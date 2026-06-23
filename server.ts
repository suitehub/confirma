import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import cors from "cors";
import Stripe from "stripe";
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

dotenv.config();

// Safe Lazy Initialization for Stripe
let stripeClient: Stripe | null = null;
function getStripeInstance() {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key) {
      stripeClient = new Stripe(key, {
        apiVersion: "2025-02-18-preview" as any,
      });
    } else {
      console.warn("STRIPE_SECRET_KEY is not defined. Stripe endpoints will run in Sandbox/Simulated mode.");
    }
  }
  return stripeClient;
}

// Safe Lazy Initialization for Firebase Admin
let adminApp: any = null;
function getFirebaseAdmin() {
  if (!adminApp) {
    try {
      if (getApps().length === 0) {
        adminApp = initializeApp();
      } else {
        adminApp = getApp();
      }
    } catch (e) {
      try {
        const projectId = process.env.FIREBASE_PROJECT_ID || "ai-studio-6705d0b3-c449-43ab-b3b7-f163d0af0b55";
        adminApp = initializeApp({
          projectId: projectId,
        });
      } catch (err) {
        console.warn("Firebase Admin failed to initialize. Webhooks will not be able to write directly to Firestore unless configured properly.", err);
      }
    }
  }
  return adminApp;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());

  // Support capturing raw body for Stripe signature verification
  app.use(express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    }
  }));

  // Endpoint to check Stripe configuration
  app.get("/api/stripe/config", (req, res) => {
    res.json({
      stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
    });
  });

  // Create Checkout Session
  app.post("/api/stripe/create-checkout-session", async (req, res) => {
    try {
      const { userId, email } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "userId é obrigatório" });
      }

      const stripe = getStripeInstance();
      const origin = req.headers.origin || process.env.APP_URL || "http://localhost:3000";

      // If Stripe is not configured, run in Sandbox/Simulated mode
      if (!stripe) {
        console.log(`[Stripe Sandbox] Creating simulated checkout for user ${userId}`);
        const simulatedUrl = `${origin}?simulated_success=true&user_id=${userId}`;
        return res.json({ url: simulatedUrl });
      }

      console.log(`[Stripe API] Creating real checkout session for user ${userId} (${email || "no-email"})`);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: {
                name: "Confirma - Acesso Vitalício",
                description: "Liberação permanente de todas as funcionalidades de gestão clínica, relatórios IA e controle financeiro.",
              },
              unit_amount: 9990, // R$ 99.90 (9990 centavos)
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${origin}?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}?cancel=true`,
        customer_email: email || undefined,
        metadata: {
          userId: userId,
        },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Erro ao criar checkout session de Stripe:", error);
      res.status(500).json({ error: error.message || "Falha ao gerar o Link de Pagamento." });
    }
  });

  // Stripe Webhook Endpoint
  app.post("/api/stripe/webhook", async (req: any, res) => {
    const stripe = getStripeInstance();
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: any;

    try {
      if (stripe && webhookSecret && sig) {
        // Real verification
        event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
      } else {
        // Skip verification for developer convenience in dev mode
        event = req.body;
      }

      // Handle the event
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const userId = session.metadata?.userId;

        if (userId) {
          console.log(`[Stripe Webhook] Pagamento confirmado para o usuário ${userId}`);
          
          // Use firebase-admin to update the Firestore document flag
          const adminApp = getFirebaseAdmin();
          if (adminApp) {
            const dbAdmin = getFirestore(adminApp);
            await dbAdmin.collection("users").doc(userId).set({
              isPaid: true,
              paidAt: FieldValue.serverTimestamp()
            }, { merge: true });
            console.log(`[Stripe Webhook] Usuário ${userId} marcado como PAGO no Firestore.`);
          } else {
            console.warn(`[Stripe Webhook] Firebase Admin não inicializado. Não foi possível atualizar usuário ${userId} diretamente no banco.`);
          }
        } else {
          console.warn("[Stripe Webhook] Nenhuma userId encontrada nos metadados da sessão.");
        }
      }

      res.json({ received: true });
    } catch (err: any) {
      console.error(`[Stripe Webhook Error] ${err.message}`);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });

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
