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
import { Loader2, Unlink } from "lucide-react"
import { TransactionsApi } from "@/services/api"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Transaction } from "@/types/conciliation"

interface UnmatchDialogProps {
  transaction: Transaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function UnmatchDialog({
  transaction,
  open,
  onOpenChange,
  onSuccess
}: UnmatchDialogProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleConfirm = async () => {
    if (!transaction) return
    setLoading(true)
    
    try {
      await TransactionsApi.unmatchTransaction(transaction.id)
      
      toast({ 
        title: "Vínculo Desfeito", 
        description: "A transação retornou para a fila de pendências.", 
        className: "bg-blue-50 text-blue-800 border-blue-200" 
      })
      
      onSuccess()
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      toast({ 
        title: "Erro", 
        description: "Não foi possível desfazer o vínculo.", 
        variant: "destructive" 
      })
    } finally {
      setLoading(false)
    }
  }

  if (!transaction) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Unlink className="h-5 w-5" />
            Desfazer Vínculo?
          </DialogTitle>
          <DialogDescription>
            Você está prestes a desvincular a transação <strong>{transaction.gatewayId}</strong>.
            <br/><br/>
            Ela voltará para o status <strong>PENDENTE</strong> e poderá ser processada novamente pelo robô ou manualmente.
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={loading}
            variant="destructive"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirmar Desvinculação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}