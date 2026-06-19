import React, { useState, useEffect } from "react";
import { X, Trash2, Calendar, Clipboard } from "lucide-react";
import { Patient, Session } from "../types";
import { ymdFromDate } from "../utils/helpers";

interface SessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sessionDraft: Omit<Session, "id" | "createdAt">) => void;
  onDelete?: (id: string) => void;
  editingSession: Session | null;
  patients: Patient[];
  initialDate?: string;
  initialTime?: string;
}

export default function SessionModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editingSession,
  patients,
  initialDate,
  initialTime,
}: SessionModalProps) {
  const [patientId, setPatientId] = useState("");
  const [type, setType] = useState<'avulsa' | 'semanal'>("avulsa");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [local, setLocal] = useState("Presencial");
  const [note, setNote] = useState("");
  const [value, setValue] = useState<number>(150);
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [financialStatus, setFinancialStatus] = useState("Pendente");

  useEffect(() => {
    if (isOpen) {
      if (editingSession) {
        setPatientId(editingSession.patientId);
        setType(editingSession.type);
        setDate(editingSession.date);
        setTime(editingSession.time);
        setLocal(editingSession.local);
        setNote(editingSession.note || "");
        setValue(editingSession.value !== undefined ? editingSession.value : 150);
        setPaymentMethod(editingSession.paymentMethod || "PIX");
        setFinancialStatus(editingSession.financialStatus || "Pendente");
      } else {
        // Defaults for new session
        setPatientId(patients.length > 0 ? patients[0].id : "");
        setType("avulsa");
        setDate(initialDate || ymdFromDate(new Date()));
        setTime(initialTime || "09:00");
        setLocal("Presencial");
        setNote("");
        setValue(150);
        setPaymentMethod("PIX");
        setFinancialStatus("Pendente");
      }
    }
  }, [isOpen, editingSession, patients, initialDate, initialTime]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      alert("Por favor, selecione um paciente.");
      return;
    }
    if (!date || !time) {
      alert("Selecione a data e o horário.");
      return;
    }
    onSave({
      patientId,
      date,
      time,
      type,
      local,
      note: note.trim(),
      value: Number(value) || 0,
      paymentMethod,
      financialStatus
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl animate-in fade-in duration-200">
        <div className="flex items-center justify-between border-b border-brand-border px-6 py-4">
          <div>
            <h3 className="text-lg font-black text-brand-text">
              {editingSession ? "Editar Sessão" : "Programar Sessão"}
            </h3>
            <p className="mt-1 text-xs text-brand-muted">
              Crie uma sessão avulsa ou semanal (ocorrências recorrentes por 90 dias)
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="rounded-lg p-1.5 text-brand-muted hover:bg-slate-100 hover:text-brand-text transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-brand-muted">Paciente</label>
              {patients.length === 0 ? (
                <div className="mt-1 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  <span>Nenhum paciente cadastrado</span>
                </div>
              ) : (
                <select
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-sm outline-hidden focus:border-brand-primary cursor-pointer"
                  required
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-muted">Tipo de Frequência</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'avulsa' | 'semanal')}
                className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-sm outline-hidden focus:border-brand-primary cursor-pointer"
              >
                <option value="avulsa">Avulsa (Apenas este dia)</option>
                <option value="semanal">Semanal (Toda semana)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-bold text-brand-muted">Data Inicial</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-sm outline-hidden focus:border-brand-primary"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-muted">Horário</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-sm outline-hidden focus:border-brand-primary"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-muted">Local</label>
              <select
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-sm outline-hidden focus:border-brand-primary cursor-pointer"
              >
                <option value="Presencial">🏢 Presencial</option>
                <option value="Online">💻 Online</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-muted">Observação (Opcional)</label>
            <input
              type="text"
              placeholder="Ex.: sala 4, link do Google Meet, ou restrições do paciente"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-sm outline-hidden focus:border-brand-primary"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-brand-border/40 pt-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-bold text-brand-muted">Valor da Sessão (R$)</label>
              <input
                type="number"
                placeholder="Ex.: 150"
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-sm outline-hidden focus:border-brand-primary"
                min="0"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-muted">Forma de Pagamento</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-sm outline-hidden focus:border-brand-primary cursor-pointer"
              >
                <option value="PIX">⚡ PIX</option>
                <option value="Dinheiro">💵 Dinheiro</option>
                <option value="Cartão">💳 Cartão</option>
                <option value="Transferência">🏦 Transferência</option>
                <option value="Convênio">🩺 Convênio</option>
                <option value="Outro">⚙️ Outro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-muted">Status Financeiro</label>
              <select
                value={financialStatus}
                onChange={(e) => setFinancialStatus(e.target.value)}
                className="mt-1 w-full rounded-xl border border-brand-border bg-white px-3 py-2.5 text-sm outline-hidden focus:border-brand-primary cursor-pointer"
              >
                <option value="Pendente">⏱️ Pendente</option>
                <option value="Pago">✅ Pago</option>
                <option value="Isento">🎁 Isento</option>
                <option value="Cancelado">❌ Cancelado</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-between">
            {editingSession && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Deseja realmente excluir esta sessão base do sistema?")) {
                    onDelete(editingSession.id);
                  }
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 hover:bg-red-100 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" /> Excluir Sessão
              </button>
            ) : (
              <div />
            )}

            <div className="flex gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-brand-border bg-slate-50 py-2.5 px-4 text-sm font-bold text-brand-text hover:bg-slate-100 cursor-pointer sm:flex-initial"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={patients.length === 0}
                className="flex-1 rounded-xl bg-brand-primary py-2.5 px-4 text-sm font-black text-white hover:opacity-95 disabled:opacity-50 cursor-pointer sm:flex-initial"
              >
                Salvar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
