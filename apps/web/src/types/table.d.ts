import "@tanstack/react-table"
import { Transaction } from "./conciliation"

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    onOpenDispute: (transaction: Transaction) => void
    onSort: (field: string) => void
    onUnmatch: (transaction: Transaction) => void
    onLinkPayable: (transaction: Transaction) => void
    onOpenSettle: (transaction: Transaction) => void // <--- NOVO
    currentSort?: string
  }
}