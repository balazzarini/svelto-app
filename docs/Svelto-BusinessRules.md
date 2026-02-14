# **Svelto SaaS \- Regras de Negócio e Lógica Financeira**

**Versão:** 1.2

**Autoridade:** Svelto Architect

## **1\. Visão Geral do Produto**

- O Svelto SaaS é uma plataforma de inteligência e conciliação financeira multi-tenant projetada para auditar, conferir e integrar o fluxo de caixa de empresas que operam com múltiplos meios de pagamento digitais (Gateways: Mercado pago, Appmax, Pagar.me) e necessitam de controle rigoroso em seus sistemas de gestão (ERPs: Omie, Bling, Tiny).

- Diferencial Central: Auditoria Forense ("Engenharia da Verdade"). O sistema não assume que o Gateway ou o ERP estão certos; ele confronta os dados para encontrar divergências de taxas, prazos e valores líquidos.

## **2\. Princípios Fundamentais**

### **RN01 \- A Quádrupla Verdade**

Cada transação existe em quatro estados simultâneos que devem ser monitorados:

1. **Operacional (Gateway):** O status da venda (Aprovado, Recusado).  
2. **Contábil (ERP):** O título a receber (Aberto, Baixado).  
3. **Financeira (Auditoria):** O cálculo de taxas e líquidos esperado.  
4. **Bancária (Extrato):** O dinheiro efetivo na conta (Settlement).

### **RN02 \- State Locking (Autoridade de Estado)**

- **Estados Voláteis (PENDING, MATCHED):** O Gateway tem autoridade. Atualizações de status no MP refletem no Svelto.  
- **Estados Terminais (CONCILIATED):** O Svelto tem autoridade. O Gateway não pode alterar uma transação já baixada no ERP, exceto em caso de **Desastre** (Chargeback, Reembolso).

## **2\. Motor de Conciliação (Matchmaker)**

### **RN03 \- Hierarquia de Match**

1. **Hard Match:** Transaction.gatewayId \=== ErpReceivable.erpNsu (Confiança 100%).  
2. **Smart Match:** Valor , Data (-1/7+ dias), Nome.  
   - Se \> 1 candidato: Gera status AMBIGUOUS.

### **RN04 \- Enriquecimento de Dados**

Os títulos do Omie (Recebíveis) devem ser enriquecidos com customerName e customerDoc cruzando com a tabela local de Clientes, pois a API de títulos não fornece esses dados nativamente.

## **3\. Gestão de Exceções: Chargebacks e Reembolsos**

O tratamento de disputas segue a lógica de ciclo de vida do Mercado Pago:

### **RN05 \- Ciclo do Chargeback**

Detalhamento dos gatewayStatus e dos statusDetail (Pai-Filho).

