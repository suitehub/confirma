import React, { useState, useMemo } from "react";
import { 
  Users, 
  PlusCircle, 
  Search, 
  Trash2, 
  Send, 
  Sparkles, 
  UserCheck, 
  ArrowUpDown,
  Phone
} from "lucide-react";
import { AppState, WaitingPatient, Patient } from "../types";

interface WaitingListTabProps {
  state: AppState;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  onWaOpen: (phone: string, msg: string) => void;
}

export default function WaitingListTab({
  state,
  onUpdateState,
  onWaOpen
}: WaitingListTabProps) {
  // Local active list
  const list = useMemo(() => {
    return state.waitingList || [];
  }, [state.waitingList]);

  // Sorting
  const [sortBy, setSortBy] = useState<"prioridade" | "data">("prioridade");

  // Inputs for novel entry
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [availability, setAvailability] = useState("Segunda tarde");
  const [priority, setPriority] = useState<"alta" | "media" | "baixa">("media");
  const [notes, setNotes] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  // Handler: Add Patient to Waitlist
  const handleAddToWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim().replace(/\D/g, "");

    if (!cleanName || !cleanPhone) {
      alert("Por favor, preencha o Nome e o WhatsApp.");
      return;
    }

    const newItem: WaitingPatient = {
      id: crypto.randomUUID(),
      name: cleanName,
      phone: cleanPhone,
      availability,
      priority,
      notes: notes.trim(),
      createdAt: Date.now()
    };

    onUpdateState((prev) => ({
      ...prev,
      waitingList: [...(prev.waitingList || []), newItem]
    }));

    // Resetting
    setName("");
    setPhone("");
    setNotes("");
    alert(`${cleanName} adicionado à Fila de Espera.`);
  };

  // Handler: Remove from Waitlist
  const handleRemove = (id: string, name: string) => {
    if (confirm(`Remover "${name}" da lista de espera?`)) {
      onUpdateState((prev) => ({
        ...prev,
        waitingList: (prev.waitingList || []).filter((w) => w.id !== id)
      }));
    }
  };

  // Handler: Convert Waiting Patient to Active clinic patient
  const handleConvertToActive = (w: WaitingPatient) => {
    if (confirm(`Cadastrar "${w.name}" como paciente definitivo do consultório?`)) {
      onUpdateState((prev) => {
        // 1. check for existing patient
        const alreadyExists = prev.patients.some((p) => p.phone === w.phone);
        
        const nextPatients = alreadyExists 
          ? prev.patients 
          : [
              ...prev.patients,
              {
                id: crypto.randomUUID(),
                name: w.name,
                phone: w.phone,
                notes: `Convertido de fila de espera. Notas anteriores: ${w.notes || "Nenhuma"}`
              }
            ];

        return {
          ...prev,
          patients: nextPatients,
          waitingList: (prev.waitingList || []).filter((item) => item.id !== w.id)
        };
      });
      alert(`Cadastro definitivo efetuado para ${w.name}!`);
    }
  };

  // Handler: Offer Spot (OFERECER HORÁRIO) via WhatsApp
  const handleOfferSpot = (w: WaitingPatient) => {
    const text = `Olá ${w.name}! Tudo bem? Temos um horário disponível no consultório que combina com sua preferência de atendimento: ${w.availability}. Gostaria de agendar esse compromisso com a gente? Me avise para segurarmos a vaga!`;
    onWaOpen(w.phone, text);
  };

  // Apply search query and sorting
  const processedList = useMemo(() => {
    let filtered = list;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = list.filter(w => w.name.toLowerCase().includes(q) || w.phone.includes(q));
    }

    return [...filtered].sort((a, b) => {
      if (sortBy === "data") {
        return b.createdAt - a.createdAt; // Newest first
      } else {
        // Prioridade sorting: alta -> media -> baixa
        const weight = { alta: 3, media: 2, baixa: 1 };
        return weight[b.priority || "media"] - weight[a.priority || "media"];
      }
    });
  }, [list, searchQuery, sortBy]);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 leading-relaxed">
      
      {/* Back and title */}
      <div className="lg:col-span-12 px-1">
        <h2 className="text-xl font-black text-brand-text">Fila de Espera de Pacientes</h2>
        <p className="text-xs text-brand-muted">Gerencie a entrada de novos clientes interessados e ofereça vagas ociosas</p>
      </div>

      {/* Form: Add queue (Col span 5) */}
      <div className="lg:col-span-5">
        <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs space-y-3.5">
          <h3 className="inline-flex items-center gap-1.5 text-xs font-black text-brand-text uppercase tracking-wider">
            <PlusCircle className="h-4 w-4 text-brand-primary" /> Colocar Paciente na Fila
          </h3>

          <form onSubmit={handleAddToWaitlist} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-brand-muted uppercase">Nome por Extenso</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Rodrigo Siqueira"
                className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs focus:border-brand-primary outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-brand-muted uppercase">WhatsApp (DDD)</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex.: 47999881122"
                className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs focus:border-brand-primary outline-hidden"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-brand-muted uppercase">Disponibilidade</label>
                <select
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-brand-border bg-white p-2 text-xs focus:border-brand-primary outline-hidden"
                >
                  <option value="Segunda manhã">🌅 Seg Manhã</option>
                  <option value="Segunda tarde">🌇 Seg Tarde</option>
                  <option value="Terça manhã">🌅 Ter Manhã</option>
                  <option value="Terça tarde">🌇 Ter Tarde</option>
                  <option value="Quarta manhã">🌅 Qua Manhã</option>
                  <option value="Quarta tarde">🌇 Qua Tarde</option>
                  <option value="Quinta manhã">🌅 Qui Manhã</option>
                  <option value="Quinta tarde">🌇 Qui Tarde</option>
                  <option value="Sexta manhã">🌅 Sex Manhã</option>
                  <option value="Sexta tarde">🌇 Sex Tarde</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-brand-muted uppercase">Prioridade</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as "alta" | "media" | "baixa")}
                  className="mt-1 w-full rounded-xl border border-brand-border bg-white p-2 text-xs focus:border-brand-primary outline-hidden font-bold"
                >
                  <option value="alta" className="text-red-700 font-extrabold">🚨 ALTA</option>
                  <option value="media" className="text-amber-700 font-extrabold">⚠️ MÉDIA</option>
                  <option value="baixa" className="text-blue-700 font-extrabold">📉 BAIXA</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-brand-muted uppercase">Observações da Entrada</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: Caso clínico severo, aguarda liberação de vaga..."
                className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs focus:border-brand-primary outline-hidden"
              />
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary py-2.5 text-xs font-black text-white hover:opacity-95 cursor-pointer"
            >
              Adicionar Novo Prontuário
            </button>
          </form>
        </div>
      </div>

      {/* List: Waitlist display (Col span 7) */}
      <div className="lg:col-span-7">
        <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs space-y-4">
          
          {/* Header controllers */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-2.5">
            <h3 className="inline-flex items-center gap-1.5 text-xs font-black text-brand-text uppercase tracking-wider">
              <Users className="h-4.5 w-4.5 text-brand-primary" /> Fila Ativa ({processedList.length})
            </h3>

            <div className="flex gap-2 w-full sm:w-auto">
              {/* Sort Toggle */}
              <button
                onClick={() => setSortBy(prev => prev === "prioridade" ? "data" : "prioridade")}
                className="inline-flex items-center gap-1 rounded-xl border border-brand-border bg-slate-50 hover:bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-brand-muted cursor-pointer"
              >
                <ArrowUpDown className="h-3 w-3" /> Ordenar: {sortBy === "prioridade" ? "Prioridade" : "Data de Entrada"}
              </button>

              <div className="relative w-full sm:w-40">
                <Search className="absolute top-2 left-2.5 h-3.5 w-3.5 text-brand-muted" />
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-brand-border bg-white pl-8 pr-2 py-1 text-[10px] outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* List display */}
          <div className="space-y-3">
            {processedList.length === 0 ? (
              <p className="text-xs text-brand-muted italic py-6 text-center">Fila de espera vazia. Adicione novas solicitações ao lado!</p>
            ) : (
              processedList.map((w) => (
                <div key={w.id} className="rounded-xl border border-brand-border bg-slate-50/50 p-3.5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  
                  {/* Detail text */}
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <strong className="text-xs font-black text-brand-text truncate block">{w.name}</strong>
                      <span className={`px-1.5 py-0.5 rounded-sm text-[8.5px] font-extrabold uppercase border ${
                        w.priority === "alta" 
                          ? "bg-red-50 text-red-700 border-red-100" 
                          : w.priority === "media"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-blue-50 text-blue-700 border-blue-100"
                      }`}>
                        {w.priority || "media"}
                      </span>
                    </div>

                    <div className="text-[10.5px] text-brand-muted space-y-0.5 font-medium">
                      <p>Disponibilidade: <b className="font-exrabold text-brand-primary">{w.availability}</b></p>
                      {w.notes && <p className="italic text-slate-700">Obs: "{w.notes}"</p>}
                    </div>
                  </div>

                  {/* Operational actions */}
                  <div className="flex gap-1.5 sm:self-center self-end border-t border-dashed sm:border-none pt-2.5 sm:pt-0">
                    <button
                      onClick={() => handleOfferSpot(w)}
                      className="inline-flex items-center gap-1 rounded bg-brand-primary px-2.5 py-1.5 text-[10px] font-black text-white hover:opacity-90 cursor-pointer"
                      title="Oferecer vaga disponível por WhatsApp"
                    >
                      <Send className="h-3 w-3" /> Oferecer Horário
                    </button>
                    
                    <button
                      onClick={() => handleConvertToActive(w)}
                      className="inline-flex items-center gap-1 rounded border border-emerald-250 bg-white px-2.5 py-1.5 text-[10px] font-black text-emerald-800 hover:bg-emerald-50 cursor-pointer"
                      title="Promover para Cadastro Ativo"
                    >
                      <UserCheck className="h-3 w-3" /> Efetivar
                    </button>

                    <button
                      onClick={() => handleRemove(w.id, w.name)}
                      className="p-1 rounded text-red-700 hover:bg-red-50 cursor-pointer"
                      title="Excluir da lista de espera"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
