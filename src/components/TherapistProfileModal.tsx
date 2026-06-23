import React, { useState, useRef } from "react";
import { X, Camera, ShieldCheck, Sparkles, User, AlertTriangle } from "lucide-react";

interface TherapistProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialName: string;
  initialPhoto: string;
  isPaid: boolean;
  onSave: (name: string, photo: string) => Promise<void>;
  onUpgrade: () => void;
}

export default function TherapistProfileModal({
  isOpen,
  onClose,
  initialName,
  initialPhoto,
  isPaid,
  onSave,
  onUpgrade,
}: TherapistProfileModalProps) {
  const [name, setName] = useState(initialName || "Henrique Castro Santos");
  const [photo, setPhoto] = useState(initialPhoto || "");
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Preset Avatar Silhouettes for psychologist personalization
  const avatarPresets = [
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80", // Professional female terapeuta
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&q=80", // Professional male terapeuta
    "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=150&q=80", // Experienced clinical profile
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80", // Smiling clinical professional
  ];

  // Client-side quick compression to under 15KB so it syncs instantly to Firestore
  const processAndCompressFile = (file: File) => {
    setUploadError(null);
    if (!file.type.match(/image.*/)) {
      setUploadError("Por favor, selecione apenas arquivos de imagem.");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const targetWidth = 120;
        const targetHeight = 120;

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        if (ctx) {
          // Crop center square
          const size = Math.min(img.width, img.height);
          const sx = (img.width - size) / 2;
          const sy = (img.height - size) / 2;
          ctx.drawImage(img, sx, sy, size, size, 0, 0, targetWidth, targetHeight);
          
          try {
            const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
            setPhoto(dataUrl);
          } catch (err) {
            setUploadError("Falha ao otimizar a imagem. Tente outra foto.");
          }
        }
      };
    };
    reader.onerror = () => {
      setUploadError("Erro ao ler o arquivo selecionado.");
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAndCompressFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processAndCompressFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Por favor, insira o seu nome de cadastro profissional.");
      return;
    }
    setIsSaving(true);
    try {
      await onSave(name.trim(), photo);
      onClose();
    } catch (err) {
      alert("Houve um erro ao sincronizar seu perfil no banco.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 animate-in fade-in duration-200 backdrop-blur-xs">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-brand-border bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-brand-border bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-brand-primary">
              <User className="h-5 w-5" />
            </span>
            <h3 className="font-serif text-base font-black text-brand-text">
              Perfil do Profissional
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-brand-muted hover:bg-slate-100 hover:text-brand-text transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-left">
          
          {/* Section: Avatar */}
          <div className="flex flex-col items-center space-y-3.5">
            <div className="relative group">
              <div className="h-22 w-22 overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-md ring-2 ring-brand-primary/20 flex items-center justify-center text-3xl font-black text-brand-muted">
                {photo ? (
                  <img src={photo} alt={name} className="h-full w-full object-cover" />
                ) : (
                  name.substring(0, 2).toUpperCase()
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full border border-brand-border bg-white text-brand-muted hover:text-brand-primary shadow-xs flex items-center justify-center cursor-pointer hover:scale-105 transition-all"
                title="Trocar Foto"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Drag and drop prompt */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full border border-dashed rounded-2xl p-3 text-center transition-all cursor-pointer ${
                isDragOver 
                  ? "border-brand-primary bg-slate-50 text-brand-primary" 
                  : "border-brand-border bg-slate-50/50 hover:bg-slate-50 text-brand-muted hover:border-brand-muted"
              }`}
            >
              <p className="text-[11px] font-black uppercase tracking-wider">
                Arraste ou clique para enviar foto
              </p>
              <p className="text-[10px] mt-0.5 opacity-80 leading-tight">
                JPG, PNG. A foto será otimizada automaticamente.
              </p>
            </div>

            {uploadError && (
              <p className="text-[11px] text-red-600 font-bold">{uploadError}</p>
            )}

            {/* Presets Option */}
            <div className="w-full space-y-2">
              <p className="text-[10px] font-black text-brand-muted uppercase tracking-widest text-center">
                Ou use uma foto padrão profissional:
              </p>
              <div className="flex justify-center gap-3">
                {avatarPresets.map((presetUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPhoto(presetUrl);
                      setUploadError(null);
                    }}
                    className={`h-9 w-9 rounded-full overflow-hidden border-2 transition-all hover:scale-105 cursor-pointer ${
                      photo === presetUrl ? "border-brand-primary scale-105 shadow-sm" : "border-transparent opacity-80 hover:opacity-100"
                    }`}
                  >
                    <img src={presetUrl} alt="Preset professional" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <hr className="border-brand-border" />

          {/* Section: Name */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-brand-muted uppercase tracking-widest">
              Nome do Psicólogo(a)
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Henrique Castro Santos"
              className="w-full rounded-xl border border-brand-border bg-slate-50/50 px-3.5 py-2.5 text-xs font-black text-brand-text outline-none focus:border-brand-primary focus:bg-white focus:ring-4 focus:ring-brand-primary/10 transition-all placeholder-slate-400"
            />
          </div>

          {/* Section: Plan information & action */}
          <div className="rounded-2xl border border-brand-border bg-slate-50/50 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-brand-muted uppercase tracking-widest">
                Status da Conta:
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                isPaid 
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
              }`}>
                {isPaid ? <ShieldCheck className="h-3 w-3" /> : null}
                <span>{isPaid ? "Premium Vitalício" : "Plano Grátis"}</span>
              </span>
            </div>

            {isPaid ? (
              <p className="text-[11px] text-brand-muted leading-relaxed font-medium">
                Parabéns! Sua conta premium vitalícia está ativa. Você possui acesso ilimitado a prontuários, inteligência artificial e relatórios financeiros sem mensalidade.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-brand-muted leading-relaxed">
                  Você está no plano de testes gratuito com limitações de cadastro. Libere todo o potencial hoje e evite a futura assinatura mensal!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onUpgrade();
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-black py-2.5 shadow-sm active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Ativar Plano Vitalício • R$ 99,90</span>
                </button>
              </div>
            )}
          </div>

          {/* Action Footer Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-brand-border bg-white hover:bg-slate-50 text-brand-text font-black text-xs py-3 cursor-pointer text-center transition-all uppercase tracking-wide"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 rounded-xl bg-[#3A5A6B] hover:bg-[#2C4452] text-white font-black text-xs py-3 cursor-pointer text-center transition-all uppercase tracking-wide shadow-xs"
            >
              {isSaving ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
