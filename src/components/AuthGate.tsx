import React, { useState, useEffect } from "react";
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  verifyPasswordResetCode, 
  confirmPasswordReset 
} from "firebase/auth";
import { auth } from "../firebase";
import { 
  Calendar, 
  MessageSquare, 
  ShieldCheck, 
  TrendingUp, 
  Brain, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  Loader2, 
  ChevronRight,
  ArrowLeft
} from "lucide-react";

interface AuthGateProps {
  onAuthenticated: (uid: string) => void;
  onLogout: () => void;
}

export default function AuthGate({ onAuthenticated, onLogout }: AuthGateProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isResetMode, setIsResetMode] = useState(false);
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  
  // Interactive UX states
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [forgotPasswordActive, setForgotPasswordActive] = useState(false);

  useEffect(() => {
    // Check if URL has oobCode for password reset
    const params = new URLSearchParams(window.location.search);
    const code = params.get("oobCode");
    const mode = params.get("mode");

    if (code && mode === "resetPassword") {
      setOobCode(code);
      setIsResetMode(true);
      // Validate code
      verifyPasswordResetCode(auth, code)
        .then(() => {
          setInfo("Código de redefinição verificado. Digite sua nova senha de acesso.");
        })
        .catch(() => {
          setError("O link de redefinição expirou ou já foi utilizado. Solicite um novo.");
        });
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email || !password) {
      setError("Por favor, preencha o e-mail e a senha.");
      return;
    }
    setIsSubmitLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      onAuthenticated(userCredential.user.uid);
    } catch (err: any) {
      console.error(err);
      if (err?.code === "auth/user-not-found" || err?.code === "auth/wrong-password" || err?.code === "auth/invalid-credential") {
        setError("E-mail ou senha incorretos. Por favor, verifique.");
      } else {
        setError(err?.message || "Falha ao realizar login. Verifique as credenciais.");
      }
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email) {
      setError("Digite o seu e-mail no campo acima para solicitar a redefinição.");
      return;
    }
    setIsSubmitLoading(true);
    try {
      const actionCodeSettings = {
        url: window.location.origin,
        handleCodeInApp: true,
      };
      await sendPasswordResetEmail(auth, email.trim(), actionCodeSettings);
      setInfo("Enviamos um e-mail de redefinição de senha! Verifique seu lixo eletrônico ou caixa de entrada.");
      setForgotPasswordActive(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Falha ao enviar e-mail de redefinição.");
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!newPassword || !confirmNewPassword) {
      setError("Preencha e confirme a nova senha.");
      return;
    }
    if (newPassword.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("As senhas informadas não coincidem.");
      return;
    }
    if (!oobCode) return;

    setIsSubmitLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setInfo("Senha alterada com sucesso! Redirecionando para o login...");
      setTimeout(() => {
        // Clear search params to exit reset state
        window.history.replaceState({}, document.title, window.location.pathname);
        setIsResetMode(false);
        setOobCode(null);
        setNewPassword("");
        setConfirmNewPassword("");
        setInfo(null);
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Erro ao salvar nova senha. Tente redefinir novamente.");
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleBackToLogin = () => {
    window.history.replaceState({}, document.title, window.location.pathname);
    setIsResetMode(false);
    setForgotPasswordActive(false);
    setOobCode(null);
    setError(null);
    setInfo(null);
  };

  return (
    <div className="min-h-screen w-full flex bg-[#F7F9FB]">
      <div className="w-full flex grid grid-cols-1 lg:grid-cols-12 min-h-screen">
        
        {/* Left Column - Beautiful Presentation Sidebar (Hidden on mobile) */}
        <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-br from-[#1E293B] to-[#3A5A6B] text-white p-12 flex-col justify-between relative overflow-hidden">
          {/* Subtle design element */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -ml-24 -mb-24 pointer-events-none"></div>
          
          {/* Content Top */}
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/25 pr-0.5">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-black tracking-tight text-white">Confirma</span>
              <span className="bg-white/10 text-white/90 text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider border border-white/10">Psi Cloud</span>
            </div>
          </div>

          {/* Core presentation content */}
          <div className="relative z-10 my-auto py-12">
            <h1 className="text-3xl font-black tracking-tight leading-tight max-w-sm">
              Sua prática clínica organizada, inteligente e sem faltas.
            </h1>
            <p className="mt-4 text-sm text-slate-300 max-w-sm leading-relaxed font-light">
              Uma ferramenta integrada sob medida para psicólogos gerenciarem presenças, prontuários, faturamento e integrações com total segurança e praticidade.
            </p>

            {/* Feature lists */}
            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3.5 group">
                <div className="mt-1 h-7 w-7 rounded-lg bg-white/15 flex items-center justify-center border border-white/15 shadow-sm text-white shrink-0">
                  <Calendar className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Agenda Sincronizada</h3>
                  <p className="text-xs text-slate-300 font-light mt-0.5">Calendário profissional rápido projetado para fluxo diário de consultório.</p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 group">
                <div className="mt-1 h-7 w-7 rounded-lg bg-white/15 flex items-center justify-center border border-white/15 shadow-sm text-white shrink-0">
                  <MessageSquare className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Lembretes por WhatsApp</h3>
                  <p className="text-xs text-slate-300 font-light mt-0.5">Reduza em até 80% as faltas dos pacientes avisando-os de forma automática.</p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 group">
                <div className="mt-1 h-7 w-7 rounded-lg bg-white/15 flex items-center justify-center border border-white/15 shadow-sm text-white shrink-0">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Prontuário e Evolução Clínico</h3>
                  <p className="text-xs text-slate-300 font-light mt-0.5">Registro protegido em nuvem obedecendo a todos os critérios éticos de sigilo.</p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 group">
                <div className="mt-1 h-7 w-7 rounded-lg bg-white/15 flex items-center justify-center border border-white/15 shadow-sm text-white shrink-0">
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Faturamentos Claros</h3>
                  <p className="text-xs text-slate-300 font-light mt-0.5">Histórico de pagamentos recebidos e vencidos de forma simples e visual.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Testimonial Quote Footer */}
          <div className="relative z-10 border-t border-white/10 pt-6">
            <p className="text-xs italic text-slate-300 font-light leading-relaxed">
              "O de longe melhor sistema para gerenciar minha agenda e o contato de confirmação sem perder tempo manual."
            </p>
            <p className="mt-2 text-xs font-black text-white uppercase tracking-wider">
              — Dra. Helena Souza, Psicóloga Clínica
            </p>
          </div>
        </div>

        {/* Right Column - Beautiful Authentication Card */}
        <div className="col-span-1 lg:col-span-7 flex flex-col justify-center items-center px-4 sm:px-8 lg:px-16 py-12 relative">
          
          <div className="w-full max-w-sm flex flex-col">
            {/* Header / Logo for mobile & small screens */}
            <div className="mb-8 text-center lg:text-left flex flex-col items-center lg:items-start">
              <div className="flex lg:hidden items-center gap-2 mb-6">
                <div className="h-9 w-9 rounded-xl bg-[#3A5A6B] flex items-center justify-center pr-0.5 shadow-md">
                  <Brain className="h-4.5 w-4.5 text-white" />
                </div>
                <span className="text-lg font-black tracking-tight text-[#0F172A]">Confirma</span>
              </div>

              <img src="/logo.png" alt="Confirma" className="h-[44px] object-contain mb-5" />
              
              <h2 className="text-2xl font-black text-brand-text tracking-tight mt-1">
                {isResetMode 
                  ? "Redefinir Senha" 
                  : forgotPasswordActive 
                    ? "Esqueci minha Senha" 
                    : "Portal do Psicólogo"
                }
              </h2>
              
              <p className="text-xs text-brand-muted mt-2 leading-relaxed">
                {isResetMode 
                  ? "Crie uma nova credencial robusta para assegurar seus dados clínicos" 
                  : forgotPasswordActive
                    ? "Insera o seu e-mail de cadastro para receber as orientações de redefinição"
                    : "Faça login com sua conta para acessar seu consultório e sincronizar confirmações na nuvem"
                }
              </p>
            </div>

            {/* Error notifications */}
            {error && (
              <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800 text-xs animate-in fade-in duration-200 shadow-sm flex items-start gap-2">
                <span className="text-base leading-none -mt-0.5">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Informative notifications */}
            {info && (
              <div className="mb-5 rounded-2xl border border-emerald-250 bg-emerald-50 p-4 font-bold text-emerald-800 text-xs animate-in fade-in duration-200 shadow-sm flex items-start gap-2">
                <span className="text-base leading-none -mt-0.5">💡</span>
                <span>{info}</span>
              </div>
            )}

            {/* -------------------- RESET PASSWORD INPUTS -------------------- */}
            {isResetMode && (
              <form onSubmit={handleSaveNewPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">Nova Senha</label>
                  <div className="relative mt-1.5">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                      <Lock className="h-4 w-4" />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo de 6 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-xl border border-brand-border bg-white pl-10 pr-10 py-3 text-sm font-semibold outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all text-brand-text placeholder-slate-400"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer text-slate-400 hover:text-brand-text"
                    >
                      {showPassword ? <EyeOff className="h-4 open w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">Confirmar Nova Senha</label>
                  <div className="relative mt-1.5">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                      <Lock className="h-4 w-4" />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Repita a senha idêntica"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full rounded-xl border border-brand-border bg-white pl-10 pr-10 py-3 text-sm font-semibold outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all text-brand-text placeholder-slate-400"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={isSubmitLoading}
                    className="w-full rounded-xl bg-brand-primary py-3 px-4 text-sm font-black text-white hover:opacity-95 transition-opacity flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-brand-primary/10"
                  >
                    {isSubmitLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
                      </>
                    ) : (
                      "Salvar Nova Senha"
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    disabled={isSubmitLoading}
                    className="w-full rounded-xl border border-brand-border bg-white hover:bg-slate-50 py-3 px-4 text-sm font-bold text-[#334155] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" /> Cancelar / Voltar ao Login
                  </button>
                </div>
              </form>
            )}

            {/* -------------------- FORGOT PASSWORD INPUTS -------------------- */}
            {!isResetMode && forgotPasswordActive && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">Seu E-mail de Cadastro</label>
                  <div className="relative mt-1.5">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                      <Mail className="h-4 w-4" />
                    </span>
                    <input
                      type="email"
                      placeholder="exemplo@clinica.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-brand-border bg-white pl-10 pr-4 py-3 text-sm font-semibold outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all text-brand-text placeholder-slate-400"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={isSubmitLoading}
                    className="w-full rounded-xl bg-[#3A5A6B] py-3 px-4 text-sm font-black text-white hover:opacity-95 transition-opacity flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-brand-primary/10"
                  >
                    {isSubmitLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
                      </>
                    ) : (
                      "Gerar link de redefinição"
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="w-full rounded-xl border border-brand-border bg-white hover:bg-slate-50 py-3 px-4 text-sm font-bold text-[#334155] transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" /> Voltar ao Login
                  </button>
                </div>
              </form>
            )}

            {/* -------------------- ORDINARY LOGIN INPUTS -------------------- */}
            {!isResetMode && !forgotPasswordActive && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">E-mail de acesso</label>
                  <div className="relative mt-1.5">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                      <Mail className="h-4 w-4" />
                    </span>
                    <input
                      type="email"
                      placeholder="exemplo@clinica.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-brand-border bg-white pl-10 pr-4 py-3 text-sm font-semibold outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all text-brand-text placeholder-slate-400"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">Senha</label>
                    <button
                      type="button"
                      onClick={() => setForgotPasswordActive(true)}
                      className="text-[11px] font-bold text-brand-primary hover:underline"
                    >
                      Esqueceu?
                    </button>
                  </div>
                  <div className="relative mt-1.5">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                      <Lock className="h-4 w-4" />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Insira sua senha de acesso"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-brand-border bg-white pl-10 pr-10 py-3 text-sm font-semibold outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all text-brand-text placeholder-slate-400"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer text-slate-400 hover:text-brand-text"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitLoading}
                    className="w-full rounded-xl bg-[#3A5A6B] py-3.5 px-4 text-sm font-black text-white hover:opacity-95 transition-opacity flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#3A5A6B]/20"
                  >
                    {isSubmitLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Verificando...
                      </>
                    ) : (
                      <>
                        Acessar Consultório
                        <ChevronRight className="h-4 w-4 mt-0.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Footer rights/credits - Pure, humble, standard design */}
            <p className="mt-12 text-center text-[10px] text-slate-400 tracking-wide font-medium relative z-10 select-none">
              &copy; {new Date().getFullYear()} Confirma Inc. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
