import { Patient, Session, Occurrence } from "../types";

export const pad2 = (n: number) => String(n).padStart(2, "0");

export function formatLongBR(d: Date): string {
  const weekdays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const months = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho", 
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];
  return `${weekdays[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]}`;
}

export function formatShortDay(d: Date): string {
  const w = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const m = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${w[d.getDay()]}, ${pad2(d.getDate())} ${m[d.getMonth()]} ${d.getFullYear()}`;
}

export function hmFromDate(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function ymdFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseYmdHm(ymd: string, hm: string): Date {
  const [Y, M, D] = ymd.split("-").map(Number);
  const [h, mi] = hm.split(":").map(Number);
  return new Date(Y, M - 1, D, h, mi, 0, 0);
}

export function normalizePhone(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  return "55" + digits;
}

export function tryStripEmoji(s: string): string {
  try {
    return s.replace(/\p{Extended_Pictographic}/gu, "");
  } catch {
    return s;
  }
}

export function sanitizeMessage(text: string): string {
  let t = String(text || "");
  t = t.replace(/\r?\n|\r/g, " ");
  t = tryStripEmoji(t);
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

export function waLink(phone: string, text: string): string {
  const p = normalizePhone(phone);
  const cleaned = sanitizeMessage(text);
  const encoded = encodeURIComponent(cleaned);
  return `https://wa.me/${p}?text=${encoded}`;
}

export function replaceVars(tpl: string, vars: { nome: string; dia: string; hora: string }): string {
  return String(tpl || "")
    .replaceAll("{nome}", vars.nome || "")
    .replaceAll("{dia}", vars.dia || "")
    .replaceAll("{hora}", vars.hora || "");
}

export function formatPhone(p: string): string {
  const d = String(p || "").replace(/\D/g, "");
  if (d.length < 12) return p;
  const cc = d.slice(0, 2);
  const ddd = d.slice(2, 4);
  const rest = d.slice(4);
  
  if (rest.length === 9) {
    return `+${cc} (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  return `+${cc} (${ddd}) ${rest}`;
}

export function buildOccurrences(
  patients: Patient[],
  sessions: Session[],
  today: Date
): Occurrence[] {
  const occ: Occurrence[] = [];
  
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 90);

  for (const s of sessions) {
    // Only generate occurrences if active patient exists
    if (!patients.some((p) => p.id === s.patientId)) continue;

    if (s.type === "semanal") {
      const base = parseYmdHm(s.date, s.time);
      let d = new Date(base);
      while (d < start) {
        d.setDate(d.getDate() + 7);
      }
      while (d <= end) {
        occ.push({
          key: `${s.id}__${ymdFromDate(d)}__${hmFromDate(d)}`,
          sessionId: s.id,
          patientId: s.patientId,
          when: new Date(d),
          local: s.local,
          note: s.note,
        });
        d = new Date(d);
        d.setDate(d.getDate() + 7);
      }
    } else {
      const d = parseYmdHm(s.date, s.time);
      if (d >= start && d <= end) {
        occ.push({
          key: `${s.id}__${ymdFromDate(d)}__${hmFromDate(d)}`,
          sessionId: s.id,
          patientId: s.patientId,
          when: new Date(d),
          local: s.local,
          note: s.note,
        });
      }
    }
  }

  // Sort chronologically
  occ.sort((a, b) => a.when.getTime() - b.when.getTime());
  return occ;
}

