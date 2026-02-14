"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { X, Search, CheckCircle2, AlertTriangle, Clock, ShieldAlert, BadgeCheck, Ban } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import { DataTableFacetedFilter } from "@/components/ui/data-table-faceted-filter" // Componente Multi-Select
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { DateRange } from "react-day-picker"
import { format, parseISO } from "date-fns"

export function DataTableToolbar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // -- Inicialização --
  const initialSearch = searchParams.get("search") || ""
  
  // Status Múltiplo: Converte "PENDING,MATCHED" para Set
  const statusParam = searchParams.get("status")
  const initialStatusSet = new Set(statusParam ? statusParam.split(",") : [])
  
  // Datas
  const dateFrom = searchParams.get("dateStart")
  const dateTo = searchParams.get("dateEnd")
  const initialDateRange: DateRange | undefined = dateFrom ? {
      from: parseISO(dateFrom),
      to: dateTo ? parseISO(dateTo) : parseISO(dateFrom)
  } : undefined

  const [search, setSearch] = useState(initialSearch)
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(initialStatusSet)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(initialDateRange)
  
  const debouncedSearch = useDebounce(search, 500)
  const isFirstRun = useRef(true)

  const statusOptions = [
    { value: "PENDING", label: "Pendente", icon: Clock },
    { value: "MATCHED", label: "Vinculado", icon: CheckCircle2 },
    { value: "AMBIGUOUS", label: "Em Disputa", icon: AlertTriangle },
    { value: "CONCILIATED", label: "Conciliado (ERP)", icon: BadgeCheck },
    { value: "DIVERGENT", label: "Divergente", icon: AlertTriangle },
    { value: "CHARGEBACK", label: "Chargeback", icon: ShieldAlert },
    { value: "PAID_OUT", label: "Pago (Banco)", icon: CheckCircle2 },
    { value: "IGNORED", label: "Ignorado", icon: Ban },
  ]

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    
    // 1. Search
    if (debouncedSearch && debouncedSearch !== initialSearch) {
       params.set("search", debouncedSearch)
       params.set("page", "1")
    } else if (!debouncedSearch) {
       params.delete("search")
    }
    
    // 2. Status Múltiplo (Join com vírgula)
    // Se houver status selecionados, junta com virgula.
    // IMPORTANTE: Isso cria a URL ?status=PENDING,MATCHED que o backend agora sabe ler
    if (selectedStatuses.size > 0) {
       const statusString = Array.from(selectedStatuses).join(",")
       if (statusString !== statusParam) {
           params.set("status", statusString)
           params.set("page", "1")
       }
    } else {
       params.delete("status")
       if (statusParam) params.set("page", "1")
    }

    // 3. Date Range
    if (dateRange?.from) {
        const fromStr = format(dateRange.from, 'yyyy-MM-dd')
        params.set("dateStart", fromStr)
        
        if (dateRange.to) {
            const toStr = format(dateRange.to, 'yyyy-MM-dd')
            params.set("dateEnd", toStr)
        } else {
            params.delete("dateEnd")
        }
        
        if (fromStr !== dateFrom) params.set("page", "1")
    } else {
        if (dateFrom) {
            params.delete("dateStart")
            params.delete("dateEnd")
            params.set("page", "1")
        }
    }
    
    router.push(`?${params.toString()}`)
  }, [debouncedSearch, selectedStatuses, dateRange, router, searchParams])

  const hasActiveFilters = search || selectedStatuses.size > 0 || dateRange;

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex flex-1 items-center space-x-2 flex-wrap gap-y-2">
        <div className="relative w-[250px]">
           <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
           <Input
            placeholder="Filtrar por NSU, Nome..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 pl-8"
           />
        </div>
        
        <DatePickerWithRange 
            date={dateRange} 
            onDateChange={setDateRange}
            className="w-[260px]" 
        />

        {/* Filtro Múltiplo (Faceted) */}
        <DataTableFacetedFilter
            title="Status"
            options={statusOptions}
            selectedValues={selectedStatuses}
            onSelect={setSelectedStatuses}
        />

        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={() => {
                setSearch("")
                setSelectedStatuses(new Set())
                setDateRange(undefined)
            }}
            className="h-8 px-2 lg:px-3"
          >
            Limpar
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}