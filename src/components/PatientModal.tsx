import React, { useState, useEffect } from "react";
import { 
  X, 
  Trash2, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  FolderHeart, 
  HeartHandshake, 
  Compass, 
  Calendar,
  Contact,
  UsersRound,
  ShieldCheck,
  Stethoscope
} from "lucide-react";
import { Patient } from "../types";

interface PatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (patientData: Partial<Patient>) => void;
  onDelete?: () => void;
  patient: Patient | null;
}

export default function PatientModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  patient,
}: PatientModalProps) {
  // Modal internal tabs
  const [activeTab, setActiveTab] = useState<"cadastro" | "anamnese">("cadastro");

  // State fields - Cadastro Pessoal
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [profession, setProfession] = useState("");
  const [civilStatus, setCivilStatus] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [billingInfo, setBillingInfo] = useState("");
  const [insuranceInfo, setInsuranceInfo] = useState("");
  
  // Extra social/demographic
  const [socialName, setSocialName] = useState("");
  const [cpf, setCpf] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");

  // Clinical Intake/Anamnese
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [familyHistory, setFamilyHistory] = useState("");
  const [recommendedBy, setRecommendedBy] = useState("");
  const [therapyGoals, setTherapyGoals] = useState("");
  const [habitsLifestyle, setHabitsLifestyle] = useState("");

  useEffect(() => {
    if (isOpen) {
      setActiveTab("cadastro"); // Reset to first tab on open
      if (patient) {
        setName(patient.name || "");
        
        // Format phone without '55' prefix for neat natural input
        let displayPhone = (patient.phone || "").replace(/\D/g, "");
        if (displayPhone.startsWith("55") && displayPhone.length > 10) {
          displayPhone = displayPhone.slice(2);
        }
        setPhone(displayPhone);
        
        setEmail(patient.email || "");
        setBirthDate(patient.birthDate || "");
        setProfession(patient.profession || "");
        setCivilStatus(patient.civilStatus || "");
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
      } else {
        // Clearing inputs for new patient creation
        setName("");
        setPhone("");
        setEmail("");
        setBirthDate("");
        setProfession("");
        setCivilStatus("");
        setAddress("");
        setNotes("");
        setBillingInfo("");
        setInsuranceInfo("");
        setSocialName("");
        setCpf("");
        setEmergencyContact("");

        setChiefComplaint("");
        setMedicalHistory("");
        setFamilyHistory("");
        setRecommendedBy("");
        setTherapyGoals("");
        setHabitsLifestyle("");
      }
    }
  }, [isOpen, patient]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim().replace(/\D/g, "");

    if (!cleanName) {
      alert("Por favor, informe o Nome Completo do paciente.");
      return;
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      alert("Por favor, informe um número de celular/WhatsApp válido com DDD (mínimo de 10 dígitos). Este campo é obrigatório.");
      return;
    }

    onSave({
      id: patient?.id || undefined, // undefined will trigger new ID creation in App.tsx
      name: cleanName,
      phone: cleanPhone,
      email: email.trim() || undefined,
      birthDate: birthDate || undefined,
      profession: profession.trim() || undefined,
      civilStatus: civilStatus || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      billingInfo: billingInfo.trim() || undefined,
      insuranceInfo: insuranceInfo.trim() || undefined,
      socialName: socialName.trim() || undefined,
      cpf: cpf.trim() || undefined,
      emergencyContact: emergencyContact.trim() || undefined,
      chiefComplaint: chiefComplaint.trim() || undefined,
      medicalHistory: medicalHistory.trim() || undefined,
      familyHistory: familyHistory.trim() || undefined,
      recommendedBy: recommendedBy.trim() || undefined,
      therapyGoals: therapyGoals.trim() || undefined,
      habitsLifestyle: habitsLifestyle.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl animate-in fade-in duration-200 flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-brand-border px-6 py-4.5 shrink-0">
          <div>
            <h3 className="text-base font-black text-brand-text uppercase tracking-wide">
              {patient ? `📝 Editar Ficha: ${patient.name}` : "🆕 Cadastrar Novo Paciente Completo"}
            </h3>
            <p className="mt-0.5 text-xs text-brand-muted font-bold leading-tight uppercase tracking-wider">
              {patient ? "Atualize as informações administrativas e anamnese terapêutica" : "Ficha integrada de dados pessoais, convênio e anamnese inicial"}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="rounded-lg p-1.5 text-brand-muted hover:bg-slate-100 hover:text-brand-text transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* METAB NAVIGATION TABS IN THE MODAL */}
        <div className="flex border-b border-brand-border bg-slate-50 px-6 shrink-0 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("cadastro")}
            className={`flex items-center gap-2 py-3.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
              activeTab === "cadastro"
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-brand-muted hover:text-brand-text"
            }`}
          >
            <Contact className="h-4 w-4" />
            <span>1. Informações de Cadastro</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("anamnese")}
            className={`flex items-center gap-2 py-3.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
              activeTab === "anamnese"
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-brand-muted hover:text-brand-text"
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>2. Investigação de Anamnese</span>
          </button>
        </div>

        {/* CONTAINER SCROLLABLE FORM BODY */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "cadastro" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* PRIMARY ESSENTIAL AREA (RED BOX IF MISSING MANDATORY VALUE) */}
              <div className="bg-brand-primary/[0.02] border border-brand-primary/10 rounded-2xl p-4 space-y-4">
                <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest flex items-center gap-1.5 leading-none">
                  <ShieldCheck className="h-3.5 w-3.5" /> Campos de Identificação Obrigatórios
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nome Completo */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700">
                      Nome Completo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex.: Carolina de Sousa"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3.5 py-2.5 text-xs outline-hidden focus:border-brand-primary focus:ring-1 focus:ring-brand-primary font-medium"
                      required
                    />
                  </div>

                  {/* WhatsApp/Celular */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700">
                      WhatsApp / Celular <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex.: 11999998888"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3.5 py-2.5 text-xs outline-hidden focus:border-brand-primary focus:ring-1 focus:ring-brand-primary font-medium"
                      required
                    />
                    <p className="mt-1 text-[9.5px] text-brand-muted leading-tight font-medium">
                      Obrigatório com DDD (sem o 55 principal). O DDI <b>55</b> nacional de WhatsApp do Brasil é inserido de forma automática.
                    </p>
                  </div>
                </div>
              </div>

              {/* DEMOGRAPHICS & CONTACT HIGHLIGHTS */}
              <div className="space-y-4">
                <span className="text-[10px] font-black text-brand-muted uppercase tracking-widest block leading-none">
                  📂 Dados Demográficos e Sociocomportamentais
                </span>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Nome Social */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700">Nome Social / Pronomes</label>
                    <input
                      type="text"
                      placeholder="Identidade de gênero informada"
                      value={socialName}
                      onChange={(e) => setSocialName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs outline-hidden focus:border-brand-primary font-medium"
                    />
                  </div>

                  {/* CPF */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700">CPF do Paciente</label>
                    <input
                      type="text"
                      placeholder="Apenas números ou formatado"
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs outline-hidden focus:border-brand-primary font-medium"
                    />
                  </div>

                  {/* Data de Nascimento */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700">Data de Nascimento</label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs outline-hidden focus:border-brand-primary font-medium"
                    />
                  </div>

                  {/* E-mail */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700">E-mail de Contato</label>
                    <input
                      type="email"
                      placeholder="paciente@provedor.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs outline-hidden focus:border-brand-primary font-medium"
                    />
                  </div>

                  {/* Profissão */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700">Ocupação / Profissão</label>
                    <input
                      type="text"
                      placeholder="Ex.: Engenheira, Estudante de TI"
                      value={profession}
                      onChange={(e) => setProfession(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs outline-hidden focus:border-brand-primary font-medium"
                    />
                  </div>

                  {/* Estado Civil */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700">Estado Civil</label>
                    <select
                      value={civilStatus}
                      onChange={(e) => setCivilStatus(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-xs outline-hidden focus:border-brand-primary font-medium cursor-pointer"
                    >
                      <option value="">Selecione...</option>
                      <option value="Solteiro(a)">Solteiro(a)</option>
                      <option value="Casado(a)">Casado(a)</option>
                      <option value="Em união estável">Em união estável</option>
                      <option value="Divorciado(a)">Divorciado(a)</option>
                      <option value="Viúvo(a)">Viúvo(a)</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* RESPONSIBILITY & FINANCIAL STRUCTURE */}
              <div className="space-y-4 pt-2">
                <span className="text-[10px] font-black text-brand-muted uppercase tracking-widest block leading-none">
                  🛡️ Segurança & Detalhes do Acordo Financeiro
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Emergency Contact */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700">Contato de Emergência</label>
                    <input
                      type="text"
                      placeholder="Ex.: Mãe (Marta) - (11) 98888-2222"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-xs outline-hidden focus:border-brand-primary font-medium"
                    />
                    <p className="mt-1 text-[9px] text-brand-muted">
                      Extremamente importante de se manter registrado para salvaguarda em crises.
                    </p>
                  </div>

                  {/* Convênio / Ajuste de Consulta */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700">Estratégia de Acordo / Particular / Convênio</label>
                    <input
                      type="text"
                      placeholder="Ex.: Particular Sócio, Reembolso Bradesco Saúde, etc."
                      value={insuranceInfo}
                      onChange={(e) => setInsuranceInfo(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-xs outline-hidden focus:border-brand-primary font-medium"
                    />
                  </div>

                  {/* Endereço Residencial */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-750">Endereço de Residência Completo</label>
                    <input
                      type="text"
                      placeholder="Rua, Número, Complemento, Bairro, Cidade / UF"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-xs outline-hidden focus:border-brand-primary font-medium"
                    />
                  </div>

                  {/* Anotações de Cobrança / Detalhes */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700">Observações Gerais e Notas Administrativas</label>
                    <textarea
                      placeholder="Horários preferenciais de cobrança, segundas vias de recibos, restrições ou lembretes rápidos"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-white p-3 text-xs outline-hidden focus:border-brand-primary min-h-[55px] font-medium"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeTab === "anamnese" && (
            <div className="space-y-5 animate-in fade-in duration-200">
              
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 flex gap-3 text-brand-text mb-4">
                <Stethoscope className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <h4 className="text-xs font-black uppercase text-amber-800 tracking-wide">Ficha Clínica de Psicologia</h4>
                  <p className="text-[10.5px] text-amber-900 leading-normal font-medium">
                    Preencher estes campos permite ao terapeuta registrar as primeiras impressões estruturadas na entrevista de triagem ou anamnese. Todos os dados são confidenciais e protegidos por sua conta de clinica.
                  </p>
                </div>
              </div>

              {/* Layout de anamnese em grid vertical de perguntas */}
              <div className="space-y-4">
                
                {/* Chief Complaint / Motivo da Consulta */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <FolderHeart className="h-4 w-4 text-brand-primary shrink-0" />
                    <label className="block text-xs font-black text-brand-text uppercase tracking-wider">
                      1. Queixa Principal e Motivo de Procura da Terapia
                    </label>
                  </div>
                  <p className="text-[10px] text-brand-muted leading-tight font-medium">
                    Descreva o sintoma clínico gerador, crise recente, ou insatisfação que motivou o agendamento inicial do paciente.
                  </p>
                  <textarea
                    placeholder="Ex.: Crises de pânico recorrentes que começaram há 3 meses logo após promoção no trabalho. Ansiedade generalizada, ideações com perfeccionismo excessivo..."
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-brand-border bg-white p-3.5 text-xs outline-hidden focus:border-brand-primary min-h-[90px] font-medium"
                  />
                </div>

                {/* Medical & Psychiatric History */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <HeartHandshake className="h-4 w-4 text-brand-primary shrink-0" />
                    <label className="block text-xs font-black text-brand-text uppercase tracking-wider">
                      2. Histórico Médico e Psiquiátrico (Diagnósticos & Medicamentos)
                    </label>
                  </div>
                  <p className="text-[10px] text-brand-muted leading-tight font-medium">
                    Paciente toma algum remédio psiquiátrico (Tarja Preta, Antidepressivos)? Diagnósticos prévios? Histórico de internações ou outras terapias?
                  </p>
                  <textarea
                    placeholder="Ex.: Faz uso de Venlafaxina 75mg de manhã com acompanhamento psiquiátrico com Dr. José. Já fez terapia junguiana por 1 ano em 2024. Sem histórico de comorbidades físicas graves."
                    value={medicalHistory}
                    onChange={(e) => setMedicalHistory(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-brand-border bg-white p-3.5 text-xs outline-hidden focus:border-brand-primary min-h-[80px] font-medium"
                  />
                </div>

                {/* Family and Relational Dynamic */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <UsersRound className="h-4 w-4 text-brand-primary shrink-0" />
                    <label className="block text-xs font-black text-brand-text uppercase tracking-wider">
                      3. Dinâmica Familiar e Historial de Relações
                    </label>
                  </div>
                  <p className="text-[10px] text-brand-muted leading-tight font-medium">
                    Suporte familiar, casamento, filhos, histórico de perdas parentais na infância ou predisposição hereditária a transtornos de afeto na família.
                  </p>
                  <textarea
                    placeholder="Ex.: Mora com companheiro há 2 anos, relação com pais é distante e conflituosa. Mãe possui histórico de depressão grave não tratada. Sem filhos."
                    value={familyHistory}
                    onChange={(e) => setFamilyHistory(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-brand-border bg-white p-3.5 text-xs outline-hidden focus:border-brand-primary min-h-[80px] font-medium"
                  />
                </div>

                {/* Indication / Recommended by */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Compass className="h-4 w-4 text-brand-primary shrink-0" />
                    <label className="block text-xs font-black text-brand-text uppercase tracking-wider">
                      4. Indicação / Encaminhamento (Como conheceu)
                    </label>
                  </div>
                  <textarea
                    placeholder="Ex.: Recomendado pelo psiquiatra Dr. José, ou encontrou de forma direta no perfil profissional do Instagram..."
                    value={recommendedBy}
                    onChange={(e) => setRecommendedBy(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-brand-border bg-white px-3.5 py-2.5 text-xs outline-hidden focus:border-brand-primary font-medium min-h-[48px]"
                  />
                </div>

                {/* Therapy Goals */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-brand-primary shrink-0" />
                    <label className="block text-xs font-black text-brand-text uppercase tracking-wider">
                      5. Objetivos Alinhados e Expectativas da Psicoterapia
                    </label>
                  </div>
                  <p className="text-[10px] text-brand-muted leading-tight font-medium">
                    O que o paciente mapeou como desejável conquistar nas sessões futuras (Ex.: aprender a pôr limites, regulação emocional, autoconhecimento)?
                  </p>
                  <textarea
                    placeholder="Ex.: Desenvolver estratégias de enfrentamento às crises no ambiente de trabalho para não precisar de afastamento; melhorar a autoconfiança para decisões de vida."
                    value={therapyGoals}
                    onChange={(e) => setTherapyGoals(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-brand-border bg-white p-3.5 text-xs outline-hidden focus:border-brand-primary min-h-[80px] font-medium"
                  />
                </div>

                {/* Habits Lifestyle (Sleep, Routines) */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-brand-primary shrink-0" />
                    <label className="block text-xs font-black text-brand-text uppercase tracking-wider">
                      6. Padrões de Sono, Alimentação, Exercícios & Substâncias
                    </label>
                  </div>
                  <p className="text-[10px] text-brand-muted leading-tight font-medium">
                    Como está a regulação circadiana? Insônia? Alimentação? Uso abusivo do álcool ou outras drogas?
                  </p>
                  <textarea
                    placeholder="Ex.: Queixa de insônia inicial grave (demora 2h para dormir). Toma café em excesso (5 xícaras/dia). Não pratica exercícios e consome bebida alcoólica socialmente nos fins de semana."
                    value={habitsLifestyle}
                    onChange={(e) => setHabitsLifestyle(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-brand-border bg-white p-3.5 text-xs outline-hidden focus:border-brand-primary min-h-[80px] font-medium"
                  />
                </div>

              </div>
              
            </div>
          )}
        </form>

        {/* CONTAINER STICKY BOTTOM BUTTONS BAR */}
        <div className="border-t border-brand-border bg-slate-50 px-6 py-4 shrink-0 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <div className="shrink-0 flex items-center">
            {onDelete && patient && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Excluir paciente "${patient.name}"? Isso apagará definitivamente TODAS as sessões de agenda vinculadas.`)) {
                    onDelete();
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-black text-red-700 hover:bg-red-100 cursor-pointer uppercase tracking-wider transition-colors"
              >
                <Trash2 className="h-4 w-4" /> Excluir Cadastro Definitivo
              </button>
            )}
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-brand-border bg-white py-2.5 px-4 text-xs font-black text-brand-text hover:bg-slate-100 cursor-pointer sm:flex-initial uppercase tracking-wide transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 rounded-xl bg-brand-primary py-2.5 px-6 text-xs font-black text-white hover:opacity-90 active:translate-y-[0.5px] cursor-pointer sm:flex-initial uppercase tracking-wider transition-all shadow-xs"
            >
              {patient ? "Salvar Ficha do Paciente" : "Criar Novo Cadastro"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
