"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Ban, RotateCcw } from "lucide-react"

interface BatchActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: 'ignore' | 'restore'
  count: number
  onConfirm: () => void
  loading: boolean
}

export function BatchActionDialog({
  open,
  onOpenChange,
  action,
  count,
  onConfirm,
  loading
}: BatchActionDialogProps) {
  const isIgnore = action === 'ignore'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isIgnore ? (
              <Ban className="h-5 w-5 text-red-600" />
            ) : (
              <RotateCcw className="h-5 w-5 text-blue-600" />
            )}
            {isIgnore ? "Ignorar Transações" : "Restaurar Transações"}
          </DialogTitle>
          <DialogDescription>
            {isIgnore 
              ? `Você está prestes a remover ${count} transações da fila de pendências.`
              : `Você está prestes a retornar ${count} transações para a fila de pendências.`
            }
            <br />
            Essa ação pode ser desfeita depois.
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={loading}
            variant={isIgnore ? "destructive" : "default"}
            className={!isIgnore ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}