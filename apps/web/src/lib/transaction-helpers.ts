import { 
  CreditCard, QrCode, FileText, Wallet, AlertOctagon, CheckCircle2, 
  Hourglass, Ban, ShieldAlert, ShoppingBag, ArrowUpRight, Zap, TrendingDown, // <-- Adicionado aqui
  Landmark
} from "lucide-react";

/**
 * Classifica a operação para Auditoria.
 * isSale: true (Entrada de Receita), false (Movimentação Interna/Saída)
 */
export const getOperationInfo = (type: string | null | undefined) => {
  const t = type?.toLowerCase() || "unknown";

  const map: Record<string, { label: string; color: string; icon: any; isSale: boolean }> = {
    // Vendas (Entradas Operacionais)
    "regular_payment": { label: "Venda Online", color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: ShoppingBag, isSale: true },
    "pos_payment": { label: "Maquininha", color: "text-blue-700 bg-blue-50 border-blue-200", icon: CreditCard, isSale: true },
    "payment_addition": { label: "Adição Dinheiro", color: "text-blue-700 bg-blue-50 border-blue-200", icon: ArrowUpRight, isSale: true },
    "recurring_payment": { label: "Assinatura", color: "text-purple-700 bg-purple-50 border-purple-200", icon: Zap, isSale: true },
    "payment_link": { label: "Link Pgto", color: "text-indigo-700 bg-indigo-50 border-indigo-200", icon: ShoppingBag, isSale: true },

    // Não-Vendas (Saídas, Compras Pessoais, Investimentos)
    "money_transfer": { label: "Transferência", color: "text-slate-600 bg-slate-100 border-slate-200", icon: ArrowUpRight, isSale: false },
    "investment": { label: "Investimento", color: "text-amber-700 bg-amber-50 border-amber-200", icon: TrendingDown, isSale: false },
    "cellphone_recharge": { label: "Recarga Celular", color: "text-slate-600 bg-slate-100 border-slate-200", icon: Zap, isSale: false },
    "payment_order": { label: "Pgto Conta", color: "text-red-600 bg-red-50 border-red-200", icon: FileText, isSale: false },
    "bank_transfer": { label: "TED/DOC", color: "text-slate-600 bg-slate-100 border-slate-200", icon: Landmark, isSale: false },
    
    // Fallback
    "unknown": { label: t, color: "text-gray-500 bg-gray-50 border-gray-200", icon: AlertOctagon, isSale: false }
  };

  return map[t] || { ...map["unknown"], label: t };
};

export const translateStatusDetail = (detail: string | null | undefined) => {
  if (!detail) return null;

  const map: Record<string, { label: string; color: string; icon?: any }> = {
    "accredited": { label: "Aprovado", color: "text-emerald-600", icon: CheckCircle2 },
    "reimbursed": { label: "Contestado ganho", color: "text-emerald-600", icon: ShieldAlert },
    "settled": { label: "Contestado perdido", color: "text-red-600", icon: ShieldAlert },
    "in_process": { label: "Em disputa", color: "text-amber-600", icon: Hourglass },
    "pending_waiting_payment": { label: "Aguardando Pagto", color: "text-amber-600", icon: Hourglass },
    "pending_waiting_transfer": { label: "Aguardando Pagto", color: "text-amber-600", icon: Hourglass },
    "pending_contingency": { label: "Processando", color: "text-amber-600", icon: Hourglass },
    "pending_review_manual": { label: "Em Revisão", color: "text-blue-600", icon: AlertOctagon },
    "cc_rejected_insufficient_amount": { label: "Saldo Insuficiente", color: "text-red-500", icon: Ban },
    "cc_rejected_card_disabled": { label: "Cartão Desabilitado", color: "text-red-500", icon: Ban },
    "cc_rejected_card_type_not_allowed": { label: "Cartão Inválido", color: "text-red-500", icon: Ban },
    "cc_rejected_other_reason": { label: "Recusado", color: "text-red-500", icon: Ban },
    "cc_rejected_high_risk": { label: "RISCO FRAUDE", color: "text-rose-700 font-bold", icon: ShieldAlert },
    "cc_rejected_blacklist": { label: "Bloqueado (Blacklist)", color: "text-rose-700 font-bold", icon: ShieldAlert },
    "expired": { label: "Expirado", color: "text-slate-400", icon: Ban },
    "refunded": { label: "Reembolsado", color: "text-purple-600", icon: ArrowUpRight },
    "partially_refunded": { label: "Reembolso Parcial", color: "text-purple-600", icon: ArrowUpRight },
  };

  return map[detail] || { label: detail, color: "text-slate-500" };
};

export const getPaymentMethodInfo = (method: string, installments: number) => {
  const normalized = method?.toLowerCase() || "";
  
  let info = { 
    label: "Outro", 
    brandColor: "bg-slate-50 text-slate-600 border-slate-200", 
    Icon: CreditCard, 
    type: installments > 1 ? `${installments}x` : "À Vista"
  };

  if (normalized.includes("pix")) {
    return { label: "PIX", brandColor: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: QrCode, type: "Instantâneo" };
  }
  if (normalized.includes("boleto") || normalized.includes("bolbradesco") || normalized.includes("pec")) {
    return { label: "Boleto", brandColor: "bg-yellow-50 text-yellow-700 border-yellow-200", Icon: FileText, type: "Bancário" };
  }
  if (normalized.includes("account_money")) {
    return { label: "Saldo Conta", brandColor: "bg-blue-50 text-blue-700 border-blue-200", Icon: Wallet, type: "Digital" };
  }

  // Cartões
  if (normalized.includes("visa")) { info.label = "Visa"; info.brandColor = "bg-blue-50 text-blue-800 border-blue-200"; }
  else if (normalized.includes("master")) { info.label = "Mastercard"; info.brandColor = "bg-orange-50 text-orange-800 border-orange-200"; }
  else if (normalized.includes("elo")) { info.label = "Elo"; info.brandColor = "bg-red-50 text-red-800 border-red-200"; }
  else if (normalized.includes("amex")) { info.label = "Amex"; info.brandColor = "bg-cyan-50 text-cyan-800 border-cyan-200"; }
  else if (normalized.includes("hiper")) { info.label = "Hipercard"; info.brandColor = "bg-rose-50 text-rose-800 border-rose-200"; }

  return info;
};