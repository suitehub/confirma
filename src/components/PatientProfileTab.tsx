import React, { useState, useMemo, useEffect } from "react";
import { 
  User, 
  Paperclip, 
  MapPin, 
  Briefcase, 
  Heart, 
  Mail, 
  Phone, 
  Calendar, 
  Save, 
  Clock, 
  ChevronLeft,
  DollarSign,
  TrendingUp,
  FileText,
  Clock3,
  HelpCircle,
  Sparkles,
  Bot,
  Trash2,
  Pencil,
  Plus,
  CheckCircle2
} from "lucide-react";
import { AppState, Patient, Occurrence, FormResponse, Evolution } from "../types";
import { formatLongBR, formatPhone, ymdFromDate } from "../utils/helpers";

interface PatientProfileTabProps {
  patient: Patient;
  state: AppState;
  occurrences: Occurrence[];
  today: Date;
  onClose: () => void;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  initialSubTab?: "dados" | "historico" | "financeiro" | "formularios" | "prontuario" | "insights" | null;
  initialOccurrenceForEvolution?: Occurrence | null;
}

export default function PatientProfileTab({
  patient,
  state,
  occurrences,
  today,
  onClose,
  onUpdateState,
  initialSubTab,
  initialOccurrenceForEvolution
}: PatientProfileTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"dados" | "historico" | "financeiro" | "formularios" | "prontuario" | "insights">(
    initialSubTab || "prontuario"
  );

  // Local fields for editing state
  const [name, setName] = useState(patient.name);
  const [phone, setPhone] = useState(patient.phone);
  const [email, setEmail] = useState(patient.email || "");
  const [birthDate, setBirthDate] = useState(patient.birthDate || "");
  const [profession, setProfession] = useState(patient.profession || "");
  const [civilStatus, setCivilStatus] = useState(patient.civilStatus || "Solteiro(a)");
  const [address, setAddress] = useState(patient.address || "");
  const [notes, setNotes] = useState(patient.notes || "");
  const [billingInfo, setBillingInfo] = useState(patient.billingInfo || "");
  const [insuranceInfo, setInsuranceInfo] = useState(patient.insuranceInfo || "");

  // Demographic / clinical extensions for psychological anamnese
  const [socialName, setSocialName] = useState(patient.socialName || "");
  const [cpf, setCpf] = useState(patient.cpf || "");
  const [emergencyContact, setEmergencyContact] = useState(patient.emergencyContact || "");
  const [chiefComplaint, setChiefComplaint] = useState(patient.chiefComplaint || "");
  const [medicalHistory, setMedicalHistory] = useState(patient.medicalHistory || "");
  const [familyHistory, setFamilyHistory] = useState(patient.familyHistory || "");
  const [recommendedBy, setRecommendedBy] = useState(patient.recommendedBy || "");
  const [therapyGoals, setTherapyGoals] = useState(patient.therapyGoals || "");
  const [habitsLifestyle, setHabitsLifestyle] = useState(patient.habitsLifestyle || "");

  useEffect(() => {
    setName(patient.name);
    setPhone(patient.phone);
    setEmail(patient.email || "");
    setBirthDate(patient.birthDate || "");
    setProfession(patient.profession || "");
    setCivilStatus(patient.civilStatus || "Solteiro(a)");
    setAddress(patient.address || "");
    setNotes(patient.notes || "");
    setBillingInfo(patient.billingInfo || "");
    setInsuranceInfo(patient.insuranceInfo || "");
    setSocialName(patient.socialName || "");
    setCpf(patient.cpf || "");
    setEmergencyContact(patient.emergencyContact || "");
    setChiefComplaint(patient.chiefComplaint || "");
    setMedicalHistory(patient.medicalHistory || "");
    setFamilyHistory(patient.familyHistory || "");
    setRecommendedBy(patient.recommendedBy || "");
    setTherapyGoals(patient.therapyGoals || "");
    setHabitsLifestyle(patient.habitsLifestyle || "");
  }, [patient]);

  // Clinical Evolution (Prontuário) Form and Filter States
  const [evolutionSearch, setEvolutionSearch] = useState("");
  const [evolutionHumor, setEvolutionHumor] = useState<number>(7);
  const [evolutionSelectedTopics, setEvolutionSelectedTopics] = useState<string[]>([]);
  const [evolutionSummary, setEvolutionSummary] = useState("");
  const [evolutionNextSteps, setEvolutionNextSteps] = useState("");
  const [evolutionOccurrenceKey, setEvolutionOccurrenceKey] = useState<string>(
    initialOccurrenceForEvolution?.key || ""
  );
  const [customTopicInput, setCustomTopicInput] = useState("");
  const [editingEvolutionId, setEditingEvolutionId] = useState<string | null>(null);
  const [evolutionIdConfirmDelete, setEvolutionIdConfirmDelete] = useState<string | null>(null);

  // Sync if pre-filling triggered externally through "Finalizar Sessão" button
  useEffect(() => {
    if (initialOccurrenceForEvolution) {
      setEvolutionOccurrenceKey(initialOccurrenceForEvolution.key);
      setActiveSubTab("prontuario");
    }
  }, [initialOccurrenceForEvolution]);

  const predefinedTopics = [
    "Ansiedade", 
    "Relacionamento", 
    "Trabalho", 
    "Família", 
    "Autoestima", 
    "Luto", 
    "Depressão", 
    "Autoconhecimento", 
    "Finanças",
    "Estresse"
  ];

  // Calculate age based on birthDate
  const age = useMemo(() => {
    if (!birthDate) return "Não informada";
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return "Não informada";
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      years--;
    }
    return `${years} anos`;
  }, [birthDate]);

  // Occurrences belonging of this patient, sorted chronologically from newest to oldest
  const patientOccurrences = useMemo(() => {
    return occurrences
      .filter((o) => o.patientId === patient.id)
      .sort((a, b) => b.when.getTime() - a.when.getTime());
  }, [occurrences, patient.id]);

  // Compute patient-specific financials and stats
  const patientStats = useMemo(() => {
    let totalPago = 0;
    let totalPendente = 0;
    let realizadasCount = 0;
    let canceladasCount = 0;
    let faltasCount = 0;

    patientOccurrences.forEach((o) => {
      const baseSession = state.sessions.find(s => s.id === o.sessionId);
      const val = baseSession?.value !== undefined ? baseSession.value : 150;
      
      const finState = state.occurrenceFinancials?.[o.key] || {
        value: val,
        paymentMethod: baseSession?.paymentMethod || "PIX",
        financialStatus: baseSession?.financialStatus || "Pendente"
      };

      const clinicalStatus = state.statuses[o.key] || "aguardando";

      if (clinicalStatus === "realizada" || (o.when < today && clinicalStatus === "confirmado")) {
        realizadasCount++;
      } else if (clinicalStatus === "cancelado" || clinicalStatus === "remarcar") {
        canceladasCount++;
      } else if (clinicalStatus === "falta") {
        faltasCount++;
      }

      // Read financial status
      if (finState.financialStatus === "Pago") {
        totalPago += finState.value;
      } else if (finState.financialStatus === "Pendente" && clinicalStatus !== "cancelado" && clinicalStatus !== "falta") {
        totalPendente += finState.value;
      }
    });

    return {
      totalPago,
      totalPendente,
      realizadasCount,
      canceladasCount,
      faltasCount,
      totalSessoes: patientOccurrences.length
    };
  }, [patientOccurrences, state.sessions, state.occurrenceFinancials, state.statuses, today]);

  // Read registered clinical evolutions (prontuário) for this patient
  const patientEvolutionsSorted = useMemo(() => {
    return (state.evolutions || [])
      .filter((e) => e.patientId === patient.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Newest first
  }, [state.evolutions, patient.id]);

  // Compute stats for insights
  const avgHumor = useMemo(() => {
    const list = patientEvolutionsSorted;
    if (list.length === 0) return 0;
    const sum = list.reduce((acc, curr) => acc + curr.mood, 0);
    return Number((sum / list.length).toFixed(1));
  }, [patientEvolutionsSorted]);

  const recurrentTheme = useMemo(() => {
    const list = patientEvolutionsSorted;
    if (list.length === 0) return "Nenhum";
    const frequencies: { [key: string]: number } = {};
    list.forEach((e) => {
      (e.topics || []).forEach((t) => {
        frequencies[t] = (frequencies[t] || 0) + 1;
      });
    });

    let topTheme = "Nenhum";
    let maxCount = 0;
    Object.keys(frequencies).forEach((k) => {
      if (frequencies[k] > maxCount) {
        maxCount = frequencies[k];
        topTheme = k;
      }
    });

    return maxCount > 0 ? `${topTheme} (${maxCount}x)` : "Nenhum";
  }, [patientEvolutionsSorted]);

  const attendanceRate = useMemo(() => {
    const total = patientStats.realizadasCount + patientStats.faltasCount;
    if (total === 0) return 100;
    return Math.round((patientStats.realizadasCount / total) * 100);
  }, [patientStats]);

  // Clinical Notes Actions: Save/Update Evolution
  const handleSaveEvolution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evolutionSummary.trim() || !evolutionNextSteps.trim()) {
      alert("Por favor, digite o Resumo da evolução e os Próximos Passos.");
      return;
    }

    // Find custom date from the occurrence if available
    const matchedOcc = occurrences.find((o) => o.key === evolutionOccurrenceKey);
    const targetDate = matchedOcc ? ymdFromDate(matchedOcc.when) : ymdFromDate(new Date());

    if (editingEvolutionId) {
      // Edit mode
      onUpdateState((prev) => ({
        ...prev,
        evolutions: (prev.evolutions || []).map((ev) => {
          if (ev.id === editingEvolutionId) {
            return {
              ...ev,
              mood: evolutionHumor,
              topics: evolutionSelectedTopics,
              summary: evolutionSummary.trim(),
              nextSteps: evolutionNextSteps.trim(),
              date: targetDate
            };
          }
          return ev;
        })
      }));
      setEditingEvolutionId(null);
      alert("Registro de prontuário atualizado com sucesso!");
    } else {
      // Creation mode
      const newEvol: Evolution = {
        id: `evol-${Date.now()}`,
        patientId: patient.id,
        date: targetDate,
        mood: evolutionHumor,
        topics: evolutionSelectedTopics,
        summary: evolutionSummary.trim(),
        nextSteps: evolutionNextSteps.trim(),
        createdAt: Date.now()
      };

      onUpdateState((prev) => {
        const nextEvols = [newEvol, ...(prev.evolutions || [])];
        const nextStatuses = { ...prev.statuses };
        
        // Auto mark session presence status as "realizada" once evolution is logged!
        if (evolutionOccurrenceKey) {
          nextStatuses[evolutionOccurrenceKey] = "realizada";
        }

        return {
          ...prev,
          evolutions: nextEvols,
          statuses: nextStatuses
        };
      });
      alert("Evolução clínica registrada e sessão finalizada com sucesso!");
    }

    // Reset fields
    setEvolutionSummary("");
    setEvolutionNextSteps("");
    setEvolutionSelectedTopics([]);
    setEvolutionHumor(7);
    setEvolutionOccurrenceKey("");
  };

  // Edit action
  const handleStartEditEvolution = (ev: Evolution) => {
    setEditingEvolutionId(ev.id);
    setEvolutionHumor(ev.mood);
    setEvolutionSelectedTopics(ev.topics || []);
    setEvolutionSummary(ev.summary);
    setEvolutionNextSteps(ev.nextSteps);

    // Try finding occurrence key matching this evolution date
    const occMatch = occurrences.find((o) => o.patientId === patient.id && ymdFromDate(o.when) === ev.date);
    if (occMatch) {
      setEvolutionOccurrenceKey(occMatch.key);
    } else {
      setEvolutionOccurrenceKey("");
    }
  };

  // Delete action
  const handleDeleteEvolution = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta evolução clínica? Esta ação não pode ser desfeita.")) {
      onUpdateState((prev) => ({
        ...prev,
        evolutions: (prev.evolutions || []).filter((e) => e.id !== id)
      }));
    }
  };

  // Action: Save administrative data
  const handleSaveData = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateState((prev) => ({
      ...prev,
      patients: prev.patients.map((p) =>
        p.id === patient.id
          ? {
              ...p,
              name: name.trim(),
              phone: phone.trim().replace(/\D/g, ""),
              email: email.trim(),
              birthDate,
              profession: profession.trim(),
              civilStatus,
              address: address.trim(),
              notes: notes.trim(),
              billingInfo: billingInfo.trim(),
              insuranceInfo: insuranceInfo.trim(),
              socialName: socialName.trim(),
              cpf: cpf.trim(),
              emergencyContact: emergencyContact.trim(),
              chiefComplaint: chiefComplaint.trim(),
              medicalHistory: medicalHistory.trim(),
              familyHistory: familyHistory.trim(),
              recommendedBy: recommendedBy.trim(),
              therapyGoals: therapyGoals.trim(),
              habitsLifestyle: habitsLifestyle.trim(),
            }
          : p
      )
    }));
    alert("Dados cadastrais e anamnese clínica salvos com sucesso!");
  };

  return (
    <div className="space-y-6">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-brand-border/60 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-brand-border bg-white hover:bg-slate-50 p-2.5 text-brand-muted hover:text-brand-text transition-colors cursor-pointer"
            title="Voltar para a Lista"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <span className="text-[10px] font-black text-brand-muted uppercase tracking-wider">Ficha de Prontuário</span>
            <h2 className="text-xl font-black text-brand-text h-7 truncate leading-tight mt-0.5">{patient.name}</h2>
          </div>
        </div>

        <div className="flex gap-2.5">
          <span className="text-xs bg-slate-150 border border-brand-border px-3 py-1.5 rounded-full font-bold text-brand-text">
            Idade: <b className="font-extrabold">{age}</b>
          </span>
          <span className="text-xs bg-brand-primary/10 border border-brand-primary/20 px-3 py-1.5 rounded-full font-bold text-brand-primary uppercase">
            {patientOccurrences.length} sessões registradas
          </span>
        </div>
      </div>

      {/* Sub-Tabs Nav */}
      <nav className="flex gap-1.5 border-b border-brand-border/60 pb-1 overflow-x-auto">
        {(["prontuario", "insights", "dados", "historico", "financeiro", "formularios"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`rounded-xl px-4 py-2 text-xs font-black capitalize tracking-wide whitespace-nowrap cursor-pointer transition-all ${
              activeSubTab === tab
                ? "bg-brand-primary text-white"
                : "text-brand-muted hover:bg-slate-50 hover:text-brand-text"
            }`}
          >
            {tab === "prontuario" && "🩺 Prontuário"}
            {tab === "insights" && "📊 Insights Clínicos"}
            {tab === "dados" && "📝 Cadastro e Notas"}
            {tab === "historico" && "⏳ Histórico Presenças"}
            {tab === "financeiro" && "💰 Financeiro"}
            {tab === "formularios" && "📋 Formulários"}
          </button>
        ))}
      </nav>

      {/* Sub-Tabs Router */}
      <div>

        {/* SUB-TAB CLINICAL NOTES (PRONTUÁRIO) */}
        {activeSubTab === "prontuario" && (
          <div className="space-y-6">
            
            {/* Quick Record Form */}
            <form onSubmit={handleSaveEvolution} className="rounded-2xl border border-brand-primary/10 bg-white p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-brand-text border-b pb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                {editingEvolutionId ? "📝 Editar Evolução Clínica" : "🩺 Registrar Nova Evolução da Sessão"}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                
                {/* Left side: Humor, Session Date and Topics */}
                <div className="md:col-span-7 space-y-4">
                  
                  {/* Link with session appointment & Humor */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-brand-text uppercase tracking-wider block">Vincular a uma Consulta</label>
                      <select
                        value={evolutionOccurrenceKey}
                        onChange={(e) => setEvolutionOccurrenceKey(e.target.value)}
                        className="w-full text-xs rounded-xl border border-brand-border bg-slate-50 px-3 py-2 outline-hidden font-bold text-slate-800"
                      >
                        <option value="">-- Avulsa / Desvinculada --</option>
                        {patientOccurrences.map((o) => {
                          const time = o.when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                          const dateDisplay = o.when.toLocaleDateString("pt-BR");
                          return (
                            <option key={o.key} value={o.key}>
                              ⏱️ {dateDisplay} às {time} ({o.local})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-brand-text uppercase tracking-wider block">Humor do Paciente ({evolutionHumor}/10)</label>
                      <input 
                        type="range" 
                        min="1" 
                        max="10" 
                        value={evolutionHumor} 
                        onChange={(e) => setEvolutionHumor(Number(e.target.value))}
                        className="w-full h-2 bg-slate-100 rounded-lg cursor-pointer accent-emerald-600 mt-2.5"
                      />
                      <div className="flex justify-between text-[9px] font-extrabold text-brand-muted uppercase">
                        <span>1 (Deprimido)</span>
                        <span>5 (Neutro)</span>
                        <span>10 (Excelente)</span>
                      </div>
                    </div>
                  </div>

                  {/* Topics trabajado block */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-brand-text uppercase tracking-wider block">Temas Trabalhados na Sessão</label>
                    <div className="flex flex-wrap gap-1.5">
                      {predefinedTopics.map((topic) => {
                        const isSelected = evolutionSelectedTopics.includes(topic);
                        return (
                          <button
                            type="button"
                            key={topic}
                            onClick={() => {
                              if (isSelected) {
                                setEvolutionSelectedTopics(prev => prev.filter(t => t !== topic));
                              } else {
                                setEvolutionSelectedTopics(prev => [...prev, topic]);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                              isSelected 
                                ? "bg-indigo-600 border-indigo-700 text-white shadow-3xs scale-102" 
                                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {topic}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Topic addition */}
                    <div className="flex gap-2 items-center mt-2.5 max-w-xs">
                      <input
                        type="text"
                        placeholder="Outro tema..."
                        value={customTopicInput}
                        onChange={(e) => setCustomTopicInput(e.target.value)}
                        className="text-xs rounded-lg border border-brand-border bg-slate-50 px-2 py-1 flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const clean = customTopicInput.trim();
                          if (clean && !evolutionSelectedTopics.includes(clean)) {
                            setEvolutionSelectedTopics(prev => [...prev, clean]);
                            setCustomTopicInput("");
                          }
                        }}
                        className="rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] font-black px-2.5 py-1.5 cursor-pointer"
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>

                </div>

                {/* Right side: Summary and Next Steps text areas */}
                <div className="md:col-span-5 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-brand-text uppercase tracking-wider block">Resumo do Encontro (Evolução Clínica)</label>
                    <textarea
                      placeholder="Registrar anotações, principais insights relatados, respostas comportamentais desenvolvidas no encontro..."
                      value={evolutionSummary}
                      onChange={(e) => setEvolutionSummary(e.target.value)}
                      className="w-full text-xs rounded-xl border border-brand-border bg-slate-50 focus:bg-white focus:border-indigo-500 p-2.5 min-h-[75px]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-brand-text uppercase tracking-wider block">Plano de Ação / Próximos Passos</label>
                    <textarea
                      placeholder="Exercícios complementares recomendados, tópicos para retomar na próxima consulta..."
                      value={evolutionNextSteps}
                      onChange={(e) => setEvolutionNextSteps(e.target.value)}
                      className="w-full text-xs rounded-xl border border-brand-border bg-slate-50 focus:bg-white focus:border-indigo-500 p-2.5 min-h-[55px]"
                    />
                  </div>
                </div>

              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 border-t pt-3 mt-1.5">
                {editingEvolutionId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEvolutionId(null);
                      setEvolutionSummary("");
                      setEvolutionNextSteps("");
                      setEvolutionSelectedTopics([]);
                      setEvolutionOccurrenceKey("");
                      setEvolutionHumor(7);
                    }}
                    className="rounded-lg border border-slate-300 bg-white text-slate-700 text-xs px-3.5 py-1.5 font-black cursor-pointer hover:bg-slate-50"
                  >
                    Cancelar Edição
                  </button>
                )}
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-5 py-2 font-black shadow-xs cursor-pointer active:translate-y-[0.5px]"
                >
                  {editingEvolutionId ? "Atualizar Evolução Clínica" : "Salvar Registro e Evoluir"}
                </button>
              </div>
            </form>

            {/* Evolution Records Timeline list */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 p-3 rounded-2xl border">
                <div>
                  <h4 className="text-xs font-black text-brand-text uppercase block">Linha do Tempo de Evoluções Clínicas</h4>
                  <span className="text-[10px] text-brand-muted font-bold block mt-0.5">{patientEvolutionsSorted.length} anotações clínicas arquivadas</span>
                </div>

                {/* Filter and Search */}
                <div className="relative w-full sm:w-64 shrink-0">
                  <input
                    type="text"
                    placeholder="Filtrar por palavras-chave ou temas..."
                    value={evolutionSearch}
                    onChange={(e) => setEvolutionSearch(e.target.value)}
                    className="w-full text-xs rounded-xl border border-brand-border bg-white px-3 py-1.5 outline-hidden focus:border-brand-primary font-bold"
                  />
                </div>
              </div>

              {/* Timeline content list */}
              {patientEvolutionsSorted.length === 0 ? (
                <div className="text-center rounded-xl border border-dashed border-slate-200 py-10 bg-slate-50/50">
                  <Clock3 className="h-8 w-8 text-slate-300 mx-auto mb-2 animate-pulse" />
                  <p className="text-xs font-black text-brand-text">Nenhum histórico clínico anotado para este paciente.</p>
                  <p className="text-[10.5px] text-brand-muted mt-1">Preencha o formulário acima para registrar sua primeira evolução.</p>
                </div>
              ) : (
                <div className="space-y-4 relative border-l-2 border-slate-200 ml-4 pl-6 py-2">
                  {patientEvolutionsSorted
                    .filter((ev) => {
                      if (!evolutionSearch.trim()) return true;
                      const q = evolutionSearch.toLowerCase();
                      const txt = `${ev.summary} ${ev.nextSteps} ${(ev.topics || []).join(" ")} ${ev.date}`.toLowerCase();
                      return txt.includes(q);
                    })
                    .map((ev) => (
                      <div key={ev.id} className="relative group/card animate-in fade-in duration-200">
                        {/* Time marker indicator */}
                        <span className="absolute -left-[32px] top-1 h-3.5 w-3.5 rounded-full bg-emerald-600 border-2 border-white ring-2 ring-emerald-100" />

                        <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-2xs hover:border-indigo-150 transition-colors space-y-2.5">
                          {/* Date, humor and action headers */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-rose-50 pb-2">
                            <div className="flex items-center gap-2">
                              <strong className="text-xs font-black text-slate-800 uppercase">
                                {new Date(ev.date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                              </strong>
                              <span className={`text-[10px] font-black rounded px-1.5 py-0.5 border ${
                                ev.mood >= 8 
                                  ? "bg-emerald-50 border-emerald-250 text-emerald-800" 
                                  : ev.mood >= 5 
                                  ? "bg-amber-50 border-amber-250 text-amber-800"
                                  : "bg-red-50 border-red-250 text-red-800"
                              }`}>
                                Humor: {ev.mood}/10
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] sm:opacity-0 group-hover/card:opacity-100 transition-opacity">
                              {evolutionIdConfirmDelete === ev.id ? (
                                <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2 py-1 rounded-xl animate-in zoom-in-95 duration-150">
                                  <span className="font-extrabold text-rose-700 text-[9px] uppercase">Confirma excluir?</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onUpdateState((prev) => ({
                                        ...prev,
                                        evolutions: (prev.evolutions || []).filter((e) => e.id !== ev.id)
                                      }));
                                      setEvolutionIdConfirmDelete(null);
                                    }}
                                    className="font-black text-rose-600 hover:text-rose-800 bg-white border border-rose-250 px-1.5 py-0.5 rounded-sm cursor-pointer shadow-3xs text-[9px]"
                                  >
                                    Sim
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEvolutionIdConfirmDelete(null)}
                                    className="font-extrabold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded-sm cursor-pointer text-[9px]"
                                  >
                                    Não
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditEvolution(ev)}
                                    className="inline-flex items-center gap-0.5 font-bold text-slate-500 hover:text-indigo-600 hover:bg-slate-100 px-1.5 py-0.5 rounded cursor-pointer"
                                  >
                                    <Pencil className="h-2.5 w-2.5" /> Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEvolutionIdConfirmDelete(ev.id)}
                                    className="inline-flex items-center gap-0.5 font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-1.5 py-0.5 rounded cursor-pointer"
                                  >
                                    <Trash2 className="h-2.5 w-2.5" /> Excluir
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Predefined topic tag pills */}
                          {ev.topics && ev.topics.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {ev.topics.map((t) => (
                                <span key={t} className="bg-indigo-50 border border-indigo-100 text-indigo-900 rounded-md px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wide">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Summary text */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-black text-brand-muted uppercase tracking-wider block">Resumo do Processo</span>
                            <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-line bg-slate-50/50 rounded-xl p-2.5 border border-dashed border-slate-100">
                              {ev.summary}
                            </p>
                          </div>

                          {/* Plan of action next steps */}
                          <div className="space-y-1 border-t border-slate-50 pt-2 flex items-baseline gap-1.5">
                            <Sparkles className="h-3 w-3 text-emerald-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <span className="text-[10px] font-black text-brand-muted uppercase tracking-wider block">Direcionamento / Próximos Passos</span>
                              <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                                {ev.nextSteps}
                              </p>
                            </div>
                          </div>

                        </div>
                      </div>
                    ))}
                </div>
              )}

            </div>

          </div>
        )}

        {/* SUB-TAB INSIGHTS CLÍNICOS */}
        {activeSubTab === "insights" && (
          <div className="space-y-6">
            
            {/* Indicators widgets */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border rounded-2xl p-4 shadow-2xs space-y-1">
                <span className="text-[10px] uppercase font-black text-brand-muted tracking-wide block">Humor Geral Médio</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-brand-text">{avgHumor === 0 ? "N/A" : `${avgHumor}`}</span>
                  <span className="text-[10.5px] font-extrabold text-brand-primary lowercase bg-indigo-50 px-2 py-0.5 rounded-md">escala 1-10</span>
                </div>
                <p className="text-[10px] text-brand-muted leading-relaxed font-semibold pt-1">Média dos registros clínicos coletados pós-sessões.</p>
              </div>

              <div className="bg-white border rounded-2xl p-4 shadow-2xs space-y-1">
                <span className="text-[10px] uppercase font-black text-brand-muted tracking-wide block">Taxa de Presença</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-emerald-700">{attendanceRate}%</span>
                  <span className="text-[10.5px] font-extrabold text-emerald-600 lowercase bg-emerald-50 px-2 py-0.5 rounded-md">comparência</span>
                </div>
                <p className="text-[10px] text-brand-muted leading-relaxed font-semibold pt-1">Comparecimento real contra faltas contabilizadas.</p>
              </div>

              <div className="bg-white border rounded-2xl p-4 shadow-2xs space-y-1">
                <span className="text-[10px] uppercase font-black text-brand-muted tracking-wide block">Evoluções Registradas</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-blue-700">{patientEvolutionsSorted.length}</span>
                  <span className="text-[10.5px] font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">encontros</span>
                </div>
                <p className="text-[10px] text-brand-muted leading-relaxed font-semibold pt-1">Diários clínicos preenchidos e arquivados.</p>
              </div>

              <div className="bg-white border rounded-2xl p-4 shadow-2xs space-y-1">
                <span className="text-[10px] uppercase font-black text-brand-muted tracking-wide block">Demanda Preponderante</span>
                <div className="flex items-baseline gap-1.5">
                  <strong className="text-base sm:text-lg font-black text-indigo-900 truncate max-w-full block">{recurrentTheme}</strong>
                </div>
                <p className="text-[10px] text-brand-muted leading-relaxed font-semibold pt-1">Tema mais recorrente diagnosticado nas conversações.</p>
              </div>
            </div>

            {/* Custom Interactive SVG Humor Line Chart */}
            <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
              <div>
                <h4 className="text-xs font-black text-brand-text uppercase block">Evolução Histórica do Humor</h4>
                <p className="text-[10.5px] text-brand-muted font-bold mt-0.5">Variação longitudinal do estado de humor do paciente ao longo da terapia.</p>
              </div>

              {patientEvolutionsSorted.length === 0 ? (
                <div className="text-center rounded-xl p-10 bg-slate-50 border border-dashed border-slate-200">
                  <TrendingUp className="h-8 w-8 text-slate-300 mx-auto mb-1 animate-pulse" />
                  <p className="text-xs font-black text-brand-text">Gráfico indisponível.</p>
                  <p className="text-[10.5px] text-brand-muted mt-1">Registre pelo menos uma evolução para construir a linha de comportamento.</p>
                </div>
              ) : (
                <div className="pt-2">
                  <div className="relative w-full h-auto bg-slate-50/50 p-2.5 rounded-2xl border border-dashed">
                    {/* SVG Chart Engine */}
                    <svg viewBox="0 0 600 220" className="w-full h-auto" style={{ maxHeight: "240px" }}>
                      <defs>
                        <linearGradient id="moodChartGrade" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Grid lines */}
                      {[1, 5, 10].map((level) => {
                        const gridY = 180 - ((level - 1) * 160 / 9);
                        return (
                          <g key={level}>
                            <line 
                              x1="50" 
                              y1={gridY} 
                              x2="560" 
                              y2={gridY} 
                              stroke="#e2e8f0" 
                              strokeWidth="1" 
                              strokeDasharray="4 4" 
                            />
                            <text 
                              x="25" 
                              y={gridY + 4} 
                              fill="#94a3b8" 
                              fontSize="10" 
                              className="font-mono font-black"
                            >
                              lvl {level}
                            </text>
                          </g>
                        );
                      })}

                      {/* Render line path if there exist entries */}
                      {(() => {
                        // Chronological sorting (oldest first for line plotting)
                        const chron = [...patientEvolutionsSorted].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                        const coords = chron.map((ev, i) => {
                          const x = chron.length === 1 
                            ? 300 
                            : 55 + i * (500 / (chron.length - 1));
                          const y = 180 - ((ev.mood - 1) * 160 / 9);
                          return { x, y, mood: ev.mood, date: ev.date };
                        });

                        // Draw path
                        let linePath = "";
                        let fillPath = "";
                        
                        if (coords.length > 0) {
                          linePath = `M ${coords[0].x} ${coords[0].y}`;
                          fillPath = `M ${coords[0].x} 180 L ${coords[0].x} ${coords[0].y}`;
                          
                          for (let i = 1; i < coords.length; i++) {
                            linePath += ` L ${coords[i].x} ${coords[i].y}`;
                            fillPath += ` L ${coords[i].x} ${coords[i].y}`;
                          }
                          
                          fillPath += ` L ${coords[coords.length - 1].x} 180 Z`;
                        }

                        return (
                          <g>
                            {/* Area Gradient Fill */}
                            {coords.length > 1 && (
                              <path d={fillPath} fill="url(#moodChartGrade)" />
                            )}

                            {/* Main Stroke line */}
                            <path 
                              d={linePath} 
                              fill="none" 
                              stroke="#10b981" 
                              strokeWidth="3.5" 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                            />

                            {/* Coordinate Dots */}
                            {coords.map((c, idx) => (
                              <g key={idx}>
                                <circle 
                                  cx={c.x} 
                                  cy={c.y} 
                                  r="5" 
                                  fill="#10b981" 
                                  stroke="#ffffff" 
                                  strokeWidth="2" 
                                  className="cursor-pointer hover:scale-130 transition-transform" 
                                />
                                
                                {/* Label Text (date & score) */}
                                <text 
                                  x={c.x} 
                                  y={c.y - 12} 
                                  textAnchor="middle" 
                                  fill="#0f172a" 
                                  fontSize="9.5" 
                                  fontWeight="900"
                                >
                                  {c.mood}
                                </text>
                                
                                <text 
                                  x={c.x} 
                                  y="198" 
                                  textAnchor="middle" 
                                  fill="#64748b" 
                                  fontSize="9" 
                                  fontWeight="700"
                                >
                                  {(() => {
                                    const parts = c.date.split("-");
                                    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : c.date;
                                  })()}
                                </text>
                              </g>
                            ))}
                          </g>
                        );
                      })()}
                    </svg>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* SUB-TAB CADASTRO */}
        {activeSubTab === "dados" && (
          <form onSubmit={handleSaveData} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* Esquerda: Dados Pessoais (Col spans 2) */}
              <div className="md:col-span-2 rounded-2xl border border-brand-border bg-white p-5 space-y-4 shadow-xs">
                <h3 className="text-xs font-black text-brand-text uppercase tracking-wider border-b border-brand-border/45 pb-2">
                  Dados de Identificação & Contato
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-brand-muted">Nome Completo do Paciente *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs font-bold focus:border-brand-primary outline-hidden"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-brand-muted">WhatsApp / Celular com DDD *</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ex.: 11999992222"
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs font-bold focus:border-brand-primary outline-hidden"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-bold text-brand-muted">Nome Social / Pronomes</label>
                    <input
                      type="text"
                      value={socialName}
                      onChange={(e) => setSocialName(e.target.value)}
                      placeholder="Identidade de gênero relatada"
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs focus:border-brand-primary outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-brand-muted">CPF</label>
                    <input
                      type="text"
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value)}
                      placeholder="Apenas números ou formatado"
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs focus:border-brand-primary outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-brand-muted">Data de Nascimento</label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs focus:border-brand-primary outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-bold text-brand-muted">E-mail</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Ex.: paciente@email.com"
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs focus:border-brand-primary outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-brand-muted">Profissão</label>
                    <input
                      type="text"
                      value={profession}
                      onChange={(e) => setProfession(e.target.value)}
                      placeholder="Ex.: Desenvolvedora"
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs focus:border-brand-primary outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-brand-muted">Estado Civil</label>
                    <select
                      value={civilStatus}
                      onChange={(e) => setCivilStatus(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs focus:border-brand-primary outline-hidden"
                    >
                      <option value="Solteiro(a)">Solteiro(a)</option>
                      <option value="Casado(a)">Casado(a)</option>
                      <option value="Divorciado(a)">Divorciado(a)</option>
                      <option value="Viúvo(a)">Viúvo(a)</option>
                      <option value="União Estável">União Estável</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-bold text-brand-muted font-black text-amber-700">📞 Contato de Emergência</label>
                    <input
                      type="text"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      placeholder="Ex.: Marta (Mãe) - 11988887777"
                      className="mt-1.5 w-full rounded-xl border border-brand-border bg-amber-500/[0.02] px-3 py-2 text-xs focus:border-brand-primary outline-hidden border-amber-500/10"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-brand-muted">Endereço Completo</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Rua, número, bairro, cidade - UF"
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs focus:border-brand-primary outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Direita: Notas Administrativas e Observações (Col spans 1) */}
              <div className="rounded-2xl border border-brand-border bg-white p-5 space-y-4 shadow-xs">
                <h3 className="text-xs font-black text-brand-text uppercase tracking-wider border-b border-brand-border/45 pb-2">
                  Acordo Administrativo & Notas
                </h3>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-brand-muted">Lembretes & Notas Rápidas</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Horários de preferência, acompanhante terapêutico ou informações logísticas importantes..."
                      className="mt-1 w-full rounded-xl border border-brand-border bg-slate-50 p-2.5 text-xs outline-hidden focus:bg-white focus:border-brand-primary min-h-[72px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-brand-muted">Faturamento / Acordo Financeiro</label>
                    <textarea
                      value={billingInfo}
                      onChange={(e) => setBillingInfo(e.target.value)}
                      placeholder="Valor fixado por sessão, dia preferencial de PIX, responsável financeira..."
                      className="mt-1 w-full rounded-xl border border-brand-border bg-slate-50 p-2.5 text-xs outline-hidden focus:bg-white focus:border-brand-primary min-h-[58px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-brand-muted">Convênio e Parcerias</label>
                    <input
                      type="text"
                      value={insuranceInfo}
                      onChange={(e) => setInsuranceInfo(e.target.value)}
                      placeholder="Ex.: Particular, Reembolso Bradesco Saúde..."
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs focus:border-brand-primary outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* ABAIXO: Ficha de Anamnese Psicológica Integrada */}
              <div className="md:col-span-3 rounded-2xl border border-brand-border bg-slate-50/50 p-5 space-y-5">
                <div className="flex items-center gap-1.5 border-b border-brand-border/60 pb-2.5">
                  <FileText className="h-4.5 w-4.5 text-brand-primary" />
                  <div>
                    <h3 className="text-xs font-black text-brand-text uppercase tracking-wider">
                      Ficha de Investigação Inicial de Anamnese
                    </h3>
                    <p className="text-[10px] text-brand-muted leading-tight font-medium uppercase tracking-wider mt-0.5">
                      Perguntas fundamentais e registros colhidos na entrevista diagnóstica e de triagem
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Queixa Principal */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">1. Queixa Principal e Procura</label>
                    <textarea
                      placeholder="Ex.: Crises de pânico recorrentes iniciadas há 3 meses..."
                      value={chiefComplaint}
                      onChange={(e) => setChiefComplaint(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white p-3 text-xs outline-hidden focus:border-brand-primary min-h-[75px]"
                    />
                  </div>

                  {/* Histórico Clínico */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">2. Histórico Clínico, Médico & Medicamentoso</label>
                    <textarea
                      placeholder="Ex.: Faz uso de Venlafaxina 75mg prescrito pelo psiquiatra..."
                      value={medicalHistory}
                      onChange={(e) => setMedicalHistory(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white p-3 text-xs outline-hidden focus:border-brand-primary min-h-[75px]"
                    />
                  </div>

                  {/* Dinâmica Familiar */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">3. Dinâmica Familiar & Relações Próximas</label>
                    <textarea
                      placeholder="Ex.: Mora com companheiro há 2 anos, relação com pais conflituosa..."
                      value={familyHistory}
                      onChange={(e) => setFamilyHistory(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white p-3 text-xs outline-hidden focus:border-brand-primary min-h-[75px]"
                    />
                  </div>

                  {/* Indicação */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">4. Indicação / Origem do Paciente</label>
                    <textarea
                      placeholder="Como o paciente localizou o consultório..."
                      value={recommendedBy}
                      onChange={(e) => setRecommendedBy(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white p-3 text-xs outline-hidden focus:border-brand-primary min-h-[75px]"
                    />
                  </div>

                  {/* Objetivos */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">5. Objetivos Alinhados da Psicoterapia</label>
                    <textarea
                      placeholder="Ex.: Regulação emocional, pôr limites a terceiros..."
                      value={therapyGoals}
                      onChange={(e) => setTherapyGoals(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white p-3 text-xs outline-hidden focus:border-brand-primary min-h-[75px]"
                    />
                  </div>

                  {/* Sono e Hábitos */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">6. Sono, Alimentação & Hábitos Saudáveis/Gerais</label>
                    <textarea
                      placeholder="Ex.: Dificuldades em iniciar o sono, cafeína em excesso..."
                      value={habitsLifestyle}
                      onChange={(e) => setHabitsLifestyle(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white p-3 text-xs outline-hidden focus:border-brand-primary min-h-[75px]"
                    />
                  </div>
                </div>
              </div>

            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-5 py-3 text-xs font-black text-white hover:opacity-95 active:translate-y-[0.5px] cursor-pointer"
              >
                <Save className="h-4 w-4" /> Salvar Todo Cadastro
              </button>
            </div>
          </form>
        )}

        {/* SUB-TAB HISTORICO TIMELINE */}
        {activeSubTab === "historico" && (
          <div className="rounded-2xl border border-brand-border bg-white p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-black text-brand-text uppercase tracking-wider border-b border-brand-border/45 pb-2">
              Prontuário de Presenças (Linha do Tempo)
            </h3>

            {patientOccurrences.length === 0 ? (
              <p className="text-xs text-brand-muted italic py-6 text-center">Este paciente ainda não possui nenhuma sessão agendada.</p>
            ) : (
              <div className="relative border-l-2 border-brand-border/70 pl-5 ml-2.5 py-2 space-y-4">
                {patientOccurrences.map((o) => {
                  const status = state.statuses[o.key] || "aguardando";
                  const baseSession = state.sessions.find(s => s.id === o.sessionId);
                  const financial = state.occurrenceFinancials?.[o.key] || {
                    value: baseSession?.value !== undefined ? baseSession.value : 150,
                    paymentMethod: baseSession?.paymentMethod || "PIX",
                    financialStatus: baseSession?.financialStatus || "Pendente"
                  };

                  return (
                    <div key={o.key} className="relative">
                      {/* DOT Indicator */}
                      <span className={`absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white ring-2 ${
                        status === "realizada" 
                          ? "bg-blue-600 ring-blue-100" 
                          : status === "confirmado" 
                          ? "bg-emerald-600 ring-emerald-100"
                          : status === "falta"
                          ? "bg-red-600 ring-red-100"
                          : status === "cancelado"
                          ? "bg-slate-400 ring-slate-100"
                          : "bg-amber-500 ring-amber-100"
                      }`} />

                      <div className="bg-slate-50 rounded-xl p-3 hover:bg-slate-100/75 transition-colors border border-brand-border/40">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <strong className="text-xs text-brand-text block uppercase font-black">
                            {formatLongBR(o.when)} às {o.when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </strong>
                          
                          {/* Financial Badge */}
                          <div className="flex gap-2 items-center text-[10px]">
                            <span className="font-extrabold uppercase text-brand-muted">R$ {financial.value} • {financial.paymentMethod}</span>
                            <span className={`px-1.5 py-0.5 rounded-md font-black uppercase text-[9px] ${
                              financial.financialStatus === "Pago" 
                                ? "bg-emerald-100 text-emerald-800" 
                                : "bg-amber-100 text-amber-800"
                            }`}>
                              {financial.financialStatus}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 items-center mt-2.5 pt-2 border-t border-brand-border/40 text-[10px]">
                          <span className="text-brand-muted font-bold">Local: <b>{o.local}</b></span>
                          {o.note && <span className="text-brand-muted font-semibold bg-white border px-1.5 py-0.5 rounded truncate">Obs: {o.note}</span>}
                          
                          <span className="ml-auto font-black uppercase">
                            Status Presença: <b>{status}</b>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB FINANCEIRO INDIVIDUAL */}
        {activeSubTab === "financeiro" && (
          <div className="space-y-4">
            
            {/* Financial indicators widgets */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="bg-white border rounded-xl p-3 text-center">
                <span className="text-[10px] uppercase font-bold text-brand-muted block">Sessões Totais</span>
                <span className="text-lg font-black text-slate-800 block mt-1">{patientStats.totalSessoes}</span>
              </div>
              <div className="bg-white border rounded-xl p-3 text-center">
                <span className="text-[10px] uppercase font-bold text-brand-muted block">Compareceu</span>
                <span className="text-lg font-black text-emerald-700 block mt-1">{patientStats.realizadasCount}</span>
              </div>
              <div className="bg-white border rounded-xl p-3 text-center">
                <span className="text-[10px] uppercase font-bold text-brand-muted block">Faltas</span>
                <span className="text-lg font-black text-red-700 block mt-1">{patientStats.faltasCount}</span>
              </div>
              <div className="bg-white border border-emerald-250 bg-emerald-50/5 rounded-xl p-3 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">Total Pago</span>
                <span className="text-lg font-black text-emerald-800 block mt-1">R$ {patientStats.totalPago}</span>
              </div>
              <div className="bg-white border border-amber-250 bg-amber-50/5 rounded-xl p-3 text-center">
                <span className="text-[10px] uppercase font-bold text-amber-700 block">Total Pendente</span>
                <span className="text-lg font-black text-amber-800 block mt-1">R$ {patientStats.totalPendente}</span>
              </div>
            </div>

            {/* In depth logs */}
            <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs">
              <h4 className="text-xs font-black text-brand-text uppercase tracking-wider mb-2 pb-1.5 border-b">Consolidado Contábil</h4>
              
              <div className="space-y-2">
                {patientOccurrences.map((o) => {
                  const baseSession = state.sessions.find(s => s.id === o.sessionId);
                  const financial = state.occurrenceFinancials?.[o.key] || {
                    value: baseSession?.value !== undefined ? baseSession.value : 150,
                    paymentMethod: baseSession?.paymentMethod || "PIX",
                    financialStatus: baseSession?.financialStatus || "Pendente"
                  };
                  const clinicalStatus = state.statuses[o.key] || "aguardando";

                  return (
                    <div key={o.key} className="flex justify-between items-center text-xs p-2 bg-slate-50/50 rounded-lg hover:bg-slate-50">
                      <div>
                        <span className="font-bold text-slate-800">{o.when.toLocaleDateString("pt-BR")}</span>
                        <span className="text-brand-muted text-[10px] ml-2">({o.local})</span>
                      </div>
                      <div className="flex gap-4 items-center">
                        <span className="text-brand-muted capitalize font-semibold text-[11px]">{clinicalStatus}</span>
                        <strong className="text-slate-800">R$ {financial.value}</strong>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          financial.financialStatus === "Pago" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {financial.financialStatus}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SUB-TAB RESPOSTAS DE FORMULARIOS */}
        {activeSubTab === "formularios" && (
          <div className="rounded-2xl border border-brand-border bg-white p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-black text-brand-text uppercase tracking-wider border-b border-brand-border/45 pb-2">
              Respostas de Questionários Recebidas
            </h3>

            {!patient.formResponses || patient.formResponses.length === 0 ? (
              <p className="text-xs text-brand-muted italic py-6 text-center">Nenhum formulário ou escala clínica respondida por este paciente ainda.</p>
            ) : (
              <div className="space-y-4">
                {patient.formResponses.map((resp, idx) => (
                  <div key={idx} className="rounded-xl border border-brand-border bg-slate-50 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <strong className="text-xs font-black text-brand-text uppercase">{resp.formTitle}</strong>
                      <span className="text-[11px] font-bold text-brand-muted">Enviado em {resp.date}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 text-xs">
                      {Object.keys(resp.answers).map((fieldId) => {
                        const ans = resp.answers[fieldId];
                        return (
                          <div key={fieldId} className="bg-white p-2.5 rounded-lg border">
                            <span className="text-[10px] font-extrabold text-brand-muted block uppercase tracking-wide">Pergunta / Métrica</span>
                            <span className="font-black text-brand-text block mt-0.5">{fieldId}</span>
                            <span className="text-[10.5px] text-slate-800 block mt-1.5 pl-2 border-l-2 border-brand-primary bg-slate-50/50 py-1 rounded">
                              {typeof ans === "boolean" ? (ans ? "✅ Sim / Confirmado" : "❌ Não") : String(ans)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
