"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowDownToLine, Receipt } from "lucide-react"
import { TransactionsApi } from "@/services/api"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Transaction } from "@/types/conciliation"

interface SettleDialogProps {
  transaction: Transaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function SettleDialog({
  transaction,
  open,
  onOpenChange,
  onSuccess
}: SettleDialogProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleConfirm = async () => {
    if (!transaction) return
    setLoading(true)
    
    try {
      await TransactionsApi.settleTransaction(transaction.id)
      
      toast({ 
        title: "Sucesso", 
        description: "Título baixado e conciliado no ERP.", 
        className: "bg-emerald-50 text-emerald-800 border-emerald-200" 
      })
      
      onSuccess?.()
      onOpenChange(false)
      router.refresh()
    } catch (error: any) {
      toast({ 
        title: "Erro na Baixa", 
        description: error.response?.data?.message || "Falha ao comunicar com o ERP.", 
        variant: "destructive" 
      })
    } finally {
      setLoading(false)
    }
  }

  if (!transaction) return null

  const value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transaction.amountNetGateway);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-700">
            <ArrowDownToLine className="h-5 w-5" />
            Confirmar Baixa
          </DialogTitle>
          <DialogDescription>
            Isso registrará o recebimento de <strong>{value}</strong> na conta corrente do ERP.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-slate-50 p-4 rounded-md border border-slate-100 flex items-start gap-3">
             <Receipt className="w-5 h-5 text-slate-400 mt-0.5" />
             <div className="text-sm text-slate-600">
                <p><strong>Ação Contábil:</strong></p>
                <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                    <li>Liquidação do título <strong>{transaction.erpId}</strong>.</li>
                    <li>Lançamento da taxa administrativa como despesa.</li>
                    <li>Conciliação bancária automática.</li>
                </ul>
             </div>
        </div>
        
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirmar Baixa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}