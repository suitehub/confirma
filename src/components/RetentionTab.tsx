import React, { useMemo } from "react";
import { 
  TrendingUp, 
  BarChart3, 
  Calendar, 
  Users, 
  Activity, 
  ArrowUpRight 
} from "lucide-react";
import { AppState, Occurrence } from "../types";
import { ymdFromDate } from "../utils/helpers";

interface RetentionTabProps {
  state: AppState;
  occurrences: Occurrence[];
  today: Date;
}

export default function RetentionTab({
  state,
  occurrences,
  today
}: RetentionTabProps) {

  // Average session calculations
  const stats = useMemo(() => {
    const totalPatients = state.patients.length;
    if (totalPatients === 0) {
      return {
        permanenciaMedia: "0 meses",
        mediaSessoes: "0",
        frequenciaMedia: "0x / semana",
        ativos: 0,
        perdidos: 0,
        recuperados: 0
      };
    }

    let permanenciaAcumuladaDias = 0;
    let sessoesRealizadasAcumulado = 0;
    let sessoesFuturasAcumulado = 0;
    let ativos = 0;
    let perdidos = 0;
    let recuperados = 0;

    const nowMs = Date.now();

    state.patients.forEach((p) => {
      const pOccs = occurrences.filter((o) => o.patientId === p.id);
      if (pOccs.length === 0) return;

      const pPast = pOccs.filter((o) => o.when < today);
      const pFuture = pOccs.filter((o) => o.when >= today);
      
      const realizadas = pPast.filter(o => state.statuses[o.key] === "realizada" || state.statuses[o.key] === "confirmado").length;
      sessoesRealizadasAcumulado += realizadas;

      const firstDate = pOccs[pOccs.length - 1].when;
      const lastDate = pOccs[0].when;
      const diasEntre = Math.max(1, Math.floor((lastDate.getTime() - firstDate.getTime()) / (24 * 60 * 60 * 1000)));
      permanenciaAcumuladaDias += diasEntre;

      const hasFuture = pFuture.length > 0;
      if (hasFuture) {
        ativos++;
        // If they had consecutive absences previously but returned
        const hadAbsences = pPast.slice(0,2).some(o => state.statuses[o.key] === "falta");
        if (hadAbsences) {
          recuperados++;
        }
      } else {
        const lastSessionDate = pPast[0]?.when;
        const diasSemSessao = lastSessionDate ? Math.floor((nowMs - lastSessionDate.getTime()) / (24 * 60 * 60 * 1000)) : 999;
        if (diasSemSessao >= 45) {
          perdidos++;
        } else {
          ativos++;
        }
      }
    });

    const permanenciaMediaMeses = totalPatients > 0 
      ? (permanenciaAcumuladaDias / totalPatients / 30).toFixed(1) 
      : "0";
    const mediaSessoes = totalPatients > 0 
      ? (sessoesRealizadasAcumulado / totalPatients).toFixed(1) 
      : "0";

    return {
      permanenciaMedia: `${permanenciaMediaMeses} meses`,
      mediaSessoes,
      frequenciaMedia: "1.0x / semana",
      ativos,
      perdidos,
      recuperados
    };
  }, [state.patients, state.sessions, state.statuses, occurrences, today]);

  // Chart 1: Show up rate calculation cumulative (Show-up vs Absences)
  const showUpRate = useMemo(() => {
    const pastOccs = occurrences.filter(o => o.when < today);
    if (pastOccs.length === 0) return 100;
    
    let realizadas = 0;
    let faltas = 0;
    
    pastOccs.forEach(o => {
      const s = state.statuses[o.key] || "aguardando";
      if (s === "realizada" || s === "confirmado") realizadas++;
      else if (s === "falta") faltas++;
    });

    const total = realizadas + faltas;
    return total > 0 ? Math.round((realizadas / total) * 100) : 100;
  }, [occurrences, state.statuses, today]);

  // Chart 2: Scheduled vs Completed on last 4 weeks (fully calculated manually for custom SVG chart!)
  const weeklyDistribution = useMemo(() => {
    const weeksData = [
      { weekName: "S-3", agendadas: 0, realizadas: 0 },
      { weekName: "S-2", agendadas: 0, realizadas: 0 },
      { weekName: "S-1", agendadas: 0, realizadas: 0 },
      { weekName: "S-0 (Atual)", agendadas: 0, realizadas: 0 }
    ];

    const weekStartDates = Array.from({ length: 4 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (3 - i) * 7 - today.getDay());
      d.setHours(0,0,0,0);
      return d;
    });

    occurrences.forEach((o) => {
      for (let i = 0; i < 4; i++) {
        const start = weekStartDates[i];
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        
        if (o.when >= start && o.when < end) {
          weeksData[i].agendadas++;
          const s = state.statuses[o.key] || "aguardando";
          if (s === "realizada" || s === "confirmado" || o.when >= today) {
            weeksData[i].realizadas++;
          }
        }
      }
    });

    return weeksData;
  }, [occurrences, state.statuses, today]);

  // Chart 3: Sessions distributed by Day of week (Segunda to Sexta)
  const dayOfWeekDistribution = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]; // Seg, Ter, Qua, Qui, Sex
    occurrences.forEach((o) => {
      const day = o.when.getDay(); // 0 is Sunday, 1 is Monday ...
      if (day >= 1 && day <= 5) {
        counts[day - 1]++;
      }
    });

    const labels = ["Seg", "Ter", "Qua", "Qui", "Sex"];
    const total = counts.reduce((acc, v) => acc + v, 0) || 1;

    return counts.map((count, idx) => ({
      name: labels[idx],
      value: count,
      percentage: Math.round((count / total) * 100)
    }));
  }, [occurrences]);

  return (
    <div className="space-y-6">
      
      {/* Overview Head */}
      <div>
        <h2 className="text-xl font-black text-brand-text flex items-center gap-2">
          <Activity className="h-5 w-5 text-brand-primary" /> Diagnóstico de Retenção e Engajamento
        </h2>
        <p className="text-xs text-brand-muted mt-1">
          Relatório de aderência clínica e saúde de fidelidade dos pacientes no consultório
        </p>
      </div>

      {/* Retention indicators widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="bg-white border text-center rounded-xl p-3 shadow-xs">
          <span className="text-[9px] uppercase font-black text-brand-muted block">T. Média Tratamento</span>
          <span className="text-sm font-black text-slate-800 block mt-1">{stats.permanenciaMedia}</span>
        </div>
        <div className="bg-white border text-center rounded-xl p-3 shadow-xs">
          <span className="text-[9px] uppercase font-black text-brand-muted block">Frequência Semanal</span>
          <span className="text-sm font-black text-slate-800 block mt-1">{stats.frequenciaMedia}</span>
        </div>
        <div className="bg-white border text-center rounded-xl p-3 shadow-xs">
          <span className="text-[9px] uppercase font-black text-brand-muted block">Consultas / Paciente</span>
          <span className="text-sm font-black text-slate-800 block mt-1">{stats.mediaSessoes} sessões</span>
        </div>
        <div className="bg-emerald-50/50 border border-emerald-100 text-center rounded-xl p-3 shadow-xs">
          <span className="text-[9px] uppercase font-black text-emerald-700 block">Ativos Atualmente</span>
          <span className="text-sm font-black text-emerald-800 block mt-1">{stats.ativos}</span>
        </div>
        <div className="bg-rose-50/50 border border-rose-150 text-center rounded-xl p-3 shadow-xs">
          <span className="text-[9px] uppercase font-black text-rose-700 block">Pacientes Evasão/Inat</span>
          <span className="text-sm font-black text-rose-800 block mt-1">{stats.perdidos}</span>
        </div>
        <div className="bg-purple-50/50 border border-purple-100 text-center rounded-xl p-3 shadow-xs">
          <span className="text-[9px] uppercase font-black text-purple-700 block">Recuperados no Mês</span>
          <span className="text-sm font-black text-purple-800 block mt-1">{stats.recuperados}</span>
        </div>
      </div>

      {/* SVG Graphics section (Full pixel-perfect handcrafted responsive charts) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Graph 1: Comparecimento Taxa Cumulativa */}
        <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs text-center flex flex-col justify-between">
          <h3 className="text-xs font-black text-brand-text uppercase tracking-wider border-b pb-2 mb-2">Show-Up Rate (Fidelidade)</h3>
          
          <div className="relative flex items-center justify-center py-6">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle cx="64" cy="64" r="50" fill="transparent" stroke="#E2E8F0" strokeWidth="8"/>
              <circle 
                cx="64" 
                cy="64" 
                r="50" 
                fill="transparent" 
                stroke="#3A5A6B" 
                strokeWidth="10" 
                strokeDasharray={2 * Math.PI * 50} 
                strokeDashoffset={2 * Math.PI * 50 * (1 - showUpRate / 100)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <span className="block text-2xl font-black text-brand-text">{showUpRate}%</span>
              <span className="text-[9px] font-black text-brand-muted uppercase leading-tight">Presença</span>
            </div>
          </div>

          <p className="text-[10px] text-brand-muted leading-relaxed px-2 font-medium">
            Proporção de consultas atendidas contra faltas do paciente. Um show-up acima de <b>85%</b> aponta uma agenda estável.
          </p>
        </div>

        {/* Graph 2: Histórico semanal de agendamentos versus realizados */}
        <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs flex flex-col justify-between">
          <h3 className="text-xs font-black text-brand-text uppercase tracking-wider border-b pb-2 mb-3">Histórico de 4 Semanas</h3>
          
          {/* Custom SVG Bar Chart */}
          <div className="h-36 w-full flex items-end justify-around pb-2 border-b">
            {weeklyDistribution.map((w, idx) => {
              const maxVal = Math.max(1, ...weeklyDistribution.map(wd => wd.agendadas));
              const heightAgendadas = (w.agendadas / maxVal) * 100;
              const heightRealizadas = (w.realizadas / maxVal) * 100;

              return (
                <div key={idx} className="flex flex-col items-center gap-1.5 w-1/5">
                  <div className="flex gap-1 items-end h-28 w-full justify-center">
                    {/* Bar 1: Scheduled */}
                    <div 
                      style={{ height: `${heightAgendadas}%` }}
                      className="w-2.5 bg-slate-300 rounded-t-xs"
                      title={`Agendadas: ${w.agendadas}`}
                    />
                    {/* Bar 2: Completed */}
                    <div 
                      style={{ height: `${heightRealizadas}%` }}
                      className="w-2.5 bg-brand-primary rounded-t-xs"
                      title={`Comparecidas: ${w.realizadas}`}
                    />
                  </div>
                  <span className="text-[9px] font-bold text-brand-muted">{w.weekName}</span>
                </div>
              );
            })}
          </div>

          <div className="flex justify-center gap-4 text-[9px] uppercase font-black text-brand-muted pt-2.5">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-slate-300 rounded-full inline-block" /> Agendado</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-brand-primary rounded-full inline-block" /> Realizado</span>
          </div>
        </div>

        {/* Graph 3: Distribuição percentual por Dia da Semana */}
        <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs flex flex-col justify-between">
          <h3 className="text-xs font-black text-brand-text uppercase tracking-wider border-b pb-2 mb-3">Sessões por Dia</h3>

          <div className="space-y-2.5 my-2">
            {dayOfWeekDistribution.map((d, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-brand-muted">
                  <span>{d.name}</span>
                  <span>{d.value} ({d.percentage}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${d.percentage}%` }}
                    className="bg-brand-primary h-full rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-[9.5px] text-brand-muted leading-relaxed text-center font-bold uppercase tracking-wide">
            Dia com maior volume: <b>{dayOfWeekDistribution.reduce((max, x) => x.value > max.value ? x : max, {name:'-', value:-1}).name || "-"}</b>
          </p>
        </div>

      </div>

    </div>
  );
}
