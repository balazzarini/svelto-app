"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Play, Loader2, RefreshCw, Database, CheckCircle2, Clock, Zap } from "lucide-react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { TransactionsApi } from "@/services/api"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Progress } from "@/components/ui/progress"

export function MatchButton({ pendingCount }: { pendingCount: number }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  
  const [progress, setProgress] = useState(0)
  const [totalToProcess, setTotalToProcess] = useState(0)
  const [processedCount, setProcessedCount] = useState(0)
  
  const [syncStep, setSyncStep] = useState(0)
  
  const router = useRouter()
  const { toast } = useToast()

  const handleMatch = async () => {
    setLoading(true)
    setProgress(0)
    setProcessedCount(0)
    
    try {
      // 1. Busca IDs pendentes
      const ids = await TransactionsApi.getPendingIds();
      setTotalToProcess(ids.length);

      if (ids.length === 0) {
          toast({ title: "Tudo em dia", description: "Nenhuma transação pendente para conciliar." });
          setLoading(false);
          setOpen(false);
          return;
      }

      // 2. Processa em Lotes de 50 (Chunking no Frontend)
      const BATCH_SIZE = 50;
      let matches = 0;
      let disputes = 0;

      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
          const chunk = ids.slice(i, i + BATCH_SIZE);
          
          // Chama o backend apenas para esse lote
          const res = await TransactionsApi.triggerMatch(undefined, chunk);
          
          matches += (res.matches || 0);
          disputes += (res.disputes || 0);
          
          // Atualiza Progresso Visual
          const current = Math.min(i + BATCH_SIZE, ids.length);
          setProcessedCount(current);
          setProgress(Math.round((current / ids.length) * 100));
      }

      // 3. Finalização
      router.refresh()
      
      // Delay para ver o 100%
      await new Promise(r => setTimeout(r, 800));
      setOpen(false);

      toast({
        title: "Vinculação Finalizada",
        description: (
            <div className="flex flex-col gap-1 mt-1">
                <span className="flex items-center gap-2 font-medium text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" /> Sucesso:
                </span>
                <span className="text-xs text-slate-600">
                    • {matches} vinculados<br/>
                    • {disputes} disputas
                </span>
            </div>
        ),
        className: "bg-white border-slate-200 shadow-lg",
      })

    } catch (error) {
      toast({ title: "Erro", description: "Falha durante o processamento.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // ... (handleFullSync mantido igual) ...
  const handleFullSync = async () => {
      setSyncing(true);
      setSyncStep(1); 
      
      try {
          await TransactionsApi.syncGateway();
          setSyncStep(2); 
          await TransactionsApi.syncCustomers();
          setSyncStep(3); 
          await TransactionsApi.syncReceivables();
          setSyncStep(4); 

          toast({ 
              title: "Base Atualizada", 
              description: "Gateway, Clientes e Títulos sincronizados com sucesso.", 
              className: "bg-emerald-50 text-emerald-800 border-emerald-200" 
          });
          router.refresh();
      } catch (error) {
          toast({ title: "Erro no Sync", description: "Falha em uma das etapas.", variant: "destructive" });
      } finally {
          setSyncing(false);
          setTimeout(() => setSyncStep(0), 2000);
      }
  }
  
  const getSyncLabel = () => {
      switch(syncStep) {
          case 1: return "1/3 Buscando vendas no Mercado Pago...";
          case 2: return "2/3 Sincronizando clientes do Omie...";
          case 3: return "3/3 Atualizando títulos a receber...";
          case 4: return "Finalizando...";
          default: return "";
      }
  }

  const getSyncProgress = () => {
      switch(syncStep) {
          case 1: return 33;
          case 2: return 66;
          case 3: return 90;
          case 4: return 100;
          default: return 0;
      }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !loading && setOpen(val)}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm gap-2">
          <Play className="w-4 h-4 fill-current" />
          Vincular Tudo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            Motor de Vinculação Global
          </DialogTitle>
          <DialogDescription>
            {loading 
              ? `Processando transações... ${processedCount} de ${totalToProcess}`
              : `Este processo analisará todas as ${pendingCount} transações pendentes em busca de correspondências no ERP.`
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          {/* Card de Atualização da Base */}
          {!loading && (
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <div className="bg-white p-2.5 rounded-full border shadow-sm">
                              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-blue-600' : ''}`} />
                          </div>
                          <div>
                              <h4 className="text-sm font-semibold text-slate-900">Atualizar Base de Dados</h4>
                              <p className="text-xs text-slate-500 max-w-[240px]">
                                Busca novas vendas e títulos antes de conciliar.
                              </p>
                          </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={handleFullSync} disabled={syncing}>
                          {syncing ? "Processando..." : "Atualizar Agora"}
                      </Button>
                  </div>
                  
                  {syncing && (
                      <div className="space-y-1 pt-2 border-t border-slate-200/60 animate-in fade-in slide-in-from-top-1">
                          <div className="flex justify-between text-xs text-blue-600 font-medium">
                              <span>{getSyncLabel()}</span>
                              <span>{getSyncProgress()}%</span>
                          </div>
                          <Progress value={getSyncProgress()} className="h-1.5" />
                      </div>
                  )}
              </div>
          )}

          {/* Estado de Loading do Match */}
          {loading ? (
             <div className="space-y-2">
                <Progress value={progress} className="h-3" />
                <p className="text-xs text-center text-slate-500">
                    O navegador está enviando lotes para o servidor... Não feche esta janela.
                </p>
             </div>
          ) : (
             <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 text-sm text-slate-700">
                <p className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Critérios de Vínculo:
                </p>
                <ul className="list-disc list-inside space-y-1.5 text-xs ml-1">
                  <li><strong>Prioridade 1 (Hard):</strong> Busca exata por NSU.</li>
                  <li><strong>Prioridade 2 (Fuzzy):</strong> Valor (±0.01) + Data + Nome.</li>
                </ul>
             </div>
          )}
        </div>

        {!loading && (
            <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={syncing}>
                Cancelar
            </Button>
            <Button onClick={handleMatch} disabled={syncing} className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto">
                Rodar Vinculação
            </Button>
            </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}