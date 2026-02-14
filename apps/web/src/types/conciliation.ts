export type TransactionStatus =
  | 'PENDING'
  | 'MATCHED'
  | 'AMBIGUOUS'
  | 'AUDITED'
  | 'CONCILIATED'
  | 'PAID_OUT'
  | 'DIVERGENT'
  | 'IGNORED'
  | 'CHARGEBACK'
  | 'ERROR_SYNC';

// Exportando como tipo Union String para facilitar compatibilidade com JSON
export type FinancialStatus = 'OPEN' | 'SETTLED' | 'BLOCKED' | 'REVERSED';

export interface ConciliationCandidate {
  id: string;
  transactionId: string;
  erpReceivableId: string;
  score: number;
  matchReason: string;
  erpReceivable: {
    id: string;
    erpId: string;
    erpDocNumber: string | null;
    erpExternalRef: string | null;
    amountValue: string;
    dateEmission: string;
    customerName: string | null;
    customerDoc: string | null;
  };
}

export interface Transaction {
  id: string;
  tenantId: string;
  integrationId: string;
  
  // Identificadores
  gatewayId: string;
  externalReference?: string | null;
  authorizationCode?: string | null;
  operationType?: string | null;
  
  // Dados ERP
  erpId?: string | null;
  erpStatus?: string | null; 
  
  // Datas
  dateEvent: string; 
  dateEstimated?: string | null;
  
  // Liquidação
  moneyReleaseDate?: string | null;
  moneyReleaseStatus?: string | null;
  
  // Engenharia Financeira
  amountGross: number;
  amountPaidByCustomer?: number | null;
  amountMdrFee: number;
  amountFinancingFee: number;
  amountNetGateway: number;
  amountNetCalculated?: number | null;
  
  // CORREÇÃO: Usando o tipo Union definido acima
  financialStatus?: FinancialStatus; 
  
  // Pagador
  payerName?: string | null;
  payerDocNumber?: string | null;
  
  // Status
  paymentMethod: string;
  installments: number;
  status: TransactionStatus;
  statusDetail?: string | null;
  matchDescription?: string | null;
  
  isDisputed: boolean;
  
  candidates?: { id: string }[]; 
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    lastPage: number;
    limit: number;
  };
}

export interface DashboardStats {
  total: number;
  volumeTotal: number;
  byStatus: Record<TransactionStatus, number>;
}