- pending: O usuário ainda não concluiu o processo de pagamento (por exemplo, após gerar um boleto, o pagamento será concluído quando o usuário pagar no local selecionado
- approved: O pagamento foi aprovado e creditado com sucesso.  
- accredited: Pagamento creditado.  
- authorized: O pagamento foi autorizado, mas ainda não foi capturado.  
- in\_process: O pagamento está em análise.  
- in\_mediation: O usuário iniciou uma disputa.  
- rejected: O pagamento foi rejeitado (o usuário pode tentar pagar novamente).  
- cancelled: O pagamento foi cancelado por uma das partes ou expirou.  
- refunded: O pagamento foi reembolsado ao usuário.
  - refunded: O pagamento foi devolvido pelo vendedor. A transação agora precisa estar disponível para ser vinculada a um contas a pagar.  
- charged\_back: Um chargeback foi aplicado no cartão de crédito do comprador. A transação precisa ser alterada  para o status CHARGEBACK e o usuário precisa ser notificado visualmente pois pode ser uma transação já vinculada, com contas a receber quitado e lançamentos conciliados no ERP.  
  - in\_process: Para pagamentos com o status charged\_back, o pagamento está em processo de disputa. O usuário precisa ser informado com alerta que o valor está bloqueado na carteira do mercado pago.  
  - settled: Para pagamentos com o status charged\_back, o dinheiro foi devolvido para o cliente. O usuário precisa ser notificado e a transação precisa receber um status que facilite vincula-la agora a um contas a pagar no ERP.  
  - reimbursed: Para pagamentos com o status charged\_back, o dinheiro foi desbloqueado na conta da loja após a disputa. Aqui precisamos entender se a transação já fora conciliada ou não

  1. **Abertura (Disaster Start):**

  - **Gatilho:** MP envia no statusDetail in\_process.
  - **Ação Svelto:** Mudar status para CHARGEBACK imediatamente. Hoje, esse estado somente congela o valor na conta do mercado pago. {É interessante pensar em uma forma de notificar o usuário, mas não é necessário reverter}  

  2. **Perda (Settled):**

  - **Gatilho:** MP envia statusDetail settled.  
  - **Ação Svelto:** Manter CHARGEBACK. Gerar alerta de perda financeira definitiva. Necessário lançar saída no ERP (Contas a Pagar), portanto, precisamos habilitar o vinculo & conciliação com o contas a pagar.Ainda vamos desenvolver essa etapa.

  3. **Vitória/Cobertura (Reimbursed):**

  - **Gatilho:** MP envia statusDetail reimbursed.  
  - **Ação Svelto:** Reverter status para APPROVED ou MATCHED se já estava vinculado, ou CONCILIATED se o valor já foi creditado e conciliado com o contas a receber. O dinheiro foi devolvido ao lojista.

### **RN06 \- Reembolso Voluntário (Refund)**

1. **Gatilho:** MP envia gatewayStatus e statusDetail refunded.  
2. **Ação Svelto:** Marcar como novo status REFUNDED. Indica saída de caixa voluntária. Nesse caso também precisaremos agora associar a transação a um contas a pagar.

## **4\. Regras de Negócio (As Leis do Sistema)**

### **RN07 \- A Regra da Independência**

O Svelto deve entregar valor (Auditoria de Taxas) mesmo que o usuário não conecte um ERP. A conexão com o Omie é um "Power-Up", não um requisito bloqueante para a análise de vendas do Gateway.

### **RN08 \- A Regra da Autoridade de Estado (State Locking)**

● Estados Voláteis (PENDING, MATCHED): O Gateway tem autoridade. Se o MP mudar o status de "Pendente" para "Aprovado", o Svelto atualiza.

● Estados Terminais (CONCILIATED, PAID\_OUT): O Svelto tem autoridade. O Gateway não pode alterar um registro que o usuário já marcou como "Conciliado/Baixado", garantindo a estabilidade do fechamento contábil, exceto em caso de reembolso voluntário ou chargeback detalhados nos tópicos RN05 e RN06 do capitulo 3 desse manual.

### **RN08 \- A Regra da Competência vs. Caixa**

● O Svelto respeita a data da venda (dateEvent) para relatórios de Competência (Vendas do Mês).

● O Svelto respeita a data de liberação “money\_release\_date” para relatórios de Caixa (O que vai cair na conta hoje).

### **RN09 \- A Regra do Vínculo Bancário**

Toda integração de Gateway (ex: "Conta MP Loja 1") deve ser explicitamente mapeada para uma Conta Corrente interna do ERP (ex: "Banco 123 \- MP"). Sem esse vínculo, a baixa automática é proibida para evitar lançamentos na conta errada (ex: lançar MP no Itaú).

### **RN10 \- A Regra da Tolerância Zero para Duplicidade**

Antes de enviar qualquer comando de escrita (Baixa/Inclusão) para o Omie, o sistema deve verificar se a operação já foi realizada (ConsultarContaReceber \-\> Status LIQUIDADO). Em caso de dúvida, o sistema não faz nada e alerta o usuário.

### **RN11 \- A Regra da Liquidação Parcelada**

Uma Transação (Venda) parcelada só transita para o status final CONCILIATED quando a soma de todos os Settlements (Recebimentos) vinculados a ela cobrir 100% do amountNetGateway. Enquanto houver saldo remanescente, a transação permanece em estado de auditoria/acompanhamento, mas as baixas parciais podem ser enviadas ao ERP mês a mês. Esse processo só ocorre quando o parcelamento é pela loja. Nos parcelamentos por cliente essa regra não se aplica

### **RN12 \- A regra da independencia**

1. O usuário tem que ter a possibilidade de usar o sistema para simplesmente auditar os gateways de pagamento, conferindo a taxa de desconto aplicada de acordo com o meio de pagamento. Auditar se a data de liquidação está sendo cumprida.

2. A arquitetura do sistema precisa estar preparada para trabalhar qualquer um dos gateways com qualquer um dos ERPs, ou seja, cada método, processo, rotina precisa estar muito bem definida para viabilizar essa interoperabilidade.

3. O sistema precisa estar apto a multi-tenants, ou seja, vários ambientes ("Clientes") diferentes. O usuário, pode ser um contador que, neste caso, pode acessar mais de um ambiente

## **5. Glossário de Campos**

- amountGross: Valor pago pelo cliente.  
- amountNetGateway: Valor líquido repassado pelo gateway.  
- amountPaidByCustomer: Total pago (incluindo juros do comprador).  
- gatewayStatus: Status original bruto (ex: approved).  
- statusDetail : Detalhamento do gatewayStatus. É nossa base pra resolver o que fazer com a transação no processo de match quando mercado pago  
- status: Status de trabalho do Svelto (ex: PENDING, MATCHED)