import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  Bot, 
  Send, 
  Sparkles, 
  Trash2, 
  HelpCircle, 
  User, 
  Loader2 
} from "lucide-react";
import { AppState, Occurrence } from "../types";
import { ymdFromDate } from "../utils/helpers";

interface AIChatTabProps {
  state: AppState;
  occurrences: Occurrence[];
  today: Date;
}

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  createdAt: Date;
}

export default function AIChatTab({
  state,
  occurrences,
  today
}: AIChatTabProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      sender: "ai",
      text: "Olá! Sou seu Assistente Administrativo do Confirma. Posso ajudar você a analisar as métricas de faturamento, elaborar circulares e e-mails de cobrança, dar ideias para gerenciar a lista de espera ou propor melhorias para diminuir o absenteísmo na sua clínica. Pergunte-me qualquer dúvida operacional!",
      createdAt: new Date()
    }
  ]);

  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new message entry
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const presetQueries = [
    { label: "Reduzir Faltas", query: "Como posso reduzir as faltas dos meus pacientes clínicos através de práticas recomendadas?" },
    { label: "Cobrança Amigável", query: "Crie um esboço curto e extremamente educado de aviso de acerto de débito/PIX para enviar por WhatsApp." },
    { label: "Resgatar Paciente Sumido", query: "Como reatar o contato de forma ética e profissional com um cliente que sumiu há mais de 45 dias?" },
    { label: "Otimizar Minha Agenda", query: "Quais heurísticas de escala posso adotar para encaixar a fila de espera nas desistências que ocorrem na agenda?" }
  ];

  // Dynamically compute the active clinic numbers for the prompt metadata payload
  const computedStatePayload = useMemo(() => {
    const totalPatients = state.patients.length;
    
    // Monthly financials (for simple prompt metadata)
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    const monthOccs = occurrences.filter((o) => o.when >= firstDay && o.when <= lastDay);

    let expected = 0;
    let received = 0;
    let pending = 0;
    let lost = 0;

    monthOccs.forEach((o) => {
      const baseSession = state.sessions.find(s => s.id === o.sessionId);
      const val = baseSession?.value !== undefined ? baseSession.value : 150;
      const finState = state.occurrenceFinancials?.[o.key] || {
        value: val,
        paymentMethod: baseSession?.paymentMethod || "PIX",
        financialStatus: baseSession?.financialStatus || "Pendente"
      };

      const clinicalStatus = state.statuses[o.key] || "aguardando";

      if (clinicalStatus === "cancelado" || clinicalStatus === "falta") {
        lost += finState.value;
      } else {
        expected += finState.value;
        if (finState.financialStatus === "Pago") {
          received += finState.value;
        } else if (finState.financialStatus === "Pendente") {
          pending += finState.value;
        }
      }
    });

    // At risk Count
    let atRisk = 0;
    const nowMs = Date.now();
    state.patients.forEach((p) => {
      const pOccs = occurrences.filter((o) => o.patientId === p.id);
      if (pOccs.length === 0) return;
      const past = pOccs.filter((o) => o.when < today);
      const sortedPastAsc = [...past].sort((a,b) => a.when.getTime() - b.when.getTime());
      let consecutiveAbsences = 0;
      for (let i = sortedPastAsc.length - 1; i >= 0; i--) {
        const s = state.statuses[sortedPastAsc[i].key] || "aguardando";
        if (s === "falta") consecutiveAbsences++;
        else break;
      }
      if (consecutiveAbsences >= 2) atRisk++;
    });

    return {
      activePatientsCount: totalPatients,
      totalSessionsCount: occurrences.length,
      atRiskCount: atRisk,
      waitingListCount: (state.waitingList || []).length,
      expectedRevenue: expected,
      receivedRevenue: received,
      pendingRevenue: pending,
      lostRevenue: lost
    };
  }, [state, occurrences, today]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      sender: "user",
      text: textToSend,
      createdAt: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputVal("");
    setLoading(true);

    try {
      const response = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: textToSend,
          clinicState: computedStatePayload
        })
      });

      if (!response.ok) {
        let errMsg = "Erro de comunicação com o servidor.";
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (e) {
          // ignore parsing error
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      let answerText = data.text || "Desculpe, não consegui obter uma resposta adequada.";

      // Fail-safe cleanup to ensure no raw markdown symbols are shown
      answerText = answerText
        .replace(/^#+\s+(.*)$/gmi, "$1") // Strip line-start headers like #, ##, ###
        .replace(/\*\*(.*?)\*\*/g, "$1") // Strip double asterisks for bolding
        .replace(/\*(.*?)\*/g, "$1")     // Strip single asterisks for italics
        .replace(/`([^`]+)`/g, "$1")     // Strip inline backticks
        .replace(/^\s*\*\s+/gmi, "- ")   // Replace bullet asterisk list icons with neat hyphens
        .replace(/\*/g, "");             // Strip any other lingering asterisks

      const aiMessage: Message = {
        id: crypto.randomUUID(),
        sender: "ai",
        text: answerText,
        createdAt: new Date()
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: "ai",
          text: `⚠️ Desculpe, ocorreu um erro ao chamar o Assistente Administrativo: ${err.message || err}. Certifique-se de que sua chave de API está ativa.`,
          createdAt: new Date()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[460px] border border-brand-border bg-white rounded-2xl overflow-hidden shadow-xs leading-relaxed">
      
      {/* Header section */}
      <div className="bg-slate-50 border-b px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-5.5 w-5.5 text-indigo-600 animate-pulse" />
          <div>
            <strong className="text-xs font-black text-brand-text block uppercase tracking-wider">Suporte de IA Administrativa</strong>
            <span className="text-[10px] text-brand-muted font-bold">Respostas ao vivo com inteligência exclusiva do Gemini</span>
          </div>
        </div>

        <button
          onClick={() => {
            if (confirm("Limpar todo o histórico de conversa?")) {
              setMessages([messages[0]]);
            }
          }}
          className="p-1.5 rounded-lg hover:bg-slate-200 text-red-700 cursor-pointer"
          title="Limpar histórico"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Main chat viewport */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        
        {messages.map((m) => {
          const isUser = m.sender === "user";
          return (
            <div key={m.id} className={`flex gap-3 max-w-[85%] ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}>
              {/* Avatar circle */}
              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-xs ${
                isUser ? "bg-brand-primary" : "bg-indigo-600"
              }`}>
                {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>

              {/* Text bubble */}
              <div className={`rounded-2xl p-4 text-xs font-semibold leading-relaxed whitespace-pre-wrap ${
                isUser 
                  ? "bg-brand-primary text-white rounded-tr-xs" 
                  : "bg-slate-50 border border-brand-border/60 text-slate-800 rounded-tl-xs shadow-xs"
              }`}>
                {m.text}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 max-w-[85%] mr-auto">
            <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-xs bg-indigo-600 animate-spin">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl p-4 text-xs font-bold leading-relaxed bg-slate-50 border border-slate-100 text-brand-muted flex items-center gap-1.5 shadow-xs">
              <Loader2 className="h-4 w-4 animate-spin text-brand-primary" /> IA está analisando seus números clínicos... Referenciando sigilo LGPD...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Preset / Recommendations shelf */}
      {messages.length === 1 && !loading && (
        <div className="px-5 py-2 bg-slate-50 border-t border-brand-border/40 space-y-1.5/5 flex flex-col">
          <span className="text-[9px] font-black uppercase text-brand-muted tracking-wider block">Dúvidas Frequentes Rápidas:</span>
          <div className="flex flex-wrap gap-2 pt-1 pb-2">
            {presetQueries.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(p.query)}
                className="inline-flex rounded-lg border border-indigo-150 bg-indigo-50/20 hover:bg-indigo-50 px-2.5 py-1 text-[10px] font-black text-indigo-800 cursor-pointer transition-colors"
              >
                💡 {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input container */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputVal);
        }}
        className="bg-white border-t p-3 flex gap-2"
      >
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Digite sua dúvida ou instrução para o robô Confirma..."
          className="flex-1 rounded-xl border border-brand-border px-3.5 py-2.5 text-xs outline-hidden focus:border-brand-primary focus:ring-1"
          disabled={loading}
        />
        <button
          type="submit"
          className="rounded-xl bg-brand-primary text-white p-2.5 flex items-center justify-center hover:opacity-90 active:translate-y-[0.5px] disabled:opacity-50 cursor-pointer"
          disabled={loading || !inputVal.trim()}
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

    </div>
  );
}
