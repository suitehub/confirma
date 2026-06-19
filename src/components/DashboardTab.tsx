import React, { useMemo } from "react";
import { 
  Users, 
  Calendar, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  DollarSign, 
  UserMinus, 
  ArrowRight,
  Sparkles,
  HelpCircle
} from "lucide-react";
import { AppState, Occurrence } from "../types";
import { formatLongBR, formatPhone, ymdFromDate } from "../utils/helpers";

interface DashboardTabProps {
  state: AppState;
  occurrences: Occurrence[];
  today: Date;
  onTabChange: (tab: any) => void;
  onSelectPatient: (patientId: string) => void;
  onFinalizeSession?: (o: Occurrence) => void;
}

export default function DashboardTab({
  state,
  occurrences,
  today,
  onTabChange,
  onSelectPatient,
  onFinalizeSession
}: DashboardTabProps) {
  
  // Calculate today indicators
  const todayOccs = useMemo(() => {
    return occurrences.filter((o) => ymdFromDate(o.when) === ymdFromDate(today));
  }, [occurrences, today]);

  const statsToday = useMemo(() => {
    let confirmadas = 0;
    let aguardando = 0;
    let canceladas = 0;
    let remarcadas = 0;

    todayOccs.forEach((o) => {
      const status = state.statuses[o.key] || "aguardando";
      if (status === "confirmado") confirmadas++;
      else if (status === "aguardando") aguardando++;
      else if (status === "cancelado" || status === "semresposta") canceladas++;
      else if (status === "remarcar") remarcadas++;
    });

    return {
      total: todayOccs.length,
      confirmadas,
      aguardando,
      canceladas,
      remarcadas
    };
  }, [todayOccs, state.statuses]);

  // Month stats calculation
  const statsMonth = useMemo(() => {
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    const monthOccs = occurrences.filter((o) => o.when >= firstDayOfMonth && o.when <= lastDayOfMonth);

    let realizadas = 0;
    let cancelamentos = 0;
    let faltas = 0;

    monthOccs.forEach((o) => {
      const status = state.statuses[o.key] || "aguardando";
      if (status === "realizada" || (o.when < today && status === "confirmado")) {
        realizadas++;
      } else if (status === "cancelado" || status === "remarcar") {
        cancelamentos++;
      } else if (status === "falta") {
        faltas++;
      }
    });

    const totalAgendadas = monthOccs.length;
    const totalCompareceramOuFaltaram = realizadas + faltas;
    const taxaComparecimento = totalCompareceramOuFaltaram > 0 
      ? Math.round((realizadas / totalCompareceramOuFaltaram) * 100) 
      : 100;

    return {
      totalRealizadas: realizadas,
      totalCancelamentos: cancelamentos,
      totalFaltas: faltas,
      totalAgendadas,
      taxaComparecimento
    };
  }, [occurrences, state.statuses, today]);

  // Financial stats calculation (this month)
  const statsFinance = useMemo(() => {
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    const monthOccs = occurrences.filter((o) => o.when >= firstDayOfMonth && o.when <= lastDayOfMonth);

    let prevista = 0;
    let recebida = 0;
    let pendente = 0;
    let perdida = 0;

    monthOccs.forEach((o) => {
      const baseSession = state.sessions.find(s => s.id === o.sessionId);
      const val = baseSession?.value !== undefined ? baseSession.value : 150;
      
      const finState = state.occurrenceFinancials?.[o.key] || {
        value: val,
        paymentMethod: baseSession?.paymentMethod || "PIX",
        financialStatus: baseSession?.financialStatus || "Pendente"
      };

      const status = state.statuses[o.key] || "aguardando";

      if (status === "cancelado") {
        perdida += finState.value;
      } else if (status === "falta") {
        perdida += finState.value;
      } else {
        prevista += finState.value;
        if (finState.financialStatus === "Pago") {
          recebida += finState.value;
        } else if (finState.financialStatus === "Pendente") {
          pendente += finState.value;
        } else if (finState.financialStatus === "Isento") {
          // No addition to recebida/pendente
        }
      }
    });

    return {
      prevista,
      recebida,
      pendente,
      perdida
    };
  }, [occurrences, state.sessions, state.occurrenceFinancials, state.statuses, today]);

  // At-risk patients list evaluation
  const atRiskPatients = useMemo(() => {
    const list: Array<{ patientId: string; name: string; phone: string; reason: string; level: "alta" | "media" | "baixa" }> = [];
    const nowMs = Date.now();

    state.patients.forEach((p) => {
      // Find occurrences of this patient
      const pOccs = occurrences
        .filter((o) => o.patientId === p.id)
        .sort((a, b) => b.when.getTime() - a.when.getTime());

      if (pOccs.length === 0) return;

      const pastOccs = pOccs.filter((o) => o.when < today);
      const futureOccs = pOccs.filter((o) => o.when >= today);

      // Rule a: 2 consecutive absences
      let consecutiveAbsences = 0;
      const sortedPastOccsByDateAsc = [...pastOccs].sort((a,b) => a.when.getTime() - b.when.getTime());
      
      let count = 0;
      for (let i = sortedPastOccsByDateAsc.length - 1; i >= 0; i--) {
        const status = state.statuses[sortedPastOccsByDateAsc[i].key] || "aguardando";
        if (status === "falta") {
          count++;
        } else if (status === "realizada" || status === "confirmado") {
          break;
        }
      }
      consecutiveAbsences = count;

      // Rule b: 3 reschedules in 30 days
      const thirtyDaysAgoMs = nowMs - 30 * 24 * 60 * 60 * 1000;
      const recentReschedules = pOccs.filter(o => o.when.getTime() >= thirtyDaysAgoMs && state.statuses[o.key] === "remarcar");

      // Rule c: 30 days without next scheduled session
      const hasFuture = futureOccs.length > 0;
      const lastSessionDate = pastOccs[0]?.when;
      const daysSinceLastSession = lastSessionDate ? Math.floor((nowMs - lastSessionDate.getTime()) / (24 * 60 * 60 * 1000)) : 999;

      // Rule d: 45 days since last attendance
      const lastAttendedSession = pastOccs.find(o => state.statuses[o.key] === "realizada" || state.statuses[o.key] === "confirmado");
      const daysSinceLastAttendance = lastAttendedSession ? Math.floor((nowMs - lastAttendedSession.when.getTime()) / (24 * 60 * 60 * 1000)) : 999;

      if (consecutiveAbsences >= 2) {
        list.push({
          patientId: p.id,
          name: p.name,
          phone: p.phone,
          reason: "Registrou 2 faltas consecutivas sem justificativa.",
          level: "alta"
        });
      } else if (daysSinceLastAttendance >= 45 && lastAttendedSession) {
        list.push({
          patientId: p.id,
          name: p.name,
          phone: p.phone,
          reason: `Ficou mais de 45 dias sem comparecer (último em ${ymdFromDate(lastAttendedSession.when)}).`,
          level: "alta"
        });
      } else if (recentReschedules.length >= 3) {
        list.push({
          patientId: p.id,
          name: p.name,
          phone: p.phone,
          reason: "Remarcou consultas 3 vezes nos últimos 30 dias.",
          level: "media"
        });
      } else if (!hasFuture && daysSinceLastSession >= 30 && lastSessionDate) {
        list.push({
          patientId: p.id,
          name: p.name,
          phone: p.phone,
          reason: `Está há mais de 30 dias sem agendamento futuro de terapia.`,
          level: "baixa"
        });
      }
    });

    return list;
  }, [state.patients, occurrences, state.statuses, today]);

  // Patients with no future scheduled appointments
  const patientsWithNoFutureAppointments = useMemo(() => {
    return state.patients.filter((p) => {
      const hasFuture = occurrences.some((o) => o.patientId === p.id && o.when >= today);
      return !hasFuture;
    });
  }, [state.patients, occurrences, today]);

  // Occurrences (past 30 days) of attended sessions (realizada or confirmed) missing a recorded evolution note
  const occurrencesWithMissingEvolutions = useMemo(() => {
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return occurrences.filter((o) => {
      // Must be in the past
      if (o.when < thirtyDaysAgo || o.when >= today) return false;

      // Status must be either "realizada" or "confirmado" (attended)
      const status = state.statuses[o.key] || "aguardando";
      if (status !== "realizada" && status !== "confirmado") return false;

      // Must not have an evolution with matching occurrenceKey or patient + date combination
      const hasNote = (state.evolutions || []).some(
        (e) => e.occurrenceKey === o.key || (e.patientId === o.patientId && e.date === ymdFromDate(o.when))
      );
      return !hasNote;
    });
  }, [occurrences, state.statuses, state.evolutions, today]);

  // Quick action alerts
  const alertsList = useMemo(() => {
    const list: Array<{ id: string; type: "risco" | "financeiro" | "confirmacao" | "atencao"; title: string; desc: string; actionText: string; actionTab: any; actionParam?: string }> = [];

    // Alert 1: High risk patients
    const highRisk = atRiskPatients.filter(p => p.level === "alta");
    if (highRisk.length > 0) {
      list.push({
        id: "alert-risk",
        type: "risco",
        title: `${highRisk.length} Pacientes em Alto Risco`,
        desc: "Pacientes estão prestes a abandonar a terapia devido a faltas consecutivas ou ausência de comparecimento.",
        actionText: "Ver Pacientes em Risco",
        actionTab: "risk"
      });
    }

    // Alert 1.5: Missing clinical evolutions
    if (occurrencesWithMissingEvolutions.length > 0) {
      list.push({
        id: "alert-missing-evolutions",
        type: "atencao",
        title: `${occurrencesWithMissingEvolutions.length} Evoluções Pendentes`,
        desc: "Você possui consultas realizadas nos últimos 30 dias que ainda estão sem registro de evolução clínica.",
        actionText: "Registrar Prontuários",
        actionTab: "patients"
      });
    }

    // Alert 2: High pending value
    if (statsFinance.pendente > 150) {
      list.push({
        id: "alert-finance",
        type: "financeiro",
        title: `R$ ${statsFinance.pendente} Pendentes de Pagamento`,
        desc: "Você possui valores pendentes de consultas realizadas neste mês.",
        actionText: "Cobrar Pendentes",
        actionTab: "financial"
      });
    }

    // Alert 3: Sessions awaiting confirmation
    if (statsToday.aguardando > 0) {
      list.push({
        id: "alert-confirm",
        type: "confirmacao",
        title: `${statsToday.aguardando} Confirmações Pendentes Hoje`,
        desc: "Envie mensagens rápidas de confirmação via WhatsApp para as sessões de hoje.",
        actionText: "Enviar Confirmações",
        actionTab: "today"
      });
    }

    // Alert 4: Patients with no future appointment
    if (patientsWithNoFutureAppointments.length > 0) {
      list.push({
        id: "alert-no-future",
        type: "atencao",
        title: `${patientsWithNoFutureAppointments.length} Pacientes sem Sessão Futura`,
        desc: "Pacientes ativos estão sem novas datas de sessões agendadas.",
        actionText: "Ver Recomendações",
        actionTab: "patients"
      });
    }

    return list;
  }, [atRiskPatients, statsFinance.pendente, statsToday.aguardando, patientsWithNoFutureAppointments, occurrencesWithMissingEvolutions]);

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="rounded-2xl border border-brand-primary/20 bg-linear-to-r from-brand-primary/10 to-emerald-500/10 p-5 shadow-xs relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1 text-[10px] font-black text-brand-primary uppercase tracking-widest bg-brand-primary/10 rounded-full px-2.5 py-1 mb-2.5">
            <Sparkles className="h-3 w-3 text-emerald-600 animate-spin" /> Painel Geral Ativo
          </span>
          <h2 className="text-xl font-black text-brand-text">Bem-vindo ao Confirma 2.0!</h2>
          <p className="text-xs text-brand-muted mt-1 leading-relaxed">
            Sua clínica resumida de ponta a ponta. Gerencie indicadores diários, acompanhe a saúde financeira, identifique riscos de evasão e envie lembretes rápidos por WhatsApp.
          </p>
        </div>
        <div className="absolute top-1/2 -right-8 -translate-y-1/2 opacity-5 pointer-events-none hidden md:block">
          <TrendingUp className="h-44 w-44 text-brand-primary" />
        </div>
      </div>

      {/* Grid of indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Indicators of the Day */}
        <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-brand-border/40 pb-2.5 mb-3.5">
            <Calendar className="h-4 w-4 text-brand-primary" />
            <span className="text-xs font-black text-brand-text uppercase tracking-wider">Como está o seu dia hoje?</span>
          </div>

          <div className="grid grid-cols-5 gap-2 text-center">
            <div className="bg-slate-50 rounded-xl p-2.5">
              <span className="block text-lg font-black text-brand-text">{statsToday.total}</span>
              <span className="text-[9px] font-bold text-brand-muted uppercase block leading-tight mt-0.5">Sessões</span>
            </div>
            <div className="bg-emerald-50/50 rounded-xl p-2.5 border border-emerald-100">
              <span className="block text-lg font-black text-emerald-800">{statsToday.confirmadas}</span>
              <span className="text-[9px] font-bold text-emerald-700 uppercase block leading-tight mt-0.5">Confirm.</span>
            </div>
            <div className="bg-amber-50/50 rounded-xl p-2.5 border border-amber-100">
              <span className="block text-lg font-black text-amber-800">{statsToday.aguardando}</span>
              <span className="text-[9px] font-bold text-amber-700 uppercase block leading-tight mt-0.5">Aguard.</span>
            </div>
            <div className="bg-slate-100 rounded-xl p-2.5">
              <span className="block text-lg font-black text-slate-700">{statsToday.remarcadas}</span>
              <span className="text-[9px] font-bold text-slate-500 uppercase block leading-tight mt-0.5">Remarc.</span>
            </div>
            <div className="bg-rose-50/50 rounded-xl p-2.5 border border-rose-100">
              <span className="block text-lg font-black text-rose-800">{statsToday.canceladas}</span>
              <span className="text-[9px] font-bold text-rose-700 uppercase block leading-tight mt-0.5">Canc/SR</span>
            </div>
          </div>
        </div>

        {/* Indicators of the Month */}
        <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-brand-border/40 pb-2.5 mb-3.5">
            <TrendingUp className="h-4 w-4 text-brand-primary" />
            <span className="text-xs font-black text-brand-text uppercase tracking-wider">Fidelidade e Rendimento Mensal</span>
          </div>

          <div className="grid grid-cols-5 gap-2 text-center">
            <div className="bg-slate-50 rounded-xl p-2.5">
              <span className="block text-lg font-black text-brand-text">{statsMonth.totalAgendadas}</span>
              <span className="text-[9px] font-bold text-brand-muted uppercase block leading-tight mt-0.5">Agendat.</span>
            </div>
            <div className="bg-emerald-50/50 rounded-xl p-2.5 border border-emerald-100">
              <span className="block text-lg font-black text-emerald-800">{statsMonth.totalRealizadas}</span>
              <span className="text-[9px] font-bold text-emerald-700 uppercase block leading-tight mt-0.5">Realiz.</span>
            </div>
            <div className="bg-rose-50/50 rounded-xl p-2.5 border border-rose-100">
              <span className="block text-lg font-black text-rose-800">{statsMonth.totalCancelamentos}</span>
              <span className="text-[9px] font-bold text-rose-700 uppercase block leading-tight mt-0.5">Canc.</span>
            </div>
            <div className="bg-red-50/50 rounded-xl p-2.5 border border-red-100">
              <span className="block text-lg font-black text-red-800">{statsMonth.totalFaltas}</span>
              <span className="text-[9px] font-bold text-red-700 uppercase block leading-tight mt-0.5">Faltas</span>
            </div>
            <div className="bg-brand-primary/10 rounded-xl p-2.5 border border-brand-primary/20">
              <span className="block text-lg font-black text-brand-primary">{statsMonth.taxaComparecimento}%</span>
              <span className="text-[9px] font-bold text-brand-primary uppercase block leading-tight mt-0.5">Taxa Comp.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Month Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-brand-border bg-white p-3 shadow-xs">
          <span className="text-[10px] font-bold text-brand-muted uppercase block">Previsto Total (Mês)</span>
          <span className="text-sm font-black text-slate-800 block mt-1">R$ {statsFinance.prevista}</span>
        </div>
        <div className="rounded-xl border border-brand-border bg-emerald-50/35 p-3 shadow-xs border-emerald-100">
          <span className="text-[10px] font-bold text-emerald-700 uppercase block">Recebido (Pago)</span>
          <span className="text-sm font-black text-emerald-800 block mt-1">R$ {statsFinance.recebida}</span>
        </div>
        <div className="rounded-xl border border-brand-border bg-amber-50/35 p-3 shadow-xs border-amber-100">
          <span className="text-[10px] font-bold text-amber-700 uppercase block">Pendente</span>
          <span className="text-sm font-black text-amber-800 block mt-1">R$ {statsFinance.pendente}</span>
        </div>
        <div className="rounded-xl border border-brand-border bg-rose-50/35 p-3 shadow-xs border-rose-100">
          <span className="text-[10px] font-bold text-rose-700 uppercase block">Perdas p/ Faltas</span>
          <span className="text-sm font-black text-rose-800 block mt-1">R$ {statsFinance.perdida}</span>
        </div>
      </div>

      {/* Alerts and Action table */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* At-attention center (2 columns) */}
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs">
            <h3 className="text-xs font-black text-brand-text uppercase tracking-wider border-b border-brand-border/40 pb-2 mb-3">
              🔴 Central de Atenção Imediata
            </h3>

            {alertsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <CheckCircle className="h-6 w-6 text-emerald-600 mb-1" />
                <p className="text-xs font-bold text-brand-text">Tudo Organizado!</p>
                <p className="text-[10px] text-brand-muted">Sua clínica não possui alertas operacionais prioritários pendentes.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {alertsList.map((alert) => (
                  <div key={alert.id} className="flex items-start justify-between gap-3 bg-slate-50 rounded-xl p-3 hover:bg-slate-100 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        {alert.type === "risco" && <AlertTriangle className="h-4 w-4 text-rose-600" />}
                        {alert.type === "financeiro" && <DollarSign className="h-4 w-4 text-emerald-600" />}
                        {alert.type === "confirmacao" && <Clock className="h-4 w-4 text-brand-primary" />}
                        {alert.type === "atencao" && <HelpCircle className="h-4 w-4 text-amber-600" />}
                        <strong className="text-xs font-black text-brand-text">{alert.title}</strong>
                      </div>
                      <p className="text-[11px] text-brand-muted leading-relaxed">{alert.desc}</p>
                    </div>
                    <button
                      onClick={() => onTabChange(alert.actionTab)}
                      className="inline-flex items-center gap-1 rounded-lg bg-brand-primary/10 hover:bg-brand-primary/20 px-2.5 py-1 text-[10px] font-black text-brand-primary whitespace-nowrap tracking-wide cursor-pointer"
                    >
                      {alert.actionText} <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {occurrencesWithMissingEvolutions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-brand-border/40 space-y-2.5">
                <span className="text-[10px] font-black text-brand-muted uppercase tracking-wider block">
                  📝 Registrar Evoluções Pendentes ({occurrencesWithMissingEvolutions.length} consulta{occurrencesWithMissingEvolutions.length !== 1 && "s"})
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {occurrencesWithMissingEvolutions.slice(0, 4).map((o) => {
                    const patient = state.patients.find((p) => p.id === o.patientId);
                    if (!patient) return null;
                    return (
                      <div key={o.key} className="flex items-center justify-between gap-3 bg-brand-primary/[0.02] border border-brand-primary/10 rounded-xl p-2.5 hover:bg-brand-primary/[0.04] transition-colors">
                        <div className="min-w-0">
                          <span className="block text-xs font-black text-brand-text truncate uppercase leading-tight">
                            {patient.name}
                          </span>
                          <span className="block text-[9.5px] text-brand-muted leading-tight mt-0.5">
                            {o.when.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} • {o.when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <button
                          onClick={() => onFinalizeSession?.(o)}
                          className="shrink-0 bg-brand-primary hover:bg-opacity-90 text-white rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-wider cursor-pointer"
                        >
                          Evoluir
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Clinical Statistics side (1 column) */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs">
            <h3 className="text-xs font-black text-brand-text uppercase tracking-wider border-b border-brand-border/40 pb-2 mb-3">
              🩺 Saúde da Operação
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-brand-muted" />
                  <span className="text-xs font-bold text-brand-muted">Pacientes Ativos</span>
                </div>
                <strong className="text-xs font-black text-brand-text">{state.patients.length}</strong>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-red-500/75" />
                  <span className="text-xs font-bold text-brand-muted">Em risco de evasão</span>
                </div>
                <strong className="text-xs font-black text-red-700">{atRiskPatients.length}</strong>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-emerald-600/75" />
                  <span className="text-xs font-bold text-brand-muted">Fila de Espera Ativa</span>
                </div>
                <strong className="text-xs font-black text-emerald-700">{(state.waitingList || []).length}</strong>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <UserMinus className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-bold text-brand-muted">Sem sessão programada</span>
                </div>
                <strong className="text-xs font-black text-amber-700">{patientsWithNoFutureAppointments.length}</strong>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-brand-border/40">
              <button 
                onClick={() => onTabChange("ai_chat")}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2 text-xs font-black text-white hover:opacity-95 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" /> Consultar IA Administrativa
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
