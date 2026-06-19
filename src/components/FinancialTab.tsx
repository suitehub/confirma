import React, { useState, useMemo } from "react";
import { 
  DollarSign, 
  Search, 
  Calendar, 
  CheckCircle, 
  Clock, 
  Send,
  SlidersHorizontal,
  HelpCircle
} from "lucide-react";
import { AppState, Occurrence } from "../types";
import { formatLongBR, formatPhone, ymdFromDate } from "../utils/helpers";

interface FinancialTabProps {
  state: AppState;
  occurrences: Occurrence[];
  today: Date;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  onWaOpen: (phone: string, msg: string) => void;
}

export default function FinancialTab({
  state,
  occurrences,
  today,
  onUpdateState,
  onWaOpen
}: FinancialTabProps) {
  const [filterPeriod, setFilterPeriod] = useState<"hoje" | "semana" | "mes" | "ano" | "tudo">("mes");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBillingRecord, setSelectedBillingRecord] = useState<typeof financialRecords[0] | null>(null);
  const [billingTemplateLocal, setBillingTemplateLocal] = useState("");
  const [customMsgLocal, setCustomMsgLocal] = useState("");

  // Filter occurrences based on the selected period
  const periodOccurrences = useMemo(() => {
    const now = new Date();
    
    return occurrences.filter((o) => {
      const oDate = o.when;
      
      if (filterPeriod === "hoje") {
        return ymdFromDate(oDate) === ymdFromDate(today);
      }
      
      if (filterPeriod === "semana") {
        // Calculate the first and last day of the current week (Sunday to Saturday)
        const currentDay = today.getDay();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - currentDay);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        return oDate >= startOfWeek && oDate <= endOfWeek;
      }
      
      if (filterPeriod === "mes") {
        return oDate.getFullYear() === today.getFullYear() && oDate.getMonth() === today.getMonth();
      }
      
      if (filterPeriod === "ano") {
        return oDate.getFullYear() === today.getFullYear();
      }
      
      return true; // "tudo"
    });
  }, [occurrences, filterPeriod, today]);

  // Expand filtered period occurrences with their financial status details
  const financialRecords = useMemo(() => {
    return periodOccurrences.map((o) => {
      const patient = state.patients.find((p) => p.id === o.patientId);
      const baseSession = state.sessions.find((s) => s.id === o.sessionId);
      
      // Fallback variables
      const defaultValue = baseSession?.value !== undefined ? baseSession.value : 150;
      const defaultMethod = baseSession?.paymentMethod || "PIX";
      const defaultStatus = baseSession?.financialStatus || "Pendente";

      // Read custom instance override
      const override = state.occurrenceFinancials?.[o.key];

      const recordValue = override?.value !== undefined ? override.value : defaultValue;
      const recordMethod = override?.paymentMethod || defaultMethod;
      const recordStatus = override?.financialStatus || defaultStatus;

      const clinicalStatus = state.statuses[o.key] || "aguardando";

      return {
        key: o.key,
        sessionId: o.sessionId,
        patientId: o.patientId,
        patientName: patient?.name || "Desconhecido",
        patientPhone: patient?.phone || "",
        dateStr: ymdFromDate(o.when),
        timeStr: o.when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        when: o.when,
        value: recordValue,
        method: recordMethod,
        status: recordStatus,
        clinicalStatus
      };
    });
  }, [periodOccurrences, state.patients, state.sessions, state.occurrenceFinancials, state.statuses]);

  // Applying search filter on records list
  const filteredRecords = useMemo(() => {
    if (!searchQuery) return financialRecords;
    const q = searchQuery.toLowerCase();
    return financialRecords.filter((r) => r.patientName.toLowerCase().includes(q));
  }, [financialRecords, searchQuery]);

  // Compute total aggregates based on active period occurrences
  const aggregates = useMemo(() => {
    let receitaPrevista = 0;
    let receitaRecebida = 0;
    let receitaPendente = 0;
    let receitaPerdida = 0;

    financialRecords.forEach((r) => {
      if (r.clinicalStatus === "cancelado" || r.clinicalStatus === "falta" || r.status === "Cancelado") {
        receitaPerdida += r.value;
      } else {
        receitaPrevista += r.value;
        if (r.status === "Pago") {
          receitaRecebida += r.value;
        } else if (r.status === "Pendente") {
          receitaPendente += r.value;
        }
      }
    });

    return {
      prevista: receitaPrevista,
      recebida: receitaRecebida,
      pendente: receitaPendente,
      perdida: receitaPerdida
    };
  }, [financialRecords]);

  // Action: Mark as Paid
  const handleMarkAsPaid = (key: string, r: typeof financialRecords[0]) => {
    onUpdateState((prev) => {
      const financials = { ...(prev.occurrenceFinancials || {}) };
      financials[key] = {
        value: r.value,
        paymentMethod: r.method,
        financialStatus: "Pago"
      };
      
      // Also automatically mark the clinical status as "realizada" if it was not done or cancelled!
      const nextStatuses = { ...prev.statuses };
      if (!nextStatuses[key] || nextStatuses[key] === "aguardando") {
        nextStatuses[key] = "realizada";
      }

      return {
        ...prev,
        occurrenceFinancials: financials,
        statuses: nextStatuses
      };
    });
  };

  // Action: Enviar Cobrança via WhatsApp (Configuração interativa e pré-visualização)
  const handleSendBillingMessage = (r: typeof financialRecords[0]) => {
    setSelectedBillingRecord(r);
    const templateText = state.templates?.cobrarDefault || "Olá {nome}, tudo bem? Realizando o fechamento da nossa sessão do dia {dia} ({hora}). O valor em aberto é de R$ {valor}. Chave PIX cadastrada: seu-pix-aqui. Obrigado!";
    setBillingTemplateLocal(templateText);
    const substituted = templateText
      .replace(/{nome}/g, r.patientName)
      .replace(/{dia}/g, r.when.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }))
      .replace(/{hora}/g, r.timeStr)
      .replace(/{valor}/g, String(r.value));
    setCustomMsgLocal(substituted);
  };

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-1">
        <div>
          <h2 className="text-xl font-black text-brand-text">Fluxo Financeiro Clínico</h2>
          <p className="text-xs text-brand-muted">Acompanhe e configure o faturamento de suas sessões clínicas</p>
        </div>

        {/* Filters Selectors */}
        <div className="flex gap-1.5 overflow-x-auto self-start sm:self-auto py-1">
          {(["hoje", "semana", "mes", "ano", "tudo"] as const).map((period) => (
            <button
              key={period}
              onClick={() => setFilterPeriod(period)}
              className={`rounded-xl px-3 py-1.5 text-xs font-black capitalize whitespace-nowrap cursor-pointer transition-all ${
                filterPeriod === period
                  ? "bg-brand-primary text-white"
                  : "bg-white text-brand-muted border border-brand-border hover:bg-slate-50"
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Aggregates Dashboard Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs relative">
          <span className="text-[10px] font-black text-brand-muted uppercase block tracking-wider">Faturamento Previsto</span>
          <span className="text-2xl font-black text-slate-800 block mt-2">R$ {aggregates.prevista}</span>
          <p className="text-[10px] text-brand-muted mt-1 italic">Consultas não canceladas</p>
        </div>

        <div className="rounded-2xl border border-emerald-250 bg-emerald-50/20 p-4 shadow-xs border-emerald-100">
          <span className="text-[10px] font-black text-emerald-700 uppercase block tracking-wider">Valores Recebidos</span>
          <span className="text-2xl font-black text-emerald-800 block mt-2">R$ {aggregates.recebida}</span>
          <p className="text-[10px] text-emerald-600 mt-1 italic">Consultas marcadas como Pagas</p>
        </div>

        <div className="rounded-2xl border border-amber-250 bg-amber-50/20 p-4 shadow-xs border-amber-100">
          <span className="text-[10px] font-black text-amber-700 uppercase block tracking-wider">A Receber / Pendente</span>
          <span className="text-2xl font-black text-amber-800 block mt-2">R$ {aggregates.pendente}</span>
          <p className="text-[10px] text-amber-600 mt-1 italic">Cobranças em aberto</p>
        </div>

        <div className="rounded-2xl border border-rose-250 bg-rose-50/20 p-4 shadow-xs border-rose-100">
          <span className="text-[10px] font-black text-rose-700 uppercase block tracking-wider">Perdas p/ Faltas e Canc.</span>
          <span className="text-2xl font-black text-rose-800 block mt-2">R$ {aggregates.perdida}</span>
          <p className="text-[10px] text-rose-600 mt-1 italic">Consultas perdidas</p>
        </div>
      </div>

      {/* Main transactions list */}
      <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs space-y-4">
        
        {/* List Header and Search */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-brand-border/40 pb-3">
          <span className="text-xs font-black text-brand-text uppercase tracking-wider">Lançamentos de Consultas ({filteredRecords.length})</span>
          
          <div className="relative w-full sm:w-64">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-brand-muted" />
            <input
              type="text"
              placeholder="Pesquisar por paciente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-brand-border bg-white pl-9 pr-3 py-1.5 text-xs outline-hidden focus:border-brand-primary"
            />
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-brand-border text-[10px] font-black text-brand-muted uppercase tracking-wider bg-slate-50">
                <th className="py-2.5 px-3">Paciente</th>
                <th className="py-2.5 px-3">Data/Hora</th>
                <th className="py-2.5 px-3 text-center">Valor (R$)</th>
                <th className="py-2.5 px-3 text-center">Método</th>
                <th className="py-2.5 px-3 text-center">Clínica</th>
                <th className="py-2.5 px-3 text-center">Pagamento</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-brand-muted">
                    <SlidersHorizontal className="h-6 w-6 text-brand-muted/50 mx-auto mb-1 animate-pulse" />
                    Nenhum lançamento no período filtrado.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.key} className="border-b border-brand-border/60 text-xs hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-800">{r.patientName}</td>
                    <td className="py-3 px-3">
                      <span className="block font-black">{r.when.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                      <span className="text-[10.5px] text-brand-muted">{r.timeStr}</span>
                    </td>
                    <td className="py-3 px-3 text-center text-slate-800 font-bold">R$ {r.value}</td>
                    <td className="py-3 px-3 text-center">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-black uppercase">
                        {r.method}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {r.clinicalStatus === "aguardando" && (
                        <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase">Aguardando</span>
                      )}
                      {r.clinicalStatus === "confirmado" && (
                        <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase">Confirmado</span>
                      )}
                      {r.clinicalStatus === "realizada" && (
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase">Realizada</span>
                      )}
                      {r.clinicalStatus === "falta" && (
                        <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase">Falta</span>
                      )}
                      {r.clinicalStatus === "cancelado" && (
                        <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase">Cancelada</span>
                      )}
                      {r.clinicalStatus === "remarcar" && (
                        <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase">Remarcada</span>
                      )}
                      {r.clinicalStatus === "semresposta" && (
                        <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase">Sem Resposta</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                        r.status === "Pago" 
                          ? "bg-emerald-100 text-emerald-800" 
                          : r.status === "Isento"
                          ? "bg-purple-100 text-purple-800"
                          : r.status === "Cancelado"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        {r.status !== "Pago" && r.status !== "Isento" && (
                          <button
                            onClick={() => handleMarkAsPaid(r.key, r)}
                            className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                          >
                            <CheckCircle className="h-3 w-3" /> Receber
                          </button>
                        )}
                        <button
                          onClick={() => handleSendBillingMessage(r)}
                          className="inline-flex items-center gap-1 rounded border border-brand-border bg-white px-2 py-1 text-[10px] font-black text-brand-text hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <Send className="h-3 w-3 text-brand-muted" /> Cobrar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Configuração e Disparo de Cobrança */}
      {selectedBillingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-155">
          <div className="bg-white rounded-2xl border border-brand-border shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-50 border-b p-4 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">⚙️ Configurar e Pré-visualizar Cobrança</h3>
                <p className="text-[11px] text-brand-muted mt-0.5">Configure o modelo geral e mude livremente a mensagem antes do envio de {selectedBillingRecord.patientName}</p>
              </div>
              <button 
                onClick={() => setSelectedBillingRecord(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2.5 py-1 bg-slate-200/50 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
              >
                Voltar
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              
              {/* Box 1: General Template Config */}
              <div className="space-y-1.5 bg-slate-50/55 border rounded-xl p-3.5">
                <div className="flex justify-between items-center pb-1">
                  <label className="text-[11px] font-black text-indigo-900 uppercase tracking-wider block">Modelo de Cobrança Geral (Editável)</label>
                  <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-sm">Salvar Padrão Clínico</span>
                </div>
                <textarea
                  value={billingTemplateLocal}
                  onChange={(e) => {
                    const nextTpl = e.target.value;
                    setBillingTemplateLocal(nextTpl);
                    // Dynamically recalculate preview
                    const substituted = nextTpl
                      .replace(/{nome}/g, selectedBillingRecord.patientName)
                      .replace(/{dia}/g, selectedBillingRecord.when.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }))
                      .replace(/{hora}/g, selectedBillingRecord.timeStr)
                      .replace(/{valor}/g, String(selectedBillingRecord.value));
                    setCustomMsgLocal(substituted);
                  }}
                  className="w-full text-xs font-semibold border border-brand-border rounded-xl p-2.5 bg-white outline-hidden focus:border-indigo-500 min-h-[90px]"
                />
                <div className="flex flex-wrap gap-1.5 mt-1 text-[9px] font-bold text-brand-muted uppercase">
                  <span>Tags dinâmicas:</span>
                  <span className="text-brand-primary font-mono bg-white px-1 py-0.5 border rounded">{`{nome}`}</span>
                  <span className="text-brand-primary font-mono bg-white px-1 py-0.5 border rounded">{`{dia}`}</span>
                  <span className="text-brand-primary font-mono bg-white px-1 py-0.5 border rounded">{`{hora}`}</span>
                  <span className="text-brand-primary font-mono bg-white px-1 py-0.5 border rounded">{`{valor}`}</span>
                </div>
              </div>

              {/* Box 2: Final Preview & Customization */}
              <div className="space-y-1">
                <div className="flex justify-between items-center pb-1">
                  <label className="text-[11px] font-black text-emerald-800 uppercase tracking-wider block">Mensagem Formatada Pronta para Envio</label>
                  <span className="text-[9.5px] font-bold text-brand-muted">Livre para edições extras</span>
                </div>
                <textarea
                  value={customMsgLocal}
                  onChange={(e) => setCustomMsgLocal(e.target.value)}
                  className="w-full text-xs font-semibold border border-brand-border rounded-xl p-3 bg-slate-50/50 outline-hidden focus:border-brand-primary min-h-[110px]"
                />
              </div>

            </div>

            <div className="bg-slate-50 border-t p-4 flex flex-col sm:flex-row gap-3 sm:justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  onUpdateState(prev => ({
                    ...prev,
                    templates: {
                      ...prev.templates,
                      cobrarDefault: billingTemplateLocal
                    }
                  }));
                  alert("Modelo de cobrança financeira atualizado com sucesso no sistema!");
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-black text-indigo-700 hover:bg-indigo-50 cursor-pointer transition-colors"
              >
                Salvar Modelo como Padrão
              </button>

              <button
                type="button"
                onClick={() => {
                  onWaOpen(selectedBillingRecord.patientPhone, customMsgLocal);
                  setSelectedBillingRecord(null);
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 border border-emerald-700 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-700 cursor-pointer shadow-sm uppercase tracking-wider transition-colors"
              >
                Disparar WhatsApp ⚡
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
