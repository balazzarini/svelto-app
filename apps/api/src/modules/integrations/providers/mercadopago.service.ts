import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { SecurityService, EncryptedData } from '../../security/security.service';
import { lastValueFrom } from 'rxjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);
  private readonly BASE_URL = 'https://api.mercadopago.com';

  constructor(
    private readonly httpService: HttpService,
    private readonly securityService: SecurityService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Busca pagamentos no Mercado Pago.
   * Suporta busca por data de criação (Carga Inicial) ou última atualização (Incremental).
   */
  async fetchPayments(
    encryptedToken: EncryptedData, 
    dateStart: string, 
    dateEnd: string,
    useLastUpdated = false
  ) {
    const accessToken = this.securityService.decrypt(encryptedToken);
    
    let offset = 0;
    const limit = 50;
    let hasMore = true;
    const allTransactions: Prisma.TransactionCreateInput[] = [];

    // Define critério de busca: 'date_last_updated' para incremental, 'date_created' para carga inicial
    const rangeCriteria = useLastUpdated ? 'date_last_updated' : 'date_created';

    try {
      while (hasMore) {
        this.logger.debug(`Buscando pagamentos MP... Offset: ${offset}, Criteria: ${rangeCriteria}`);

        const response = await lastValueFrom(
          this.httpService.get(`${this.BASE_URL}/v1/payments/search`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: {
              sort: rangeCriteria,
              criteria: 'asc', // Ordem cronológica para garantir integridade do histórico
              range: rangeCriteria,
              begin_date: dateStart,
              end_date: dateEnd,
              limit: limit,
              offset: offset,
            },
          }),
        );

        const pageResults = response.data.results || [];
        const paging = response.data.paging;

        const mappedPage = pageResults.map((p: any) => this.mapToTransactionSchema(p));
        allTransactions.push(...mappedPage);

        // Verifica paginação
        if (pageResults.length < limit || (paging && offset + limit >= paging.total)) {
          hasMore = false;
        } else {
          offset += limit;
          // Safety break para evitar loops infinitos em testes
          if (offset > 10000) {
             this.logger.warn('Limite de segurança de 10k registros atingido no loop.');
             hasMore = false; 
          }
        }
      }
      
      this.logger.log(`Total de transações recuperadas do MP: ${allTransactions.length}`);
      return allTransactions;

    } catch (error) {
      this.logger.error(`Erro ao buscar pagamentos no Mercado Pago: ${error.message}`, error.response?.data);
      throw error;
    }
  }

  /**
   * CORE: Orquestra a busca e a persistência com regras de negócio (State Locking).
   * Substitui a lógica que estava no Controller.
   */
  async syncTransactions(
    integrationId: string,
    tenantId: string,
    credentials: EncryptedData,
    startDate: string,
    endDate: string,
    useLastUpdated: boolean
  ) {
    // 1. Busca Dados na API
    const transactions = await this.fetchPayments(credentials, startDate, endDate, useLastUpdated);
    
    if (transactions.length === 0) {
        return { processed: 0, message: "Nenhuma transação nova encontrada." };
    }

    // 2. Otimização de Leitura (Evita N+1)
    const gatewayIds = transactions.map(t => t.gatewayId);
    const existingTransactions = await this.prisma.transaction.findMany({
      where: { integrationId: integrationId, gatewayId: { in: gatewayIds } },
      select: { 
          gatewayId: true, 
          status: true, 
          statusDetail: true, 
          erpId: true,
          moneyReleaseDate: true, // Importante para a regra de persistência
          moneyVoidDate: true,
          financialStatus: true
      } 
    });
    const existingStatusMap = new Map(existingTransactions.map(t => [t.gatewayId, t]));

    // 3. Processamento com Regras de Negócio
    const operations = transactions.map((txData) => {
       const existing = existingStatusMap.get(txData.gatewayId);
       let updateData: any = { ...txData }; 
       
       // Limpeza de campos relacionais para update
       delete updateData.gatewayId; 
       delete updateData.integration; 
       delete updateData.tenant;

       // REGRA DE OURO: Proteção do moneyReleaseDate e Histórico de Estorno
       // Se já tínhamos uma data de liberação (dinheiro entrou), e o MP manda uma nova data num contexto de estorno,
       // essa nova data é a data da SAÍDA (Void), não a substituição da entrada.
       if (existing?.moneyReleaseDate && (!txData.moneyReleaseDate || txData.moneyReleaseDate !== existing.moneyReleaseDate)) {
           if (['charged_back', 'refunded', 'in_mediation'].includes(txData.gatewayStatus || '')) {
               // 1. Preserva a data original da entrada
               updateData.moneyReleaseDate = existing.moneyReleaseDate;
               
               // 2. Salva a data do evento de estorno no novo campo (se o MP enviou uma data nova)
               if (txData.moneyReleaseDate) {
                   updateData.moneyVoidDate = txData.moneyReleaseDate;
               }
           }
       }

       // Definição do Status Financeiro
       const isReleased = txData.moneyReleaseStatus === 'released';
       const moneyReleaseDate = updateData.moneyReleaseDate ? new Date(updateData.moneyReleaseDate) : null;
       const isDatePassed = moneyReleaseDate && moneyReleaseDate <= new Date();
       
       let calculatedFinancialStatus: any = 'OPEN';
       if (isReleased || isDatePassed) {
           calculatedFinancialStatus = 'SETTLED';
       }
       
       updateData.financialStatus = calculatedFinancialStatus;
       
       if (existing) {
           const newDetail = txData.statusDetail || '';
           const newGatewayStatus = txData.gatewayStatus || '';

           // Máquina de Estados de Disputa (RN05/RN06)
           if (newDetail === 'in_process' || newGatewayStatus === 'in_mediation') {
               updateData.status = 'AMBIGUOUS'; 
               updateData.matchDescription = '⚠️ Disputa de Chargeback Aberta. Valor bloqueado.';
               updateData.financialStatus = 'BLOCKED';
           }
           else if (newDetail === 'settled' || newGatewayStatus === 'charged_back') {
               updateData.status = 'CHARGEBACK';
               updateData.matchDescription = 'Perda Confirmada (Chargeback). Necessário vincular Contas a Pagar.';
               updateData.financialStatus = 'REVERSED';
           }
           else if (newGatewayStatus === 'refunded' || newDetail === 'refunded') {
               updateData.status = 'REFUNDED'; // NOVO STATUS: Sem ambiguidade
               updateData.matchDescription = 'Reembolso Voluntário. Dinheiro devolvido.';
               updateData.financialStatus = 'REVERSED';
           }
       }

       return this.prisma.transaction.upsert({
          where: { integrationId_gatewayId: { integrationId: integrationId, gatewayId: txData.gatewayId } },
          create: { ...txData, financialStatus: calculatedFinancialStatus, tenant: { connect: { id: tenantId } }, integration: { connect: { id: integrationId } } },
          update: updateData
       });
    });

    // 4. Execução em Lote
    const BATCH_SIZE = 50; 
    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
        await this.prisma.$transaction(operations.slice(i, i + BATCH_SIZE));
    }

    // 5. Atualização do Checkpoint na Integração
    const currentIntegration = await this.prisma.integration.findUnique({ where: { id: integrationId } });
    const currentSettings = (currentIntegration?.settings as any) || {};
    const newSettings = { ...currentSettings, lastSync: { ...(currentSettings.lastSync || {}), transactions: new Date().toISOString() } };
    
    await this.prisma.integration.update({ 
        where: { id: integrationId }, 
        data: { settings: newSettings as Prisma.InputJsonValue, lastSyncAt: new Date() } 
    });

    return { processed: transactions.length };
  }

  /**
   * Mapeia o payload bruto do Mercado Pago para o Schema do Prisma (Transaction).
   * Realiza a "Explosão de Taxas" (Fee Explosion) e captura dados de inteligência.
   */
  private mapToTransactionSchema(mpData: any): Prisma.TransactionCreateInput {
    let mdrFee = 0;
    let financingFee = 0;
    let shippingFee = 0;
    let taxAmount = 0;
    let couponAmount = 0;

    // Decompõe as taxas do array fee_details
    if (mpData.fee_details && Array.isArray(mpData.fee_details)) {
      mpData.fee_details.forEach((fee: any) => {
        switch (fee.type) {
          case 'mercadopago_fee':
            mdrFee += fee.amount;
            break;
          case 'financing_fee':
            financingFee += fee.amount;
            break;
          case 'shipping_fee':
            shippingFee += fee.amount;
            break;
          case 'coupon_fee':
            couponAmount += fee.amount;
            break;
          case 'application_fee':
            // Se houver taxa de aplicação (marketplace), somamos ao MDR por enquanto
            mdrFee += fee.amount;
            break;
          default:
            // Outras taxas caem no MDR genérico para garantir que o líquido bata
            mdrFee += fee.amount;
            break;
        }
      });
    }

    // Captura impostos retidos na fonte, se houver
    if (mpData.taxes_amount) {
        taxAmount = mpData.taxes_amount;
    }

    // Lógica inteligente para capturar o nome do pagador
    // CORREÇÃO AQUI: Tipagem explícita para evitar erro TS2322
    let finalPayerName: string | null = null;
    
    if (mpData.additional_info?.payer?.first_name) {
        const first = mpData.additional_info.payer.first_name;
        const last = mpData.additional_info.payer.last_name || '';
        finalPayerName = `${first} ${last}`.trim();
    } else if (mpData.payer?.first_name) {
        const first = mpData.payer.first_name;
        const last = mpData.payer.last_name || '';
        finalPayerName = `${first} ${last}`.trim();
    } else if (mpData.payer?.email) {
        // Fallback para email se não tiver nome
        finalPayerName = mpData.payer.email;
    }

    // Monta o objeto final
    return {
      gatewayId: mpData.id.toString(),
      externalReference: mpData.external_reference || null,
      authorizationCode: mpData.authorization_code || null,
      
      // NOVO: Collector ID (Para identificar quem recebeu e fazer auto-discovery de loja)
      collectorId: mpData.collector_id ? mpData.collector_id.toString() : null,

      // NOVO: Tipo de Operação (Vital para filtrar "money_transfer" vs "regular_payment")
      operationType: mpData.operation_type || null,

      // Datas
      dateEvent: new Date(mpData.date_created),
      dateEstimated: mpData.money_release_date ? new Date(mpData.money_release_date) : null,
      
      // NOVO: Dados de Liquidação e Fluxo de Caixa
      moneyReleaseDate: mpData.money_release_date ? new Date(mpData.money_release_date) : null,
      moneyReleaseStatus: mpData.money_release_status || null, // "released", "pending"

      // Valores Monetários (Decimal)
      amountGross: mpData.transaction_amount,
      amountNetGateway: mpData.transaction_details?.net_received_amount || 0,
      
      // NOVO: Valor pago pelo cliente (para detectar juros embutidos ou pagos pelo cliente)
      amountPaidByCustomer: mpData.transaction_details?.total_paid_amount || mpData.transaction_amount,

      // Detalhamento de Taxas (Fee Explosion)
      amountMdrFee: mdrFee, 
      amountFinancingFee: financingFee,
      amountShippingFee: shippingFee,
      amountTaxes: taxAmount,
      amountCoupon: couponAmount,
      
      // NOVO: Salva o JSON bruto para auditoria forense futura (Deep Research)
      rawDetails: mpData as any,

      // Dados do Pagador (Com a lógica aprimorada)
      payerDocType: mpData.payer?.identification?.type || null,
      payerDocNumber: mpData.payer?.identification?.number || null,
      payerEmail: mpData.payer?.email || null,
      payerName: finalPayerName,
      
      // Metadados
      paymentMethod: mpData.payment_method_id || 'unknown',
      installments: mpData.installments || 1,
      
      // NOVO: Gestão de Status Dupla (Gateway vs Svelto)
      gatewayStatus: mpData.status, // Status original (approved, rejected, etc)
      status: 'PENDING',            // Status interno Svelto (controle de fluxo)
      statusDetail: mpData.status_detail || null,
      
      // Relacionamentos (serão conectados no Controller/Service de Sync)
      tenant: undefined, 
      integration: undefined 
    } as any; 
  }
}