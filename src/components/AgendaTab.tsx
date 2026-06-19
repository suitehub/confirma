import React, { useState, useMemo } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Plus, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";
import { AppState, Occurrence } from "../types";
import { ymdFromDate, formatLongBR } from "../utils/helpers";

interface AgendaTabProps {
  state: AppState;
  occurrences: Occurrence[];
  today: Date;
  onSelectPatient: (patientId: string) => void;
  onAddSessionAt: (date: string, time: string) => void;
}

export default function AgendaTab({
  state,
  occurrences,
  today,
  onSelectPatient,
  onAddSessionAt
}: AgendaTabProps) {
  // We keep track of the start of the week shown. Default: Monday of the current week.
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date(today);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  // Navigate week forward or backward
  const handlePrevWeek = () => {
    setCurrentWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() - 7);
      return next;
    });
  };

  const handleNextWeek = () => {
    setCurrentWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 7);
      return next;
    });
  };

  const handleGoToToday = () => {
    const d = new Date(today);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
  };

  // Generate the 6 days of the week (Monday to Saturday)
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 6; i++) {
      const day = new Date(currentWeekStart);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  }, [currentWeekStart]);

  // Hours intervals
  const hourSlots = [
    "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", 
    "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"
  ];

  // Helper to query occurrences matching a day and hour slot
  const getOccurrenceForSlot = (day: Date, hhmm: string) => {
    const targetYmd = ymdFromDate(day);
    return occurrences.find((o) => {
      if (ymdFromDate(o.when) !== targetYmd) return false;
      // Compare hours and minutes
      const oTime = o.when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      // Match general hour slot (e.g. "14:00" matches "14:00")
      return oTime === hhmm || oTime.startsWith(hhmm.substring(0, 3));
    });
  };

  // Human readable labels
  const getDayName = (d: Date) => {
    const names = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return names[d.getDay()];
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Grid */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1">
        <div>
          <h2 className="text-xl font-black text-brand-text flex items-center gap-2">
            <Calendar className="h-5.5 w-5.5 text-brand-primary" /> Minha Agenda Semanal
          </h2>
          <p className="text-xs text-brand-muted mt-0.5">
            Visualize facilmente sua ocupação semanal, horários disponíveis para novos agendamentos e status clínicos dos pacientes.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleGoToToday}
            className="rounded-xl border border-brand-border bg-white px-3 py-2 text-xs font-black text-brand-text hover:bg-slate-50 transition-all cursor-pointer"
          >
            Hoje
          </button>
          
          <div className="inline-flex rounded-xl border border-brand-border bg-white p-1">
            <button
              onClick={handlePrevWeek}
              className="rounded-lg p-1.5 text-brand-muted hover:bg-slate-100 hover:text-brand-text cursor-pointer"
            >
              <ChevronLeft className="h-4.5 w-4.5" />
            </button>
            <span className="px-3 py-1.5 text-xs font-black text-slate-700 min-w-[170px] text-center">
              {weekDays[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} - {weekDays[5].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
            <button
              onClick={handleNextWeek}
              className="rounded-lg p-1.5 text-brand-muted hover:bg-slate-100 hover:text-brand-text cursor-pointer"
            >
              <ChevronRight className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Responsive Scheduler Grid */}
      <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {/* Calendar Table Grid */}
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {/* Time header spacer */}
                <th className="p-2.5 text-left border-b border-brand-border/60 text-[10px] font-black text-brand-muted uppercase tracking-wider w-16">
                  Horário
                </th>
                {weekDays.map((day) => {
                  const isToday = ymdFromDate(day) === ymdFromDate(today);
                  return (
                    <th 
                      key={day.getTime()} 
                      className={`p-2.5 border-b border-brand-border/60 text-center min-w-[140px] ${
                        isToday ? "bg-brand-primary/5 rounded-t-xl" : ""
                      }`}
                    >
                      <span className={`block text-xs font-black ${isToday ? "text-brand-primary" : "text-brand-text"}`}>
                        {getDayName(day)}
                      </span>
                      <span className={`block text-[11px] font-bold ${isToday ? "text-brand-primary/80" : "text-brand-muted"}`}>
                        {day.getDate()} de {day.toLocaleDateString("pt-BR", { month: "short" })}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {hourSlots.map((slot) => (
                <tr key={slot} className="border-b border-brand-border/40 hover:bg-slate-50/20">
                  {/* Time label row title */}
                  <td className="p-3 text-xs font-black text-slate-800 font-mono border-r border-brand-border/40 vertical-middle">
                    {slot}
                  </td>
                  
                  {weekDays.map((day) => {
                    const occ = getOccurrenceForSlot(day, slot);
                    const patient = occ ? state.patients.find((p) => p.id === occ.patientId) : null;
                    const isToday = ymdFromDate(day) === ymdFromDate(today);
                    
                    if (occ && patient) {
                      const status = state.statuses[occ.key] || "aguardando";
                      
                      // Status styling
                      let statusBg = "bg-amber-50/85 hover:bg-amber-100 border-amber-200 text-amber-950";
                      let borderStyle = "border-l-4 border-l-amber-500";
                      
                      if (status === "confirmado") {
                        statusBg = "bg-emerald-50/85 hover:bg-emerald-100 border-emerald-200 text-emerald-950";
                        borderStyle = "border-l-4 border-l-emerald-600";
                      } else if (status === "realizada") {
                        statusBg = "bg-blue-50/85 hover:bg-blue-100 border-blue-200 text-blue-950";
                        borderStyle = "border-l-4 border-l-blue-600";
                      } else if (status === "falta") {
                        statusBg = "bg-red-50/85 hover:bg-red-100 border-red-200 text-red-950";
                        borderStyle = "border-l-4 border-l-red-600";
                      } else if (status === "cancelado") {
                        statusBg = "bg-slate-50/85 hover:bg-slate-100 border-slate-200 text-slate-600 line-through";
                        borderStyle = "border-l-4 border-l-slate-400";
                      } else if (status === "remarcar") {
                        statusBg = "bg-purple-50/85 hover:bg-purple-100 border-purple-200 text-purple-950";
                        borderStyle = "border-l-4 border-l-purple-500";
                      }

                      return (
                        <td 
                          key={day.getTime()} 
                          className={`p-1.5 border-r border-brand-border/30 transition-all ${
                            isToday ? "bg-brand-primary/[0.01]" : ""
                          }`}
                        >
                          <div 
                            onClick={() => onSelectPatient(patient.id)}
                            className={`rounded-xl p-2.5 border text-left cursor-pointer transition-all shadow-2xs ${statusBg} ${borderStyle}`}
                          >
                            <span className="block text-[11px] font-black leading-tight uppercase truncate">
                              {patient.name}
                            </span>
                            <div className="flex items-center gap-1 mt-1 text-[9px] font-bold opacity-80 uppercase tracking-wider">
                              <Clock className="h-2.5 w-2.5" />
                              <span>{occ.local}</span>
                              <span className="ml-auto font-black">{status}</span>
                            </div>
                          </div>
                        </td>
                      );
                    }

                    // Otherwise, slot is available (disponível)
                    const dateStr = ymdFromDate(day);
                    return (
                      <td 
                        key={day.getTime()} 
                        className={`p-1.5 border-r border-brand-border/30 transition-all ${
                          isToday ? "bg-brand-primary/[0.02]" : ""
                        }`}
                      >
                        <div 
                          onClick={() => onAddSessionAt(dateStr, slot)}
                          className="group/btn relative rounded-xl border border-dashed border-slate-200 hover:border-emerald-300 bg-slate-50/40 hover:bg-emerald-50/20 p-2 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[46px]"
                        >
                          <span className="text-[10px] font-black text-slate-400 group-hover/btn:text-emerald-700 uppercase tracking-wider block">
                            Disponível
                          </span>
                          <span className="absolute right-1.5 bottom-1.5 opacity-0 group-hover/btn:opacity-100 transition-opacity bg-emerald-600 text-white rounded-md p-0.5">
                            <Plus className="h-3 w-3" />
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Legend Card */}
      <div className="rounded-xl border border-brand-border bg-slate-50/50 p-3 flex flex-wrap gap-4 justify-center text-[10.5px] font-bold text-brand-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Aguardando</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Confirmado</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Realizada</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-600" /> Falta</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Cancelado</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> Remarcar</span>
      </div>
    </div>
  );
}
