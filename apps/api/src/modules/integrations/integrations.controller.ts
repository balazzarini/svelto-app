import { 
  Body, Controller, Post, Patch, Get, Param, HttpException, HttpStatus, Logger, ParseUUIDPipe
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; 
import { MercadoPagoService } from './providers/mercadopago.service';
import { OmieService } from './providers/omie.service';
import { OmieSyncService } from './services/omie-sync.service'; 
import { OmieCustomerSyncService } from './services/omie-customer-sync.service'; 
import { SecurityService, EncryptedData } from '../security/security.service';
import { Prisma } from '@prisma/client';
import { ConciliationService } from '../conciliation/conciliation.service';
import { subMinutes } from 'date-fns';

interface SyncPayload {
  initialDate?: string; 
  fullSync?: boolean;   
}

@Controller('integrations')
export class IntegrationsController {
  private readonly logger = new Logger(IntegrationsController.name);

  // Tenant ID fixo (Ambiente Produção/Homo)
  private readonly CURRENT_TENANT_ID = '69711ece-3857-4f6d-b623-c72a91adef86';

  constructor(
    private readonly prisma: PrismaService,
    private readonly mercadoPagoService: MercadoPagoService,
    private readonly omieService: OmieService,
    private readonly omieSyncService: OmieSyncService,
    private readonly omieCustomerSyncService: OmieCustomerSyncService,
    private readonly securityService: SecurityService,
    private readonly conciliationService: ConciliationService
  ) {}

  // ===========================================================================
  // 0. STATUS GERAL
  // ===========================================================================
  @Get('status')
  async getLastSyncStatus() {
    const lastIntegration = await this.prisma.integration.findFirst({
      where: {
        tenantId: this.CURRENT_TENANT_ID,
        status: 'ACTIVE',
        lastSyncAt: { not: null }
      },
      orderBy: { lastSyncAt: 'desc' },
      select: { lastSyncAt: true, status: true }
    });

    return {
      lastRun: lastIntegration?.lastSyncAt || null,
      status: lastIntegration?.status || 'PENDING'
    };
  }

  // ===========================================================================
  // 1. GESTÃO DE INTEGRAÇÕES (CRUD)
  // ===========================================================================
  @Post()
  async createIntegration(@Body() body: { name: string; token: string; provider?: string }) {
    if (!body.token || !body.name) {
      throw new HttpException('Nome e Token são obrigatórios', HttpStatus.BAD_REQUEST);
    }
    const provider = body.provider || 'MERCADOPAGO';
    const encryptedCredentials = this.securityService.encrypt(body.token);

    const integration = await this.prisma.integration.create({
      data: {
        tenantId: this.CURRENT_TENANT_ID,
        name: body.name,
        provider: provider as any,
        status: 'ACTIVE',
        credentials: encryptedCredentials as unknown as Prisma.InputJsonValue, 
      },
    });
    return { success: true, id: integration.id };
  }

  @Patch(':id')
  async updateIntegration(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { token?: string; name?: string }
  ) {
    const integration = await this.prisma.integration.findUnique({ where: { id } });

    if (!integration) {
        throw new HttpException('Integração não encontrada.', HttpStatus.NOT_FOUND);
    }

    const data: any = {};
    if (body.name) data.name = body.name;
    
    if (body.token) {
        this.logger.log(`🔐 Atualizando token da integração ${id}...`);
        data.credentials = this.securityService.encrypt(body.token) as unknown as Prisma.InputJsonValue;
    }

    if (integration.tenantId !== this.CURRENT_TENANT_ID) {
        this.logger.warn(`⚠️ Migrando integração ${id} do tenant ${integration.tenantId} para ${this.CURRENT_TENANT_ID}`);
        data.tenantId = this.CURRENT_TENANT_ID;
    }

    await this.prisma.integration.update({
        where: { id },
        data
    });

    return { success: true, message: 'Integração atualizada com sucesso.' };
  }

  @Post(':id/settings')
  async updateIntegrationSettings(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) { 
      const integration = await this.prisma.integration.findUnique({ where: { id } });
      if (!integration) throw new HttpException('Integração não encontrada', HttpStatus.NOT_FOUND);
      
      const currentSettings = integration.settings as any || {};
      const newSettings = { ...currentSettings, omieBankAccount: { nCodCC: body.omieAccountId, descricao: body.omieAccountName } };
      
      await this.prisma.integration.update({ where: { id: integration.id }, data: { settings: newSettings as Prisma.InputJsonValue } });
      return { success: true, settings: newSettings };
  }
  
  @Get('omie/accounts')
  async listOmieAccounts() {
    const omieIntegration = await this.prisma.integration.findFirst({
      where: { tenantId: this.CURRENT_TENANT_ID, provider: 'OMIE', status: 'ACTIVE' }
    });
    if (!omieIntegration) throw new HttpException('Integração Omie não encontrada.', HttpStatus.NOT_FOUND);
    try {
      const credentials = omieIntegration.credentials as unknown as EncryptedData;
      const rawAccounts = await this.omieService.listarContasCorrentes(credentials);
      return rawAccounts.map(acc => ({ id: acc.nCodCC, name: acc.descricao, bankCode: acc.codigo_banco, agency: acc.agencia, account: acc.conta_corrente }));
    } catch (error) {
      throw new HttpException('Falha ao comunicar com Omie.', HttpStatus.BAD_GATEWAY);
    }
  }

  // ===========================================================================
  // 2. ORQUESTRAÇÃO DE SYNC (Vendas)
  // ===========================================================================
  
  // SYNC MP MANUAL
  @Post(':id/sync')
  async syncIntegration(@Param('id', ParseUUIDPipe) id: string, @Body() body: SyncPayload) {
    this.logger.log(`Iniciando Sync MP para ${id}`);
    return this.runSyncMpLogic(id, body);
  }

  // SYNC OMIE (Recebíveis)
  @Post(':id/sync-omie')
  async syncOmieIntegration(@Param('id', ParseUUIDPipe) id: string, @Body() body: SyncPayload) {
    const integration = await this.prisma.integration.findUnique({ where: { id } });
    if (!integration || integration.provider !== 'OMIE') throw new HttpException('Integração Omie inválida.', HttpStatus.NOT_FOUND);
    
    const settings = (integration.settings as any) || {};
    if (!settings.lastSync?.receivables && !body.initialDate && !body.fullSync) {
       throw new HttpException('Carga Inicial Omie: O parâmetro "initialDate" é obrigatório.', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.omieSyncService.syncReceivables(id, this.CURRENT_TENANT_ID, body.initialDate, body.fullSync);
      return { success: true, data: result };
    } catch (error) {
      throw new HttpException(error.message, error.status || 500);
    }
  }

  // SYNC CLIENTES
  @Post(':id/sync-customers')
  async syncCustomers(@Param('id', ParseUUIDPipe) id: string, @Body() body: SyncPayload) {
    try {
      const result = await this.omieCustomerSyncService.syncCustomers(id, this.CURRENT_TENANT_ID, body.fullSync);
      return { success: true, data: result };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // MATCH MAKER
  @Post(':id/match')
  async runMatchMaker(
      @Param('id', ParseUUIDPipe) id: string,
      @Body() body: { ids?: string[] } 
  ) { 
      return this.conciliationService.runAutoMatch(this.CURRENT_TENANT_ID, id, body?.ids);
  }

  // FULL SYNC ORCHESTRATOR
  @Post(':id/full-sync')
  async runFullSync(@Param('id', ParseUUIDPipe) id: string) {
      this.logger.log(`🚀 Iniciando Full Sync Orchestration para ${id}`);
      
      const mpIntegration = await this.prisma.integration.findUnique({ where: { id } });
      const omieIntegration = await this.prisma.integration.findFirst({ 
          where: { tenantId: this.CURRENT_TENANT_ID, provider: 'OMIE', status: 'ACTIVE' } 
      });

      if (!mpIntegration) throw new HttpException('Integração MP não encontrada', HttpStatus.NOT_FOUND);
      if (!omieIntegration) throw new HttpException('Integração Omie não encontrada. Configure-a primeiro.', HttpStatus.PRECONDITION_FAILED);

      try {
          this.logger.log("1/3 Sync Gateway (Incremental com Overlap)...");
          await this.runSyncMpLogic(mpIntegration.id, { fullSync: false }); 

          this.logger.log("2/3 Sync Clientes...");
          await this.omieCustomerSyncService.syncCustomers(omieIntegration.id, this.CURRENT_TENANT_ID, false);

          this.logger.log("3/3 Sync Títulos...");
          await this.omieSyncService.syncReceivables(omieIntegration.id, this.CURRENT_TENANT_ID, undefined, false);

          return { success: true, message: "Ciclo de atualização completo finalizado." };
      } catch (error) {
          this.logger.error(`Falha no Full Sync: ${error.message}`);
          throw new HttpException(`Erro no ciclo de atualização: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
      }
  }

  // ===========================================================================
  // 3. LÓGICA CORE DE INGESTÃO MERCADO PAGO
  // ===========================================================================
  private async runSyncMpLogic(id: string, body: SyncPayload) {
      const integration = await this.prisma.integration.findUnique({ where: { id } });
      if (!integration) throw new HttpException('Integração não encontrada.', HttpStatus.NOT_FOUND);
      
      const settings = (integration.settings as any) || {};
      const lastSyncTransactions = settings.lastSync?.transactions;
      
      let startDate: string;
      const endDate = new Date().toISOString();
      let useLastUpdated = false;

      if (lastSyncTransactions && !body.fullSync) {
        // Overlap de 30 minutos para segurança em incremental
        const lastSyncDate = new Date(lastSyncTransactions);
        const safeStartDate = subMinutes(lastSyncDate, 30);
        startDate = safeStartDate.toISOString();
        useLastUpdated = true;
        this.logger.log(`🔄 Incremental Seguro: Buscando update desde ${startDate}`);
      } else {
        startDate = body.initialDate ? new Date(body.initialDate).toISOString() : new Date('2025-01-01').toISOString();
        useLastUpdated = false;
        this.logger.log(`📚 Carga Inicial: Criados desde ${startDate}`);
      }

      const credentials = integration.credentials as unknown as EncryptedData;
      
      // Delega para o Service (Refatorado)
      return this.mercadoPagoService.syncTransactions(
        integration.id,
        this.CURRENT_TENANT_ID,
        credentials,
        startDate,
        endDate,
        useLastUpdated
      );
  }
}