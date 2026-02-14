"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Transaction } from "@/types/conciliation"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { 
  CheckCircle2, AlertTriangle, Clock, XCircle, ShieldAlert, ArrowRightLeft,
  ArrowUpCircle, ArrowDownCircle, Info, HandCoins, Gavel, User, ArrowUpDown, ArrowUp, ArrowDown,
  BanIcon, Undo2, FileText, Link, Receipt, Wallet, CalendarClock, FileMinus, ArrowDownToLine
} from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { getPaymentMethodInfo, translateStatusDetail, getOperationInfo } from "@/lib/transaction-helpers"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"

// Removidas interfaces locais e declare module para usar os globais



const SortableHeader = ({ title, field, table }: { title: string, field: string, table: any }) => {
    const currentSort = table.options.meta?.currentSort || '';
    const [sortField, sortDir] = currentSort.split('.');
    
    const isActive = sortField === field;
    
    return (
      <Button
        variant="ghost"
        className="-ml-4 h-8 hover:bg-slate-100"
        onClick={() => table.options.meta?.onSort(field)}
      >
        <span>{title}</span>
        {isActive && sortDir === 'asc' && <ArrowUp className="ml-2 h-3 w-3 text-blue-600" />}
        {isActive && sortDir === 'desc' && <ArrowDown className="ml-2 h-3 w-3 text-blue-600" />}
        {!isActive && <ArrowUpDown className="ml-2 h-3 w-3 text-slate-400" />}
      </Button>
    )
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, { color: string, icon: any, label: string }> = {
    CONCILIATED: { color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle2, label: "Conciliado" },
    MATCHED: { color: "bg-blue-100 text-blue-800 border-blue-200", icon: ArrowRightLeft, label: "Pronto p/ Baixa" },
    PENDING: { color: "bg-slate-100 text-slate-700 border-slate-200", icon: Clock, label: "Pendente" },
    DIVERGENT: { color: "bg-amber-100 text-amber-800 border-amber-200", icon: AlertTriangle, label: "Divergente" },
    CHARGEBACK: { color: "bg-rose-100 text-rose-800 border-rose-200", icon: ShieldAlert, label: "Chargeback" },
    ERROR_SYNC: { color: "bg-red-100 text-red-800 border-red-200", icon: XCircle, label: "Erro Sync" },
    PAID_OUT: { color: "bg-purple-100 text-purple-800 border-purple-200", icon: CheckCircle2, label: "Pago (Banco)" },
    AMBIGUOUS: { color: "bg-amber-50 text-amber-700 border-amber-200", icon: AlertTriangle, label: "Em Disputa" },
    IGNORED: { color: "bg-slate-50 text-slate-500 border-slate-200 decoration-slate-400", icon: BanIcon, label: "Ignorado" },
  };
  
  const config = styles[status] || { color: "bg-gray-100 text-gray-800", icon: Clock, label: status };
  const Icon = config.icon;
  
  return (
    <Badge variant="outline" className={`${config.color} gap-1 pr-2 whitespace-nowrap cursor-default`}>
      <Icon className="w-3 h-3" />
      <span>{config.label}</span>
    </Badge>
  );
};


