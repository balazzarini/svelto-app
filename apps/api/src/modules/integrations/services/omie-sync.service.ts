import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { OmieService } from '../providers/omie.service';
import { SecurityService, EncryptedData } from '../../security/security.service';
import { Prisma } from '@prisma/client';
import { subDays, format, parseISO } from 'date-fns';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class OmieSyncService {
  private readonly logger = new Logger(OmieSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly omieService: OmieService,
    private readonly securityService: SecurityService,
  ) {}

  /**
   * Sincroniza Contas a Receber
   * Suporta Full Sync (Reset) ou Incremental (Deltas)
   */
  async syncReceivables(
    integrationId: string, 
    tenantId: string, 
    initialDate?: string,
    fullSync: boolean = false
  ) {
    this.logger.log(`🔄 Iniciando Sync Financeiro Omie (Integração: ${integrationId})`);

    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId, tenantId },
    });

    if (!integration || integration.provider !== 'OMIE') {
      throw new HttpException('Integração Omie inválida.', HttpStatus.NOT_FOUND);
    }

    const credentials = integration.credentials as unknown as EncryptedData;
    const settings = (integration.settings as any) || {};
    
    // 1. DEFINIÇÃO DA DATA DE CORTE
    let dataInicio: Date;
    let modoExecucao = '';

    if (fullSync || !settings.lastSync?.receivables) {
        modoExecucao = 'FULL_SYNC';
        if (initialDate) {
            dataInicio = parseISO(initialDate);
        } else {
            dataInicio = new Date('2025-01-01T00:00:00');
        }
    } else {
        modoExecucao = 'INCREMENTAL';
        const lastSyncDate = parseISO(settings.lastSync.receivables);
        dataInicio = subDays(lastSyncDate, 1);
    }

    const dataFim = new Date();

    // 2. CONFIGURAÇÃO DOS FILTROS
    const baseFilters = {
        registros_por_pagina: 50,
        apenas_importado_api: 'N',
        filtrar_por_data_de: format(dataInicio, 'dd/MM/yyyy'),
        filtrar_por_data_ate: format(dataFim, 'dd/MM/yyyy'),
        filtrar_apenas_alteracao: 'S',
        exibir_obs: 'S'
    };

    let page = 1;
    let hasMore = true;
    let totalSynced = 0;

    // 3. LOOP DE PAGINAÇÃO (CARGA FINANCEIRA)
    while (hasMore) {
      try {
        if (page > 1) await sleep(50);

        const filters = { ...baseFilters, pagina: page };

        this.logger.debug(`📄 Buscando página ${page}... Período: ${filters.filtrar_por_data_de} a ${filters.filtrar_por_data_ate}`);

        const response = await this.omieService.executeCall(
            credentials,
            'financas/contareceber/',
            'ListarContasReceber',
            filters
        );

        const titulos = response.conta_receber_cadastro || [];
        const totalPages = response.total_de_paginas || 0;
        const totalRegistros = response.total_de_registros || 0;

        if (page === 1) {
            this.logger.log(`📊 Omie retornou ${totalRegistros} registros para processar.`);
        }

        if (titulos.length === 0) {
            hasMore = false;
            break;
        }

        // 4. PROCESSAMENTO E PERSISTÊNCIA
        const operations = titulos.map((titulo: any) => {
            const parseDate = (dateStr: string) => {
                if (!dateStr) return null;
                const [d, m, y] = dateStr.split('/');
                return new Date(`${y}-${m}-${d}`);
            };

            const valorDoc = new Prisma.Decimal(titulo.valor_documento || 0);
            const valorPago = new Prisma.Decimal(titulo.valor_recebido || 0);
            
            let statusSvelto = 'EM ABERTO';
            if (titulo.cancelado === 'S') {
                statusSvelto = 'CANCELADO';
            } else if (titulo.valor_saldo_ado === 0 || (valorPago.gte(valorDoc) && valorDoc.gt(0))) {
                statusSvelto = 'RECEBIDO';
            }

            const createData: any = {
                tenantId,
                integrationId: integration.id,
                erpId: String(titulo.codigo_lancamento_omie),
                erpDocNumber: titulo.numero_documento_fiscal || titulo.boleto?.cNumBoleto || '',
                erpExternalRef: titulo.codigo_pedido_integracao || titulo.numero_pedido || '',
                erpNsu: titulo.nsu || null,
                erpControl: titulo.cPedidoCliente || null, 
                bankAccountId: titulo.id_conta_corrente ? String(titulo.id_conta_corrente) : '',
                customerId: titulo.codigo_cliente_fornecedor ? String(titulo.codigo_cliente_fornecedor) : null,
                customerName: null, 
                customerDoc: null,
                amountValue: valorDoc,
                dateDue: parseDate(titulo.data_vencimento) || new Date(),
                dateEmission: parseDate(titulo.data_emissao) || new Date(),
                datePrevision: parseDate(titulo.data_previsao) || new Date(),
                status: statusSvelto,
            };

            const updateData: any = {
                amountValue: valorDoc,
                status: statusSvelto,
                dateDue: parseDate(titulo.data_vencimento) || new Date(),
                datePrevision: parseDate(titulo.data_previsao) || new Date(),
                erpExternalRef: titulo.codigo_pedido_integracao || titulo.numero_pedido || '',
                erpNsu: titulo.nsu || null,
                erpControl: titulo.cPedidoCliente || null,
                customerId: titulo.codigo_cliente_fornecedor ? String(titulo.codigo_cliente_fornecedor) : undefined,
            };

            return this.prisma.erpReceivable.upsert({
                where: {
                    integrationId_erpId: {
                        integrationId: integration.id,
                        erpId: String(titulo.codigo_lancamento_omie)
                    }
                },
                create: createData,
                update: updateData
            });
        });

        if (operations.length > 0) {
            await this.prisma.$transaction(operations);
        }
        
        totalSynced += titulos.length;
        this.logger.log(`✅ Página ${page}/${totalPages} processada.`);

        if (page >= totalPages) { 
            hasMore = false;
        } else {
            page++;
        }

      } catch (error) {
          if (error.message && error.message.includes('não faz parte da estrutura')) {
              this.logger.error(`🔥 ERRO CRÍTICO DE PARÂMETRO OMIE: ${error.message}`);
              hasMore = false;
          } else {
              this.logger.error(`❌ Erro ao sincronizar página ${page}: ${error.message}`);
              hasMore = false; 
              throw new HttpException(`Erro no Sync Omie: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
          }
      }
    }

    // =========================================================================
    // SUB-ROTINA DE ENRIQUECIMENTO (PÓS-CARGA)
    // =========================================================================
    this.logger.log(`🔍 Executando sub-rotina de enriquecimento de dados de clientes (Bulk Local)...`);
    await this.enrichReceivablesWithCustomerData(integration.id, tenantId);

    // 5. ATUALIZAÇÃO DO CHECKPOINT
    const newSettings = {
        ...settings,
        lastSync: {
            ...(settings.lastSync || {}),
            receivables: new Date().toISOString()
        }
    };

    await this.prisma.integration.update({
        where: { id: integration.id },
        data: { 
            settings: newSettings as Prisma.InputJsonValue,
            lastSyncAt: new Date() 
        }
    });

    this.logger.log(`🏁 Sync Finalizado. Modo: ${modoExecucao}. Total: ${totalSynced}`);

    return { 
        success: true, 
        total: totalSynced, 
        mode: modoExecucao
    };
  }

  /**
   * Sub-rotina que busca títulos com ID de cliente mas sem Nome/Doc
   * e preenche usando a tabela local erp_customers
   */
  private async enrichReceivablesWithCustomerData(integrationId: string, tenantId: string) {
      // 1. Identificar títulos "órfãos"
      const whereCondition: any = {
          integrationId,
          tenantId,
          customerId: { not: null },
          OR: [
              { customerName: null },
              { customerName: '' }
          ]
      };

      const orphans = await this.prisma.erpReceivable.findMany({
          where: whereCondition,
          select: { id: true, customerId: true },
          take: 2000 
      });

      if (orphans.length === 0) {
          this.logger.log(`✅ Todos os títulos já possuem dados de cliente.`);
          return;
      }

      // 2. Extrai IDs únicos de clientes necessários e filtra nulos
      const customerIds = [...new Set(
          orphans
            .map(o => o.customerId)
            .filter((id): id is string => id !== null) // Filtra nulos e garante tipo string
      )];

      if (customerIds.length === 0) return;

      this.logger.log(`🛠️ Enriquecendo ${orphans.length} títulos. Buscando dados para ${customerIds.length} clientes na tabela local...`);

      // 3. Buscar dados na tabela erp_customers (Bulk Read)
      const customers = await this.prisma.erpCustomer.findMany({
          where: {
              integrationId,
              tenantId,
              erpId: { in: customerIds }
          },
          select: {
              erpId: true,
              name: true,
              docNumber: true
          }
      });

      // 4. Criar Mapa para acesso rápido
      const customerMap = new Map(customers.map(c => [c.erpId, c]));
      
      // Tipagem explícita do array de Promises para evitar o erro 'never'
      const updates: Prisma.PrismaPromise<any>[] = [];

      // 5. Preparar Updates
      for (const orphan of orphans) {
          if (!orphan.customerId) continue;

          // Acessa o mapa com a chave garantida como string
          const customerData = customerMap.get(orphan.customerId);

          if (customerData) {
              const updatePayload: any = {
                  customerName: customerData.name,
                  customerDoc: customerData.docNumber
              };

              updates.push(
                  this.prisma.erpReceivable.update({
                      where: { id: orphan.id },
                      data: updatePayload
                  })
              );
          }
      }

      // 6. Executar Updates em Lote
      const BATCH_SIZE = 100;
      let updatedCount = 0;
      
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
          const batch = updates.slice(i, i + BATCH_SIZE);
          if (batch.length > 0) {
            await this.prisma.$transaction(batch);
            updatedCount += batch.length;
          }
      }

      this.logger.log(`✨ Sub-rotina concluída: ${updatedCount} títulos enriquecidos com Nome/CNPJ.`);
  }
}