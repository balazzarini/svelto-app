import { TransactionsApi } from "@/services/api";
import { columns } from "./columns";
import { DataTable } from "./data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Banknote, ArrowRightLeft, AlertTriangle, History } from "lucide-react";
import { MatchButton } from "@/components/transactions/match-button";
import { TransactionPagination } from "@/components/transactions/pagination";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DataTableToolbar } from "./data-table-toolbar";

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export const revalidate = 0; 

export default async function TransactionsPage({ searchParams }: PageProps) {
  const page = typeof searchParams.page === 'string' ? Number(searchParams.page) : 1;
  const status = typeof searchParams.status === 'string' ? searchParams.status : "";
  const search = typeof searchParams.search === 'string' ? searchParams.search : "";
  const dateStart = typeof searchParams.dateStart === 'string' ? searchParams.dateStart : undefined;
  const dateEnd = typeof searchParams.dateEnd === 'string' ? searchParams.dateEnd : undefined;
  const sort = typeof searchParams.sort === 'string' ? searchParams.sort : undefined;

  let transactionsData;
  let dashboardData;
  let lastSyncInfo;

  try {
    [transactionsData, dashboardData, lastSyncInfo] = await Promise.all([
      TransactionsApi.findAll({ 
        page, 
        limit: 10, // Limit atual da página
        status, 
        search,
        dateStart,
        dateEnd,
        sort 
      }),
      TransactionsApi.getDashboard(),
      TransactionsApi.getLastSyncInfo(),
    ]);
  } catch (error) {
    return (
      <div className="p-10 text-red-600 border border-red-200 bg-red-50 rounded m-4">
        <h3 className="font-bold">Erro de Conexão</h3>
        <p>Não foi possível carregar os dados. Verifique se o Backend (API) está rodando na porta 3000.</p>
      </div>
    );
  }

  const data = transactionsData?.data || [];
  const meta = transactionsData?.meta || { page: 1, lastPage: 1, total: 0 };
  const dashboard = dashboardData || { total: 0, volumeTotal: 0, byStatus: { PENDING: 0, DIVERGENT: 0 } };

  return (
    <div className="w-full px-6 py-6 space-y-6 bg-slate-50/50 min-h-screen">
      
      {/* Header com Ações */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Cockpit de Conciliação</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão unificada de fluxo de caixa e auditoria de taxas.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border shadow-sm">
            <div className="bg-slate-100 p-2 rounded-full">
              <History className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Último Sync</p>
              <p className="text-xs font-medium text-slate-900">
                {lastSyncInfo.lastRun ? formatDistanceToNow(new Date(lastSyncInfo.lastRun), { addSuffix: true, locale: ptBR }) : 'Nunca'}
              </p>
            </div>
          </div>
          
          <MatchButton pendingCount={dashboard.byStatus.PENDING || 0} />
        </div>
      </div>

      {/* Cards de KPI */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Volume Total</CardTitle>
            <Banknote className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dashboard.volumeTotal)}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm bg-blue-50/50 border-blue-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Pendentes (Match)</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{dashboard.byStatus.PENDING || 0}</div>
            <p className="text-xs text-blue-600/80">Aguardando processamento</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm bg-amber-50/50 border-amber-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-700">Divergentes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900">{dashboard.byStatus.DIVERGENT || 0}</div>
            <p className="text-xs text-amber-600/80">Taxas ou valores incorretos</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Transações</CardTitle>
            <History className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{dashboard.total}</div>
          </CardContent>
        </Card>
      </div>

      {/* Área da Tabela */}
      <div className="bg-white rounded-lg border shadow-sm p-4 space-y-4">
        <DataTableToolbar />
        
        {/* Passando o total de registros para permitir a seleção global */}
        <DataTable 
            columns={columns} 
            data={data} 
            totalCount={meta.total} 
        />
        
        <div className="pt-4 border-t flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Mostrando {data.length} de {meta.total} registros
          </p>
          <TransactionPagination currentPage={meta.page} lastPage={meta.lastPage} />
        </div>
      </div>
    </div>
  );
}