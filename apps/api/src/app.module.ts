import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config'; // <--- Importe aqui
import { SecurityService } from './modules/security/security.service';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { MercadoPagoService } from './modules/integrations/providers/mercadopago.service';
import { IntegrationsController } from './modules/integrations/integrations.controller'; // <--- Importe o Controller
import { PrismaService } from './prisma/prisma.service';
import { OmieService } from './modules/integrations/providers/omie.service';
import { OmieSyncService } from './modules/integrations/services/omie-sync.service';
import { ConciliationService } from './modules/conciliation/conciliation.service';
import { OmieCustomerSyncService } from './modules/integrations/services/omie-customer-sync.service';
import { TransactionsModule } from './modules/transactions/transactions.module'; // Caminho correto
import { SyncSchedulerService } from './modules/integrations/services/sync-scheduler.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    HttpModule,
    TransactionsModule,
  ],
  controllers: [
    AppController, 
    IntegrationsController
  ],
  providers: [
    AppService,
    PrismaService,
    SecurityService, 
    MercadoPagoService,
    OmieService,
    OmieSyncService,
    ConciliationService,
    OmieCustomerSyncService,
    SyncSchedulerService,
  ],
})
export class AppModule {}
