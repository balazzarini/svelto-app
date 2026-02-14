"use client"

import { useState, useEffect } from "react"
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertTriangle, User, Calendar, DollarSign, ArrowRight, Check, XCircle, SearchX } from "lucide-react"
import { Transaction, ConciliationCandidate } from "@/types/conciliation"
import { TransactionsApi } from "@/services/api"
import { format, differenceInDays, addMinutes } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

interface DisputeModalProps {
  transaction: Transaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DisputeModal({ transaction, open, onOpenChange }: DisputeModalProps) {
  const [candidates, setCandidates] = useState<ConciliationCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [resolving, setResolving] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    if (open && transaction) {
      setLoading(true)
      setCandidates([])
      
      TransactionsApi.getCandidates(transaction.id)
        .then((data) => {
            setCandidates(data)
        })
        .catch((err) => {
            console.error(err)
            toast({ title: "Erro", description: "Falha ao carregar candidatos.", variant: "destructive" })
        })
        .finally(() => setLoading(false))
    }
  }, [open, transaction, toast])

  const handleResolve = async (candidateId: string, receivableId: string) => {
    if (!transaction) return
    setResolving(candidateId)
    try {
      await TransactionsApi.resolveDispute(transaction.id, receivableId)
      toast({ title: "Sucesso", description: "Conciliação realizada.", className: "bg-emerald-50 text-emerald-800" })
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível realizar o vínculo.", variant: "destructive" })
    } finally {
      setResolving(null)
    }
  }

  const formatMoney = (val: string | number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val))

  if (!transaction) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] bg-white z-50 max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 text-xl font-bold">
                <AlertTriangle className="h-6 w-6" />
                Resolução de Conflito
            </DialogTitle>
            <DialogDescription className="text-slate-500">
                A transação possui múltiplos títulos compatíveis ou requer validação manual.
            </DialogDescription>
            </DialogHeader>
        </div>

        <div className="grid md:grid-cols-12 h-full min-h-[400px]">
            {/* Lado Esquerdo: A Transação (Referência) */}
            <div className="md:col-span-5 bg-slate-50 p-6 border-r border-slate-100 flex flex-col gap-6">
                <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Origem (Gateway)</div>
                    <div className="text-4xl font-bold text-slate-900 tracking-tight">{formatMoney(transaction.amountGross)}</div>
                    <div className="text-sm text-slate-500 font-medium mt-1">Valor da Venda</div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="bg-white p-2 rounded border shadow-sm">
                            <Calendar className="w-4 h-4 text-slate-500" />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400 uppercase font-bold">Data</div>
                            <div className="text-sm font-medium text-slate-900">
                                {format(new Date(transaction.dateEvent), "dd/MM/yyyy")}
                            </div>
                            <div className="text-xs text-slate-400">
                                {format(new Date(transaction.dateEvent), "HH:mm")}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="bg-white p-2 rounded border shadow-sm">
                            <User className="w-4 h-4 text-slate-500" />
                        </div>
                        <div>
                            <div className="text-xs text-slate-400 uppercase font-bold">Pagador</div>
                            <div className="text-sm font-medium text-slate-900 line-clamp-1" title={transaction.payerName || ""}>
                                {transaction.payerName || "Nome não informado"}
                            </div>
                            <div className="text-xs text-slate-400 font-mono">
                                {transaction.payerDocNumber || "CPF N/A"}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-auto pt-6 border-t border-slate-200/50">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">ID Transação</div>
                    <div className="font-mono text-xs text-slate-500 bg-slate-200/50 p-2 rounded break-all">
                        {transaction.gatewayId}
                    </div>
                </div>
            </div>

            {/* Lado Direito: Os Candidatos (Escolha) */}
            <div className="md:col-span-7 p-6 bg-white flex flex-col h-full">
                <div className="flex justify-between items-center mb-4">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Candidatos ERP ({candidates.length})
                    </div>
                    {loading && <span className="text-xs text-blue-500 animate-pulse font-medium">Buscando no ERP...</span>}
                </div>
                
                <ScrollArea className="flex-1 pr-4 -mr-4 h-[400px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
                            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                        </div>
                    ) : candidates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <SearchX className="h-12 w-12 text-slate-300" />
                            <div>
                                <h4 className="text-slate-900 font-medium mb-1">Nenhum candidato encontrado</h4>
                                <p className="text-xs text-slate-500">
                                    Não encontramos títulos no valor de <strong>{formatMoney(transaction.amountGross)}</strong> com data próxima a {format(new Date(transaction.dateEvent), "dd/MM")}.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3 pb-2 pt-2">
                            {candidates.map((c) => {
                                const diff = differenceInDays(new Date(transaction.dateEvent), new Date(c.erpReceivable.dateEmission));
                                const isExactAmount = Number(c.erpReceivable.amountValue) === Number(transaction.amountGross);
                                const isExactName = transaction.payerName && c.erpReceivable.customerName && 
                                                    c.erpReceivable.customerName.toLowerCase().includes(transaction.payerName.split(' ')[0].toLowerCase());

                                return (
                                    <div 
                                        key={c.id} 
                                        className={`
                                            relative bg-white border rounded-xl p-4 transition-all shadow-sm group
                                            ${c.score >= 50 ? "border-emerald-200 ring-1 ring-emerald-100 bg-emerald-50/10" : "border-slate-100 hover:border-blue-300 hover:shadow-md"}
                                        `}
                                    >
                                        {/* Ajuste de Posição do Badge: Agora dentro do fluxo, alinhado à direita */}
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="space-y-1">
                                                 <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                                       NF #{c.erpReceivable.erpDocNumber || " --"} Ped #{c.erpReceivable.erpExternalRef || "S/N"}
                                                    </span>
                                                    {/* Badge de Score movido para aqui */}
                                                    {c.score >= 90 && (
                                                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1 shadow-sm">
                                                            <Check className="w-3 h-3" /> {c.score}% Match
                                                        </span>
                                                    )}
                                                    {c.score < 90 && (
                                                        <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1 shadow-sm">
                                                            <Check className="w-3 h-3" /> {c.score}% Match
                                                        </span>
                                                    )}
                                                </div>
                                                <div className={`text-sm items-center flex gap-1 font-medium line-clamp-1 ${isExactName ? "text-emerald-700" : "text-amber-800"}`}>
                                                    {isExactName ?  <Check className="w-3.5 h-3.5 text-emerald-600 font-extrabold bg-emerald-100 rounded" /> : <XCircle className="w-3.5 h-3.5 text-amber-600 font-extrabold rounded" />}
                                                    {c.erpReceivable.customerName || "Cliente não identificado"}                                               
                                                </div>
                                            </div>
                                            <div className={`text-base font-bold tabular-nums ${isExactAmount ? "text-emerald-600" : "text-amber-600"}`}>
                                                {formatMoney(c.erpReceivable.amountValue)}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                                            <div className="flex items-center gap-3 text-xs">
                                                <span className={`flex items-center gap-1.5 ${Math.abs(diff) <= 2 ? "text-slate-600" : "text-amber-600"}`}>
                                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                    Emissão: {format(addMinutes(new Date(c.erpReceivable.dateEmission), new Date().getTimezoneOffset()), "dd/MM")}
                                                    <span className="font-medium bg-slate-100 px-1 rounded">
                                                        {diff === 0 ? <div className="text-emerald-600">Mesmo dia</div> : `${Math.abs(diff)}d dif`}
                                                    </span>
                                                </span>
                                            </div>

                                            <Button 
                                                size="sm" 
                                                className="h-8 text-xs bg-white hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 shadow-sm transition-colors"
                                                onClick={() => handleResolve(c.id, c.erpReceivable.id)}
                                                disabled={!!resolving}
                                            >
                                                {resolving === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                                                    <>
                                                        Vincular <ArrowRight className="w-3 h-3 ml-1" />
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </ScrollArea>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}