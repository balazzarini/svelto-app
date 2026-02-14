// apps/api/src/modules/integrations/services/sync-scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { MercadoPagoService } from '../providers/mercadopago.service';
import { SecurityService, EncryptedData } from '../../security/security.service';
import { subHours } from 'date-fns';

@Injectable()
export class SyncSchedulerService {
  private readonly logger = new Logger(SyncSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly securityService: SecurityService,
  ) {}

  /**
   * Executa a cada 1 hora (0 * * * *)
   * Busca transações atualizadas na última hora com overlap de segurança.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlySync() {
    this.logger.log('⏰ Iniciando Job de Sincronização Horária (Mercado Pago)...');

    const activeIntegrations = await this.prisma.integration.findMany({
      where: {
        provider: 'MERCADOPAGO',
        status: 'ACTIVE',
      },
    });

    this.logger.log(`🔎 Encontradas ${activeIntegrations.length} integrações ativas.`);

    for (const integration of activeIntegrations) {
      try {
        // Define janela de tempo: Última sincronização ou última hora (com overlap)
        const settings = (integration.settings as any) || {};
        const lastSync = settings.lastSync?.transactions 
          ? new Date(settings.lastSync.transactions) 
          : subHours(new Date(), 24); // Fallback seguro

        // Overlap de 30 min para garantir que nada foi perdido na borda do tempo
        const startDate = subHours(lastSync, 0.5).toISOString();
        const endDate = new Date().toISOString();

        this.logger.log(`🔄 Sync Auto: ${integration.name} (${integration.id}) | Desde: ${startDate}`);

        const credentials = integration.credentials as unknown as EncryptedData;
        
        // Chama a lógica centralizada no Service
        const result = await this.mercadoPagoService.syncTransactions(
            integration.id,
            integration.tenantId,
            credentials,
            startDate,
            endDate,
            true // useLastUpdated = true para incremental
        );

        this.logger.log(`✅ Sync Auto Sucesso: ${result.processed} processados.`);

      } catch (error) {
        this.logger.error(`❌ Falha no Sync Auto para ${integration.name}: ${error.message}`);
        // Não interrompe o loop para outras integrações
      }
    }
  }
}
