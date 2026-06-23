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
  FileDown,
  CreditCard,
  ShieldCheck,
  ArrowLeft,
  MessageCircle
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
import TherapistProfileModal from "./components/TherapistProfileModal";

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

  // Therapist profile state
  const [therapistName, setTherapistName] = useState<string>("Henrique Castro Santos");
  const [therapistPhoto, setTherapistPhoto] = useState<string>("");
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);

  // Application data state
  const [state, setState] = useState<AppState>(getInitialState());
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "today" | "agenda" | "sessions" | "patients" | "financial" | "risk" | "retention" | "waiting" | "automations" | "ai_chat" | "reports" | "settings"
  >("dashboard");
  const [selectedPatientProfile, setSelectedPatientProfile] = useState<Patient | null>(null);

  // Stripe & Premium integration states
  const [isPaid, setIsPaid] = useState<boolean>(false); // Initialized to false, loaded from Firestore
  const [stripeConfigured, setStripeConfigured] = useState<boolean>(false);
  const [checkoutLoading, setCheckoutLoading] = useState<boolean>(false);
  const [showSimulatedCheckout, setShowSimulatedCheckout] = useState<boolean>(false);
  const [simulatedPaymentMethod, setSimulatedPaymentMethod] = useState<"card" | "pix">("card");
  const [simulatedCardName, setSimulatedCardName] = useState<string>("");
  const [simulatedCardNumber, setSimulatedCardNumber] = useState<string>("");
  const [simulatedCardExpiry, setSimulatedCardExpiry] = useState<string>("");
  const [simulatedCardCvv, setSimulatedCardCvv] = useState<string>("");
  const [simulatedPixCopied, setSimulatedPixCopied] = useState<boolean>(false);
  const [simulatedPaymentProcessing, setSimulatedPaymentProcessing] = useState<boolean>(false);
  const [publishableKey, setPublishableKey] = useState<string>("");
  const [stripePromise, setStripePromise] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState<string>("");
  const [paymentIntentLoading, setPaymentIntentLoading] = useState<boolean>(false);
  const [profileInitialSubTab, setProfileInitialSubTab] = useState<"dados" | "historico" | "financeiro" | "formularios" | "prontuario" | "insights" | null>(null);
  const [profileInitialOccurrence, setProfileInitialOccurrence] = useState<Occurrence | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Modals state
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [sessionModalInitialDate, setSessionModalInitialDate] = useState<string | undefined>(undefined);
  const [sessionModalInitialTime, setSessionModalInitialTime] = useState<string | undefined>(undefined);
  const [sessionModalInitialPatientId, setSessionModalInitialPatientId] = useState<string | undefined>(undefined);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  // Helper to calculate start of the week shown (Monday)
  const getInitialMonday = (baseDate: Date) => {
    const d = new Date(baseDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? 1 : 1); // If Sunday, show upcoming week
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const [agendaWeekStart, setAgendaWeekStart] = useState<Date>(() => {
    const d = new Date();
    const todayBase = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = todayBase.getDay();
    const diff = todayBase.getDate() - day + (day === 0 ? 1 : 1);
    const monday = new Date(todayBase.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

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
  const [today, setToday] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  });

  // Keep today state updated whenever the active tab changes or the window is focused
  useEffect(() => {
    const updateToday = () => {
      const d = new Date();
      setToday(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    };

    updateToday();

    window.addEventListener("focus", updateToday);
    return () => {
      window.removeEventListener("focus", updateToday);
    };
  }, [activeTab]);

  // Keep agenda week start in sync if today shifts
  useEffect(() => {
    setAgendaWeekStart(getInitialMonday(today));
  }, [today]);

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
        const localCache = localStorage.getItem("confirma_v4_" + user.uid);
        let initialData = getInitialState();
        if (localCache) {
          try {
            initialData = JSON.parse(localCache);
          } catch (e) {
            console.error("Failing loading local cache.", e);
          }
        }

        // Load cached therapist profile for THIS user as initial fallback
        const cachedName = localStorage.getItem("confirma_therapist_name_" + user.uid);
        const cachedPhoto = localStorage.getItem("confirma_therapist_photo_" + user.uid);
        if (cachedName) setTherapistName(cachedName);
        if (cachedPhoto) setTherapistPhoto(cachedPhoto);

        // 3. Query newest cloud representation
        const path = `users/${user.uid}`;
        try {
          const cloudDoc = await getDoc(doc(db, "users", user.uid));
          if (cloudDoc.exists()) {
            const data = cloudDoc.data();
            const loadedIsPaid = (data && data.isPaid !== undefined ? !!data.isPaid : false) || (user.email === "rickyjorgecastro@gmail.com");
            setIsPaid(loadedIsPaid);

            if (user.email === "rickyjorgecastro@gmail.com" && (!data || !data.isPaid)) {
              setDoc(doc(db, "users", user.uid), { isPaid: true }, { merge: true }).catch(console.error);
            }

            if (data) {
              if (data.displayName) {
                setTherapistName(data.displayName);
                localStorage.setItem("confirma_therapist_name_" + user.uid, data.displayName);
              } else {
                setTherapistName("Henrique Castro Santos");
                localStorage.removeItem("confirma_therapist_name_" + user.uid);
              }
              if (data.photoUrl) {
                setTherapistPhoto(data.photoUrl);
                localStorage.setItem("confirma_therapist_photo_" + user.uid, data.photoUrl);
              } else {
                setTherapistPhoto("");
                localStorage.removeItem("confirma_therapist_photo_" + user.uid);
              }
            }
            
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
              localStorage.setItem("confirma_v4_" + user.uid, JSON.stringify(cloudState));
            } else {
              // Document exists but has no state (e.g., initialized via AuthGate displayName save first)
              const isUserPaid = user.email === "rickyjorgecastro@gmail.com";
              setIsPaid(isUserPaid);
              setState(initialData);
              await saveToFirestore(user.uid, initialData);
              if (isUserPaid) {
                await setDoc(doc(db, "users", user.uid), { isPaid: true }, { merge: true });
              }
            }
          } else {
            // First time user on cloud - deploy local state if they had cached records
            const isUserPaid = user.email === "rickyjorgecastro@gmail.com";
            setIsPaid(isUserPaid);
            setState(initialData);
            await saveToFirestore(user.uid, initialData);
            if (isUserPaid) {
              await setDoc(doc(db, "users", user.uid), { isPaid: true }, { merge: true });
            }
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
        setIsPaid(false);
        setState(getInitialState());
        setTherapistName("Henrique Castro Santos");
        setTherapistPhoto("");
      }
      setInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  // Handle successful redirects from paywall
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const simulatedSuccess = params.get("simulated_success");

    if ((success || simulatedSuccess) && userId) {
      setIsPaid(true);

      const userDocRef = doc(db, "users", userId);
      setDoc(userDocRef, { isPaid: true, paidAt: serverTimestamp() }, { merge: true })
        .then(() => {
          console.log("Salvo user status como pago no firestore do cliente.");
        })
        .catch((err) => console.error("Falha ao salvar status pago no firestore:", err));

      const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: cleanUrl }, "", cleanUrl);

      alert("Parabéns! O seu plano Vitalício Premium do Confirma foi ativado com sucesso! Aproveite todos os recursos ilimitados ❤️");
    }
  }, [userId]);

  // Open manual premium info/checkout flow helper
  const handleCreateCheckout = () => {
    if (!userId) {
      alert("Por favor, faça login antes de acessar o plano Premium.");
      return;
    }
    setShowSimulatedCheckout(true);
  };

  // Save changes triggers local storage immediately and debounces firestore sync
  const updateState = (updater: (prev: AppState) => AppState) => {
    if (!isPaid) {
      alert("Acesso Limitado à Visualização: Por favor, ative seu Plano Vitalício Premium nas Definições para liberar o cadastro, alteração e salvamento de dados!");
      return;
    }
    setState((prev) => {
      const next = updater(prev);
      if (userId) {
        localStorage.setItem("confirma_v4_" + userId, JSON.stringify(next));

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
    if (!isPaid) {
      alert("Modo de Visualização: A ativação da sua assinatura Premium é necessária para cadastrar novos pacientes.");
      return;
    }
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
    if (!isPaid) {
      alert("Modo de Visualização: A ativação da sua assinatura Premium é necessária para agendar ou alterar consultas.");
      return;
    }
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
      // Jump agenda's week start to the scheduled session's date's week start so they see it instantly!
      if (draft.date) {
        const [y, m, d] = draft.date.split("-").map(Number);
        const targetDate = new Date(y, m - 1, d);
        setAgendaWeekStart(getInitialMonday(targetDate));
      }
    }
    setIsSessionModalOpen(false);
    setEditingSession(null);
    setSessionModalInitialPatientId(undefined);
  };

  // Delete Session and remove its statuses
  const handleDeleteSession = (id: string) => {
    if (!isPaid) {
      alert("Modo de Visualização: A ativação da sua assinatura Premium é necessária para excluir agendamentos.");
      return;
    }
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
    if (!isPaid) {
      alert("Modo de Visualização: A ativação da sua assinatura Premium é necessária para salvar prontuários ou cadastrar pacientes.");
      return;
    }
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
          ...patientData,
          id: crypto.randomUUID(),
          name: patientData.name!,
          phone: cleanPhone,
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
    if (!isPaid) {
      alert("Modo de Visualização: A ativação da sua assinatura Premium é necessária para excluir pacientes.");
      return;
    }
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
    if (!isPaid) {
      alert("Modo de Visualização: A ativação da sua assinatura Premium é necessária para marcar presenças ou faltas.");
      return;
    }
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
    if (!isPaid) {
      alert("Modo de Visualização: A ativação da sua assinatura Premium é necessária para alterar templates.");
      return;
    }
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
    if (!isPaid) {
      alert("Modo de Visualização: A ativação da sua assinatura Premium é necessária para alterar templates.");
      return;
    }
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
    if (!isPaid) {
      alert("Modo de Visualização: A ativação da sua assinatura Premium é necessária para alterar templates.");
      return;
    }
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
    if (!isPaid) {
      alert("Modo de Visualização: A ativação da sua assinatura Premium é necessária para criar templates personalizados.");
      return;
    }
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
    if (!isPaid) {
      alert("Modo de Visualização: A ativação da sua assinatura Premium é necessária para excluir templates.");
      return;
    }
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
    if (!isPaid) {
      alert("Modo de Visualização: A ativação da sua assinatura Premium é necessária para importar backups.");
      return;
    }
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
    if (!isPaid) {
      alert("Modo de Visualização: A ativação da sua assinatura Premium é necessária para redefinir templates.");
      return;
    }
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

  // Save Therapist Profile Edit
  const handleSaveTherapistProfile = async (name: string, photo: string) => {
    if (!userId) return;
    try {
      await setDoc(doc(db, "users", userId), {
        displayName: name,
        photoUrl: photo,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setTherapistName(name);
      setTherapistPhoto(photo);
      localStorage.setItem("confirma_therapist_name_" + userId, name);
      if (photo) {
        localStorage.setItem("confirma_therapist_photo_" + userId, photo);
      } else {
        localStorage.removeItem("confirma_therapist_photo_" + userId);
      }
    } catch (err) {
      console.error("Erro ao salvar perfil do terapeuta:", err);
      throw err;
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
        onAuthenticated={async (uid, displayName) => {
          setUserId(uid);
          if (displayName) {
            setTherapistName(displayName);
            localStorage.setItem("confirma_therapist_name_" + uid, displayName);
            try {
              await setDoc(doc(db, "users", uid), {
                displayName: displayName,
                updatedAt: serverTimestamp()
              }, { merge: true });
            } catch (err) {
              console.error("Erro ao salvar nome no cadastro inicial:", err);
            }
          }
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
            <img src="./logo.png" alt="Confirma" className="h-8 w-auto object-contain" />
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
        <div className="border-t border-[#DFE7EC] p-3.5 bg-slate-50 shrink-0">
          <div className="flex items-center justify-between gap-1.5">
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-2 min-w-0 text-left hover:bg-slate-200/60 p-1.5 -m-1.5 rounded-2xl flex-1 group transition-colors cursor-pointer"
              title="Visualizar Perfil Profissional"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-primary overflow-hidden border border-[#DFE7EC] font-black text-white text-xs uppercase shadow-xs">
                {therapistPhoto ? (
                  <img src={therapistPhoto} alt={therapistName} className="h-full w-full object-cover animate-in fade-in duration-300" />
                ) : (
                  therapistName.substring(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex flex-col justify-center">
                <span className="block text-[11px] font-black text-brand-text truncate leading-none group-hover:text-brand-primary transition-colors">
                  {therapistName}
                </span>
                <span className={`inline-flex items-center gap-0.5 self-start mt-0.5 px-1.5 py-0.5 rounded-md text-[8px] font-extrabold uppercase tracking-wider leading-none ${
                  isPaid 
                    ? "bg-amber-500/10 text-amber-700 border border-amber-500/25 shadow-[0_1px_2px_rgba(245,158,11,0.05)]"
                    : "bg-slate-100 text-slate-500 border border-slate-200"
                }`}>
                  {isPaid ? "★ PREMIUM" : "⚡ Sem plano"}
                </span>
              </div>
            </button>
            
            <button
              onClick={handleLogout}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#DFE7EC] bg-white text-brand-muted hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
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
                if (!isPaid) {
                  alert("Modo de Visualização: A ativação da sua assinatura Premium é necessária para criar novos agendamentos.");
                  return;
                }
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

            {!isPaid && (
              <div id="read_only_banner" className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs text-left animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0 mt-0.5">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                      <span>Modo de Visualização Ativo</span>
                      <span className="px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded text-[9px] font-bold">Assinatura Inativa</span>
                    </h4>
                    <p className="text-xs text-amber-850 leading-relaxed font-semibold">
                      Sua conta do <strong className="text-amber-900">Confirma</strong> não possui o plano ativo. Você pode visualizar e navegar pelo sistema livremente, mas todos os recursos de agendamento, cadastro, prontuários, automações e IA estão protegidos contra edições ou novas inserções. Ative seu plano premium para liberar todas as funções.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setActiveTab("settings");
                    handleCreateCheckout();
                  }}
                  className="inline-flex items-center gap-1 bg-[#3A5A6B] hover:bg-[#2C4452] text-white font-black text-xs px-4 py-2.5 rounded-xl cursor-pointer shadow-xs transition-all shrink-0 uppercase tracking-wider border-none self-start sm:self-auto"
                >
                  <Sparkles className="h-3.5 w-3.5 animate-pulse text-amber-200" />
                  <span>Ativar Plano Vitalício</span>
                </button>
              </div>
            )}

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
            currentWeekStart={agendaWeekStart}
            onCurrentWeekStartChange={setAgendaWeekStart}
            onSelectPatient={(pId) => {
              const matched = state.patients.find((p) => p.id === pId);
              if (matched) {
                setSelectedPatientProfile(matched);
                setActiveTab("patients");
              }
            }}
            onAddSessionAt={(date, time) => {
              if (!isPaid) {
                alert("Modo de Visualização: A ativação da sua assinatura Premium é necessária para criar novos agendamentos.");
                return;
              }
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
                    if (!isPaid) {
                      alert("Modo de Visualização: A ativação da sua assinatura Premium é necessária para cadastrar novos pacientes.");
                      return;
                    }
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
                                onClick={() => openWa(p.phone, `Oi ${p.name}, tudo bem?`)}
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
              if (!isPaid) {
                alert("Modo de Visualização: A ativação da sua assinatura Premium é necessária para agendar novos retornos.");
                return;
              }
              setEditingSession(null);
              setSessionModalInitialPatientId(pId);
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
          !isPaid ? (
            <div className="max-w-2xl mx-auto rounded-2xl border border-brand-border bg-white p-8 text-center space-y-6 shadow-xs">
              <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto text-brand-primary text-3xl">✨</div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-brand-text">Assistente de IA Administrativo</h3>
                <p className="text-sm text-brand-muted max-w-md mx-auto leading-relaxed">
                  Gere análises de clínicas, respostas inteligentes de whatsapp e planos estratégicos baseados em IA.
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-black">
                  ⭐ Funcionalidade Exclusiva Premium
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl space-y-3 text-left max-w-md mx-auto text-xs text-brand-muted leading-relaxed">
                <div className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> Auditoria automatizada de perdas financeiras</div>
                <div className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> Insights de risco de abandono de pacientes</div>
                <div className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> Sugestão de agendamento reativo otimizado por IA</div>
              </div>
              <button
                onClick={() => setActiveTab("settings")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary hover:bg-brand-primary/95 px-6 py-3 text-sm font-black text-white cursor-pointer shadow-md w-full max-w-xs transition-all"
              >
                Ativar Acesso Vitalício
              </button>
            </div>
          ) : (
            <AIChatTab
              state={state}
              occurrences={occurrences}
              today={today}
            />
          )
        )}

        {/* TAB GERADOR DE RELATÓRIOS (Módulo 10) */}
        {activeTab === "reports" && (
          !isPaid ? (
            <div className="max-w-2xl mx-auto rounded-2xl border border-brand-border bg-white p-8 text-center space-y-6 shadow-xs">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 text-3xl">📊</div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-brand-text">Gerador de Relatórios Clínicos</h3>
                <p className="text-sm text-brand-muted max-w-md mx-auto leading-relaxed">
                  Exporte relatórios financeiros de receitas, histórico completo de agendas e auditorias de clínica.
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-black">
                  ⭐ Funcionalidade Exclusiva Premium
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl space-y-3 text-left max-w-md mx-auto text-xs text-brand-muted leading-relaxed">
                <div className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> Exportação de balancetes mensais em CSV/XLS</div>
                <div className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> Relatórios de produtividade clínica</div>
                <div className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> Auditoria completa de faturamento</div>
              </div>
              <button
                onClick={() => setActiveTab("settings")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary hover:bg-brand-primary/95 px-6 py-3 text-sm font-black text-white cursor-pointer shadow-md w-full max-w-xs transition-all"
              >
                Ativar Acesso Vitalício
              </button>
            </div>
          ) : (
            <ReportsTab
              state={state}
              occurrences={occurrences}
              today={today}
            />
          )
        )}

        {/* TAB DEFINIÇÕES: TEMPLATES + BACKUPS (Módulo 11) */}
        {activeTab === "settings" && (
          showSimulatedCheckout ? (
            <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-brand-border shadow-md overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 mb-8">
              {/* Header */}
              <div className="border-b border-brand-border bg-slate-50 px-6 py-5 flex items-center justify-between">
                <button
                  onClick={() => setShowSimulatedCheckout(false)}
                  className="inline-flex items-center gap-2 text-xs font-black text-brand-primary hover:opacity-85 transition-all cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Voltar para Definições</span>
                </button>
                <div className="flex items-center gap-1.5 text-brand-primary">
                  <ShieldCheck className="h-5 w-5 text-brand-primary" />
                  <span className="text-xs font-bold text-brand-muted">Ativação de Conta • Premium</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 md:divide-x md:divide-brand-border">
                {/* Left Column: Order Summary */}
                <div className="md:col-span-12 lg:col-span-5 bg-slate-50/50 p-6 sm:p-8 space-y-6 text-left">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black tracking-widest text-[#3A5A6B] uppercase block">Faturamento Confirma</span>
                    <h2 className="text-lg font-black text-brand-text font-serif">Resumo do Pedido</h2>
                  </div>

                  {/* Receipt Item */}
                  <div className="p-4 rounded-2xl border border-brand-border bg-white space-y-3.5">
                    <div className="flex items-start justify-between gap-2 border-b border-brand-border pb-3">
                      <div>
                        <p className="font-black text-xs text-brand-text">Confirma Premium</p>
                        <p className="text-[11px] text-brand-muted mt-0.5">Acesso Premium Vitalício</p>
                      </div>
                      <div className="text-right">
                        <span className="line-through text-slate-400 text-[10px] mr-1.5 font-bold">R$ 197,00</span>
                        <span className="font-extrabold text-[#3a5a6b] text-xs">R$ 99,90</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold text-brand-text">
                      <span>Investimento Único:</span>
                      <div className="text-right">
                        <span className="line-through text-slate-400 text-xs mr-2 font-bold">R$ 197,00</span>
                        <span className="text-base font-black text-[#3a5a6b]">R$ 99,90</span>
                      </div>
                    </div>
                  </div>

                  {/* Features included list */}
                  <div className="space-y-3.5 pt-2">
                    <p className="text-[10px] font-black text-brand-muted uppercase tracking-wider">Benefícios inclusos:</p>
                    <ul className="space-y-2.5 text-xs text-brand-muted">
                      <li className="flex items-start gap-2">
                        <span className="text-[#3A5A6B] font-bold select-none">✓</span>
                        <span>Aproveite o <strong>Acesso Completo</strong> definitivo de todas as ferramentas e recursos existentes no sistema.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#3A5A6B] font-bold select-none">✓</span>
                        <span><strong>Acesso a todos os usos do Confirma</strong> sem limites de cadastros, atendimentos ou solicitações de IA.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 bg-[#FFFBEB] rounded-2xl border-2 border-amber-400 text-xs text-[#92400E] flex gap-2.5 animate-pulse shadow-[0_0_18px_rgba(245,158,11,0.5)] ring-2 ring-amber-400/20">
                    <span className="text-sm">⏳</span>
                    <p className="leading-snug font-semibold text-[11px]">
                      <strong>Aviso Importante:</strong> Em breve iremos migrar a plataforma para mensalidade por assinatura. Garanta agora o seu <strong>acesso vitalício</strong> por pagamento único e não perca essa oportunidade definitiva!
                    </p>
                  </div>

                  <div className="p-4 bg-[#EBF5FF] rounded-2xl border border-[#BFDBFE] text-xs text-[#1E40AF] flex gap-2.5">
                    <span className="text-sm">🛡️</span>
                    <p className="leading-snug font-medium">
                      <strong>Acesso Definitivo:</strong> Sem taxas adicionais, sem assinaturas recorrentes. Compre uma vez, use para sempre.
                    </p>
                  </div>
                </div>

                {/* Right Column: Payments Gateway instructions */}
                <div className="md:col-span-12 lg:col-span-7 p-6 sm:p-8 space-y-6 bg-white text-left">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-widest font-mono">
                      ⚡ Ativação Manual Facilitada
                    </div>
                    <h3 className="text-base font-black text-brand-text">Como liberar seu acesso vitalício?</h3>
                    <p className="text-xs text-brand-muted leading-relaxed">
                      Siga o passo a passo simples abaixo para realizar o PIX e enviar o comprovante. Nossa equipe liberará sua conta imediatamente!
                    </p>
                  </div>

                  {/* Step Card: Pay via Pix */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-brand-border space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#1E40AF] text-white text-[11px] font-black flex items-center justify-center font-mono">1</div>
                      <p className="text-xs font-black text-brand-text">Realize o pagamento via Pix</p>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[9px] uppercase font-black tracking-widest text-brand-muted">Chave Pix Copia e Cola (E-mail):</label>
                      <div className="flex items-center gap-2 bg-white rounded-xl border border-brand-border p-2">
                        <span className="font-mono text-[11px] text-brand-text font-black flex-1 select-all truncate pr-2">
                          confirma.psico@gmail.com
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText("confirma.psico@gmail.com");
                            alert("Chave Pix copiada com sucesso! Transfira o valor de R$ 99,90 no aplicativo do seu banco.");
                          }}
                          className="bg-[#1E40AF] hover:bg-[#1D4ED8] text-white font-black text-[10px] px-3.5 py-2 rounded-lg active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                        >
                          Copiar Chave
                        </button>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-brand-muted pt-1 font-semibold">
                        <span>Beneficiário: Henrique Castro Santos</span>
                        <span className="text-[#3A5A6B]">Valor: R$ 99,90</span>
                      </div>
                    </div>
                  </div>

                  {/* Step Card: Send proof */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-brand-border space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#1E40AF] text-white text-[11px] font-black flex items-center justify-center font-mono">2</div>
                      <p className="text-xs font-black text-brand-text">Envie o comprovante de pagamento</p>
                    </div>

                    <p className="text-xs text-brand-muted leading-relaxed">
                      Após realizar o PIX no app do banco, clique no botão abaixo para nos enviar o comprovante pelo Whatsapp. Dessa forma, iremos conceder o acesso premium vitalício!
                    </p>

                    <div className="grid grid-cols-1 gap-2 pt-1">
                      <a
                        href={`https://wa.me/5511959760647?text=Olá!%20Acabei%20de%20realizar%20o%20pagamento%20de%20R$%2099,90%20via%20Pix%20para%20o%20Confirma%20Premium.%20Segue%20o%20comprovante%20em%20anexo%20para%20ativar%20a%20minha%20conta.`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-3 rounded-xl cursor-pointer shadow-md transition-all uppercase tracking-wider text-center"
                      >
                        <span className="text-sm">💬</span>
                        <span>Enviar comprovante por WhatsApp</span>
                      </a>
                    </div>
                    <p className="text-[11px] text-center text-brand-muted leading-relaxed mt-2 pt-1 border-t border-dashed border-brand-border">
                      Caso não consiga acessar o botão, envie o comprovante para o número: <strong className="text-brand-text">11 95976-0647</strong> ou para o e-mail: <strong className="text-brand-text">confirma.psico@gmail.com</strong>
                    </p>
                  </div>

                  <div className="text-center pt-2">
                    <p className="text-[10px] text-brand-muted font-black tracking-widest uppercase flex items-center justify-center gap-2 font-mono">
                      <span>🔒</span> SUPORTE DIÁRIO DE ATIVAÇÃO DAS 08H ÀS 22H
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <section className="max-w-2xl mx-auto leading-relaxed space-y-4">
              {/* Novo Plano e Assinatura Premium - Altamente estético em cor clara integrada */}
              <div className="rounded-2xl border border-brand-border bg-white p-5 sm:p-6 shadow-xs space-y-5 relative overflow-hidden text-left">
                <div className="flex items-center justify-between border-b border-brand-border pb-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#EBF5FF] text-[#1E40AF] border border-[#BFDBFE] tracking-wider uppercase">
                      👑 PLANO DE ASSINATURA
                    </div>
                    <h3 className="text-base font-black text-brand-text pt-1 mb-0">
                      Confirma • Acesso Vitalício Premium
                    </h3>
                  </div>
                  <div>
                    {isPaid ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#E6FFFA] text-[#006652] border border-[#B2F5EA]">
                        ✨ Premium Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        Assinatura Inativa
                      </span>
                    )}
                  </div>
                </div>

                {isPaid ? (
                  <div className="space-y-4">
                    <p className="text-xs text-brand-muted leading-relaxed">
                      Sua conta do <strong>Confirma</strong> já possui o <strong>Acesso Vitalício Premium Ativo</strong>. Todos os recursos completos de IA, prontuários do paciente e relatórios integrados estão liberados sem mensalidades!
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center pt-2">
                      <div className="p-3 bg-slate-50 rounded-xl border border-brand-border/40">
                        <div className="text-[#3A5A6B] font-black text-xs">Membros Ilimitados</div>
                        <div className="text-[10px] text-brand-muted mt-0.5">Sem limite de prontuários</div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-brand-border/40">
                        <div className="text-[#3A5A6B] font-black text-xs font-sans">Robô IA Pro</div>
                        <div className="text-[10px] text-brand-muted mt-0.5">Análises administrativas</div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-brand-border/40">
                        <div className="text-[#3A5A6B] font-black text-xs">Gerador Estatístico</div>
                        <div className="text-[10px] text-brand-muted mt-0.5">Auditoria e Exportação</div>
                      </div>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl text-center text-xs text-emerald-800 font-bold border border-emerald-100">
                      Agradecemos por apoiar e investir no desenvolvimento independente do Confirma! ❤️
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-brand-muted leading-relaxed">
                      Sua conta do <strong>Confirma</strong> não possui uma assinatura ativa no momento. Ative o plano de pagamento único por apenas R$ 99,90 para liberar todos os recursos do sistema.
                    </p>

                    {/* Clean list with premium features (no trial vs pro comparison grid) */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-brand-border/50 text-xs text-left">
                      <p className="font-bold text-[#1E40AF] uppercase tracking-wider text-[10px] mb-2">Recursos inclusos na assinatura:</p>
                      <ul className="space-y-1.5 text-slate-700">
                        <li className="flex items-center gap-2">
                          <span className="text-emerald-500 font-bold">✓</span>
                          <span><strong>Prontuários & Pacientes Ilimitados</strong>: gerencie todo o seu consultório psicoterapêutico sem qualquer limitação.</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-emerald-500 font-bold">✓</span>
                          <span><strong>Agenda Inteligente Completa</strong>: lance sessões recorrentes, marque faltas ou presenças e envie lembretes.</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-emerald-500 font-bold">✓</span>
                          <span><strong>Assistente de Atendimento IA</strong>: gere resumos clínicos de prontuários, análises financeiras e automações de clínica.</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-emerald-500 font-bold">✓</span>
                          <span><strong>Exportações & Relatórios</strong>: emita balancetes e listas completas para controle perfeito de faturamento.</span>
                        </li>
                      </ul>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-slate-100 text-left">
                      <div>
                        <span className="text-[9px] text-brand-muted uppercase font-black tracking-widest block">INVESTIMENTO ÚNICO</span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-xs text-brand-muted">De R$ 197 por</span>
                          <span className="text-[#3A5A6B] text-xs font-sans">R$</span>
                          <span className="text-xl font-black text-brand-text">99</span>
                          <span className="text-xs font-bold text-brand-text">,90</span>
                          <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded bg-[#EBF5FF] text-[#1E40AF] text-[9px] font-bold">Acesso Vitalício</span>
                        </div>
                      </div>

                      <button
                        onClick={handleCreateCheckout}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#3A5A6B] hover:bg-[#2C4452] text-white font-black text-xs px-5 py-3 cursor-pointer shadow-xs transition-all border-none"
                      >
                        <span>Abrir Página de Checkout Seguro</span>
                        <Sparkles className="h-4 w-4 text-slate-100 animate-pulse" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

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
        )
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
          setSessionModalInitialPatientId(undefined);
        }}
        onSave={handleSaveSession}
        onDelete={handleDeleteSession}
        editingSession={editingSession}
        patients={state.patients}
        initialDate={sessionModalInitialDate}
        initialTime={sessionModalInitialTime}
        initialPatientId={sessionModalInitialPatientId}
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

      <TherapistProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        initialName={therapistName}
        initialPhoto={therapistPhoto}
        isPaid={isPaid}
        onSave={handleSaveTherapistProfile}
        onUpgrade={() => {
          setActiveTab("settings");
          setShowSimulatedCheckout(true);
        }}
      />

    </div>
  );
}
