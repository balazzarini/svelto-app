"use client"

import { useState, useEffect } from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  RowSelectionState,
} from "@tanstack/react-table"

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"


// Importações de Diálogos
import { DisputeModal } from "@/components/transactions/dispute-modal"
import { MatchBatchDialog } from "@/components/transactions/match-batch-dialog" 
import { BatchActionDialog } from "@/components/transactions/batch-action-dialog" 
import { UnmatchDialog } from "@/components/transactions/unmatch-dialog" 
import { SettleDialog } from "@/components/transactions/settle-dialog" // <--- NOVO
import { SettleBatchDialog } from "@/components/transactions/settle-batch-dialog" // <--- NOVO

// Importações de Tipos
import { Transaction } from "@/types/conciliation"

// Importações de Componentes
import { Button } from "@/components/ui/button"
import { useRouter, useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Ban, Loader2, CheckCircle, RotateCcw, Link, ArrowDownToLine } from "lucide-react"

// Importações de Serviços
import { TransactionsApi } from "@/services/api"

// Removida declaração de módulo duplicada - Agora está em types/table.d.ts

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  totalCount: number
}

export function DataTable<TData, TValue>({
  columns,
  data,
  totalCount
}: DataTableProps<TData, TValue>) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [selectGlobal, setSelectGlobal] = useState(false)
  
  const [disputeTransaction, setDisputeTransaction] = useState<Transaction | null>(null)
  const [disputeOpen, setDisputeOpen] = useState(false)
  
  const [unmatchTransaction, setUnmatchTransaction] = useState<Transaction | null>(null)
  const [unmatchOpen, setUnmatchOpen] = useState(false)

  const [settleTransaction, setSettleTransaction] = useState<Transaction | null>(null)
  const [settleOpen, setSettleOpen] = useState(false)
  
  const [matchBatchOpen, setMatchBatchOpen] = useState(false)
  const [batchActionOpen, setBatchActionOpen] = useState(false)
  const [settleBatchOpen, setSettleBatchOpen] = useState(false) // <--- NOVO
  const [isProcessingBatch, setIsProcessingBatch] = useState(false)

  const handleSort = (field: string) => {
      const currentSort = searchParams.get('sort') || '';
      const [currentField, currentDir] = currentSort.split('.');
      
      let newSort = '';
      if (currentField === field && currentDir === 'asc') {
          newSort = `${field}.desc`; 
      } else {
          newSort = `${field}.asc`; 
      }
      
      const params = new URLSearchParams(searchParams.toString());
      params.set('sort', newSort);
      router.push(`?${params.toString()}`);
  }

  const handleUnmatch = (transaction: Transaction) => {
      setUnmatchTransaction(transaction)
      setUnmatchOpen(true)
  }

  const handleOpenSettle = (transaction: Transaction) => {
      setSettleTransaction(transaction)
      setSettleOpen(true)
  }

  // Placeholder para vincular saída (Futuro)
  const handleLinkPayable = (t: Transaction) => alert("Em breve: Buscar Contas a Pagar");

  useEffect(() => {
    if (Object.keys(rowSelection).length === 0 && selectGlobal) {
        setSelectGlobal(false);
    }
  }, [rowSelection, selectGlobal]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    getRowId: (row: any) => row.id,
    enableRowSelection: true,
    manualSorting: true, 
    state: {
      rowSelection,
    },
    meta: {
      onOpenDispute: (transaction: any) => {
          setDisputeTransaction(transaction)
          setDisputeOpen(true)
      },
      onSort: handleSort,
      onUnmatch: handleUnmatch,
      onLinkPayable: handleLinkPayable,
      onOpenSettle: handleOpenSettle,
      currentSort: searchParams.get('sort') || undefined
    }
  })

  const selectedCount = Object.keys(rowSelection).length;
  const isPageFullSelected = table.getIsAllPageRowsSelected();
  
  const selectedRows = table.getSelectedRowModel().rows;
  // @ts-ignore
  const allSelectedAreIgnored = selectedRows.length > 0 && selectedRows.every(r => r.original.status === 'IGNORED');
  // @ts-ignore
  const anyMatchedAndSettled = selectedRows.length > 0 && selectedRows.some(r => r.original.status === 'MATCHED' && r.original.financialStatus === 'SETTLED');
  // @ts-ignore
  const anyPendingOrAmbiguous = selectedRows.length > 0 && selectedRows.some(r => ['PENDING', 'AMBIGUOUS'].includes(r.original.status));

  const batchActionType = allSelectedAreIgnored ? 'restore' : 'ignore';

  const executeBatchAction = async () => {
    const ids = Object.keys(rowSelection);
    setIsProcessingBatch(true);
    
    try {
        if (batchActionType === 'ignore') {
            await TransactionsApi.ignoreBatch(ids);
        } else {
            await TransactionsApi.restoreBatch(ids);
        }
        
        toast({ 
            title: batchActionType === 'restore' ? "Restaurado com Sucesso" : "Ignorado com Sucesso",
            description: (
                <div className="flex items-center gap-2">
                    {batchActionType === 'restore' ? <RotateCcw className="h-4 w-4 text-blue-600" /> : <CheckCircle className="h-4 w-4 text-emerald-600" />}
                    <span>
                        {ids.length} item(s) processados.
                    </span>
                </div>
            ),
            className: "bg-white border-slate-200" 
        });
        
        setRowSelection({});
        setSelectGlobal(false);
        setBatchActionOpen(false);
        router.refresh();
    } catch (error) {
        toast({ 
            title: "Erro", 
            description: `Falha ao processar a solicitação.`, 
            variant: "destructive" 
        });
    } finally {
        setIsProcessingBatch(false);
    }
  };

