import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  Bot, 
  Send, 
  Sparkles, 
  Trash2, 
  HelpCircle, 
  User, 
  Loader2,
  Key
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

  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem("CONFIRMA_USER_GEMINI_KEY") || "");
  const [showKeyInput, setShowKeyInput] = useState(() => {
    return window.location.hostname.includes("github.io") && !localStorage.getItem("CONFIRMA_USER_GEMINI_KEY");
  });

  const callGeminiDirectly = async (apiKey: string, prompt: string, clinicState: any) => {
    const systemInstruction = `Você é o Assistente Administrativo do "Confirma", uma plataforma completa de gestão clínica e financeira para psicólogos autônomos.
Seu papel é auxiliar o psicólogo na gestão de sua clínica baseado nos dados enviados.
Dificuldades operacionais, financeiras, de retenção e faturamento são o seu foco.
NUNCA faça diagnósticos clínicos, NUNCA dê palpites de tratamento psicológico, e NUNCA sugira intervenções clínicas. Não tente substituir o profissional de psicologia.
Ao responder, seja extremamente direto, profissional, claro e focado em ações práticas que ajudem o psicólogo a economizar tempo e otimizar faturamento ou retenção.
Sempre responda em Português do Brasil.
IMPORTANTE: NÃO utilize formatação Markdown, tags ou símbolos de marcação de texto (como asteriscos "**", "*", ou sustenidos "###", "##"). Suas respostas serão renderizadas como texto puro.
Para destacar títulos ou seções, use LETRAS MAIÚSCULAS.
Para listas, use hífens simples "-" ou números "1. ", "2. ".
Use quebras de linha duplas abundantes para separar parágrafos e deixar a leitura leve, organizada e extremamente fluida.`;

    const contentsText = `Olá assistente administrativo! Analise os dados da minha clínica a seguir e atenda à solicitação do psicólogo:

DADOS ATUAIS DA CLÍNICA:
- Pacientes ativos cadastrados: ${clinicState.activePatientsCount}
- Sessões totais programadas: ${clinicState.totalSessionsCount}
- Pacientes em situação de risco de abandono: ${clinicState.atRiskCount}
- Lista de espera atual: ${clinicState.waitingListCount} pacientes
- Financeiro deste mês:
  * Receita prevista: R$ ${clinicState.expectedRevenue}
  * Receita recebida: R$ ${clinicState.receivedRevenue}
  * Receita pendente: R$ ${clinicState.pendingRevenue}
  * Receita perdida por faltas: R$ ${clinicState.lostRevenue}

PERGUNTA OU COMANDO DO PSICÓLOGO:
"${prompt}"

Por favor, elabore sua resposta focando no aspecto administrativo, financeiro ou operacional solicitado.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: contentsText }]
            }
          ],
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          generationConfig: {
            temperature: 0.7,
          }
        })
      }
    );

    if (!response.ok) {
      let errMsg = "Erro de resposta da API do Gemini.";
      try {
        const errJson = await response.json();
        if (errJson?.error?.message) {
          errMsg = errJson.error.message;
        }
      } catch {
        // ignore
      }
      throw new Error(errMsg);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Resposta vazia da API do Gemini.");
    }
    return text;
  };

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
      let answerText = "";
      const savedKey = localStorage.getItem("CONFIRMA_USER_GEMINI_KEY") || "";

      if (savedKey) {
        try {
          answerText = await callGeminiDirectly(savedKey, textToSend, computedStatePayload);
        } catch (directErr: any) {
          console.error("Direct API call error:", directErr);
          throw new Error(`[Erro Chamada Direta] ${directErr.message || directErr}`);
        }
      } else {
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
              // ignore
            }
            throw new Error(errMsg);
          }

          const data = await response.json();
          answerText = data.text || "Desculpe, não consegui obter uma resposta adequada.";
        } catch (serverErr: any) {
          const isStaticDeploy = window.location.hostname.includes("github.io");
          if (isStaticDeploy) {
            throw new Error(
              `Erro de comunicação com o servidor. Como o site está no GitHub Pages (estático), clique na chave (🔑 Configurar) no topo ou digite sua Chave API do Gemini para rodar a IA localmente.`
            );
          } else {
            throw serverErr;
          }
        }
      }

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

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowKeyInput(!showKeyInput)}
            className={`p-1.5 rounded-lg flex items-center gap-1 text-[11px] font-black uppercase tracking-wider cursor-pointer border ${
              showKeyInput 
                ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-bold" 
                : "border-slate-200 hover:bg-slate-200 text-slate-700"
            }`}
            title="Configurar Chave API do Gemini"
          >
            <Key className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Chave IA</span>
          </button>

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
      </div>

      {showKeyInput && (
        <div className="bg-indigo-50/75 border-b border-indigo-100 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 mb-1.5">
            <Key className="h-4 w-4 text-indigo-750" />
            <span className="text-xs font-black text-indigo-950 uppercase tracking-wider">Hospedagem Estática / Configurações IA</span>
          </div>
          <p className="text-[10.5px] text-slate-600 mb-3 leading-relaxed font-semibold">
            Como este site está publicado no GitHub Pages (estático, sem backend), você pode conectar sua própria Chave de API do Gemini (do ai.google.dev, que possui cota gratuita para testes) para rodar o assistente diretamente no seu próprio navegador de forma 100% segura. A chave é gravada localmente apenas no seu dispositivo.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={customApiKey}
              onChange={(e) => {
                const val = e.target.value.trim();
                setCustomApiKey(val);
                if (val) {
                  localStorage.setItem("CONFIRMA_USER_GEMINI_KEY", val);
                } else {
                  localStorage.removeItem("CONFIRMA_USER_GEMINI_KEY");
                }
              }}
              placeholder="Cole sua Gemini API Key aqui (ex: AIzaSy...)"
              className="flex-1 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-450 focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
            />
            {customApiKey && (
              <button
                type="button"
                onClick={() => {
                  setCustomApiKey("");
                  localStorage.removeItem("CONFIRMA_USER_GEMINI_KEY");
                }}
                className="rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-800 text-xs font-black px-4 py-2 cursor-pointer transition-colors"
               >
                Remover Chave
              </button>
            )}
          </div>
        </div>
      )}

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
