import React, { useState, useMemo } from "react";
import { 
  FileDown, 
  Copy, 
  Clipboard, 
  Search, 
  Printer, 
  Sparkles, 
  HelpCircle,
  FileText
} from "lucide-react";
import { AppState, Occurrence } from "../types";
import { ymdFromDate } from "../utils/helpers";

interface ReportsTabProps {
  state: AppState;
  occurrences: Occurrence[];
  today: Date;
}

export default function ReportsTab({
  state,
  occurrences,
  today
}: ReportsTabProps) {
  const [reportType, setReportType] = useState<"faturamento" | "assiduidade" | "comparecimento" | "espera">("faturamento");
  const [filterMonth, setFilterMonth] = useState<number>(today.getMonth());

  // Generate Report Text on the fly based on selections
  const generatedReportText = useMemo(() => {
    let text = "";
    const line = "========================================================\n";
    
    if (reportType === "faturamento") {
      const year = today.getFullYear();
      const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
      
      const firstDay = new Date(year, filterMonth, 1);
      const lastDay = new Date(year, filterMonth + 1, 0, 23, 59, 59);
      const monthOccs = occurrences.filter((o) => o.when >= firstDay && o.when <= lastDay);

      let prevista = 0;
      let recebida = 0;
      let pendente = 0;
      let perdida = 0;

      monthOccs.forEach((o) => {
        const baseSession = state.sessions.find(s => s.id === o.sessionId);
        const val = baseSession?.value !== undefined ? baseSession.value : 150;
        const finState = state.occurrenceFinancials?.[o.key] || {
          value: val,
          paymentMethod: baseSession?.paymentMethod || "PIX",
          financialStatus: baseSession?.financialStatus || "Pendente"
        };
        const clinStatus = state.statuses[o.key] || "aguardando";

        if (clinStatus === "cancelado" || clinStatus === "falta") {
          perdida += finState.value;
        } else {
          prevista += finState.value;
          if (finState.financialStatus === "Pago") {
            recebida += finState.value;
          } else if (finState.financialStatus === "Pendente") {
            pendente += finState.value;
          }
        }
      });

      text += `${line}`;
      text += `       RELATÓRIO FINANCEIRO E CONTÁBIL MENSAL\n`;
      text += `            CONFIRMA 2.0 - OPERAÇÃO PSI\n`;
      text += `${line}`;
      text += `Referência: ${monthNames[filterMonth]} de ${year}\n`;
      text += `Gerado em: ${new Date().toLocaleString("pt-BR")}\n`;
      text += `${line}\n`;
      text += `RESUMO FINANCEIRO:\n`;
      text += `--------------------------------------------------------\n`;
      text += `• Faturamento Estimado Previsto: R$ ${prevista}\n`;
      text += `• Faturamento Liquidado (Pago):  R$ ${recebida}\n`;
      text += `• Valores Pendentes de Cobrança: R$ ${pendente}\n`;
      text += `• Perda Financeira por Faltas:   R$ ${perdida}\n`;
      text += `--------------------------------------------------------\n\n`;
      text += `LANÇAMENTOS INDIVIDUAIS DO PERÍODO:\n`;
      text += `Dia/Mês  - Paciente            - Valor   - Status\n`;
      text += `--------------------------------------------------------\n`;
      
      monthOccs.forEach((o) => {
        const patient = state.patients.find(p => p.id === o.patientId);
        const baseSession = state.sessions.find(s => s.id === o.sessionId);
        const val = baseSession?.value !== undefined ? baseSession.value : 150;
        const finState = state.occurrenceFinancials?.[o.key] || {
          value: val,
          paymentMethod: baseSession?.paymentMethod || "PIX",
          financialStatus: baseSession?.financialStatus || "Pendente"
        };

        const dateStr = o.when.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        const namePadded = (patient?.name || "Desconhecido").padEnd(19).substring(0, 19);
        const valPadded = `R$ ${finState.value}`.padEnd(7);
        text += `${dateStr}    - ${namePadded} - ${valPadded} - ${finState.financialStatus}\n`;
      });

      if (monthOccs.length === 0) {
        text += `Nenhum lançamento no mês selecionado.\n`;
      }

    } else if (reportType === "assiduidade") {
      text += `${line}`;
      text += `          RELATÓRIO GERAL DE ASSIDUIDADE PSI\n`;
      text += `               E PRESENÇA DE PACIENTES\n`;
      text += `${line}`;
      text += `Gerado em: ${new Date().toLocaleString("pt-BR")}\n`;
      text += `${line}\n`;
      text += `Paciente             | Presenças | Faltas | Remarcações\n`;
      text += `--------------------------------------------------------\n`;

      state.patients.forEach((p) => {
        const pOccs = occurrences.filter((o) => o.patientId === p.id);
        let presenças = 0;
        let faltas = 0;
        let remarcar = 0;

        pOccs.forEach((o) => {
          const s = state.statuses[o.key] || "aguardando";
          if (s === "realizada" || (o.when < today && s === "confirmado")) presenças++;
          else if (s === "falta") faltas++;
          else if (s === "remarcar") remarcar++;
        });

        const namePadded = p.name.padEnd(20).substring(0, 20);
        const presPadded = String(presenças).padEnd(9);
        const faltasPadded = String(faltas).padEnd(6);
        text += `${namePadded} | ${presPadded} | ${faltasPadded} | ${remarcar}\n`;
      });

    } else if (reportType === "comparecimento") {
      const totalPast = occurrences.filter(o => o.when < today);
      let realizadas = 0;
      let faltas = 0;
      let remarcar = 0;
      let sResposta = 0;

      totalPast.forEach((o) => {
        const s = state.statuses[o.key] || "aguardando";
        if (s === "realizada" || s === "confirmado") realizadas++;
        else if (s === "falta") faltas++;
        else if (s === "remarcar") remarcar++;
        else if (s === "semresposta") sResposta++;
      });

      const totalAcoes = realizadas + faltas;
      const rate = totalAcoes > 0 ? Math.round((realizadas / totalAcoes) * 100) : 100;

      text += `${line}`;
      text += `       INDICADOR CLÍNICO DE FIDELIDADE (SHOW-UP RATE)\n`;
      text += `            CONFIRMA 2.0 - OPERAÇÃO PSI\n`;
      text += `${line}`;
      text += `Gerado em: ${new Date().toLocaleString("pt-BR")}\n`;
      text += `${line}\n`;
      text += `MÉTRICA GERAL DE ADERÊNCIA:\n`;
      text += `• Total de atendimentos concluídos:   ${realizadas}\n`;
      text += `• Total de faltas não justificadas:   ${faltas}\n`;
      text += `• Taxa de comparecimento cumulativa:  ${rate}%\n`;
      text += `--------------------------------------------------------\n\n`;
      text += `INFORME ANALÍTICO:\n`;
      if (rate >= 85) {
        text += `=> EXCELENTE: Sua taxa de comparecimento está acima do patamar de segurança de 85% recomendada.\n`;
      } else {
        text += `=> ATENÇÃO: Sua taxa está abaixo de 85%. Sugerimos ligar as automações de lembrete 3h antes da sessão para reduzir faltas.\n`;
      }

    } else if (reportType === "espera") {
      const waitlist = state.waitingList || [];
      text += `${line}`;
      text += `          STATUS ATUAL DA FILA DE ESPERA\n`;
      text += `${line}`;
      text += `Gerado em: ${new Date().toLocaleString("pt-BR")}\n`;
      text += `${line}\n`;
      text += `Atualmente existem ${waitlist.length} pacientes na fila.\n\n`;
      text += `LISTA GERAL DE ENTRADA:\n`;
      text += `--------------------------------------------------------\n`;
      text += `Nome                | Prioridade | Preferência\n`;
      text += `--------------------------------------------------------\n`;
      
      waitlist.forEach((w) => {
        const namePadded = w.name.padEnd(19).substring(0, 19);
        const prioPadded = (w.priority || "media").toUpperCase().padEnd(10);
        text += `${namePadded} | ${prioPadded} | ${w.availability}\n`;
      });
    }

    text += `\n${line}`;
    text += `             [ Fim do Relatório Corporativo ]\n`;
    text += `${line}`;
    return text;
  }, [reportType, filterMonth, state, occurrences, today]);

  // Action: Copy text to clipboard
  const handleCopyReport = () => {
    navigator.clipboard.writeText(generatedReportText).then(
      () => alert("Relatório copiado para a área de transferência!"),
      () => alert("Erro ao tentar copiar relatório.")
    );
  };

  // Action: Download text file
  const handleDownloadFile = () => {
    const blob = new Blob([generatedReportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-confirma-${reportType}-${new Date().toISOString().substring(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      
      {/* Intro */}
      <div className="px-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-brand-text">Gerador de Relatórios Consolidados</h2>
          <p className="text-xs text-brand-muted">Gere relatórios de auditoria, faturamento, assiduidade e lista de espera para impressão ou arquivo.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
        
        {/* Selection side (1 column) */}
        <div className="rounded-2xl border border-brand-border bg-white p-4 space-y-4 shadow-xs">
          <span className="text-[11px] font-black uppercase text-brand-muted block">Configurações de Geração</span>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-brand-muted">Tipo de Relatório</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as any)}
                className="mt-1 w-full rounded-xl border border-brand-border bg-white p-2 text-xs font-bold focus:border-brand-primary outline-hidden cursor-pointer"
              >
                <option value="faturamento">📊 Faturamento Mensal</option>
                <option value="assiduidade">👥 Assiduidade Individual</option>
                <option value="comparecimento">🎯 Taxa de Comparecimento</option>
                <option value="espera">⏳ Fila de Espera Clínica</option>
              </select>
            </div>

            {reportType === "faturamento" && (
              <div>
                <label className="block text-xs font-bold text-brand-muted">Mês de Referência</label>
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-brand-border bg-white p-2 text-xs focus:border-brand-primary outline-hidden cursor-pointer"
                >
                  {["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"].map((m, idx) => (
                    <option key={idx} value={idx}>{m}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-3 border-t">
            <button
              onClick={handleCopyReport}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand-border bg-white hover:bg-slate-50 py-2.5 text-xs font-black text-brand-text cursor-pointer"
            >
              <Clipboard className="h-4 w-4" /> Copiar Texto
            </button>
            <button
              onClick={handleDownloadFile}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary py-2.5 text-xs font-black text-white hover:opacity-95 cursor-pointer"
            >
              <FileDown className="h-4 w-4" /> Baixar em .TXT
            </button>
          </div>
        </div>

        {/* Display side (3 columns) */}
        <div className="md:col-span-3 rounded-2xl border border-brand-border bg-slate-900 p-4.5 text-slate-100 font-mono text-[11px] leading-relaxed shadow-lg overflow-x-auto min-h-[300px] select-all whitespace-pre">
          {generatedReportText}
        </div>

      </div>

    </div>
  );
}
