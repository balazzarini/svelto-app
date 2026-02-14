# **Svelto SaaS \- Roadmap Executivo & Status**

**Última Atualização:** 25/01/2026

**Versão do Core:** v3.2 (Dispute Resolution Stable)

## **🎯 Visão Geral**

Sistema Operacional Financeiro para conciliação automatizada entre Gateways (Mercado Pago) e ERP (Omie), focado em integridade de dados e auditoria de taxas.

## **✅ Milestone 1: Fundação e Ingestão (CONCLUÍDO)**

* ( X ) **Monorepo:** Estrutura NestJS \+ Next.js estabilizada.  
* ( X ) **Segurança:** Envelope Encryption para tokens.  
* ( X ) **Ingestão MP:** Sync de vendas com detalhamento de taxas (MDR, Financing).  
* ( X ) **Ingestão Omie:** Sync de Clientes e Títulos a Receber com enriquecimento de dados.

## **✅ Milestone 2: O Motor de Conciliação (CONCLUÍDO)**

* ( X ) **Algoritmo Híbrido:** Hard Match (NSU) \+ Smart Match (Valor/Data/Nome).  
* ( X ) **Gestão de Disputas:** Identificação de ambiguidade e criação de candidatos.  
* ( X ) **Interface de Operação:** DataTable com filtros server-side, ordenação e ações em lote.  
* ( X ) **Fluxo de Correção:** Funcionalidades de Ignorar, Restaurar e Desfazer Vínculo (Unmatch).

## **🚧 Milestone 3: Execução Financeira & Exceções (EM ANDAMENTO)**

* (  ) **Lógica de Chargeback e Reembolso:** Mapeamento correto de status (in\_process, settled, reimbursed, refunded).  
* (  ) **Baixa no ERP ("Botão Vermelho"):** Escrita do recebimento e no pagamento (chargeback/reembolso) no Omie.  
* (  ) **Dashboard Gerencial:** Gráficos de fluxo e divergência de taxas.

## **🔮 Milestone 4: Escala e Produto**

* (  ) **Scheduler:** Construir o orquestrador de sincronização automática levando em consideração uma arquitetura escalável para várias contas de clientes.  
* (  ) **Multi-Tenant:** Isolamento lógico completo. Com as configurações e parametros por tenant  
* (  ) **Multi-Gateway:** Abstração para Pagar.me/Stripe/Appmax.  
* (  ) **Billing:** Cobrança do SaaS