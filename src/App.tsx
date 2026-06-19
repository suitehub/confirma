import React, { useState, useEffect, useMemo, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, getDocFromServer } from "firebase/firestore";
import { 
  Calendar, 
  Users, 
  Settings, 
  LogOut, 
  Plus, 
  Download, 
  Upload, 
  UserPlus,
  HelpCircle,
  FileText,
  AlertTriangle,
  Clock,
  User,
  ExternalLink,
  Menu,
  ChevronDown,
  Trash2,
  CheckCircle,
  Search,
  BookOpen,
  Pencil,
  TrendingUp,
  DollarSign,
  Bot,
  Sparkles,
  FileDown
} from "lucide-react";

import { auth, db, handleFirestoreError } from "./firebase";
import { AppState, Patient, Session, Occurrence, CustomConfirmTemplate, OperationType } from "./types";
import { 
  formatLongBR, 
  formatShortDay, 
  ymdFromDate, 
  hmFromDate, 
  normalizePhone, 
  sanitizeMessage, 
  waLink, 
  replaceVars, 
  formatPhone, 
  buildOccurrences,
  parseYmdHm
} from "./utils/helpers";

import AuthGate from "./components/AuthGate";
import SessionModal from "./components/SessionModal";
import PatientModal from "./components/PatientModal";
import SessionRow from "./components/SessionRow";

// Modular feature tab imports
import DashboardTab from "./components/DashboardTab";
import AgendaTab from "./components/AgendaTab";
import FinancialTab from "./components/FinancialTab";
import PatientProfileTab from "./components/PatientProfileTab";
import RiskPatientsTab from "./components/RiskPatientsTab";
import RetentionTab from "./components/RetentionTab";
import WaitingListTab from "./components/WaitingListTab";
import AutomationsTab from "./components/AutomationsTab";
import AIChatTab from "./components/AIChatTab";
import ReportsTab from "./components/ReportsTab";

const defaultTemplates = {
  confirmarDefault: "Oi {nome}, confirmando nossa sessão {dia} às {hora}. Se precisar ajustar, me avise com antecedência.",
  reforco: "Oi {nome}, lembrando nossa sessão hoje às {hora}.",
  semresposta: "Oi {nome}, consegue confirmar nossa sessão {dia} às {hora}?",
  cobrarDefault: "Olá {nome}, tudo bem? Realizando o fechamento da nossa sessão do dia {dia} ({hora}). O valor em aberto é de R$ {valor}. Chave PIX cadastrada: seu-pix-aqui. Obrigado!"
};

const getInitialState = (): AppState => ({
  patients: [],
  sessions: [],
  statuses: {},
  templates: { ...defaultTemplates },
  customConfirmTemplates: [],
  waitingList: [],
  occurrenceFinancials: {},
  automations: [],
  evolutions: []
});

