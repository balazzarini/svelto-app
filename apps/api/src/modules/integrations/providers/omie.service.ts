import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { SecurityService, EncryptedData } from '../../security/security.service';
import { lastValueFrom } from 'rxjs';

interface OmieRequest {
  call: string;
  app_key: string;
  app_secret: string;
  param: any[];
}

@Injectable()
export class OmieService {
  private readonly logger = new Logger(OmieService.name);
  private readonly BASE_URL = 'https://app.omie.com.br/api/v1';

  constructor(
    private readonly httpService: HttpService,
    private readonly securityService: SecurityService,
  ) {}

  async executeCall(
    credentials: EncryptedData,
    endpoint: string,
    call: string,
    params: any
  ): Promise<any> {
    const decrypted = this.securityService.decrypt(credentials);
    const [appKey, appSecret] = decrypted.split(':');

    if (!appKey || !appSecret) {
      throw new Error('Credenciais Omie inválidas. Formato esperado: APP_KEY:APP_SECRET');
    }

    const payload: OmieRequest = {
      call: call,
      app_key: appKey,
      app_secret: appSecret,
      param: [params],
    };

    const url = `${this.BASE_URL}/${endpoint}`;
    this.logger.debug(`🚀 [Omie Request] Disparando para ${url} (Call: ${call})`);

    try {
      const response = await lastValueFrom(
        this.httpService.post(url, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000, 
        })
      );

      // Tratamento de Erro de Negócio do Omie (200 OK mas com faultstring)
      if (response.data.faultstring) {
        // Ignora erro específico de cliente não encontrado se for apenas uma consulta
        if (response.data.faultstring.includes('ERROR: ConsultarCliente')) {
             return { faultstring: response.data.faultstring }; 
        }
        
        // Log detalhado para debug
        this.logger.error(`❌ [Omie Fault] Call: ${call} | Error: ${response.data.faultstring}`);
        throw new Error(`Erro Omie: ${response.data.faultstring}`);
      }

      return response.data;

    } catch (error) {
      // DEBUG DE REDE PROFUNDO
      if (error.response) {
        this.logger.error(`🔥 [Omie HTTP Error] Status: ${error.response.status} | Call: ${call}`);
        this.logger.error(`Payload Enviado: ${JSON.stringify(params)}`);
        this.logger.error(`Resposta Erro: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        this.logger.error(`Timeout ou Erro de Rede: O Omie não respondeu para ${call}.`);
      } else {
        this.logger.error(`Erro ao montar requisição: ${error.message}`);
      }
      throw error;
    }
  }

  // ... (Outros métodos: consultarContaReceber, listarContasReceber, listarContasCorrentes...)
  async consultarContaReceber(credentials: EncryptedData, nCodTitulo: number) {
    return this.executeCall(credentials, 'financas/contareceber/', 'ConsultarContaReceber', { nCodTitulo });
  }

  async listarContasReceber(credentials: EncryptedData, filters: any = {}) {
     return this.executeCall(credentials, 'financas/contareceber/', 'ListarContasReceber', filters);
  }

  async listarContasCorrentes(credentials: EncryptedData) {
    const result = await this.executeCall(
      credentials,
      'geral/contacorrente/', 
      'ListarContasCorrentes', 
      { pagina: 1, registros_por_pagina: 100, apenas_importado_api: 'N' }
    );
    return result.ListarContasCorrentes || result.conta_corrente_cadastro || [];
  }

  async consultarClientePorDoc(credentials: EncryptedData, doc: string) {
    const cpfCnpj = doc.replace(/\D/g, ''); 
    const result = await this.executeCall(
        credentials, 'geral/clientes/', 'ListarClientes',
        { pagina: 1, registros_por_pagina: 1, clientes_filtro: { cnpj_cpf: cpfCnpj } }
    );
    if (result.clientes_cadastro && result.clientes_cadastro.length > 0) return result.clientes_cadastro[0];
    return null;
  }

  async listarClientes(credentials: EncryptedData, page: number = 1, limit: number = 500, filters: any = {}) {
     return this.executeCall(
        credentials,
        'geral/clientes/',
        'ListarClientes',
        { 
          pagina: page, 
          registros_por_pagina: limit, 
          apenas_importado_api: 'N', 
          ...filters 
        }
     );
  }

  async lancarRecebimento(credentials: EncryptedData, params: {
      codigo_lancamento: number;      
      codigo_conta_corrente: number;  
      valor: number;                  
      desconto: number;               
      data: string;                   
      observacao?: string;            
      conciliar_documento?: string;   
  }) {
      return this.executeCall(credentials, 'financas/contareceber/', 'LancarRecebimento', params);
  }

  // ===========================================================================
  // NOVO: Lançamento em Conta Corrente (Para Taxas)
  // ===========================================================================
  async incluirLancamentoContaCorrente(credentials: EncryptedData, params: {
    cCodIntLanc?: string; // Chave de Idempotência
    cabecalho: {
        nCodCC: number;
        dDtLanc: string;
        nValorLanc: number;
    },
    detalhes: {
        cCodCateg: string; 
        cTipo: 'DEB' | 'CRED'; 
        nCodCliente?: number;
        cNumDoc?: string; 
        cObs?: string;
    }
  }) {
      return this.executeCall(credentials, 'financas/contacorrentelancamentos/', 'IncluirLancCC', params);
  }
  // NOVO: Alteração de Lançamento em C/C (Para forçar atualização/conciliação)
  async alterarLancamentoContaCorrente(credentials: EncryptedData, params: {
    cCodIntLanc: string; // Chave de Idempotência Obrigatória
    cabecalho: {
        nCodCC: number;
        dDtLanc: string;
        nValorLanc: number;
    },
    detalhes: {
        cCodCateg: string; 
        cTipo: 'DEB' | 'CRED'; 
        nCodCliente?: number;
        cNumDoc?: string; 
        cObs?: string;
    }
  }) {
      return this.executeCall(credentials, 'financas/contacorrentelancamentos/', 'AlterarLancCC', params);
  }
}