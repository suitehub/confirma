export interface FormResponse {
  formId: string;
  formTitle: string;
  date: string;
  answers: { [fieldId: string]: any };
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  email?: string;
  birthDate?: string;
  profession?: string;
  civilStatus?: string;
  address?: string;
  notes?: string; // Observações
  billingInfo?: string; // Informações de cobrança
  insuranceInfo?: string; // Informações de convênio
  formResponses?: FormResponse[];
  
  // Dados demográficos e sociais adicionais
  socialName?: string;
  cpf?: string;
  emergencyContact?: string; // Nome e telefone do contato de emergência

  // Dados Clínicos / Psicologia Anamnese
  chiefComplaint?: string;          // Queixa Principal
  medicalHistory?: string;          // Histórico Médico / Psiquiátrico / Medicações
  familyHistory?: string;           // Histórico Familiar / Dinâmica Relacional
  recommendedBy?: string;           // Indicação / Encaminhamento
  therapyGoals?: string;            // Objetivos da terapia / Expectativas
  habitsLifestyle?: string;         // Sono, alimentação, rotinas e hábitos
}

export interface Session {
  id: string;
  patientId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  type: 'avulsa' | 'semanal';
  local: string; // "Presencial" | "Online"
  note?: string;
  createdAt?: number;
  value?: number;
  paymentMethod?: string; // e.g. "PIX", "Dinheiro", "Cartão", "Transferência", "Convênio", "Outro"
  financialStatus?: string; // e.g. "Pago", "Pendente", "Isento", "Cancelado"
}

export interface Templates {
  confirmarDefault: string;
  reforco: string;
  semresposta: string;
  cobrarDefault?: string;
}

export interface CustomConfirmTemplate {
  id: string;
  name: string;
  text: string;
}

export interface WaitingPatient {
  id: string;
  name: string;
  phone: string;
  availability: string; // e.g. "Segunda manhã", "Terça tarde"
  notes?: string;
  priority?: "alta" | "media" | "baixa";
  createdAt: number;
}

export interface FormField {
  id: string;
  type: "texto_curto" | "texto_longo" | "escala" | "escolha" | "checkbox";
  label: string;
  options?: string[]; // Para múltipla escolha
}

export interface FormTemplate {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
}

export interface AutomationTemplate {
  id: string;
  name: string;
  text: string;
  enabled: boolean;
  trigger: "48h_antes" | "24h_antes" | "3h_antes" | "pos_sessao" | "pos_vencimento" | "sem_sessao_futura" | "em_risco" | "aniversario";
}

export interface Evolution {
  id: string;
  patientId: string;
  sessionId?: string; // linked to a specific session
  occurrenceKey?: string; // linked to a specific occurrence (e.g. sessionId__YYYY-MM-DD__HH:MM)
  date: string; // YYYY-MM-DD
  mood: number; // Scale 1 to 10
  topics: string[]; // e.g. ["ansiedade", "relacionamento"]
  summary: string;
  nextSteps: string;
  createdAt: number;
}

export interface AppState {
  patients: Patient[];
  sessions: Session[];
  statuses: { [occurrenceKey: string]: string };
  templates: Templates;
  customConfirmTemplates: CustomConfirmTemplate[];
  waitingList?: WaitingPatient[];
  formsList?: FormTemplate[];
  automations?: AutomationTemplate[];
  occurrenceFinancials?: { [occurrenceKey: string]: { value: number; paymentMethod: string; financialStatus: string } };
  theme?: "light" | "dark";
  evolutions?: Evolution[];
}

export interface Occurrence {
  key: string; // sessionId__YYYY-MM-DD__HH:MM
  sessionId: string;
  patientId: string;
  when: Date;
  local: string;
  note?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}