// ################
// COLUNAS  
// ################
export const columns: ColumnDef<Transaction>[] = [
  
  // COLUNA DE SELEÇÃO
  {
    id: "select", 
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  
  // COLUNAS DE ID DA TRANSAÇÃO
  {
    accessorKey: "gatewayId",
    header: "Transação",
    cell: ({ row }) => {
      const opInfo = getOperationInfo(row.original.operationType || "regular_payment"); 
      return (
        <div className="flex flex-col gap-1 min-w-[140px]">
          <div className="flex items-center gap-2">
             <span className="font-mono text-xs font-bold text-slate-900 tracking-tight truncate" title={row.original.gatewayId}>
                {row.original.gatewayId}
             </span>
             {/* Badge agora na mesma linha ou logo abaixo se preferir, mas aqui compacta */}
          </div>
          <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 border w-fit ${opInfo.color}`}>
              {opInfo.icon && <opInfo.icon className="w-2 h-2 mr-1" />}
              {opInfo.label}
          </Badge>
        </div>
      );
    },
  },
  // COLUNA DATA DA VENDA
  {
    accessorKey: "dateEvent",
    header: ({ table }) => <SortableHeader title="Venda" field="dateEvent" table={table} />,
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium text-sm tabular-nums text-slate-700">
          {format(new Date(row.original.dateEvent), "dd/MM/yy", { locale: ptBR })}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {format(new Date(row.original.dateEvent), "HH:mm")}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "moneyReleaseDate",
    header: ({ table }) => <SortableHeader title="Liq." field="moneyReleaseDate" table={table} />,
    cell: ({ row }) => {
        const releaseDate = row.original.moneyReleaseDate ? new Date(row.original.moneyReleaseDate) : null;
        const status = row.original.moneyReleaseStatus;
        const isReleased = status === 'released';
        
        if (!releaseDate) return <span className="text-xs text-slate-300">-</span>;

        return (
          <div className="flex flex-col">
            <div className={`flex items-center gap-1.5 text-xs font-medium tabular-nums ${isReleased ? "text-emerald-700" : "text-amber-600"}`}>
                {isReleased ? <Wallet className="w-3 h-3" /> : <CalendarClock className="w-3 h-3" />}
                {format(releaseDate, "dd/MM", { locale: ptBR })}
            </div>
          </div>
        )
    },
  },
  {
    accessorKey: "payerName",
    header: "Cliente",
    cell: ({ row }) => {
        const name = row.original.payerName || "Desconhecido";
        return (
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 truncate max-w-[150px]" title={name}>
                <User className="w-3 h-3 text-slate-400 min-w-[12px]" />
                {name}
            </div>
        )
    }
  },
  {
    accessorKey: "paymentMethod",
    header: "Método",
    cell: ({ row }) => {
      const { label, brandColor, Icon, type } = getPaymentMethodInfo(
        row.original.paymentMethod, 
        row.original.installments
      );
      return (
        <div className="flex flex-col gap-1">
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border w-fit ${brandColor}`}>
            <Icon className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase">{label}</span>
          </div>
          <span className="text-[10px] text-muted-foreground pl-1">{type}</span>
        </div>
      );
    },
  },
  // COLUNA STATUS DETAIL (RE-ADICIONADA)
  {
    accessorKey: "statusDetail",
    header: "Detalhe",
    cell: ({ row }) => {
      const detail = translateStatusDetail(row.original.statusDetail);
      if (!detail) return <span className="text-slate-400 text-xs">-</span>;
      
      const Icon = detail.icon;
      return (
        <div className={`flex items-center gap-1.5 text-xs font-medium ${detail.color} whitespace-nowrap`}>
          {Icon && <Icon className="w-3.5 h-3.5" />}
          <span>{detail.label}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "amountMdrFee",
    header: () => <div className="text-right">Taxas</div>,
    cell: ({ row }) => {
      const fee = Number(row.original.amountMdrFee) || 0;
      const financing = Number(row.original.amountFinancingFee) || 0;
      const totalFee = fee + financing;
      const gross = Number(row.original.amountGross) || 1;
      const pct = (totalFee / gross) * 100;

      return (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-end cursor-help">
                <span className="text-xs font-medium text-rose-600 tabular-nums">
                  - {formatCurrency(totalFee)}
                </span>
                <span className="text-[10px] text-muted-foreground bg-slate-100 px-1 rounded flex gap-1 items-center">
                  {pct.toFixed(1)}%
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-xs p-2 bg-white border border-slate-200 text-slate-700">
              <p>MDR: {formatCurrency(fee)}</p>
              <p>Financ: {formatCurrency(financing)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
  },
  {
    accessorKey: "amountGross",
    header: ({ table }) => (
        <div className="flex justify-end">
            <SortableHeader title="Valores" field="amountGross" table={table} />
        </div>
    ),
    cell: ({ row }) => {
      const gross = Number(row.getValue("amountGross"));
      const net = Number(row.original.amountNetGateway);
      const isReversed = row.original.financialStatus === 'REVERSED';
      const isNegative = isReversed || row.original.status === 'CHARGEBACK';

      return (
        <div className="flex flex-col items-end gap-0.5">
          <span className={`text-xs font-medium tabular-nums ${isNegative ? "text-slate-400 line-through" : "text-slate-600"}`}>
            {formatCurrency(gross)}
          </span>
          <div className={`flex items-center gap-1 font-bold tabular-nums text-sm ${isNegative ? 'text-rose-600' : 'text-emerald-700'}`}>
            {isNegative ? <ArrowDownCircle className="w-3 h-3" /> : <ArrowUpCircle className="w-3 h-3" />}
            {formatCurrency(net)}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ table }) => <SortableHeader title="Status" field="status" table={table} />,
    cell: ({ row, table }) => {
       const status = row.getValue("status") as string;
       const matchDesc = row.original.matchDescription;
       const isReversed = row.original.financialStatus === 'REVERSED';
       const isSettled = row.original.financialStatus === 'SETTLED';

       return (
        <div className="flex flex-col items-start gap-1">
           {status === 'AMBIGUOUS' ? (
               <Button 
                 variant="outline" 
                 size="sm" 
                 className="h-7 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                 onClick={(e) => {
                     e.stopPropagation();
                     table.options.meta?.onOpenDispute(row.original)
                 }}
               >
                 <Gavel className="w-3 h-3 mr-1" />
                 Resolver
               </Button>
           ) : isReversed ? (
               <Button 
                 variant="outline" 
                 size="sm" 
                 className="h-7 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                 onClick={(e) => {
                     e.stopPropagation();
                     table.options.meta?.onLinkPayable(row.original)
                 }}
               >
                 <FileMinus className="w-3 h-3 mr-1" />
                 Saída
               </Button>
           ) : status === 'MATCHED' ? (
               <div className="flex items-center gap-1 group">
                   {/* Badge + Undo */}
                   <div className="relative flex items-center gap-1">
                        {/* @ts-ignore */}
                        <StatusBadge status={status} />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Desfazer Vínculo"
                            onClick={(e) => {
                                e.stopPropagation();
                                table.options.meta?.onUnmatch(row.original)
                            }}
                        >
                            <Undo2 className="h-3 w-3" />
                        </Button>
                   </div>

                   {/* BOTÃO DE BAIXA (Ícone + Tooltip) */}
                   {isSettled && (
                       <TooltipProvider delayDuration={200}>
                         <Tooltip>
                           <TooltipTrigger asChild>
                               <Button 
                                    size="icon" 
                                    className="h-6 w-6 bg-emerald-600 hover:bg-emerald-700 text-white ml-1 shadow-sm rounded-full"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        table.options.meta?.onOpenSettle(row.original)
                                    }}
                               >
                                   <ArrowDownToLine className="w-3 h-3" />
                               </Button>
                           </TooltipTrigger>
                           <TooltipContent className="bg-emerald-700 text-white border-0">
                             <p className="text-xs font-medium">Baixar no ERP</p>
                           </TooltipContent>
                         </Tooltip>
                       </TooltipProvider>
                   )}
               </div>
           ) : (
                // @ts-ignore
                <StatusBadge status={status} />
           )}
           
           {/* ... (Match Description HoverCard) ... */}
           {matchDesc && (
             <HoverCard openDelay={200}>
               <HoverCardTrigger asChild>
                 <div className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-blue-600 cursor-help transition-colors max-w-[140px]">
                   <Link className="w-3 h-3 min-w-[12px]" />
                   <span className="truncate">{matchDesc.split('|')[1] || matchDesc}</span>
                 </div>
               </HoverCardTrigger>
               <HoverCardContent className="w-80 p-3 bg-white border-slate-200 shadow-xl z-50">
                 <p className="text-xs text-slate-600 leading-relaxed">{matchDesc}</p>
               </HoverCardContent>
             </HoverCard>
           )}
        </div>
       )
    },
  },
]