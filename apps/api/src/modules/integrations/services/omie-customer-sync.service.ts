import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { OmieService } from '../providers/omie.service';
import { EncryptedData } from '../../security/security.service';
import { Prisma } from '@prisma/client';
import { format, subHours, parseISO } from 'date-fns';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class OmieCustomerSyncService {
  private readonly logger = new Logger(OmieCustomerSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly omieService: OmieService,
  ) {}

  async syncCustomers(integrationId: string, tenantId: string, fullSync = false) {
    this.logger.log(`🔄 Iniciando Sync Clientes (Full: ${fullSync})`);
    const integration = await this.prisma.integration.findUnique({ where: { id: integrationId, tenantId } });
    if (!integration || integration.provider !== 'OMIE') throw new Error('Integração inválida.');

    const credentials = integration.credentials as unknown as EncryptedData;
    const settings = (integration.settings as any) || {};
    
    // 1. ISOLAMENTO: Lê checkpoint de Clientes
    const lastSyncCustomers = settings.lastSync?.customers 
        ? parseISO(settings.lastSync.customers) 
        : null;

    const existingCount = await this.prisma.erpCustomer.count({ where: { integrationId } });
    if (existingCount === 0 && !fullSync) {
        this.logger.log("⚠️ Base vazia. Forçando Full Sync.");
        fullSync = true;
    }

    let filters: any = {};

    // REGRA 3: Full na carga, Incremental depois
    if (!fullSync && lastSyncCustomers) {
        // INCREMENTAL
        const safeDate = subHours(lastSyncCustomers, 24);
        filters.filtrar_por_data_de = format(safeDate, 'dd/MM/yyyy');
        filters.filtrar_apenas_alteracao = 'S';
        this.logger.log(`📅 Sync Incremental Clientes: Desde ${filters.filtrar_por_data_de}`);
    } else {
        this.logger.log(`📚 Sync Completo Clientes.`);
        filters = {}; 
    }

    let page = 1;
    const limit = 50; 
    let hasMore = true;
    let totalSynced = 0;

    while (hasMore) {
      try {
        if (page > 1) await sleep(200); 
        const currentFilters = { ...filters, pagina: page, registros_por_pagina: limit, apenas_importado_api: 'N' };

        const response = await this.omieService.listarClientes(credentials, page, limit, currentFilters);
        const clientes = response.clientes_cadastro || [];
        const totalPages = response.total_de_paginas || 0;
        
        if (clientes.length === 0) { hasMore = false; break; }

        const operations = clientes.map((cli: any) => {
            const rawDoc = cli.cnpj_cpf || '';
            const docNumber = rawDoc.replace(/\D/g, '');
            const finalDocNumber = docNumber.length > 0 ? docNumber : null;
            const docType = finalDocNumber ? (finalDocNumber.length > 11 ? 'CNPJ' : 'CPF') : null;
            
            return this.prisma.erpCustomer.upsert({
                where: { integrationId_erpId: { integrationId: integration.id, erpId: cli.codigo_cliente_omie.toString() } },
                create: {
                    tenantId, integrationId: integration.id, erpId: cli.codigo_cliente_omie.toString(),
                    erpInternalId: cli.codigo_cliente_integracao || null,
                    name: cli.razao_social || cli.nome_fantasia || 'Sem Nome',
                    docType, docNumber: finalDocNumber, email: cli.email || null,
                },
                update: {
                    name: cli.razao_social || cli.nome_fantasia || 'Sem Nome',
                    docNumber: finalDocNumber, docType: docType, email: cli.email || null,
                }
            });
        });

        if (operations.length > 0) await this.prisma.$transaction(operations);
        
        totalSynced += clientes.length;
        if (page >= totalPages) hasMore = false; else page++;

      } catch (error) {
          this.logger.error(`Erro sync clientes: ${error.message}`);
          hasMore = false; 
      }
    }
    
    // 2. GRAVA CHECKPOINT ISOLADO
    const newSettings = {
        ...settings,
        lastSync: {
            ...(settings.lastSync || {}),
            customers: new Date().toISOString()
        }
    };

    await this.prisma.integration.update({
        where: { id: integration.id },
        data: { settings: newSettings as Prisma.InputJsonValue } 
    });

    return { success: true, total: totalSynced };
  }
}