export default function App() {
  // Auth state
  const [userId, setUserId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Application data state
  const [state, setState] = useState<AppState>(getInitialState());
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "today" | "agenda" | "sessions" | "patients" | "financial" | "risk" | "retention" | "waiting" | "automations" | "ai_chat" | "reports" | "settings"
  >("dashboard");
  const [selectedPatientProfile, setSelectedPatientProfile] = useState<Patient | null>(null);
  const [profileInitialSubTab, setProfileInitialSubTab] = useState<"dados" | "historico" | "financeiro" | "formularios" | "prontuario" | "insights" | null>(null);
  const [profileInitialOccurrence, setProfileInitialOccurrence] = useState<Occurrence | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Modals state
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [sessionModalInitialDate, setSessionModalInitialDate] = useState<string | undefined>(undefined);
  const [sessionModalInitialTime, setSessionModalInitialTime] = useState<string | undefined>(undefined);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  // Search/Filters state
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [sessionSearchQuery, setSessionSearchQuery] = useState("");

  // New Patient Inputs
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientPhone, setNewPatientPhone] = useState("");

  // New Custom Template Inputs
  const [newTplName, setNewTplName] = useState("");
  const [newTplText, setNewTplText] = useState("");

  // Saved timers for debouncing Firestore synchronization
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef<AppState>(state);

  // Keep stateRef in sync to safely use inside timers
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Track today date to generate correct boundaries
  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  // Sync to Firestore helper
  const saveToFirestore = async (uid: string, s: AppState) => {
    const path = `users/${uid}`;
    try {
      await setDoc(doc(db, "users", uid), {
        state: s,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("Firestore sync error", err);
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  // Auth Listener and Initial Loader
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        
        // 1. Double check network availability
        try {
          await getDocFromServer(doc(db, 'test', 'connection')).catch(() => {});
        } catch (e) {
          console.warn("Firestore running in offline/cached wrapper mode.");
        }

        // 2. Load cached representation
        const localCache = localStorage.getItem("confirma_v4");
        let initialData = getInitialState();
        if (localCache) {
          try {
            initialData = JSON.parse(localCache);
          } catch (e) {
            console.error("Failing loading local cache.", e);
          }
        }

        // 3. Query newest cloud representation
        const path = `users/${user.uid}`;
        try {
          const cloudDoc = await getDoc(doc(db, "users", user.uid));
          if (cloudDoc.exists()) {
            const data = cloudDoc.data();
            if (data && data.state) {
              const cloudState: AppState = {
                patients: data.state.patients || [],
                sessions: data.state.sessions || [],
                statuses: data.state.statuses || {},
                templates: {
                  ...defaultTemplates,
                  ...(data.state.templates || {})
                },
                customConfirmTemplates: data.state.customConfirmTemplates || [],
                waitingList: data.state.waitingList || [],
                occurrenceFinancials: data.state.occurrenceFinancials || {},
                automations: data.state.automations || [],
                formsList: data.state.formsList || [],
                evolutions: data.state.evolutions || []
              };
              setState(cloudState);
              localStorage.setItem("confirma_v4", JSON.stringify(cloudState));
            }
          } else {
            // First time user on cloud - deploy local state if they had cached records
            setState(initialData);
            await saveToFirestore(user.uid, initialData);
          }
        } catch (err) {
          console.error("Loading from cloud failed, fallback to local storage.", err);
          setState(initialData);
          setInitializing(false);
          // Async report to let the UI finish rendering without crashing the React lifecycle
          setTimeout(() => {
            try {
              handleFirestoreError(err, OperationType.GET, path);
            } catch (reportErr) {
              console.error("Reported Firebase error:", reportErr);
            }
          }, 50);
          return;
        }
      } else {
        setUserId(null);
        setState(getInitialState());
      }
      setInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  // Save changes triggers local storage immediately and debounces firestore sync
  const updateState = (updater: (prev: AppState) => AppState) => {
    setState((prev) => {
      const next = updater(prev);
      localStorage.setItem("confirma_v4", JSON.stringify(next));

      if (userId) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          saveToFirestore(userId, next).catch(console.error);
        }, 800);
      }
      return next;
    });
  };

  // Log Out Method
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      alert("Falha ao deslogar: " + err.message);
    }
  };

  const openWa = (phone: string, msg?: string) => {
    window.open(waLink(phone, msg || ""), "_blank", "noopener,noreferrer");
  };

  // Occurrences engine calculation
  const occurrences = useMemo(() => {
    return buildOccurrences(state.patients, state.sessions, today);
  }, [state.patients, state.sessions, today]);

  // Tab 1: Today Occurrences
  const todayOccurrences = useMemo(() => {
    return occurrences.filter((o) => {
      const d = o.when;
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    });
  }, [occurrences, today]);

  // Tab 2: Future Occurrences Grouped by date (excluding today)
  const futureOccurrences = useMemo(() => {
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    return occurrences.filter((o) => o.when > endOfDay);
  }, [occurrences, today]);

  // Filter future occurrences by Search Query
  const filteredFutureOccurrences = useMemo(() => {
    if (!sessionSearchQuery) return futureOccurrences;
    const query = sessionSearchQuery.toLowerCase();
    return futureOccurrences.filter((o) => {
      const p = state.patients.find((pat) => pat.id === o.patientId);
      if (!p) return false;
      return (
        p.name.toLowerCase().includes(query) ||
        o.local.toLowerCase().includes(query) ||
        (o.note && o.note.toLowerCase().includes(query))
      );
    });
  }, [futureOccurrences, sessionSearchQuery, state.patients]);

  // Grouped future occurrences list
  const futureGroups = useMemo(() => {
    const groups: { [dateStr: string]: Occurrence[] } = {};
    for (const o of filteredFutureOccurrences) {
      const dStr = ymdFromDate(o.when);
      if (!groups[dStr]) groups[dStr] = [];
      groups[dStr].push(o);
    }
    return Object.keys(groups)
      .sort((a, b) => a.localeCompare(b))
      .map((dateStr) => ({
        date: parseYmdHm(dateStr, "00:00"),
        items: groups[dateStr].sort((a, b) => a.when.getTime() - b.when.getTime()),
      }));
  }, [filteredFutureOccurrences]);

  // Tab 3: Patients list filtered by search query
  const filteredPatients = useMemo(() => {
    if (!patientSearchQuery) {
      return [...state.patients].sort((a, b) => a.name.localeCompare(b.name));
    }
    const query = patientSearchQuery.toLowerCase();
    return state.patients
      .filter((p) => p.name.toLowerCase().includes(query) || p.phone.includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.patients, patientSearchQuery]);

  // Create Patient Process
  const handleCreatePatient = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPatientName.trim();
    const phone = normalizePhone(newPatientPhone.trim());

    if (!name || !phone) {
      alert("Por favor, informe o nome e o WhatsApp do paciente.");
      return;
    }

    // Check pre-existing
    if (state.patients.some((p) => normalizePhone(p.phone) === phone)) {
      alert("Já existe um paciente cadastrado com este número de WhatsApp.");
      return;
    }

    const newPatient: Patient = {
      id: crypto.randomUUID(),
      name,
      phone,
    };

    updateState((prev) => ({
      ...prev,
      patients: [...prev.patients, newPatient],
    }));

    setNewPatientName("");
    setNewPatientPhone("");
  };

  // Saved Session Process (Create or Update)
  const handleSaveSession = (draft: Omit<Session, "id" | "createdAt">) => {
    if (editingSession) {
      updateState((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === editingSession.id ? { ...s, ...draft } : s
        ),
      }));
    } else {
      const newSession: Session = {
        id: crypto.randomUUID(),
        ...draft,
        createdAt: Date.now(),
      };
      updateState((prev) => ({
        ...prev,
        sessions: [...prev.sessions, newSession],
      }));
    }
    setIsSessionModalOpen(false);
    setEditingSession(null);
  };

  // Delete Session and remove its statuses
  const handleDeleteSession = (id: string) => {
    updateState((prev) => {
      // filters other statuses
      const nextStatuses = { ...prev.statuses };
      Object.keys(nextStatuses).forEach((key) => {
        if (key.startsWith(`${id}__`)) {
          delete nextStatuses[key];
        }
      });
      return {
        ...prev,
        sessions: prev.sessions.filter((s) => s.id !== id),
        statuses: nextStatuses,
      };
    });
    setIsSessionModalOpen(false);
    setEditingSession(null);
  };

  // Open Edit Modals
  const handleOpenEditSession = (session: Session) => {
    setEditingSession(session);
    setIsSessionModalOpen(true);
  };

  const handleOpenEditPatient = (p: Patient) => {
    setEditingPatient(p);
    setIsPatientModalOpen(true);
  };

  // Save changes of patient info or core creation
  const handleSavePatientEdit = (patientData: Partial<Patient>) => {
    const rawPhone = patientData.phone || "";
    const cleanPhone = normalizePhone(rawPhone);

    if (!patientData.name || !cleanPhone) {
      alert("Por favor, preencha o nome e o WhatsApp do paciente.");
      return;
    }

    const isEditing = !!patientData.id;

    updateState((prev) => {
      if (!isEditing) {
        // Create new patient flow
        if (prev.patients.some((p) => normalizePhone(p.phone) === cleanPhone)) {
          alert("Já existe um paciente cadastrado com este número de WhatsApp.");
          return prev;
        }

        const newPatient: Patient = {
          id: crypto.randomUUID(),
          name: patientData.name!,
          phone: cleanPhone,
          ...patientData,
        };

        return {
          ...prev,
          patients: [...prev.patients, newPatient],
        };
      } else {
        // Edit existing patient flow
        return {
          ...prev,
          patients: prev.patients.map((p) =>
            p.id === patientData.id ? ({ ...p, ...patientData, phone: cleanPhone } as Patient) : p
          ),
        };
      }
    });

    if (isEditing && selectedPatientProfile && selectedPatientProfile.id === patientData.id) {
      setSelectedPatientProfile((prev) => 
        prev ? ({ ...prev, ...patientData, phone: cleanPhone } as Patient) : null
      );
    }

    setIsPatientModalOpen(false);
    setEditingPatient(null);
  };

  // Delete patient alongside all sessions associated
  const handleDeletePatient = () => {
    if (!editingPatient) return;
    const pId = editingPatient.id;

    updateState((prev) => {
      const associatedSessionIds = prev.sessions
        .filter((s) => s.patientId === pId)
        .map((s) => s.id);
      const associatedSet = new Set(associatedSessionIds);

      // Filter sessions
      const nextSessions = prev.sessions.filter((s) => s.patientId !== pId);

      // Filter statuses
      const nextStatuses = { ...prev.statuses };
      Object.keys(nextStatuses).forEach((key) => {
        const sid = key.split("__")[0];
        if (associatedSet.has(sid)) {
          delete nextStatuses[key];
        }
      });

      return {
        ...prev,
        patients: prev.patients.filter((p) => p.id !== pId),
        sessions: nextSessions,
        statuses: nextStatuses,
      };
    });

    setIsPatientModalOpen(false);
    setEditingPatient(null);
  };

  // Real-time Status updates for occurrences
  const handleStatusChange = (key: string, newStatus: string) => {
    updateState((prev) => ({
      ...prev,
      statuses: {
        ...prev.statuses,
        [key]: newStatus,
      },
    }));
  };

  // Save Standard Template Edits
  const handleSaveTplConfirmDefault = (text: string) => {
    const cleaned = sanitizeMessage(text);
    if (!cleaned) {
      alert("A mensagem de confirmação padrão não pode ficar vazia.");
      return;
    }
    updateState((prev) => ({
      ...prev,
      templates: {
        ...prev.templates,
        confirmarDefault: cleaned,
      },
    }));
    alert("Template padrão de confirmação salvo.");
  };

  const handleSaveTplReforco = (text: string) => {
    const cleaned = sanitizeMessage(text);
    if (!cleaned) {
      alert("A mensagem de reforço não pode ficar vazia.");
      return;
    }
    updateState((prev) => ({
      ...prev,
      templates: {
        ...prev.templates,
        reforco: cleaned,
      },
    }));
    alert("Template de reforço salvo.");
  };

  const handleSaveTplSemResposta = (text: string) => {
    const cleaned = sanitizeMessage(text);
    if (!cleaned) {
      alert("A mensagem de sem resposta não pode ficar vazia.");
      return;
    }
    updateState((prev) => ({
      ...prev,
      templates: {
        ...prev.templates,
        semresposta: cleaned,
      },
    }));
    alert("Template de 'Sem resposta' salvo.");
  };

  // Add Custom Confirmation Template Options
  const handleAddCustomTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTplName.trim();
    const rawText = newTplText.trim();

    if (!name || !rawText) {
      alert("Preencha o nome e a mensagem do template.");
      return;
    }

    const text = sanitizeMessage(rawText);
    if (!text) {
      alert("Template inválido.");
      return;
    }

    const nextTpl: CustomConfirmTemplate = {
      id: crypto.randomUUID(),
      name,
      text,
    };

    updateState((prev) => ({
      ...prev,
      customConfirmTemplates: [...(prev.customConfirmTemplates || []), nextTpl],
    }));

    setNewTplName("");
    setNewTplText("");
  };

  // Delete Custom Confirmation Template Option
  const handleDeleteCustomTemplate = (id: string) => {
    updateState((prev) => ({
      ...prev,
      customConfirmTemplates: (prev.customConfirmTemplates || []).filter((t) => t.id !== id),
    }));
  };

  // Export JSON backup file
  const handleExportBackup = () => {
    const stringified = JSON.stringify(state, null, 2);
    const blob = new Blob([stringified], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `confirma-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import JSON backup file
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Formato inválido.");
        }
        if (!("patients" in parsed) || !("sessions" in parsed) || !("templates" in parsed)) {
          throw new Error("Estrutura incorreta. Faltam chaves essenciais.");
        }

        const newState: AppState = {
          patients: parsed.patients || [],
          sessions: parsed.sessions || [],
          statuses: parsed.statuses || {},
          templates: {
            ...defaultTemplates,
            ...(parsed.templates || {}),
          },
          customConfirmTemplates: parsed.customConfirmTemplates || [],
        };

        updateState(() => newState);
        alert("Importação realizada com sucesso!");
        // Refresh component
        setActiveTab("today");
      } catch (err: any) {
        alert("Falha ao importar arquivo JSON: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Restore Default Templates
  const handleResetTemplate = (key: keyof typeof defaultTemplates) => {
    if (confirm("Deseja redefinir este template para o conteúdo original?")) {
      updateState((prev) => ({
        ...prev,
        templates: {
          ...prev.templates,
          [key]: defaultTemplates[key]
        }
      }));
    }
  };

  // Render initialization loading screen
  if (initializing) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-brand-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
          <p className="text-sm font-black text-brand-muted tracking-wide animate-pulse">
            Carregando sua agenda...
          </p>
        </div>
      </div>
    );
  }

  // Render Auth Gate if logged out
  if (!userId) {
    return (
      <AuthGate 
        onAuthenticated={(uid) => {
          setUserId(uid);
        }} 
        onLogout={() => {}} 
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-brand-bg text-brand-text">
      {/* SHIELD OVERLAY FOR MOBILE SIDEBAR */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-xs md:hidden"
        />
      )}

      {/* SIDEBAR NAVIGATION BODY */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-66 flex-col border-r border-brand-border bg-white transition-transform duration-300 md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* LOGO AREA */}
        <div className="flex h-16 items-center justify-between border-b border-brand-border px-5 shrink-0">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Confirma" className="h-8 w-auto object-contain" />
            <span className="text-[9px] font-black text-brand-primary bg-brand-primary/10 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
              PRÓ
            </span>
          </div>
          {/* Mobile close trigger */}
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="rounded-lg p-1 text-brand-muted hover:bg-slate-100 hover:text-brand-text md:hidden cursor-pointer"
          >
            <Plus className="h-5 w-5 rotate-45" />
          </button>
        </div>

        {/* NAVIGATION GROUP PANELS */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 scrollbar-none">
          {/* SECTION 1: DIÁRIO */}
          <div className="space-y-1.5">
            <h3 className="px-3 text-[9.5px] font-black text-brand-muted/70 uppercase tracking-widest leading-none">
              Atividades Diárias
            </h3>
            <div className="space-y-0.5">
              {[
                { id: "dashboard", label: "Dashboard", icon: <BookOpen className="h-4 w-4" /> },
                { id: "today", label: "Hoje", icon: <Clock className="h-4 w-4" /> },
                { id: "agenda", label: "Agenda", icon: <Calendar className="h-4 w-4" /> },
                { id: "sessions", label: "Agendamentos", icon: <Clock className="h-4 w-4" /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setSelectedPatientProfile(null);
                    setIsSidebarOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-black tracking-wide cursor-pointer transition-all ${
                    activeTab === tab.id
                      ? "bg-brand-primary text-white shadow-xs"
                      : "text-brand-muted hover:bg-slate-50 hover:text-brand-text"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* SECTION 2: CLÍNICO */}
          <div className="space-y-1.5">
            <h3 className="px-3 text-[9.5px] font-black text-brand-muted/70 uppercase tracking-widest leading-none">
              Gestão de Pacientes
            </h3>
            <div className="space-y-0.5">
              {[
                { id: "patients", label: "Pacientes", icon: <Users className="h-4 w-4" /> },
                { id: "risk", label: "Radar Evasão", icon: <AlertTriangle className="h-4 w-4" /> },
                { id: "retention", label: "Retenção & NPS", icon: <TrendingUp className="h-4 w-4" /> },
                { id: "waiting", label: "Lista de Espera", icon: <Clock className="h-4 w-4" /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setSelectedPatientProfile(null);
                    setIsSidebarOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-black tracking-wide cursor-pointer transition-all ${
                    activeTab === tab.id
                      ? "bg-brand-primary text-white shadow-xs"
                      : "text-brand-muted hover:bg-slate-50 hover:text-brand-text"
                  }`}
                >
                  <span className={tab.id === "risk" && activeTab !== "risk" ? "text-red-500" : ""}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* SECTION 3: FINANCEIRO E CONFIGS */}
          <div className="space-y-1.5">
            <h3 className="px-3 text-[9.5px] font-black text-brand-muted/70 uppercase tracking-widest leading-none">
              Módulos e Configurações
            </h3>
            <div className="space-y-0.5">
              {[
                { id: "financial", label: "Financeiro", icon: <DollarSign className="h-4 w-4" /> },
                { id: "ai_chat", label: "Assistente IA", icon: <Sparkles className="h-4 w-4" /> },
                { id: "automations", label: "Automações & Templates", icon: <Bot className="h-4 w-4" /> },
                { id: "reports", label: "Relatórios", icon: <FileDown className="h-4 w-4" /> },
                { id: "settings", label: "Backup & Configurações", icon: <Settings className="h-4 w-4" /> }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setSelectedPatientProfile(null);
                    setIsSidebarOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-black tracking-wide cursor-pointer transition-all ${
                    activeTab === tab.id
                      ? "bg-brand-primary text-white shadow-xs"
                      : "text-brand-muted hover:bg-slate-50 hover:text-brand-text"
                  }`}
                >
                  <span className={tab.id === "ai_chat" && activeTab !== "ai_chat" ? "text-brand-primary" : ""}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* PROFILE BOTTOM TILE */}
        <div className="border-t border-brand-border p-4 bg-slate-50 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-primary font-black text-white text-xs uppercase">
                {userId?.substring(0, 2).toUpperCase() || "CL"}
              </div>
              <div className="min-w-0">
                <span className="block text-[11px] font-black text-brand-text truncate leading-tight">
                  Meu Consultório
                </span>
                <span className="block text-[10px] text-brand-muted truncate leading-tight">
                  {userId}
                </span>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-border bg-white text-brand-muted hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* CANVAS CONTAINER FOR SUBTABS */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-brand-border bg-white px-4 sm:px-6 md:px-8 shadow-xs">
          {/* Header left */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="rounded-xl border border-brand-border p-2 text-brand-muted hover:bg-slate-100 hover:text-brand-text md:hidden cursor-pointer"
              title="Menu"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="min-w-0">
              <h1 className="text-sm font-black text-brand-text truncate uppercase tracking-wide">
                {activeTab === "dashboard" && "Dashboard Geral"}
                {activeTab === "today" && "Atendimentos de Hoje"}
                {activeTab === "agenda" && "Agenda de Consultas"}
                {activeTab === "sessions" && "Histórico de Agenda"}
                {activeTab === "patients" && (selectedPatientProfile ? `Prontuário: ${selectedPatientProfile.name}` : "Prontuários Clínicos")}
                {activeTab === "financial" && "Controle Financeiro"}
                {activeTab === "risk" && "Radar Alerta de Evasão"}
                {activeTab === "retention" && "Fidelidade & Retenção de Pacientes"}
                {activeTab === "waiting" && "Lista de Espera Ativa"}
                {activeTab === "automations" && "Automações & Templates"}
                {activeTab === "ai_chat" && "Assistente de Atendimento IA"}
                {activeTab === "reports" && "Painel de Exportações"}
                {activeTab === "settings" && "Backup & Configurações"}
              </h1>
            </div>
          </div>

          {/* Quick Triggers Area */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setEditingSession(null);
                setIsSessionModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-3 py-2 text-xs font-black text-white hover:opacity-90 active:translate-y-[0.5px] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Sessão</span>
            </button>
          </div>
        </header>

        {/* COMPONENT VIEWS PORTAL */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 max-w-[1240px] w-full mx-auto">
          <main className="space-y-4">

            {/* TAB DASHBOARD */}
            {activeTab === "dashboard" && (
          <DashboardTab
            state={state}
            occurrences={occurrences}
            today={today}
            onSelectPatient={(pId) => {
              const matched = state.patients.find(p => p.id === pId);
              if (matched) {
                setSelectedPatientProfile(matched);
                setActiveTab("patients");
              }
            }}
            onTabChange={(tab) => {
              setActiveTab(tab as any);
              setSelectedPatientProfile(null);
            }}
            onFinalizeSession={(o) => {
              const matched = state.patients.find((p) => p.id === o.patientId);
              if (matched) {
                setProfileInitialSubTab("prontuario");
                setProfileInitialOccurrence(o);
                setSelectedPatientProfile(matched);
                setActiveTab("patients");
              }
            }}
          />
        )}
        
        {/* TAB HOJE */}
        {activeTab === "today" && (
          <section className="space-y-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between px-1">
              <div>
                <h2 className="text-xl font-black text-brand-text">{formatLongBR(today)}</h2>
                <p className="text-xs text-brand-muted">Acompanhamento e envio de lembretes rápidos para hoje</p>
              </div>
              <span className="text-xs font-black text-brand-primary bg-brand-primary/5 px-3 py-1 rounded-full uppercase tracking-wider self-start sm:self-auto mt-2 sm:mt-0">
                {todayOccurrences.length} consulta{todayOccurrences.length !== 1 && "s"} hoje
              </span>
            </div>

            <div className="rounded-2xl border border-brand-border bg-white p-4 space-y-3 shadow-xs">
              {todayOccurrences.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-10 text-center">
                  <Clock className="h-8 w-8 text-brand-muted mb-2 animate-pulse" />
                  <p className="text-sm font-black text-brand-text">Nenhuma sessão programada para hoje.</p>
                  <p className="text-xs text-brand-muted mt-1">Aproveite para descansar ou planejar sua semana!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {todayOccurrences.map((o) => {
                    const patient = state.patients.find((p) => p.id === o.patientId);
                    const baseSess = state.sessions.find((s) => s.id === o.sessionId);
                    if (!patient || !baseSess) return null;
                    return (
                      <SessionRow
                        key={o.key}
                        occurrence={o}
                        patient={patient}
                        status={state.statuses[o.key] || "aguardando"}
                        onStatusChange={handleStatusChange}
                        onEditSession={handleOpenEditSession}
                        baseSession={baseSess}
                        confirmDefaultTemplate={state.templates?.confirmarDefault || defaultTemplates.confirmarDefault}
                        reforcorDefaultTemplate={state.templates?.reforco || defaultTemplates.reforco}
                        semRespostaDefaultTemplate={state.templates?.semresposta || defaultTemplates.semresposta}
                        customTemplates={state.customConfirmTemplates || []}
                        onNavigateToSettings={() => setActiveTab("settings")}
                        automations={state.automations || []}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB AGENDA */}
        {activeTab === "agenda" && (
          <AgendaTab
            state={state}
            occurrences={occurrences}
            today={today}
            onSelectPatient={(pId) => {
              const matched = state.patients.find((p) => p.id === pId);
              if (matched) {
                setSelectedPatientProfile(matched);
                setActiveTab("patients");
              }
            }}
            onAddSessionAt={(date, time) => {
              setSessionModalInitialDate(date);
              setSessionModalInitialTime(time);
              setIsSessionModalOpen(true);
            }}
          />
        )}

        {/* TAB SESSÕES */}
        {activeTab === "sessions" && (
          <section className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-1">
              <div>
                <h2 className="text-xl font-black text-brand-text">Futuras Sessões</h2>
                <p className="text-xs text-brand-muted">Consulte e altere agendamentos marcados para os próximos 90 dias</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute top-2.5 left-3 h-4 w-4 text-brand-muted" />
                <input
                  type="text"
                  placeholder="Buscar sessões..."
                  value={sessionSearchQuery}
                  onChange={(e) => setSessionSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-brand-border bg-white pl-9 pr-3 py-1.5 text-xs outline-hidden focus:border-brand-primary"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-brand-border bg-white p-4 space-y-4 shadow-xs">
              {futureGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-10 text-center">
                  <Calendar className="h-8 w-8 text-brand-muted mb-2" />
                  <p className="text-sm font-black text-brand-text">A pesquisa não retornou sessões futuras.</p>
                  <p className="text-xs text-brand-muted mt-1">Clique em "+ Sessão" no canto superior para programar novas consultas.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {futureGroups.map((g) => (
                    <div key={ymdFromDate(g.date)} className="rounded-xl border border-brand-border bg-slate-50">
                      <div className="flex items-center justify-between border-b border-brand-border bg-brand-primary/5 rounded-t-xl px-4 py-2 text-brand-text">
                        <strong className="text-xs font-black tracking-wide leading-tight uppercase">
                          {formatLongBR(g.date)}
                        </strong>
                        <span className="text-[10px] font-black text-brand-muted">
                          {g.items.length} consulta{g.items.length !== 1 && "s"}
                        </span>
                      </div>
                      <div className="p-3 gap-3 flex flex-col bg-white">
                        {g.items.map((o) => {
                          const patient = state.patients.find((p) => p.id === o.patientId);
                          const baseSess = state.sessions.find((s) => s.id === o.sessionId);
                          if (!patient || !baseSess) return null;
                          return (
                            <SessionRow
                              key={o.key}
                              occurrence={o}
                              patient={patient}
                              status={state.statuses[o.key] || "aguardando"}
                              onStatusChange={handleStatusChange}
                              onEditSession={handleOpenEditSession}
                              baseSession={baseSess}
                              confirmDefaultTemplate={state.templates?.confirmarDefault || defaultTemplates.confirmarDefault}
                              reforcorDefaultTemplate={state.templates?.reforco || defaultTemplates.reforco}
                              semRespostaDefaultTemplate={state.templates?.semresposta || defaultTemplates.semresposta}
                              customTemplates={state.customConfirmTemplates || []}
                              onNavigateToSettings={() => setActiveTab("settings")}
                              automations={state.automations || []}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB PACIENTES */}
        {activeTab === "patients" && selectedPatientProfile ? (
          <PatientProfileTab
            patient={selectedPatientProfile}
            state={state}
            occurrences={occurrences}
            today={today}
            onClose={() => {
              setSelectedPatientProfile(null);
              setProfileInitialSubTab(null);
              setProfileInitialOccurrence(null);
            }}
            onUpdateState={updateState}
            initialSubTab={profileInitialSubTab}
            initialOccurrenceForEvolution={profileInitialOccurrence}
          />
        ) : activeTab === "patients" && (
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            
            {/* Esquerda: Painel Informativo & Cadastro */}
            <div className="lg:col-span-5 flex flex-col gap-4 animate-in fade-in duration-200">
              
              {/* Botão de Destaque para abrir o Modal de Cadastro */}
              <div className="rounded-2xl border border-brand-border bg-white p-5 shadow-xs flex flex-col items-center justify-center text-center space-y-4">
                <div className="rounded-2xl bg-brand-primary/10 p-3.5 text-brand-primary">
                  <UserPlus className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-brand-text uppercase tracking-wider">
                    Registro Clínico Integrado
                  </h3>
                  <p className="mt-1 text-xs text-brand-muted leading-relaxed font-semibold">
                    Adicione novos pacientes preenchendo as informações civis, contatos de urgência, dados financeiros e a anamnese psicológica inicial em um único fluxo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingPatient(null);
                    setIsPatientModalOpen(true);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary py-3 text-xs font-black text-white hover:opacity-90 active:translate-y-[0.5px] cursor-pointer shadow-xs uppercase tracking-wider transition-all"
                >
                  <UserPlus className="h-4 w-4" /> Cadastrar Novo Paciente
                </button>
              </div>

              {/* Estatísticas Clínicas */}
              <div className="rounded-2xl border border-brand-border bg-white p-5 shadow-xs space-y-4.5">
                <h4 className="text-[10.5px] font-black text-brand-muted uppercase tracking-widest border-b border-brand-border/40 pb-2 flex items-center gap-1.5 leading-none">
                  <FileText className="h-3.5 w-3.5" /> Métricas Atuais do Consultório
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <span className="block text-[10px] font-black text-brand-muted uppercase tracking-wider">Total Ativos</span>
                    <span className="text-xl font-black text-brand-text">{state.patients.length}</span>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <span className="block text-[10px] font-black text-brand-muted uppercase tracking-wider">Fichas Anamnese</span>
                    <span className="text-xl font-black text-brand-primary">
                      {state.patients.filter((p) => !!p.chiefComplaint).length}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-brand-text">
                    <span className="text-brand-muted font-bold">Fichas com Emergência</span>
                    <span className="font-black">
                      {state.patients.filter((p) => !!p.emergencyContact).length} de {state.patients.length}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-brand-primary h-full transition-all duration-300" 
                      style={{ 
                        width: `${state.patients.length ? (state.patients.filter((p) => !!p.emergencyContact).length / state.patients.length) * 100 : 0}%` 
                      }}
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Direita: Lista de Pacientes */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-xs space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-brand-border/40 pb-2.5">
                  <h3 className="inline-flex items-center gap-1.5 text-sm font-black text-brand-text uppercase tracking-wider">
                    <Users className="h-4 w-4 text-brand-primary" /> Cadastrados
                  </h3>
                  <div className="relative w-full sm:w-48">
                    <Search className="absolute top-2 left-2.5 h-3.5 w-3.5 text-brand-muted" />
                    <input
                      type="text"
                      placeholder="Buscar paciente ID..."
                      value={patientSearchQuery}
                      onChange={(e) => setPatientSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-brand-border bg-white pl-8 pr-2.5 py-1 text-[11px] outline-hidden focus:border-brand-primary"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredPatients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-brand-muted text-xs">
                      <HelpCircle className="h-6 w-6 text-brand-muted/70 mb-1" />
                      Nenhum paciente localizado.
                    </div>
                  ) : (
                    filteredPatients.map((p) => {
                      // Filter occurrences belonging to this patient and scheduled for today or forward
                      const startOfTodayMs = today.getTime();
                      const patientOccs = occurrences
                        .filter((o) => o.patientId === p.id && o.when.getTime() >= startOfTodayMs)
                        .slice(0, 5);

                      return (
                        <div key={p.id} className="rounded-xl border border-brand-border bg-slate-50/55 p-3.5 space-y-3 hover:border-brand-primary/10 transition-colors">
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="min-w-0">
                              <h4 className="font-black text-sm text-brand-text truncate leading-tight">{p.name}</h4>
                              <p className="mt-0.5 text-xs text-brand-muted font-medium">{formatPhone(p.phone)}</p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => setSelectedPatientProfile(p)}
                                className="inline-flex items-center gap-1 rounded-lg border border-brand-primary/25 bg-brand-primary/5 px-2.5 py-1 text-[10px] font-black text-brand-primary hover:bg-brand-primary hover:text-white cursor-pointer"
                              >
                                Ver Prontuário
                              </button>
                              <button
                                onClick={() => openWa(`Oi ${p.name}, tudo bem?`)}
                                className="inline-flex items-center gap-1 rounded-lg border border-brand-border bg-white px-2 py-1 text-[10px] font-bold text-brand-text hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
                              >
                                Conversar
                              </button>
                              <button
                                onClick={() => handleOpenEditPatient(p)}
                                className="inline-flex items-center gap-1 rounded-lg border border-brand-border bg-white px-2 py-1 text-[10px] font-bold text-brand-text hover:bg-slate-100 cursor-pointer"
                              >
                                Editar
                              </button>
                            </div>
                          </div>

                          {/* Next session occurrences inside Patient Card */}
                          <div className="border-t border-brand-border/40 pt-2.5">
                            <div className="flex items-center justify-between text-[10px] font-black text-brand-muted tracking-wide uppercase mb-1.5">
                              <span>Próximas Sessões</span>
                              <span>{patientOccs.length} Exibida(s)</span>
                            </div>
                            {patientOccs.length === 0 ? (
                              <p className="text-[11px] text-brand-muted italic py-1">Nenhuma sessão associada futuramente.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {patientOccs.map((o) => {
                                  const baseSess = state.sessions.find((s) => s.id === o.sessionId);
                                  return (
                                    <div key={o.key} className="flex items-center justify-between gap-3 bg-white border border-brand-border/60 rounded-lg p-2 hover:border-brand-primary/20 transition-colors">
                                      <div className="min-w-0">
                                        <p className="text-xs font-black text-brand-text leading-tight uppercase">
                                          {formatShortDay(o.when)} • {hmFromDate(o.when)}
                                        </p>
                                        <p className="text-[10px] text-brand-muted truncate mt-0.5">
                                          {o.local} {o.note ? `• ${o.note}` : ""}
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => {
                                          if (baseSess) handleOpenEditSession(baseSess);
                                        }}
                                        className="shrink-0 rounded-md p-1 border border-brand-border/40 bg-slate-50 text-brand-muted hover:bg-slate-100 cursor-pointer hover:text-brand-text"
                                        title="Editar sessão"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* TAB FINANCEIRO / CONTÁBIL (Módulo 2) */}
        {activeTab === "financial" && (
          <FinancialTab
            state={state}
            occurrences={occurrences}
            today={today}
            onUpdateState={updateState}
            onWaOpen={openWa}
          />
        )}

        {/* TAB RADAR DE EVASÃO (Módulo 4) */}
        {activeTab === "risk" && (
          <RiskPatientsTab
            state={state}
            occurrences={occurrences}
            today={today}
            onWaOpen={openWa}
            onScheduleReturn={(pId) => {
              setEditingSession(null);
              setIsSessionModalOpen(true);
            }}
          />
        )}

        {/* TAB RETENÇÃO / FIDELIDADE (Módulo 5) */}
        {activeTab === "retention" && (
          <RetentionTab
            state={state}
            occurrences={occurrences}
            today={today}
          />
        )}

        {/* TAB LISTA DE ESPERA (Módulo 6) */}
        {activeTab === "waiting" && (
          <WaitingListTab
            state={state}
            onUpdateState={updateState}
            onWaOpen={openWa}
          />
        )}

        {/* TAB LEMBRETES/AUTOMAÇÕES (Módulo 7) */}
        {activeTab === "automations" && (
          <AutomationsTab
            state={state}
            onUpdateState={updateState}
            onWaOpen={openWa}
          />
        )}

        {/* TAB ASSISTENTE DE IA ADMINISTRATIVO (Módulo 9) */}
        {activeTab === "ai_chat" && (
          <AIChatTab
            state={state}
            occurrences={occurrences}
            today={today}
          />
        )}

        {/* TAB GERADOR DE RELATÓRIOS (Módulo 10) */}
        {activeTab === "reports" && (
          <ReportsTab
            state={state}
            occurrences={occurrences}
            today={today}
          />
        )}

        {/* TAB DEFINIÇÕES: TEMPLATES + BACKUPS (Módulo 11) */}
        {activeTab === "settings" && (
          <section className="max-w-2xl mx-auto leading-relaxed space-y-4">
            
            {/* Backups e dados de conta */}
            <div className="rounded-2xl border border-brand-border bg-white p-5 shadow-xs space-y-3">
              <h3 className="inline-flex items-center gap-1.5 text-sm font-black text-brand-text uppercase tracking-wider pb-1">
                💡 Backup e Armazenamento
              </h3>
              <p className="text-xs text-brand-muted leading-snug">
                Suas configurações, pacientes e status de consultas estão sincronizados com segurança na sua conta de nuvem. No entanto, por garantia, você pode exportar backups manuais.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleExportBackup}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand-border bg-white hover:bg-slate-50 px-3 py-2.5 text-xs font-black text-brand-text cursor-pointer"
                >
                  <Download className="h-4 w-4 text-brand-primary" /> Exportar JSON
                </button>
                <button
                  onClick={handleImportButtonClick}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand-border bg-white hover:bg-slate-50 px-3 py-2.5 text-xs font-black text-brand-text cursor-pointer"
                >
                  <Upload className="h-4 w-4 text-brand-primary" /> Importar JSON
                </button>
              </div>

              <p className="text-[10px] text-brand-muted leading-tight mt-2 italic text-center">
                * A importação de JSON substitui permanentemente as definições e agendamentos existentes.
              </p>

              {/* Hidden File Input for JSON Backup */}
              <input
                type="file"
                ref={fileInputRef}
                accept="application/json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </div>

            {/* Informações técnicas e créditos */}
            <div className="rounded-2xl border border-brand-border bg-slate-50 p-5 space-y-2 text-xs text-brand-muted">
              <strong className="text-brand-text font-black block">Ambiente psi integrado</strong>
              <p>O aplicativo **Confirma** foi estruturado em cima da API segura do Firebase para autenticar e proteger de forma privada a lista de seus pacientes e anotações.</p>
              <div className="flex items-center justify-between text-[11px] font-mono select-none pt-2 border-t border-brand-border">
                <span>Versão ativa:</span>
                <span className="font-semibold text-slate-600">v4.1.0-TS</span>
              </div>
            </div>

          </section>
        )}

          </main>
        </div>
      </div>

      {/* 4. Modals and Triggers Overlay templates */}
      <SessionModal
        isOpen={isSessionModalOpen}
        onClose={() => {
          setIsSessionModalOpen(false);
          setEditingSession(null);
          setSessionModalInitialDate(undefined);
          setSessionModalInitialTime(undefined);
        }}
        onSave={handleSaveSession}
        onDelete={handleDeleteSession}
        editingSession={editingSession}
        patients={state.patients}
        initialDate={sessionModalInitialDate}
        initialTime={sessionModalInitialTime}
      />

      <PatientModal
        isOpen={isPatientModalOpen}
        onClose={() => {
          setIsPatientModalOpen(false);
          setEditingPatient(null);
        }}
        onSave={handleSavePatientEdit}
        onDelete={handleDeletePatient}
        patient={editingPatient}
      />
    </div>
  );
}
