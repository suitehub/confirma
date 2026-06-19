import React, { useMemo } from "react";
import { 
  AlertTriangle, 
  Send, 
  PlusCircle, 
  Calendar, 
  UserMinus, 
  HelpCircle,
  TrendingDown
} from "lucide-react";
import { AppState, Occurrence } from "../types";
import { formatLongBR, ymdFromDate } from "../utils/helpers";

interface RiskPatientsTabProps {
  state: AppState;
  occurrences: Occurrence[];
  today: Date;
  onWaOpen: (phone: string, msg: string) => void;
  onScheduleReturn: (patientId: string) => void;
}

export default function RiskPatientsTab({
  state,
  occurrences,
  today,
  onWaOpen,
  onScheduleReturn
}: RiskPatientsTabProps) {
  
  // Dynamic Calculation of At-Risk Patients based on parameters
  const atRiskList = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      phone: string;
      lastSessionDate: string;
      reason: string;
      level: "alta" | "media" | "baixa";
    }> = [];

    const nowMs = Date.now();

    state.patients.forEach((p) => {
      // Filter occurrences belonging to this patient
      const pOccs = occurrences
        .filter((o) => o.patientId === p.id)
        .sort((a, b) => b.when.getTime() - a.when.getTime());

      if (pOccs.length === 0) return;

      const pastOccs = pOccs.filter((o) => o.when < today);
      const futureOccs = pOccs.filter((o) => o.when >= today);

      const lastOccurrence = pastOccs[0];
      const lastSessionStr = lastOccurrence ? lastOccurrence.when.toLocaleDateString("pt-BR") : "Nenhuma";

      // 1. Rule - 2 consecutive absences
      const sortedPastOccsByDateAsc = [...pastOccs].sort((a,b) => a.when.getTime() - b.when.getTime());
      let consecutiveAbsencesCount = 0;
      for (let i = sortedPastOccsByDateAsc.length - 1; i >= 0; i--) {
        const s = state.statuses[sortedPastOccsByDateAsc[i].key] || "aguardando";
        if (s === "falta") {
          consecutiveAbsencesCount++;
        } else if (s === "realizada" || s === "confirmado") {
          break;
        }
      }

      // 2. Rule - 3 reschedules in last 30 days
      const thirtyDaysAgoMs = nowMs - 30 * 24 * 60 * 60 * 1000;
      const recentReschedulesCount = pOccs.filter(
        (o) => o.when.getTime() >= thirtyDaysAgoMs && state.statuses[o.key] === "remarcar"
      ).length;

      // 3. Rule - 30 days without future session & 30 days since last
      const hasFuture = futureOccs.length > 0;
      const daysSinceLastSession = lastOccurrence 
        ? Math.floor((nowMs - lastOccurrence.when.getTime()) / (24 * 60 * 60 * 1000)) 
        : 999;

      // 4. Rule - 45 days since last attendance (presence confirmed/realizada)
      const lastAttendedOccurrence = pastOccs.find(
        (o) => state.statuses[o.key] === "realizada" || state.statuses[o.key] === "confirmado"
      );
      const daysSinceLastAttendance = lastAttendedOccurrence
        ? Math.floor((nowMs - lastAttendedOccurrence.when.getTime()) / (24 * 60 * 60 * 1000))
        : 999;

      // Classifying Risk Levels
      if (consecutiveAbsencesCount >= 2) {
        list.push({
          id: p.id,
          name: p.name,
          phone: p.phone,
          lastSessionDate: lastSessionStr,
          reason: `Registrou ${consecutiveAbsencesCount} Faltas consecutivas sem aviso prévio.`,
          level: "alta"
        });
      } else if (daysSinceLastAttendance >= 45 && lastAttendedOccurrence) {
        list.push({
          id: p.id,
          name: p.name,
          phone: p.phone,
          lastSessionDate: lastSessionStr,
          reason: `Ficou ${daysSinceLastAttendance} dias seguidos sem comparecer à clínica.`,
          level: "alta"
        });
      } else if (recentReschedulesCount >= 3) {
        list.push({
          id: p.id,
          name: p.name,
          phone: p.phone,
          lastSessionDate: lastSessionStr,
          reason: `Instabilidade de horário: Remarcou ${recentReschedulesCount} sessões em 30 dias.`,
          level: "media"
        });
      } else if (!hasFuture && daysSinceLastSession >= 30) {
        list.push({
          id: p.id,
          name: p.name,
          phone: p.phone,
          lastSessionDate: lastSessionStr,
          reason: `Ficou há mais de ${daysSinceLastSession} dias sem agendar novos atendimentos futuros.`,
          level: "baixa"
        });
      }
    });

    return list;
  }, [state.patients, occurrences, state.statuses, today]);

  // Action: Open WhatsApp with recovery message
  const handleRecuperatePatient = (p: typeof atRiskList[0]) => {
    const text = `Olá ${p.name}, senti sua falta nas nossas sessões de terapia. Gostaria de agendar um retorno para continuarmos o seu processo nesta semana? Me diga qual o melhor dia para você. Um abraço!`;
    onWaOpen(p.phone, text);
  };

  return (
    <div className="space-y-6">
      
      {/* Intro section */}
      <div className="px-1">
        <h2 className="text-xl font-black text-brand-text flex items-center gap-2">
          <AlertTriangle className="h-5.5 w-5.5 text-rose-600 animate-bounce" /> Radar de Abandono (Prevenção de Evasão)
        </h2>
        <p className="text-xs text-brand-muted mt-1 leading-relaxed">
          Identificação proativa de pacientes com alto risco de interromper o tratamento. O algoritmo monitora ausência de marcações futuras, excesso de remarcações ou faltas sequenciais automáticas.
        </p>
      </div>

      {/* Main warning card listing patients */}
      <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs">
        {atRiskList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <svg className="h-10 w-10 text-emerald-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-black text-brand-text">Engajamento de Pacientes Excelente!</p>
            <p className="text-xs text-brand-muted mt-1">Nenhum paciente cadastrado apresenta critérios de risco ou tendências de abandono ativo.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="border-b border-brand-border/40 pb-2 mb-2 flex items-center justify-between text-[10px] font-black tracking-wider uppercase text-brand-muted">
              <span>Paciente em Risco</span>
              <span>Nível de Risco</span>
            </div>

            {atRiskList.map((p) => (
              <div key={p.id} className="rounded-xl border border-brand-border bg-slate-50/50 p-4 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                
                {/* Details side */}
                <div className="space-y-1 md:max-w-2xl">
                  <div className="flex items-center gap-2.5">
                    <strong className="text-sm font-black text-brand-text">{p.name}</strong>
                    <span className="text-[10px] bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md font-bold">
                      Última sessão: {p.lastSessionDate}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-rose-800 leading-relaxed bg-rose-50 border border-rose-100 max-w-fit px-2 py-1 rounded-sm mt-1.5 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-700" /> {p.reason}
                  </p>
                </div>

                {/* Status and Action Buttons */}
                <div className="flex items-center justify-between md:justify-end gap-3.5 border-t border-dashed md:border-none pt-3 md:pt-0">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                    p.level === "alta" 
                      ? "bg-red-100 text-red-800 border-red-200" 
                      : p.level === "media"
                      ? "bg-amber-100 text-amber-800 border-amber-250"
                      : "bg-blue-100 text-blue-800 border-blue-200"
                  }`}>
                    {p.level === "alta" ? "🚨 Alto Risco" : p.level === "media" ? "⚠️ Médio Risco" : "📉 Baixo Risco"}
                  </span>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRecuperatePatient(p)}
                      className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-xs font-black text-white cursor-pointer"
                      title="Chamar para reagendar via Whatsapp"
                    >
                      <Send className="h-3 w-3" /> Chamar
                    </button>
                    <button
                      onClick={() => onScheduleReturn(p.id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-brand-border bg-white hover:bg-slate-50 px-3 py-2 text-xs font-black text-brand-text cursor-pointer"
                    >
                      <PlusCircle className="h-3 w-3 text-brand-muted" /> Reagendar
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rules disclaimer */}
      <div className="rounded-xl border border-brand-border bg-slate-50 p-3 text-xs text-brand-muted leading-relaxed">
        <strong className="text-brand-text block font-bold mb-1">Como calculamos o índice de risco de abandono?</strong>
        <p>A inteligência clínica de monitoramento do Confirma segue diretrizes analíticas científicas de consultórios de psicologia autônomos:</p>
        <ul className="list-disc list-inside space-y-0.5 mt-1.5 font-medium">
          <li><b>Alto risco (🚨):</b> 2 faltas consecutivas sem justificativa ou 45 dias sem comparecer presencialmente/online.</li>
          <li><b>Médio risco (⚠️):</b> 3 remarcações ou desmarcações solicitadas pelo paciente em um período de 30 dias.</li>
          <li><b>Baixo risco (📉):</b> Paciente ativo em alta sem de fato possuir sessões agendadas após 30 dias.</li>
        </ul>
      </div>

    </div>
  );
}
