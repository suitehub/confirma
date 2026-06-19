import React, { useState, useMemo } from "react";
import { 
  Check, 
  Settings2, 
  Eye, 
  Bot, 
  ToggleLeft, 
  ToggleRight, 
  Save, 
  HelpCircle,
  Clock,
  FileText,
  PlusCircle,
  Trash2,
  Sparkles
} from "lucide-react";
import { AppState, AutomationTemplate, CustomConfirmTemplate } from "../types";

interface AutomationsTabProps {
  state: AppState;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  onWaOpen: (phone: string, msg: string) => void;
}

const defaultTemplates = {
  confirmarDefault: "Oi {nome}, confirmando nossa sessão {dia} às {hora}. Se precisar ajustar, me avise com antecedência.",
  reforco: "Oi {nome}, lembrando nossa sessão hoje às {hora}.",
  semresposta: "Oi {nome}, consegue confirmar nossa sessão {dia} às {hora}?",
  cobrarDefault: "Olá {nome}, tudo bem? Realizando o fechamento da nossa sessão do dia {dia} ({hora}). O valor em aberto é de R$ {valor}. Chave PIX cadastrada: seu-pix-aqui. Obrigado!"
};

const defaultAutomations: AutomationTemplate[] = [
  {
    id: "auto-48h",
    name: "Confirmação 48h Antes",
    text: "Olá {nome}, tudo bem? Passando para confirmar seu horário da próxima sessão na {dia} às {hora}. Se precisar fazer alguma alteração, me avise por aqui com antecedência. 😉",
    enabled: true,
    trigger: "48h_antes"
  },
  {
    id: "auto-24h",
    name: "Confirmação 24h Antes",
    text: "Olá {nome}! Tudo bem? Lembrando de confirmar nossa sessão programada para amanhã ({dia}) às {hora}. Abraço!",
    enabled: true,
    trigger: "24h_antes"
  },
  {
    id: "auto-3h",
    name: "Lembrete Rápido 3h Antes",
    text: "Oi {nome}, tudo bem? Passando para lembrar que nossa sessão se inicia daqui a pouco, às {hora}. Até logo!",
    enabled: true,
    trigger: "3h_antes"
  },
  {
    id: "auto-fechamento",
    name: "Cobrança Pós-Sessão",
    text: "Olá {nome}! Finalizamos nosso atendimento de hoje. O valor fechado do acerto desta sessão é de R$ {valor}. Você pode realizar o PIX para a chave cadastrada. Muito obrigado!",
    enabled: false,
    trigger: "pos_sessao"
  },
  {
    id: "auto-vencimento",
    name: "Cobrança e Lembrete Vencimento",
    text: "Olá {nome}, tudo bem? Realizando o fechamento mensal das nossas consultas terapêuticas. O valor em aberto totaliza R$ {valor} referente ao nosso acompanhamento. Aguardo seu PIX de retorno quando puder. Abraço!",
    enabled: false,
    trigger: "pos_vencimento"
  },
  {
    id: "auto-retorno",
    name: "Gatilho de Reajuste / Retorno",
    text: "Olá {nome}, tudo bem? Notei que faz um tempinho que não agendamos uma data para nosso acompanhamento. Gostaria de verificar se quer fechar uma nova vaga de sessão para continuarmos o processo terapêutico?",
    enabled: true,
    trigger: "sem_sessao_futura"
  },
  {
    id: "auto-niver",
    name: "Felicitações Aniversário",
    text: "Olá {nome}, passando para te desejar um feliz aniversário! Que seu novo ciclo seja repleto de realizações, aprendizados e muita paz. É um prazer acompanhar você nessa jornada! 🎂🎉",
    enabled: true,
    trigger: "aniversario"
  }
];

