import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { addDays, subDays, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import { ErpReceivable, Transaction } from '@prisma/client';

@Injectable()
export class ConciliationService {
  private readonly logger = new Logger(ConciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runAutoMatch(tenantId: string, integrationId: string, transactionIds?: string[]) {
    // Configurações do Smart Match (Hardcoded por enquanto)
    const SMART_MATCH_MIN_SCORE = 95;
    const SMART_MATCH_ALLOW_MULTIPLE = false; // false = Apenas match automático se houver candidato único acima do score

    this.logger.log(`🕵️ Iniciando Auto-Match v16.2 (Smart Match ${SMART_MATCH_MIN_SCORE}%+)...`);

    const integration = await this.prisma.integration.findUnique({
        where: { id: integrationId, tenantId }
    });
    
    if (!integration) throw new Error("Integração não encontrada");

    const settings = integration.settings as any;
    const targetBankId = settings?.omieBankAccount?.nCodCC;

    let bankFilter: any = {};
    if (targetBankId) {
        const bankIdString = String(targetBankId).trim();
        bankFilter = { bankAccountId: bankIdString };
    }

    const whereCondition: any = {
        integrationId,
        tenantId,
        status: 'PENDING',
    };

    if (transactionIds && transactionIds.length > 0) {
        whereCondition.id = { in: transactionIds };
        this.logger.log(`🎯 Modo Focado: Processando ${transactionIds.length} transações selecionadas.`);
    }

    const pendingTransactions = await this.prisma.transaction.findMany({
      where: whereCondition,
      take: transactionIds ? undefined : 200 
    });

    this.logger.log(`🔍 Processando ${pendingTransactions.length} transações elegíveis...`);

    let matchesFound = 0;
    let candidatesGenerated = 0;
    let ignoredCount = 0;

    for (const tx of pendingTransactions) {
      // Double-check de status para evitar race conditions
      const currentTx = await this.prisma.transaction.findUnique({ where: { id: tx.id }, select: { status: true }});
      if (currentTx?.status !== 'PENDING') continue;

      // =======================================================================
      // REGRA DE OURO: AUTO-IGNORE (Limpeza de Sujeira)
      // =======================================================================
      if (tx.gatewayStatus === 'cancelled') {
          await this.prisma.transaction.update({
              where: { id: tx.id },
              data: { 
                  status: 'IGNORED', 
                  matchDescription: 'Transação cancelada' 
              }
          });
          ignoredCount++;
          this.logger.log(`🗑️ Transação ${tx.id} ignorada por estar cancelada.`);
          continue; // Pula para a próxima
      }

      if (tx.gatewayStatus === 'rejected') {
          await this.prisma.transaction.update({
              where: { id: tx.id },
              data: { 
                  status: 'IGNORED', 
                  matchDescription: 'Transação rejeitada' 
              }
          });
          ignoredCount++;
          this.logger.log(`🗑️ Transação ${tx.id} ignorada por estar rejeitada.`);
          continue; // Pula para a próxima
      }

      // =======================================================================
      // ESTRATÉGIA 1: HARD MATCH (NSU Direto)
      // =======================================================================
      let hardMatch: ErpReceivable | null = null;

      if (tx.gatewayId) {
          hardMatch = await this.prisma.erpReceivable.findFirst({
              where: {
                  tenantId,
                  status: { not: 'CANCELADO' },
                  erpNsu: tx.gatewayId,
                  ...bankFilter
              }
          });
      }

      if (hardMatch) {
          const isTaken = await this.prisma.transaction.findFirst({ 
              where: { erpId: hardMatch.erpId, id: { not: tx.id }, status: { not: 'IGNORED' } } 
          });

          if (!isTaken) {
              await this.applyMatch(tx.id, hardMatch, 'HARD_MATCH_NSU');
              this.logger.log(`✅ Auto-Match por NSU: Tx ${tx.gatewayId} vinculada ao título ${hardMatch.erpId}.`);
              matchesFound++;
              continue; 
          } else {
              this.logger.warn(`⚠️ NSU Conflitante: Tx ${tx.gatewayId} aponta para título ${hardMatch.erpId} já ocupado.`);
          }
      }

      // =======================================================================
      // ESTRATÉGIA 2: GERAÇÃO DE CANDIDATOS (Disputa)
      // =======================================================================
      // Refatoração: Algoritmo de Pontuação Unificado (Smart Match)
      // Busca ampla baseada no Valor (com tolerância) e Data (janela de 7 dias)
      // A pontuação define a qualidade do candidato.

      const tolerance = 0.02; // 5 centavos de tolerância para busca
      const minAmount = Number(tx.amountGross) - tolerance;
      const maxAmount = Number(tx.amountGross) + tolerance;

      const dateBefore = 1;
      const dateAfter = 6;
      const minDate = startOfDay(subDays(tx.dateEvent, dateBefore));
      const maxDate = endOfDay(addDays(tx.dateEvent, dateAfter));

      // Busca candidatos "brutos" no banco
      const rawCandidates = await this.prisma.erpReceivable.findMany({
        where: {
            tenantId,
            status: { not: 'CANCELADO' },
            amountValue: { gte: minAmount, lte: maxAmount },
            dateEmission: { gte: minDate, lte: maxDate },
            ...bankFilter
        },
        take: 50 // Limite de segurança
      });

      const scoredCandidates: { receivable: ErpReceivable, reason: string, score: number }[] = [];

      // Processamento em memória para pontuação granular
      for (const candidate of rawCandidates) {
          let score = 100; // Começa perfeito
          const penalties: string[] = [];

          // 1. Análise de Valor (Peso: Crítico)
          const valDiff = Math.abs(Number(tx.amountGross) - Number(candidate.amountValue));
          if (valDiff > 0.01) {
              score -= 15; // Penalidade média se passar de 1 centavo
              penalties.push(`Valor difere ${valDiff.toFixed(2)}`);
          }
          // Se for <= 0.01, penalidade é zero (considerado igual)

          // 2. Análise de Data (Peso: Alto)
          const daysDiff = Math.abs(differenceInDays(tx.dateEvent, candidate.dateEmission));
          if (daysDiff > 0) {
              if (daysDiff <= 3) {
                  score -= (daysDiff * 1.5); // Penalidade leve para dias próximos (comportamento natural)
              } else {
                  score -= (daysDiff * 5); // Penalidade pesada para datas distantes
              }
              penalties.push(`${daysDiff}d de diferença`);
          }

          // 3. Análise de Nome (Peso: Médio)
          // Só aplicamos se tivermos nome na transação para comparar
          if (tx.payerName && candidate.customerName) {
              const txTokens = tx.payerName.toLowerCase().split(/\s+/).filter(w => w.length > 1);
              const erpTokens = candidate.customerName.toLowerCase().split(/\s+/).filter(w => w.length > 1);
              
              // Conta quantas palavras do nome da transação existem no nome do ERP
              const matches = txTokens.filter(token => erpTokens.includes(token));
              
              // Consideramos Match se houver pelo menos 2 palavras coincidentes (Nome + Sobrenome)
              // Ou se houver apenas 1 palavra no total e ela bater (ex: empresas com nome único)
              const nameMatch = matches.length >= 2 || (matches.length === 1 && (txTokens.length === 1 || erpTokens.length === 1));
              
              if (!nameMatch) {
                  score -= 10; // Penalidade se o nome não bater
                  penalties.push('Nome divergente');
              }
          }

          // Filtro de Qualidade Mínima
          if (score >= 60) {
              scoredCandidates.push({
                  receivable: candidate,
                  reason: penalties.length > 0 ? penalties.join(', ') : 'Match Perfeito (Valor + Data + Nome)',
                  score: Math.round(score)
              });
          }
      }

      // Ordena pelos melhores scores
      scoredCandidates.sort((a, b) => b.score - a.score);

      if (scoredCandidates.length > 0) {
          const bestCandidate = scoredCandidates[0];
          const candidatesAboveThreshold = scoredCandidates.filter(c => c.score >= SMART_MATCH_MIN_SCORE);
          
          const hasMinScore = bestCandidate.score >= SMART_MATCH_MIN_SCORE;
          const isUnique = candidatesAboveThreshold.length === 1;

          if (hasMinScore && (isUnique || SMART_MATCH_ALLOW_MULTIPLE)) {
              await this.applyMatch(tx.id, bestCandidate.receivable, 'SMART_MATCH');
              this.logger.log(`✨ Smart Match Automático: Tx ${tx.id} vinculada com score ${bestCandidate.score}%`);
              matchesFound++;
          } else {
              await this.saveCandidates(tx, scoredCandidates);
              candidatesGenerated++;
          }
      }
    }

    this.logger.log(`🏁 Auto-Match Finalizado. ${matchesFound} Matches, ${candidatesGenerated} Disputas, ${ignoredCount} Ignorados.`);
    return { success: true, matches: matchesFound, disputes: candidatesGenerated, ignored: ignoredCount };
  }

  // --- HELPERS ---

  private async applyMatch(transactionId: string, receivable: ErpReceivable, method: string) {
      const description = `Vinculado por: ${method === 'HARD_MATCH_NSU' ? 'NSU' : 'Algoritmo'} | Pedido ${receivable.erpExternalRef || 'Sem Pedido'} | NF: ${receivable.erpDocNumber || receivable.erpId} - ${receivable.customerName || 'Cliente não identificado'}`;

      await this.prisma.transaction.update({
          where: { id: transactionId },
          data: {
              erpId: receivable.erpId,
              status: 'MATCHED', 
              matchDescription: description 
          }
      });
  }

  private async saveCandidates(tx: Transaction, candidates: { receivable: ErpReceivable, reason: string, score: number }[]) {
      await this.prisma.conciliationCandidate.deleteMany({
          where: { transactionId: tx.id }
      });

      const candidatesData = candidates.map(c => {
          return {
              transactionId: tx.id,
              erpReceivableId: c.receivable.id,
              score: c.score,
              matchReason: c.reason
          };
      });

      if (candidatesData.length > 0) {
          await this.prisma.conciliationCandidate.createMany({ data: candidatesData });

          await this.prisma.transaction.update({
              where: { id: tx.id },
              data: {
                  status: 'AMBIGUOUS',
                  matchDescription: `${candidatesData.length} candidatos. Melhor score: ${candidates[0].score}%`
              }
          });
      }
  }
}