import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  // Tenant ID fixo para o MVP (Futuramente virá do JWT/Guard)
  private readonly CURRENT_TENANT_ID = '69711ece-3857-4f6d-b623-c72a91adef86';

  constructor(private readonly service: TransactionsService) {}

  @Get()
  async findAll(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('status') status: string,
    @Query('search') search: string,
    // Novos parâmetros de filtro e ordenação
    @Query('dateStart') dateStart: string,
    @Query('dateEnd') dateEnd: string,
    @Query('sort') sort: string,
  ) {
    return this.service.findAll({
      tenantId: this.CURRENT_TENANT_ID,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      status,
      search,
      dateStart,
      dateEnd,
      sort,
    });
  }

  @Get('dashboard')
  async getDashboard() {
    return this.service.getDashboardStats(this.CURRENT_TENANT_ID);
  }

  // Busca candidatos para uma transação (Live Search ou Persistidos)
  @Get(':id/candidates')
  async getCandidates(@Param('id') id: string) {
    return this.service.findCandidates(this.CURRENT_TENANT_ID, id);
  }

  // Resolve a disputa manualmente (Efetiva o Match)
  @Post(':id/resolve')
  async resolveDispute(
    @Param('id') id: string,
    @Body() body: { erpReceivableId: string }
  ) {
    return this.service.resolveCandidate(this.CURRENT_TENANT_ID, id, body.erpReceivableId);
  }
  // NOVO: Ignorar Transação Individual
  @Post(':id/ignore')
  async ignoreTransaction(@Param('id') id: string) {
    return this.service.ignoreTransactions(this.CURRENT_TENANT_ID, [id]);
  }

  // NOVO: Ignorar em Massa
  @Post('batch-ignore')
  async ignoreBatch(@Body() body: { ids: string[] }) {
    return this.service.ignoreTransactions(this.CURRENT_TENANT_ID, body.ids);
  }
  // DESFAZER IGNORAR em Massa
  @Post('batch-restore')
  async restoreBatch(@Body() body: { ids: string[] }) {
    // Reutiliza a lógica de update do service, voltando para PENDING
    // Vamos precisar adicionar esse método no service se não tiver
    return this.service.restoreTransactions(this.CURRENT_TENANT_ID, body.ids);
  }
  // Desfazer Match
  @Post(':id/unmatch')
  async unmatchTransaction(@Param('id') id: string) {
    return this.service.unmatchTransaction(this.CURRENT_TENANT_ID, id);
  }
  // Marcar como Liquidada
  @Post(':id/settle')
  async settleTransaction(@Param('id') id: string) {
    return this.service.settleTransaction(this.CURRENT_TENANT_ID, id);
  }
  @Get('pending-ids')
  async getPendingIds(@Query('integrationId') integrationId: string) {
    return this.service.getPendingIds(this.CURRENT_TENANT_ID, integrationId);
  }
}