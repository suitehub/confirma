import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Administrative IA (Gemini API)
  app.post("/api/gemini/analyze", async (req, res) => {
    try {
      const { prompt, clinicState } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "Chave GEMINI_API_KEY não configurada no servidor." });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

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

      const contents = `Olá assistente administrativo! Analise os dados da minha clínica a seguir e atenda à solicitação do psicólogo:

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

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Erro na rota do Gemini:", error);
      res.status(500).json({ error: error.message || "Erro desconhecido processando solicitação da IA." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
