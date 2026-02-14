import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OmieService } from '../integrations/providers/omie.service';
import { SecurityService } from '../security/security.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, PrismaService, OmieService, SecurityService],
  exports: [TransactionsService] // Boa prática exportar se for usar em outros lugares
})
export class TransactionsModule {}