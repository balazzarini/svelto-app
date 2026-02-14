"use client"

import { useState, useEffect } from "react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowDownToLine, CheckCircle2, AlertCircle } from "lucide-react"
import { TransactionsApi } from "@/services/api"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Progress } from "@/components/ui/progress" // Precisa instalar: npx shadcn@latest add progress

interface SettleBatchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedIds: string[]
  onSuccess: () => void
}

export function SettleBatchDialog({ open, onOpenChange, selectedIds, onSuccess }: SettleBatchDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<{ success: number, failed: number }>({ success: 0, failed: 0 })
  const router = useRouter()
  const { toast } = useToast()

  // Reset state on open
  useEffect(() => {
      if(open) {
          setIsProcessing(false)
          setProgress(0)
          setResults({ success: 0, failed: 0 })
      }
  }, [open])

  const handleStartBatch = async () => {
    setIsProcessing(true)
    let successCount = 0
    let failedCount = 0

    // Processa sequencialmente para não sobrecarregar a API do Omie (Rate Limit)
    for (let i = 0; i < selectedIds.length; i++) {
        const id = selectedIds[i]
        try {
            await TransactionsApi.settleTransaction(id)
            successCount++
        } catch (error) {
            console.error(`Erro ao baixar tx ${id}`, error)
            failedCount++
        }
        
        // Atualiza progresso
        setResults({ success: successCount, failed: failedCount })
        setProgress(Math.round(((i + 1) / selectedIds.length) * 100))
    }

    // Finalização
    toast({
        title: "Processamento Finalizado",
        description: `${successCount} baixas realizadas com sucesso. ${failedCount} falhas.`,
        className: failedCount > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"
    })
    
    onSuccess() // Limpa seleção
    router.refresh()
    
    // Fecha após um pequeno delay para o usuário ver o 100%
    setTimeout(() => onOpenChange(false), 1500)
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !isProcessing && onOpenChange(val)}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-700">
            <ArrowDownToLine className="h-5 w-5" />
            Baixa em Lote
          </DialogTitle>
          <DialogDescription>
            Você selecionou <strong>{selectedIds.length} transações</strong> para baixa no ERP.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
            {!isProcessing ? (
                <div className="bg-slate-50 p-3 rounded text-sm text-slate-600">
                    <p>Esta ação irá:</p>
                    <ul className="list-disc list-inside mt-1 text-xs">
                        <li>Lançar o recebimento na conta corrente.</li>
                        <li>Registrar as taxas.</li>
                        <li>Conciliar os títulos selecionados.</li>
                    </ul>
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Processando...</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="flex gap-4 text-xs pt-2">
                        <span className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="w-3 h-3" /> {results.success} Sucesso
                        </span>
                        {results.failed > 0 && (
                            <span className="flex items-center gap-1 text-red-600">
                                <AlertCircle className="w-3 h-3" /> {results.failed} Falhas
                            </span>
                        )}
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
                <Button onClick={handleStartBatch} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Confirmar Baixa
                </Button>
              </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}