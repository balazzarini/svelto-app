"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

interface PaginationProps {
  currentPage: number
  lastPage: number
}

export function TransactionPagination({ currentPage, lastPage }: PaginationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > lastPage) return

    const params = new URLSearchParams(searchParams.toString())
    params.set("page", newPage.toString())
    
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex items-center space-x-2">
      <div className="text-sm font-medium text-slate-500 mr-4">
        Página {currentPage} de {lastPage}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage <= 1}
      >
        <ChevronLeft className="h-4 w-4" />
        Anterior
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage >= lastPage}
      >
        Próximo
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}