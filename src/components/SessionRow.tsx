import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, MessageSquare, AlertCircle, RefreshCw, Pencil, CheckCircle, Clock, Coins } from "lucide-react";
import { Patient, Session, Occurrence, CustomConfirmTemplate, AutomationTemplate } from "../types";
import { 
  formatLongBR, 
  hmFromDate, 
  waLink, 
  replaceVars 
} from "../utils/helpers";

interface SessionRowProps {
  key?: React.Key | string;
  occurrence: Occurrence;
  patient: Patient;
  status: string;
  onStatusChange: (key: string, newStatus: string) => void;
  onEditSession: (session: Session) => void;
  baseSession: Session;
  confirmDefaultTemplate: string;
  reforcorDefaultTemplate: string;
  semRespostaDefaultTemplate: string;
  customTemplates: CustomConfirmTemplate[];
  onNavigateToSettings: () => void;
  onFinalizeSession?: (occurrence: Occurrence) => void;
  automations?: AutomationTemplate[];
}

export default function SessionRow({
  occurrence,
  patient,
  status,
  onStatusChange,
  onEditSession,
  baseSession,
  confirmDefaultTemplate,
  reforcorDefaultTemplate,
  semRespostaDefaultTemplate,
  customTemplates,
  onNavigateToSettings,
  onFinalizeSession,
  automations
}: SessionRowProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const time = hmFromDate(occurrence.when);
  const diaPorExtenso = formatLongBR(occurrence.when);
  const vars = { nome: patient.name, dia: diaPorExtenso, hora: time };

  // Status mapping
  const getStatusInfo = (st: string) => {
    switch (st) {
      case "confirmado":
        return { label: "Confirmado", color: "bg-status-ok", text: "text-status-ok", border: "border-status-ok/20", lightBg: "bg-status-ok/10" };
      case "semresposta":
        return { label: "Sem resposta", color: "bg-status-no", text: "text-status-no", border: "border-status-no/20", lightBg: "bg-status-no/10" };
      case "remarcar":
        return { label: "Remarcar", color: "bg-status-re", text: "text-status-re", border: "border-status-re/20", lightBg: "bg-status-re/10" };
      default:
        return { label: "Aguardando", color: "bg-status-wait", text: "text-status-wait", border: "border-status-wait/20", lightBg: "bg-status-wait/10" };
    }
  };

  const statusInfo = getStatusInfo(status);

  const openWa = (msg: string) => {
    window.open(waLink(patient.phone, msg), "_blank", "noopener,noreferrer");
  };

  const handleSendTrigger = (triggerType: string) => {
    setDropdownOpen(false);
    
    let templateText = "";
    const matchedAuto = automations?.find(a => a.trigger === triggerType);
    
    if (matchedAuto) {
      templateText = matchedAuto.text;
    } else {
      switch (triggerType) {
        case "48h_antes":
          templateText = "Olá {nome}, tudo bem? Passando para confirmar seu horário da próxima sessão na {dia} às {hora}. Se precisar fazer alguma alteração, me avise por aqui com antecedência. 😉";
          break;
        case "24h_antes":
          templateText = confirmDefaultTemplate;
          break;
        case "3h_antes":
          templateText = reforcorDefaultTemplate;
          break;
        case "pos_sessao":
          templateText = "Olá {nome}! Finalizamos nosso atendimento de hoje. O valor fechado do acerto desta sessão é de R$ {valor}. Você pode realizar o PIX para a chave cadastrada. Muito obrigado!";
          break;
        case "pos_vencimento":
          templateText = "Olá {nome}, tudo bem? Realizando o fechamento mensal das nossas consultas terapêuticas. O valor em aberto totaliza R$ {valor} referente ao nosso acompanhamento. Aguardo seu PIX de retorno quando puder. Abraço!";
          break;
        case "reschedule":
          templateText = `Oi {nome}, precisamos ajustar nosso horário. Pode me dizer dois horários bons para você?`;
          break;
        case "sem_sessao_futura":
          templateText = semRespostaDefaultTemplate;
          break;
        default:
          templateText = "";
      }
    }

    if (!templateText) return;

    const sessionCost = baseSession.value ? String(baseSession.value) : "150";
    const sessionPlace = occurrence.local || baseSession.local || "Online";

    const finalMsg = templateText
      .replace(/{nome}/g, patient.name)
      .replace(/{dia}/g, diaPorExtenso)
      .replace(/{hora}/g, time)
      .replace(/{valor}/g, sessionCost)
      .replace(/{vaga}/g, sessionPlace);

    openWa(finalMsg);

    if (triggerType === "reschedule") {
      onStatusChange(occurrence.key, "remarcar");
    } else if (triggerType === "sem_sessao_futura") {
      onStatusChange(occurrence.key, "semresposta");
    } else if (triggerType === "pos_sessao") {
      if (status !== "realizada") {
        onStatusChange(occurrence.key, "realizada");
      }
    }
  };

  const handleSendCustom = (customText: string) => {
    setDropdownOpen(false);
    const sessionCost = baseSession.value ? String(baseSession.value) : "150";
    const sessionPlace = occurrence.local || baseSession.local || "Online";

    const finalMsg = customText
      .replace(/{nome}/g, patient.name)
      .replace(/{dia}/g, diaPorExtenso)
      .replace(/{hora}/g, time)
      .replace(/{valor}/g, sessionCost)
      .replace(/{vaga}/g, sessionPlace);

    openWa(finalMsg);
  };

  const currentSessionPrice = baseSession.value ? String(baseSession.value) : null;

  return (
    <div 
      className={`group relative flex flex-col justify-between gap-4 rounded-2xl border border-brand-border bg-white p-4 transition-all hover:border-brand-primary/30 sm:flex-row sm:items-center cursor-pointer ${dropdownOpen ? "z-50" : "z-10"}`}
      onClick={(e) => {
        // Prevent opening edit modal if clicking inputs, dropdowns or buttons
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('select') || target.closest('a') || target.closest('.dropdown-area')) return;
        onEditSession(baseSession);
      }}
    >
      {/* Session main info */}
      <div className="flex flex-1 items-start gap-3 min-w-0">
        <div className="flex items-center gap-2 pt-1">
          <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusInfo.color}`} />
          <span className="font-mono text-base font-black text-brand-text w-12">{time}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h4 className="font-black text-base text-brand-text truncate leading-tight group-hover:text-brand-primary">
              {patient.name}
            </h4>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black border uppercase tracking-wider ${statusInfo.text} ${statusInfo.border} ${statusInfo.lightBg}`}>
              {statusInfo.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-brand-muted truncate">
            {occurrence.local} {occurrence.note ? `• ${occurrence.note}` : ""}
          </p>
        </div>
      </div>

      {/* Session actions */}
      <div className="flex flex-col gap-2.5 sm:items-end shrink-0 w-full sm:w-auto">
        {/* Status manual dropdown selectors */}
        <select
          value={status}
          onChange={(e) => onStatusChange(occurrence.key, e.target.value)}
          className="w-full rounded-xl border border-brand-border bg-slate-50 px-3 py-1.5 text-xs font-black text-brand-text outline-hidden cursor-pointer hover:bg-slate-100 sm:w-44"
          aria-label="Selecionar Status"
        >
          <option value="aguardando">⏳ Aguardando</option>
          <option value="confirmado">✅ Confirmado</option>
          <option value="realizada">🩺 Realizada</option>
          <option value="falta">🚨 Falta</option>
          <option value="cancelado">❌ Cancelado</option>
          <option value="semresposta">💬 Sem resposta</option>
          <option value="remarcar">🔄 Remarcar</option>
        </select>

        {/* Action button grids */}
        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
          {onFinalizeSession && status !== "realizada" && (
            <button
              onClick={() => onFinalizeSession(occurrence)}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 px-3 py-2 text-xs font-black text-center active:translate-y-[0.5px] cursor-pointer flex items-center justify-center gap-1 shadow-xs"
              title="Registrar evolução clínica desta consulta"
            >
              <CheckCircle className="h-3.5 w-3.5" /> Evoluir Consulta
            </button>
          )}

          {/* Unified WhatsApp Automations Button */}
          <div className="relative dropdown-area flex w-full sm:w-auto hover:scale-[1.01] transition-transform" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand-primary bg-brand-primary px-4 py-2 text-xs font-black text-white hover:opacity-90 cursor-pointer shadow-xs uppercase tracking-wider whitespace-nowrap"
            >
              <MessageSquare className="h-4 w-4" /> Disparar WhatsApp ⚡
              <ChevronDown className={`h-3 w-3.5 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-11 z-[120] w-72 rounded-2xl border border-brand-border bg-white shadow-2xl p-2 text-brand-text animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-2 py-1.5 border-b border-brand-border bg-slate-50/50 rounded-t-xl text-[10px] font-black text-brand-muted tracking-wide uppercase flex items-center justify-between">
                  <span>Gatilhos Clínicos Atuais</span>
                  <span className="bg-brand-primary/10 text-brand-primary text-[8px] px-1.5 py-0.5 rounded-xs font-black">WhatsApp</span>
                </div>

                <div className="max-h-72 overflow-y-auto mt-1.5 space-y-1">
                  
                  {/* Seção 1: Lembretes Futuros */}
                  <div className="px-2 py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/30 rounded-md">
                    Lembretes e Avisos
                  </div>
                  
                  <button
                    onClick={() => handleSendTrigger("48h_antes")}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-slate-50 flex flex-col group/item"
                  >
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-indigo-500" /> Confirmação 48h antes
                    </span>
                    <span className="text-[9.5px] text-brand-muted pl-4.5">Aviso prévio e aviso de agenda</span>
                  </button>

                  <button
                    onClick={() => handleSendTrigger("24h_antes")}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-slate-50 flex flex-col group/item"
                  >
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-brand-primary" /> Confirmação 24h antes
                    </span>
                    <span className="text-[9.5px] text-brand-muted pl-4.5">Lembrete padrão do consultório</span>
                  </button>

                  <button
                    onClick={() => handleSendTrigger("3h_antes")}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-slate-50 flex flex-col group/item"
                  >
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-amber-500" /> Prontidão Rápida 3h antes
                    </span>
                    <span className="text-[9.5px] text-brand-muted pl-4.5">Lembrete curto no dia da sessão</span>
                  </button>

                  {/* Seção 2: Ajustes de Fluxo */}
                  <div className="px-2 py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/30 rounded-md pt-2">
                    Ajustes Clínicos
                  </div>

                  <button
                    onClick={() => handleSendTrigger("reschedule")}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-slate-50 flex flex-col group/item"
                  >
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <RefreshCw className="h-3 w-3 text-blue-500" /> Sugerir Reagendar horário
                    </span>
                    <span className="text-[9.5px] text-brand-muted pl-4.5">Muda status de agendamento para Remarcar</span>
                  </button>

                  <button
                    onClick={() => handleSendTrigger("sem_sessao_futura")}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-slate-50 flex flex-col group/item"
                  >
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <AlertCircle className="h-3 w-3 text-rose-500" /> Notificar Falta / Sem Resposta
                    </span>
                    <span className="text-[9.5px] text-brand-muted pl-4.5">Alerta de sumiço e avisa paciente</span>
                  </button>

                  {/* Seção 3: Financeiro */}
                  <div className="px-2 py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/30 rounded-md pt-2">
                    Controle Financeiro
                  </div>

                  <button
                    onClick={() => handleSendTrigger("pos_sessao")}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-slate-50 flex flex-col group/item"
                  >
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <CheckCircle className="h-3 w-3 text-emerald-500" /> Cobrança Pós-Sessão
                    </span>
                    <span className="text-[9.5px] text-brand-muted pl-4.5">
                      Preço: {currentSessionPrice ? `R$ ${currentSessionPrice}` : "Usar valor padrão de consulta"}
                    </span>
                  </button>

                  <button
                    onClick={() => handleSendTrigger("pos_vencimento")}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-slate-50 flex flex-col group/item"
                  >
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Coins className="h-3 w-3 text-emerald-600" /> Lembrete de Vencimento
                    </span>
                    <span className="text-[9.5px] text-brand-muted pl-4.5">Pendência em aberto de mensalidades</span>
                  </button>

                  {/* Seção 4: Customizados */}
                  {customTemplates.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/30 rounded-md pt-2 border-t border-brand-border/40 mt-1">
                        Seus Templates Rápidos
                      </div>
                      {customTemplates.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleSendCustom(t.text)}
                          className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-slate-50 flex flex-col group/item truncate"
                          title={t.name}
                        >
                          <span className="font-bold text-slate-700 truncate">{t.name}</span>
                        </button>
                      ))}
                    </>
                  )}

                </div>

                <div className="mt-2.5 border-t border-brand-border/60 pt-2 flex justify-between items-center px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onNavigateToSettings();
                    }}
                    className="text-[10px] font-black text-indigo-600 hover:opacity-80"
                  >
                    ⚙️ Configurar Textos de Mensagens
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
