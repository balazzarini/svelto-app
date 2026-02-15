import axios from 'axios';
import { PaginatedResponse, Transaction, DashboardStats, ConciliationCandidate } from '@/types/conciliation';

const isServer = typeof window === 'undefined';

// No servidor, tenta usar a URL interna (SERVER_API_URL). Se não houver, usa a pública.
const API_BASE_URL = (isServer && process.env.SERVER_API_URL) 
  ? process.env.SERVER_API_URL 
  : (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000');

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  }
});

const handleApiError = (error: any, defaultMsg: string) => {
    if (error.code === 'ECONNABORTED' || error.response?.status === 504) {
        return {
            isTimeout: true,
            message: "O processo está demorando mais que o normal. Ele continuará em background."
        };
    }
    console.error(`[API Error] ${defaultMsg}:`, error);
    throw error;
};

// IDs fixos (Em produção, devem vir do contexto/config)
const MP_INTEGRATION_ID = 'aeeebc10-3ff0-4e5c-aff8-94cfcf0e504c'; 
const OMIE_INTEGRATION_ID = '6267acd8-d724-465e-9b0f-21782b270656';

export const TransactionsApi = {
  findAll: async (params: any): Promise<PaginatedResponse<Transaction>> => {
    const { data } = await api.get('/transactions', { params });
    return data;
  },

  getDashboard: async (): Promise<DashboardStats> => {
    const { data } = await api.get('/transactions/dashboard');
    return data;
  },

  // === MÉTODOS DE SYNC INDIVIDUAL (Para Barra de Progresso) ===
  syncGateway: async (): Promise<any> => {
      const { data } = await api.post(`/integrations/${MP_INTEGRATION_ID}/sync`, { fullSync: false });
      return data;
  },

  syncCustomers: async (): Promise<any> => {
      const { data } = await api.post(`/integrations/${OMIE_INTEGRATION_ID}/sync-customers`, { fullSync: false });
      return data;
  },

  syncReceivables: async (): Promise<any> => {
      const { data } = await api.post(`/integrations/${OMIE_INTEGRATION_ID}/sync-omie`, { fullSync: false });
      return data;
  },
  // ==========================================================

  triggerMatch: async (tenantId?: string, ids?: string[]): Promise<{ message: string; processed: number, matches: number, disputes: number }> => {
    try {
      const { data } = await api.post(`/integrations/${MP_INTEGRATION_ID}/match`, { ids }); 
      return data;
    }
    catch (error: any) {
        const handled = handleApiError(error, 'triggerMatch');
        if (handled.isTimeout) return { message: handled.message, processed: 0, matches: 0, disputes: 0 };
        throw error;
    } 
  },
  
  // Legado (Mantido por compatibilidade)
  runFullSync: async (): Promise<{ success: boolean, message: string }> => {
      try {
        const { data } = await api.post(`/integrations/${MP_INTEGRATION_ID}/full-sync`);
        return data;
      } catch (error: any) {
        const handled = handleApiError(error, 'runFullSync');
        if (handled.isTimeout) return { success: true, message: handled.message };
        throw error;
      }
  }, 

  getLastSyncInfo: async (): Promise<{ lastRun: string | null; status: string }> => {
    try {
        const { data } = await api.get('/integrations/status');
        return data;
    } catch (e) {
        return { lastRun: null, status: 'ERROR' };
    }
  },

  getCandidates: async (transactionId: string): Promise<ConciliationCandidate[]> => {
    const { data } = await api.get(`/transactions/${transactionId}/candidates`);
    return data;
  },

  resolveDispute: async (transactionId: string, erpReceivableId: string): Promise<void> => {
    await api.post(`/transactions/${transactionId}/resolve`, { erpReceivableId });
  },

  ignoreBatch: async (ids: string[]): Promise<{ count: number }> => {
    const { data } = await api.post('/transactions/batch-ignore', { ids });
    return data;
  },

  restoreBatch: async (ids: string[]): Promise<{ count: number }> => {
    const { data } = await api.post('/transactions/batch-restore', { ids });
    return data;
  },
  
  unmatchTransaction: async (transactionId: string): Promise<void> => {
    await api.post(`/transactions/${transactionId}/unmatch`);
  },

  settleTransaction: async (transactionId: string): Promise<void> => {
    await api.post(`/transactions/${transactionId}/settle`);
  },
  getPendingIds: async (): Promise<string[]> => {
      // Passa o ID da integração do MP para filtrar
      const { data } = await api.get(`/transactions/pending-ids?integrationId=${MP_INTEGRATION_ID}`);
      return data;
  },
};