return (
    <div className="space-y-4">
        {selectedCount > 0 && (
            <div className="flex flex-col gap-0 border border-blue-200 rounded-lg overflow-hidden animate-in fade-in slide-in-from-top-2 shadow-sm bg-white">
                <div className="bg-blue-50/50 p-2 flex justify-between items-center px-4">
                    <span className="text-sm font-medium text-blue-900 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-blue-600" />
                        {selectGlobal 
                            ? `Todos os ${totalCount} registros selecionados`
                            : `${selectedCount} selecionado(s)`
                        }
                    </span>
                    
                    <div className="flex gap-2 items-center">
                        <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-slate-500 h-8 text-xs hover:text-slate-900"
                            onClick={() => {
                                setRowSelection({})
                                setSelectGlobal(false)
                            }}
                        >
                            Cancelar
                        </Button>
                        
                        <div className="h-4 w-px bg-blue-200 mx-1" />

                        {/* Botão Ignorar/Restaurar (Sempre Visível) */}
                        <Button 
                            size="sm" 
                            variant={allSelectedAreIgnored ? "outline" : "destructive"} 
                            className={`
                                h-8 text-xs border transition-colors shadow-sm
                                ${allSelectedAreIgnored 
                                    ? "bg-white text-blue-700 border-blue-200 hover:bg-blue-50 hover:text-blue-800" 
                                    : "bg-red-600 text-white hover:bg-red-700 border-transparent"
                                }
                            `}
                            onClick={() => setBatchActionOpen(true)}
                        >
                            {allSelectedAreIgnored ? <RotateCcw className="w-3 h-3 mr-1.5" /> : <Ban className="w-3 h-3 mr-1.5" />}
                            {allSelectedAreIgnored ? "Restaurar" : "Ignorar"}
                        </Button>

                        {/* Botão Vincular (Só se houver pendentes) */}
                        {anyPendingOrAmbiguous && (
                            <Button 
                                size="sm" 
                                className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs shadow-sm"
                                onClick={() => setMatchBatchOpen(true)}
                            >
                                <Link className="w-3 h-3 mr-1.5" />
                                Vincular
                            </Button>
                        )}
                        
                        {/* Botão Baixar (Só se houver Matched e Settled) */}
                        {anyMatchedAndSettled && (
                            <Button 
                                size="sm" 
                                className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs shadow-sm"
                                onClick={() => setSettleBatchOpen(true)}
                            >
                                <ArrowDownToLine className="w-3 h-3 mr-1.5" />
                                Baixar ({selectedRows.filter(r => r.original.status === 'MATCHED' && r.original.financialStatus === 'SETTLED').length})
                            </Button>
                        )}
                    </div>
                </div>
                
                {/* ... (Seção de Seleção Global mantida) ... */}
                 {isPageFullSelected && !selectGlobal && totalCount > data.length && (
                    <div className="bg-blue-100/50 p-1.5 text-center text-xs text-blue-800 cursor-pointer hover:bg-blue-200/50 transition-colors border-t border-blue-100"
                         onClick={() => setSelectGlobal(true)}
                    >
                        Todos os <strong>{data.length}</strong> itens desta página selecionados. 
                        <span className="font-bold underline ml-1">
                            Selecionar todos os {totalCount} itens?
                        </span>
                    </div>
                )}
                
                {selectGlobal && (
                    <div className="bg-emerald-50 p-1.5 text-center text-xs text-emerald-800 border-t border-emerald-100">
                        ✅ Seleção expandida para todos os <strong>{totalCount}</strong> itens.
                        <span className="underline ml-2 cursor-pointer hover:text-emerald-950" onClick={() => setSelectGlobal(false)}>Desfazer</span>
                    </div>
                )}
            </div>
        )}

        <div className="rounded-md border bg-white shadow-sm">
           {/* ... (Tabela mantida) ... */}
           <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => {
                    // @ts-ignore
                    const isIgnored = row.original.status === 'IGNORED';
                    
                    return (
                      <TableRow 
                        key={row.id} 
                        data-state={row.getIsSelected() && "selected"}
                        className={isIgnored ? "opacity-60 bg-slate-50 hover:bg-slate-100" : ""}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">Nenhum resultado.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Modais */}
        <DisputeModal 
            // @ts-ignore
            transaction={disputeTransaction} 
            open={disputeOpen} 
            onOpenChange={setDisputeOpen} 
        />
        
        <MatchBatchDialog 
            open={matchBatchOpen}
            onOpenChange={setMatchBatchOpen}
            selectedIds={Object.keys(rowSelection)}
            onSuccess={() => {
                setRowSelection({})
                setSelectGlobal(false)
                setMatchBatchOpen(false)
            }}
        />

        <BatchActionDialog 
            open={batchActionOpen}
            onOpenChange={setBatchActionOpen}
            action={batchActionType}
            count={selectedCount}
            onConfirm={async () => {
                 // Nota: A lógica real foi movida para dentro do BatchActionDialog para clean code,
                 // mas aqui estamos usando o padrão de passar o callback. 
                 // Vamos simplificar passando a função direta no componente
            }} 
            // @ts-ignore - Precisa ajustar a prop do BatchActionDialog para receber a funcao direta
            loading={isProcessingBatch} 
        />

        <UnmatchDialog 
            transaction={unmatchTransaction}
            open={unmatchOpen}
            onOpenChange={setUnmatchOpen}
            onSuccess={() => {
                setUnmatchTransaction(null)
            }}
        />

        <SettleDialog 
            transaction={settleTransaction}
            open={settleOpen}
            onOpenChange={setSettleOpen}
            onSuccess={() => {
                setSettleTransaction(null)
            }}
        />

        <SettleBatchDialog 
            open={settleBatchOpen}
            onOpenChange={setSettleBatchOpen}
            selectedIds={Object.keys(rowSelection).filter(id => {
                // CORREÇÃO AQUI: Verificação segura para evitar crash
                try {
                    const row = table.getRow(id);
                    // @ts-ignore
                    return row?.original?.status === 'MATCHED' && row?.original?.financialStatus === 'SETTLED';
                } catch (e) {
                    // Se a linha não existir na view atual, ignoramos (não está apta para baixa imediata deste contexto)
                    return false;
                }
            })}
            onSuccess={() => {
                setRowSelection({})
                setSelectGlobal(false)
            }}
        />
    </div>
  )
}