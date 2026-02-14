import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { startOfDay, endOfDay, subDays, addDays, differenceInDays, parseISO, format } from 'date-fns';
import { OmieService } from '../integrations/providers/omie.service';
import { EncryptedData } from '../security/security.service';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private prisma: PrismaService,
    private omieService: OmieService
  ) {}

  async findAll(params: any) { 
    const { tenantId, page = 1, limit = 50, status, search, dateStart, dateEnd, sort } = params;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);
    const where: Prisma.TransactionWhereInput = { tenantId };

    if (status && status !== '' && status !== 'ALL') {
        if (status.includes(',')) {
            const statusList = status.split(',');
            where.status = { in: statusList as any[] };
        } else {
            where.status = status as any;
        }
    }

    if (dateStart) {
        const start = startOfDay(parseISO(dateStart));
        const end = dateEnd ? endOfDay(parseISO(dateEnd)) : endOfDay(parseISO(dateStart));
        where.dateEvent = { gte: start, lte: end };
    }

    if (search) {
      const searchDecimal = !isNaN(Number(search)) ? Number(search) : undefined;
      where.OR = [
        { gatewayId: { contains: search, mode: 'insensitive' } },
        { authorizationCode: { contains: search, mode: 'insensitive' } },
        { externalReference: { contains: search, mode: 'insensitive' } },
        { payerName: { contains: search, mode: 'insensitive' } },
        ...(searchDecimal ? [
            { amountGross: { equals: searchDecimal } },
            { amountPaidByCustomer: { equals: searchDecimal } }
        ] : [])
      ];
    }

    let orderBy: any = { dateEvent: 'desc' }; 
    if (sort) {
        const [field, direction] = sort.split('.');
        const allowedFields = ['dateEvent', 'amountGross', 'status', 'payerName', 'amountMdrFee', 'moneyReleaseDate'];
        if (allowedFields.includes(field) && ['asc', 'desc'].includes(direction)) {
            orderBy = { [field]: direction };
        }
    }

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where, skip, take, orderBy,
        include: { candidates: { take: 1, select: { id: true } } }
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { data, meta: { total, page: Number(page), lastPage: Math.ceil(total / take), limit: take } };
  }

  async getDashboardStats(tenantId: string) {
    const stats = await this.prisma.transaction.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { id: true },
        _sum: { amountGross: true }
    });
    const totalCount = stats.reduce((acc, curr) => acc + curr._count.id, 0);
    const totalVolume = stats.reduce((acc, curr) => acc + (Number(curr._sum.amountGross) || 0), 0);
    const byStatus = stats.reduce((acc, curr) => { acc[curr.status] = curr._count.id; return acc; }, {} as Record<string, number>);
    return { total: totalCount, volumeTotal: totalVolume, byStatus };
  }

  async findCandidates(tenantId: string, transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction) throw new NotFoundException("Transação não encontrada");

    const persistedCandidates = await this.prisma.conciliationCandidate.findMany({
      where: { transactionId },
      include: { erpReceivable: true },
      orderBy: { score: 'desc' }
    });
    if (persistedCandidates.length > 0) return persistedCandidates;

    const minDateName = startOfDay(subDays(transaction.dateEvent, 1));
    const maxDateName = endOfDay(addDays(transaction.dateEvent, 5));
    const minDateBroad = startOfDay(subDays(transaction.dateEvent, 1));
    const maxDateBroad = endOfDay(addDays(transaction.dateEvent, 7));

    let liveCandidatesMap = new Map<string, any>();

    if (transaction.payerName) {
        const firstName = transaction.payerName.split(' ')[0]?.trim();
        const cleanName = firstName?.replace(/[^a-zA-Z0-9]/g, '');
        if (cleanName && cleanName.length > 2) {
             const nameCandidates = await this.prisma.erpReceivable.findMany({
                where: {
                    tenantId,
                    status: { not: 'CANCELADO' },
                    amountValue: { equals: transaction.amountGross },
                    dateEmission: { gte: minDateName, lte: maxDateName },
                    customerName: { contains: cleanName, mode: 'insensitive' }
                }
             });
             nameCandidates.forEach(c => {
                 liveCandidatesMap.set(c.id, { 
                     id: 'temp-name-' + c.id, score: 90, 
                     matchReason: `(Live) Nome (${cleanName}) + Valor`, erpReceivable: c
                 });
             });
        }
    }
    const valueCandidates = await this.prisma.erpReceivable.findMany({
      where: {
        tenantId,
        status: { not: 'CANCELADO' },
        amountValue: { equals: transaction.amountGross },
        dateEmission: { gte: minDateBroad, lte: maxDateBroad }
      },
      take: 20
    });
    valueCandidates.forEach(c => {
        if (!liveCandidatesMap.has(c.id)) {
            const diffDays = Math.abs(differenceInDays(transaction.dateEvent, c.dateEmission));
            const score = Math.max(70 - (diffDays * 5), 10);
            liveCandidatesMap.set(c.id, {
                id: 'temp-val-' + c.id, score: score,
                matchReason: `(Live) Valor Exato (${diffDays}d dif)`, erpReceivable: c
            });
        }
    });
    return Array.from(liveCandidatesMap.values()).sort((a, b) => b.score - a.score);
  }

  async resolveCandidate(tenantId: string, transactionId: string, erpReceivableId: string) {
     const transaction = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction) throw new NotFoundException("Transação não encontrada");
    
    const receivable = await this.prisma.erpReceivable.findUnique({ where: { id: erpReceivableId } });
    if (!receivable || receivable.status !== 'EM ABERTO') throw new BadRequestException("Este título já foi conciliado ou não está mais disponível.");

    return this.prisma.$transaction(async (tx) => {
      const description = `Conciliado manualmente com título ${receivable.erpDocNumber || receivable.erpId} - Cliente: ${receivable.customerName || 'N/A'}`;
      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'MATCHED', erpId: receivable.erpId, erpStatus: receivable.status, matchDescription: description
        }
      });
      await tx.conciliationCandidate.deleteMany({ where: { transactionId } });
      return { success: true };
    });
  }

  async ignoreTransactions(tenantId: string, ids: string[]) {
    if (!ids.length) return { count: 0 };
    const result = await this.prisma.transaction.updateMany({
        where: { id: { in: ids }, tenantId, status: { notIn: ['CONCILIATED', 'PAID_OUT'] } },
        data: { status: 'IGNORED', matchDescription: 'Ignorado manualmente pelo usuário' }
    });
    return { count: result.count };
  }

  async restoreTransactions(tenantId: string, ids: string[]) {
    if (!ids.length) return { count: 0 };
    const result = await this.prisma.transaction.updateMany({
        where: { id: { in: ids }, tenantId, status: 'IGNORED' },
        data: { status: 'PENDING', matchDescription: null }
    });
    return { count: result.count };
  }

  async unmatchTransaction(tenantId: string, transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction) throw new NotFoundException("Transação não encontrada");
    if (['CONCILIATED', 'PAID_OUT'].includes(transaction.status)) {
        throw new BadRequestException("Não é possível desfazer o vínculo de uma transação já conciliada ou paga.");
    }
    await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'PENDING', erpId: null, erpStatus: null, matchDescription: null }
    });
    this.logger.log(`↩️ Transação ${transactionId} teve o vínculo desfeito (Unmatch).`);
    return { success: true };
  }


  // ===========================================================================
  // CORREÇÃO: BAIXA FINANCEIRA COM TOLERÂNCIA DE 0.01 E TRATAMENTO DE ERRO 103
  // ===========================================================================
  async settleTransaction(tenantId: string, transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { integration: true }
    });

    if (!transaction) throw new NotFoundException("Transação não encontrada");

    if (transaction.status !== 'MATCHED') {
        throw new BadRequestException(`Transação não está pronta para baixa (Status: ${transaction.status}).`);
    }
    
    if (!transaction.erpId) {
        throw new BadRequestException("Nenhum título do ERP vinculado.");
    }

    const erpReceivable = await this.prisma.erpReceivable.findFirst({
        where: { 
            tenantId,
            erpId: transaction.erpId 
        }
    });

    if (!erpReceivable) {
        throw new BadRequestException("Título (ErpReceivable) não encontrado no banco local.");
    }

    const settings = transaction.integration.settings as any || {};
    const targetAccountId = settings.omieBankAccount?.nCodCC;

    if (!targetAccountId) {
        throw new BadRequestException("Conta Corrente do Omie não configurada.");
    }

    const omieIntegration = await this.prisma.integration.findFirst({
        where: { tenantId, provider: 'OMIE', status: 'ACTIVE' }
    });

    if (!omieIntegration) {
        throw new BadRequestException("Integração Omie não encontrada.");
    }
    
    const omieCredentials = omieIntegration.credentials as unknown as EncryptedData;

    // --- CÁLCULO FINANCEIRO ---
    const mpGross = Number(transaction.amountGross);
    const omieValue = Number(erpReceivable.amountValue);
    const mpNet = Number(transaction.amountNetGateway);

    let valBaixaBruto = mpGross;
    
    const diff = Number((mpGross - omieValue).toFixed(2));
    
    if (diff > 0) {
        if (diff <= 0.01) {
            this.logger.warn(`⚠️ Ajuste de Centavo: Tx ${transaction.gatewayId}. MP (${mpGross}) > Omie (${omieValue}).`);
            valBaixaBruto = omieValue;
        } else {
             throw new BadRequestException(`Divergência de valor (${diff.toFixed(2)}) excede tolerância de 0.01. MP: ${mpGross} vs ERP: ${omieValue}.`);
        }
    }

    const taxaCalculada = valBaixaBruto - mpNet;

    const dataBaixa = transaction.moneyReleaseDate 
        ? format(new Date(transaction.moneyReleaseDate), 'dd/MM/yyyy') 
        : format(new Date(), 'dd/MM/yyyy');

    try {
        // ETAPA 1: Baixar Título
        await this.omieService.lancarRecebimento(
            omieCredentials,
            {
                codigo_lancamento: Number(transaction.erpId),
                codigo_conta_corrente: Number(targetAccountId),
                valor: valBaixaBruto, 
                desconto: 0, 
                data: dataBaixa,
                observacao: `Svelto Baixa | Gateway: ${transaction.gatewayId}`,
                conciliar_documento: 'S'
            }
        );

        // ETAPA 2: Lançar Taxa
        // ETAPA 2: Lançar Taxa na Conta Corrente
        if (taxaCalculada > 0) {
            const taxaKey = `TAX-${transaction.gatewayId}`;
            const taxaPayload = {
                cCodIntLanc: taxaKey,
                cabecalho: {
                    nCodCC: Number(targetAccountId),
                    dDtLanc: dataBaixa,
                    nValorLanc: Number(taxaCalculada.toFixed(2)),
                },
                detalhes: {
                    cCodCateg: "2.01.93", 
                    cTipo: "DEB" as const,
                    cNumDoc: erpReceivable.erpExternalRef || undefined,
                    cObs: `Svelto Taxa | NSU: ${transaction.gatewayId}`
                    // nCodCliente REMOVIDO para não sujar extrato do cliente
                }
            };

            // 2.A: Incluir Lançamento
            await this.omieService.incluirLancamentoContaCorrente(omieCredentials, taxaPayload);

            // 2.B: Alterar Lançamento (Garantia de Conciliação)
            // Chamamos a alteração usando a mesma chave de integração para forçar o status conciliado
            try {
                await this.omieService.alterarLancamentoContaCorrente(omieCredentials, taxaPayload);
            } catch (err) {
                this.logger.warn(`⚠️ Falha ao confirmar conciliação da taxa (AlterarLancCC), mas inclusão ocorreu. Erro: ${err.message}`);
                // Não falha o processo todo se apenas a confirmação falhar, pois o dinheiro já saiu
            }
        }


        // Atualização de Status
        await this.prisma.transaction.update({
            where: { id: transactionId },
            data: {
                status: 'CONCILIATED',
                erpStatus: 'LIQUIDADO',
                matchDescription: `Baixado em ${dataBaixa}. (Bruto: ${valBaixaBruto.toFixed(2)} - Taxa: ${taxaCalculada.toFixed(2)})`
            }
        });

        await this.prisma.erpReceivable.update({
            where: { id: erpReceivable.id },
            data: { status: 'LIQUIDADO' }
        });

        this.logger.log(`💰 Baixa Completa: Tx ${transaction.gatewayId} | Taxa: ${taxaCalculada.toFixed(2)}`);
        return { success: true };

    } catch (error) {
        // CORREÇÃO: Tratamento robusto de Idempotência (Inclui Client-103)
        const errorMessage = error.message?.toLowerCase() || '';
        const faultString = error.response?.data?.faultstring?.toLowerCase() || '';
        const faultCode = error.response?.data?.faultcode?.toLowerCase() || '';
        
        if (
            errorMessage.includes("baixado") || 
            errorMessage.includes("liquidado") || 
            errorMessage.includes("encerrada") ||
            errorMessage.includes("client-103") || // Erro SOAP específico do Omie
            faultString.includes("liquidado") ||
            faultString.includes("baixado") ||
            faultCode.includes("client-103")
        ) {
             this.logger.warn(`⚠️ Título já baixado (Idempotência): ${transaction.erpId}`);
             
             await this.prisma.transaction.update({
                where: { id: transactionId },
                data: { 
                    status: 'CONCILIATED', 
                    erpStatus: 'LIQUIDADO', 
                    matchDescription: 'Sincronizado (Já estava baixado no Omie)' 
                }
            });
            return { success: true, message: "Título já estava baixado. Status sincronizado." };
        }
        
        throw error;
    }
  }
  async getPendingIds(tenantId: string, integrationId?: string) {
      const where: Prisma.TransactionWhereInput = {
          tenantId,
          status: 'PENDING',
          // Opcional: Filtro por integração se passado
          ...(integrationId ? { integrationId } : {})
      };

      const transactions = await this.prisma.transaction.findMany({
          where,
          select: { id: true } // Leitura super rápida
      });

      return transactions.map(t => t.id);
  }
}