"use client"

import { useState, useEffect } from "react"
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Play, CheckCircle2, AlertCircle, Sparkles } from "lucide-react"
import { TransactionsApi } from "@/services/api"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Progress } from "@/components/ui/progress"

interface MatchBatchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedIds: string[]
  onSuccess: () => void
}

export function MatchBatchDialog({ open, onOpenChange, selectedIds, onSuccess }: MatchBatchDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  // Estado para acumular os resultados
  const [stats, setStats] = useState({ matches: 0, disputes: 0, errors: 0 })
  
  const router = useRouter()
  const { toast } = useToast()

  // Reset ao abrir
  useEffect(() => {
      if(open) {
          setIsProcessing(false)
          setProgress(0)
          setStats({ matches: 0, disputes: 0, errors: 0 })
      }
  }, [open])

  const handleConfirm = async () => {
    setIsProcessing(true)
    let processedCount = 0
    
    // Acumuladores locais
    let accMatches = 0
    let accDisputes = 0
    let accErrors = 0

    // Processa um por um para dar feedback visual (pode ajustar para Promise.all em chunks de 5 se quiser mais velocidade)
    for (const id of selectedIds) {
        try {
            // Chama o match apenas para este ID
            const res = await TransactionsApi.triggerMatch(undefined, [id])
            
            accMatches += (res.matches || 0)
            accDisputes += (res.disputes || 0)
        } catch (error) {
            console.error(`Erro ao processar match da tx ${id}`, error)
            accErrors++
        }

        processedCount++
        // Atualiza UI
        setStats({ matches: accMatches, disputes: accDisputes, errors: accErrors })
        setProgress(Math.round((processedCount / selectedIds.length) * 100))
    }

    // Finalização
    toast({ 
        title: "Vinculação em Lote Finalizada", 
        description: (
            <div className="flex flex-col gap-1 mt-1">
                <span className="flex items-center gap-2 font-medium text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" />
                    Processamento Concluído
                </span>
                <span className="text-xs text-slate-600">
                    {accMatches} vinculados | {accDisputes} disputas | {accErrors} erros
                </span>
            </div>
        ),
        className: "bg-white border-slate-200"
    })

    // Pequeno delay para usuário ver o 100%
    setTimeout(() => {
        onSuccess() // Limpa seleção na tabela
        router.refresh()
        onOpenChange(false)
    }, 3000)
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !isProcessing && onOpenChange(val)}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600 fill-purple-100" />
            Vincular selecionadas
          </DialogTitle>
          <DialogDescription>
            O sistema analisará <strong>{selectedIds.length} transações</strong> selecionadas.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
            {!isProcessing ? (
                <div className="bg-slate-50 p-4 rounded-md border border-slate-100 text-sm text-slate-600">
                    <p className="mb-2 font-medium text-slate-900">Critérios de Vínculo:</p>
                    <ul className="list-disc list-inside space-y-2 text-xs">
                        <li>Busca exata por NSU ou ID da Transação.</li>
                        <li>Busca inteligente por Valor + Data + Nome.</li>
                        <li>Se houver dúvida, marcará como <strong>Resolver</strong>.</li>
                    </ul>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex justify-between text-xs text-slate-500 font-medium">
                        <span>Processando motor de conciliação...</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    
                    <Progress value={progress} className="h-2" />
                    
                    <div className="grid grid-cols-3 gap-2 text-center pt-2">
                        <div className="bg-emerald-50 p-2 rounded border border-emerald-100">
                            <div className="text-lg font-bold text-emerald-600">{stats.matches}</div>
                            <div className="text-[10px] text-emerald-800 uppercase font-bold">Matches</div>
                        </div>
                        <div className="bg-amber-50 p-2 rounded border border-amber-100">
                            <div className="text-lg font-bold text-amber-600">{stats.disputes}</div>
                            <div className="text-[10px] text-amber-800 uppercase font-bold">Disputas</div>
                        </div>
                        <div className="bg-slate-50 p-2 rounded border border-slate-200">
                            <div className="text-lg font-bold text-slate-600">{stats.errors}</div>
                            <div className="text-[10px] text-slate-500 uppercase font-bold">Erros</div>
                        </div>
                    </div>
                </div>
            )}
        </div>

        <DialogFooter>
          {!isProcessing && (
              <>
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                    Cancelar
                </Button>
                <Button onClick={handleConfirm} className="bg-purple-600 hover:bg-purple-700 text-white">
                    <Play className="w-3 h-3 mr-2 fill-current" />
                    Iniciar Processamento
                </Button>
              </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}