export default function AutomationsTab({
  state,
  onUpdateState,
  onWaOpen
}: AutomationsTabProps) {
  const [subTab, setSubTab] = useState<"gatilhos" | "templates">("gatilhos");

  // Combine custom or stored automations with defaults
  const activeAutomations = useMemo(() => {
    if (!state.automations || state.automations.length === 0) {
      return defaultAutomations;
    }
    return state.automations;
  }, [state.automations]);

  // Local state container for editting textareas of automations
  const [localTexts, setLocalTexts] = useState<{ [autoId: string]: string }>({});

  const handleTextChange = (id: string, val: string) => {
    setLocalTexts(prev => ({
      ...prev,
      [id]: val
    }));
  };

  // Switch enable or disable trigger status
  const handleToggleEnable = (id: string) => {
    const nextList = activeAutomations.map((a) => {
      if (a.id === id) {
        return { ...a, enabled: !a.enabled };
      }
      return a;
    });

    onUpdateState(prev => ({
      ...prev,
      automations: nextList
    }));
  };

  // Save current customized contents for this ID
  const handleSaveText = (id: string) => {
    const textToSave = localTexts[id] !== undefined ? localTexts[id] : activeAutomations.find(a => a.id === id)?.text || "";
    if (!textToSave.trim()) {
      alert("A mensagem da automação não pode ficar em branco.");
      return;
    }

    const nextList = activeAutomations.map((a) => {
      if (a.id === id) {
        return { ...a, text: textToSave };
      }
      return a;
    });

    onUpdateState(prev => ({
      ...prev,
      automations: nextList
    }));
    alert("Automação atualizada e salva com sucesso!");
  };

  // Delete a customized automation
  const handleDeleteCustom = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta automação de lembrete?")) {
      const nextList = activeAutomations.filter(a => a.id !== id);
      onUpdateState(prev => ({
        ...prev,
        automations: nextList
      }));
    }
  };

  // State variables for building custom templates
  const [newAutoName, setNewAutoName] = useState("");
  const [newAutoText, setNewAutoText] = useState("");
  const [newAutoTrigger, setNewAutoTrigger] = useState<"48h_antes" | "pos_sessao" | "sem_sessao_futura">("sem_sessao_futura");
  const [isAddingNew, setIsAddingNew] = useState(false);

  const handleCreateCustomAuto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAutoName.trim() || !newAutoText.trim()) {
      alert("Por favor, preencha o nome e o texto da mensagem.");
      return;
    }

    const newTemplate: AutomationTemplate = {
      id: `custom-auto-${Date.now()}`,
      name: newAutoName.trim(),
      text: newAutoText.trim(),
      enabled: true,
      trigger: newAutoTrigger
    };

    const nextList = [...activeAutomations, newTemplate];
    onUpdateState(prev => ({
      ...prev,
      automations: nextList
    }));

    // Seed local texts dictionary
    setLocalTexts(prev => ({
      ...prev,
      [newTemplate.id]: newTemplate.text
    }));

    setNewAutoName("");
    setNewAutoText("");
    setIsAddingNew(false);
    alert("Nova automação / lembrete de WhatsApp criado com sucesso!");
  };

  // Simulate Trigger (Simular Gatilho) opens WhatsApp mockup
  const handleSimulate = (a: AutomationTemplate) => {
    const mockPatientName = state.patients.length > 0 ? state.patients[0].name : "Ana Clara Martins";
    const mockPhone = state.patients.length > 0 ? state.patients[0].phone : "11999998888";

    const currentMsg = localTexts[a.id] !== undefined ? localTexts[a.id] : a.text;

    let replaced = currentMsg
      .replace(/{nome}/g, mockPatientName)
      .replace(/{dia}/g, "Terça-feira, 26 de Março")
      .replace(/{hora}/g, "14:00")
      .replace(/{valor}/g, "150")
      .replace(/{vaga}/g, "Online");

    onWaOpen(mockPhone, replaced);
  };

  // --- STANDARD TEMPLATES LOGIC FROM SETTINGS ---
  const [localStdTexts, setLocalStdTexts] = useState<{ [key: string]: string }>({
    confirmarDefault: state.templates?.confirmarDefault || defaultTemplates.confirmarDefault,
    reforco: state.templates?.reforco || defaultTemplates.reforco,
    semresposta: state.templates?.semresposta || defaultTemplates.semresposta,
    cobrarDefault: state.templates?.cobrarDefault || defaultTemplates.cobrarDefault || ""
  });

  const handleStdTextChange = (key: string, val: string) => {
    setLocalStdTexts(prev => ({
      ...prev,
      [key]: val
    }));
  };

  const handleSaveStandardTemplate = (key: "confirmarDefault" | "reforco" | "semresposta" | "cobrarDefault") => {
    const value = localStdTexts[key]?.trim() || "";
    if (!value) {
      alert("O modelo de mensagem padrão não pode ficar em branco.");
      return;
    }

    onUpdateState(prev => ({
      ...prev,
      templates: {
        ...prev.templates,
        [key]: value
      }
    }));
    alert("Template padrão atualizado e salvo!");
  };

  const handleResetStandardTemplate = (key: "confirmarDefault" | "reforco" | "semresposta" | "cobrarDefault") => {
    if (confirm("Deseja redefinir este template para o conteúdo original de fábrica?")) {
      const originalText = defaultTemplates[key];
      setLocalStdTexts(prev => ({
        ...prev,
        [key]: originalText
      }));
      onUpdateState(prev => ({
        ...prev,
        templates: {
          ...prev.templates,
          [key]: originalText
        }
      }));
    }
  };

  // --- CUSTOM TEMPLATES LOGIC FROM SETTINGS ---
  const [newTplName, setNewTplName] = useState("");
  const [newTplText, setNewTplText] = useState("");

  const handleCreateCustomTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTplName.trim();
    const text = newTplText.trim();

    if (!name || !text) {
      alert("Por favor, preencha o nome de exibição e a mensagem do template.");
      return;
    }

    const nextTpl: CustomConfirmTemplate = {
      id: crypto.randomUUID ? crypto.randomUUID() : `custom-tpl-${Date.now()}`,
      name,
      text,
    };

    onUpdateState(prev => ({
      ...prev,
      customConfirmTemplates: [...(prev.customConfirmTemplates || []), nextTpl],
    }));

    setNewTplName("");
    setNewTplText("");
    alert("Template personalizado criado com sucesso!");
  };

  const handleDeleteCustomTemplate = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta mensagem dinâmica rápida?")) {
      onUpdateState(prev => ({
        ...prev,
        customConfirmTemplates: (prev.customConfirmTemplates || []).filter(t => t.id !== id),
      }));
    }
  };

  const handleSimulateCustom = (text: string) => {
    const mockPatientName = state.patients.length > 0 ? state.patients[0].name : "Ana Clara Martins";
    const mockPhone = state.patients.length > 0 ? state.patients[0].phone : "11999998888";

    let replaced = text
      .replace(/{nome}/g, mockPatientName)
      .replace(/{dia}/g, "Terça-feira, 26 de Março")
      .replace(/{hora}/g, "14:00")
      .replace(/{valor}/g, "150")
      .replace(/{vaga}/g, "Online");

    onWaOpen(mockPhone, replaced);
  };

  return (
    <div className="space-y-6">
      
      {/* Intro Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-brand-text flex items-center gap-2">
            <Bot className="h-5.5 w-5.5 text-indigo-600 animate-pulse" /> Central de Comunicação e Mensagens ⚡
          </h2>
          <p className="text-xs text-brand-muted mt-1 leading-relaxed">
            Personalize gatilhos programados, modifique os modelos padrões de confirmação ou cadastre templates adicionais rápidos de envio.
          </p>
        </div>

        {subTab === "gatilhos" && (
          <button
            onClick={() => setIsAddingNew(!isAddingNew)}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-4 py-2.5 shadow-xs transition-all flex items-center gap-2 self-start cursor-pointer shrink-0"
          >
            <Bot className="h-4 w-4" />
            {isAddingNew ? "Fechar Formulário" : "Criar Lembrete Personalizado"}
          </button>
        )}
      </div>

      {/* Unified Sections Layout - No Clickable Sub-tabs to avoid confusion */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLUNA ESQUERDA: GATILHOS CLÍNICOS & LEMBRETES AUTOMÁTICOS */}
        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-2xl border border-brand-border bg-slate-50/50 p-4 shadow-3xs space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <div>
                <h3 className="text-xs font-black text-brand-text uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-4.5 w-4.5 text-indigo-700" /> ⏳ Gatilhos Clínicos & Lembretes
                </h3>
                <p className="text-[10px] text-brand-muted mt-0.5">Defina ações com base em horários e tempo de agendamento</p>
              </div>
            </div>

            {isAddingNew && (
              <form onSubmit={handleCreateCustomAuto} className="rounded-xl border border-indigo-150 bg-white p-4 space-y-3.5 shadow-sm animate-in fade-in duration-200">
                <h4 className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                  ✨ Novo Lembrete / Gatilho WhatsApp
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-indigo-950 uppercase tracking-wider">Identificação do Lembrete</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Lembrete de Anamnese Secundário"
                      value={newAutoName}
                      onChange={(e) => setNewAutoName(e.target.value)}
                      className="w-full text-xs rounded-xl border border-brand-border bg-white px-3 py-2 outline-hidden focus:border-indigo-500 font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-indigo-950 uppercase tracking-wider">Momento de Envio / Gatilho</label>
                    <select
                      value={newAutoTrigger}
                      onChange={(e: any) => setNewAutoTrigger(e.target.value)}
                      className="w-full text-xs rounded-xl border border-brand-border bg-white p-2 outline-hidden focus:border-indigo-500 font-bold cursor-pointer"
                    >
                      <option value="48h_antes">⏱️ 48 Horas Antes (Confirmação)</option>
                      <option value="pos_sessao">🩺 Pós-Sessão (Cobrança/Evolução)</option>
                      <option value="sem_sessao_futura">📅 Paciente Sem Próxima Sessão</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] pb-1">
                    <label className="font-black text-indigo-950 uppercase tracking-wider">Texto da Mensagem</label>
                    <span className="text-indigo-800 font-bold">Use as variáveis dinâmicas do topo</span>
                  </div>
                  <textarea
                    required
                    placeholder="Olá {nome}, tudo bem? Passando para lembrar da nossa consulta amanhã às {hora}."
                    value={newAutoText}
                    onChange={(e) => setNewAutoText(e.target.value)}
                    className="w-full text-xs rounded-xl border border-brand-border bg-white p-3 outline-hidden focus:border-indigo-500 min-h-[80px] font-medium"
                  />
                </div>

                <div className="flex justify-end gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setIsAddingNew(false)}
                    className="rounded-xl border border-slate-300 bg-white text-slate-700 font-black px-3.5 py-1.5 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-indigo-600 text-white font-black px-4 py-1.5 hover:bg-indigo-700 shadow-xs cursor-pointer"
                  >
                    Salvar Lembrete
                  </button>
                </div>
              </form>
            )}

            {/* Automations list */}
            <div className="space-y-3">
              {activeAutomations.map((a) => {
                const currentText = localTexts[a.id] !== undefined ? localTexts[a.id] : a.text;
                const isCustom = a.id.startsWith("custom-auto-");

                return (
                  <div key={a.id} className="rounded-xl border border-brand-border bg-white p-4 shadow-3xs space-y-2.5 hover:border-indigo-100 transition-colors">
                    
                    {/* Header inside automation card */}
                    <div className="flex justify-between items-center border-b border-brand-border/40 pb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-800 font-black rounded-lg text-[8.5px] uppercase px-1.5 py-0.5 tracking-wide font-mono">
                          {a.trigger}
                        </span>
                        <h4 className="text-xs font-black text-slate-800">{a.name}</h4>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCustom && (
                          <button
                            onClick={() => handleDeleteCustom(a.id)}
                            className="text-[9px] font-black text-rose-600 hover:text-rose-800 cursor-pointer bg-rose-50 hover:bg-rose-100/50 px-2.5 py-1 rounded-lg border border-rose-100"
                            title="Excluir Lembrete Personalizado"
                          >
                            Excluir
                          </button>
                        )}

                        <button
                          onClick={() => handleToggleEnable(a.id)}
                          className="cursor-pointer text-indigo-600 hover:text-indigo-800"
                          title={a.enabled ? "Ativo" : "Pausado"}
                        >
                          {a.enabled ? (
                            <ToggleRight className="h-6.5 w-6.5 text-emerald-600 animate-in fade-in" />
                          ) : (
                            <ToggleLeft className="h-6.5 w-6.5 text-slate-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Message edit area */}
                    <div className="space-y-1.5">
                      <textarea
                        value={currentText}
                        onChange={(e) => handleTextChange(a.id, e.target.value)}
                        className="w-full text-xs border border-brand-border rounded-xl p-2.5 bg-slate-50 outline-hidden focus:bg-white focus:indigo-500 focus:ring-1 focus:ring-indigo-150 min-h-[64px] font-medium"
                      />

                      <div className="flex justify-between pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleSimulate(a)}
                          className="inline-flex items-center gap-1 text-[9.5px] font-black text-indigo-700 hover:underline cursor-pointer"
                        >
                          <Eye className="h-3 w-3" /> Visualizar Simulação
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSaveText(a.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1 text-[9.5px] font-black text-white hover:bg-indigo-700 transition-colors cursor-pointer"
                        >
                          <Save className="h-3 w-3" /> Salvar Mensagem
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: MODELOS DE CONFIRMAÇÃO PADRÕES & TEMPLATES PERSONALIZADOS */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* SECÇÃO 1: OS MODELOS PADRÕES DO SISTEMA */}
          <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-3xs space-y-4">
            <h3 className="inline-flex items-center gap-1.5 text-xs font-black text-brand-text uppercase tracking-wider border-b border-brand-border/40 pb-2 w-full">
              <FileText className="h-4.5 w-4.5 text-brand-primary" /> Modelos Principais de Confirmação (Padrão)
            </h3>

            {/* Template Padrão 1 */}
            <div className="space-y-1">
              <label className="block text-[11px] font-black text-slate-700 uppercase">Modelo 1: Confirmação Principal (24 Horas Antes)</label>
              <textarea
                value={localStdTexts.confirmarDefault}
                onChange={(e) => handleStdTextChange("confirmarDefault", e.target.value)}
                className="w-full text-xs font-semibold border border-brand-border rounded-xl p-2.5 bg-slate-50 outline-hidden focus:bg-white focus:border-brand-primary min-h-[64px]"
              />
              <div className="flex justify-between pt-0.5">
                <button
                  onClick={() => handleSimulateCustom(localStdTexts.confirmarDefault)}
                  className="text-[9.5px] inline-flex items-center gap-1 font-bold text-brand-primary hover:underline cursor-pointer"
                >
                  <Eye className="h-3 w-3" /> Simular Texto
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResetStandardTemplate("confirmarDefault")}
                    className="text-[9.5px] font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    Restaurar Padrão
                  </button>
                  <button
                    onClick={() => handleSaveStandardTemplate("confirmarDefault")}
                    className="text-[9.5px] font-black text-white bg-brand-primary px-2.5 py-0.5 rounded-md cursor-pointer hover:opacity-90"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>

            {/* Template Reforço */}
            <div className="space-y-1 pt-1.5 border-t border-brand-border/30">
              <label className="block text-[11px] font-black text-slate-700 uppercase">Modelo 2: Lembrar no Dia da Sessão (3 Horas Antes)</label>
              <textarea
                value={localStdTexts.reforco}
                onChange={(e) => handleStdTextChange("reforco", e.target.value)}
                className="w-full text-xs font-semibold border border-brand-border rounded-xl p-2.5 bg-slate-50 outline-hidden focus:bg-white focus:border-brand-primary min-h-[64px]"
              />
              <div className="flex justify-between pt-0.5">
                <button
                  onClick={() => handleSimulateCustom(localStdTexts.reforco)}
                  className="text-[9.5px] inline-flex items-center gap-1 font-bold text-brand-primary hover:underline cursor-pointer"
                >
                  <Eye className="h-3 w-3" /> Simular Texto
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResetStandardTemplate("reforco")}
                    className="text-[9.5px] font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    Restaurar Padrão
                  </button>
                  <button
                    onClick={() => handleSaveStandardTemplate("reforco")}
                    className="text-[9.5px] font-black text-white bg-brand-primary px-2.5 py-0.5 rounded-md cursor-pointer hover:opacity-90"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>

            {/* Template Sem Resposta */}
            <div className="space-y-1 pt-1.5 border-t border-brand-border/30">
              <label className="block text-[11px] font-black text-slate-700 uppercase">Modelo 3: Notificação de Falta / Sem Resposta</label>
              <textarea
                value={localStdTexts.semresposta}
                onChange={(e) => handleStdTextChange("semresposta", e.target.value)}
                className="w-full text-xs font-semibold border border-brand-border rounded-xl p-2.5 bg-slate-50 outline-hidden focus:bg-white focus:border-brand-primary min-h-[64px]"
              />
              <div className="flex justify-between pt-0.5">
                <button
                  onClick={() => handleSimulateCustom(localStdTexts.semresposta)}
                  className="text-[9.5px] inline-flex items-center gap-1 font-bold text-brand-primary hover:underline cursor-pointer"
                >
                  <Eye className="h-3 w-3" /> Simular Texto
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResetStandardTemplate("semresposta")}
                    className="text-[9.5px] font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    Restaurar Padrão
                  </button>
                  <button
                    onClick={() => handleSaveStandardTemplate("semresposta")}
                    className="text-[9.5px] font-black text-white bg-brand-primary px-2.5 py-0.5 rounded-md cursor-pointer hover:opacity-90"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>

            {/* Template Cobrança */}
            <div className="space-y-1 pt-1.5 border-t border-brand-border/30">
              <label className="block text-[11px] font-black text-slate-700 uppercase">Modelo 4: Mensagem de Cobrança Financeira (Cobrar)</label>
              <textarea
                value={localStdTexts.cobrarDefault}
                onChange={(e) => handleStdTextChange("cobrarDefault", e.target.value)}
                className="w-full text-xs font-semibold border border-brand-border rounded-xl p-2.5 bg-slate-50 outline-hidden focus:bg-white focus:border-brand-primary min-h-[64px]"
              />
              <div className="flex justify-between pt-0.5">
                <button
                  onClick={() => handleSimulateCustom(localStdTexts.cobrarDefault)}
                  className="text-[9.5px] inline-flex items-center gap-1 font-bold text-brand-primary hover:underline cursor-pointer"
                >
                  <Eye className="h-3 w-3" /> Simular Texto
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResetStandardTemplate("cobrarDefault")}
                    className="text-[9.5px] font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    Restaurar Padrão
                  </button>
                  <button
                    onClick={() => handleSaveStandardTemplate("cobrarDefault")}
                    className="text-[9.5px] font-black text-white bg-brand-primary px-2.5 py-0.5 rounded-md cursor-pointer hover:opacity-90"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* SECÇÃO 2: CADASTRO DE TEMPLATES PERSONALIZADOS ADICIONAIS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Criar Template Personalizado Rápido */}
            <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-3xs space-y-3">
              <h3 className="text-xs font-black text-brand-text uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-brand-border/40">
                <PlusCircle className="h-4.5 w-4.5 text-indigo-700" /> Novo Template Rápido
              </h3>
              
              <form onSubmit={handleCreateCustomTemplate} className="space-y-2.5">
                <div>
                  <label className="block text-[9px] font-black text-brand-muted uppercase tracking-wider">Identificação do Botão</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Confirmação Curta"
                    value={newTplName}
                    onChange={(e) => setNewTplName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-brand-border bg-white p-2 text-xs outline-hidden focus:border-brand-primary font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-brand-muted uppercase tracking-wider">Mensagem Principal WhatsApp</label>
                  <textarea
                    required
                    placeholder="Oi {nome}, tudo certo para amanhã às {hora}?"
                    value={newTplText}
                    onChange={(e) => setNewTplText(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-brand-border bg-white p-2 text-xs outline-hidden focus:border-brand-primary min-h-[50px] font-semibold"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary py-2 text-xs font-black text-white hover:opacity-90 cursor-pointer shadow-xs uppercase tracking-wider"
                >
                  Cadastrar Template
                </button>
              </form>
            </div>

            {/* Listagem dos Templates Personalizados Salvos */}
            <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-3xs space-y-2.5">
              <h3 className="text-xs font-black text-brand-text uppercase tracking-wider pb-1 border-b border-brand-border/40">
                Seus Templates Salvos
              </h3>

              <div className="space-y-2 max-h-[195px] overflow-y-auto">
                {state.customConfirmTemplates && state.customConfirmTemplates.length > 0 ? (
                  state.customConfirmTemplates.map((t) => (
                    <div key={t.id} className="flex gap-2 justify-between items-start rounded-xl border border-slate-150 bg-slate-50/50 p-2.5 hover:bg-slate-50 transition-colors">
                      <div className="min-w-0">
                        <strong className="text-[10px] font-black text-brand-text block">{t.name}</strong>
                        <p className="text-[9px] text-brand-muted leading-tight mt-0.5 line-clamp-2">{t.text}</p>
                      </div>
                      <div className="flex flex-col gap-1 items-end shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSimulateCustom(t.text)}
                          className="text-[8.5px] font-bold text-indigo-600 hover:underline"
                        >
                          Simular
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomTemplate(t.id)}
                          className="text-red-700 hover:text-red-900 focus:outline-hidden p-0.5 cursor-pointer"
                          title="Remover template"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[10.5px] text-brand-muted italic py-6 text-center">Nenhum template personalizado cadastrado.</p>
                )}
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
