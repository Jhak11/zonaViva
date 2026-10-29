// ──────────────────────────────────────────────────────────────────────
//  V1 – Onboarding / Bienvenida
//  Solo se muestra si el usuario no ha completado el onboarding.
//  3 pantallas: concepto → privacidad → alias temporal
// ──────────────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useIdentityStore } from "@/stores/identityStore";
import { generateAlias } from "@/modules/identity";
import { APP_NAME, MAX_ALIAS_LENGTH } from "@zonaviva/protocol";

const TOTAL_STEPS = 3;

export default function BienvenidaPage() {
  const [step, setStep] = useState(0);
  const [alias, setAlias] = useState(() => generateAlias());
  const [aliasError, setAliasError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const { isOnboardingCompleted, completeOnboarding } = useIdentityStore();

  // Si el onboarding ya se completó previamente, ir a inicio
  useEffect(() => {
    if (isOnboardingCompleted) {
      navigate("/", { replace: true });
    }
  }, [isOnboardingCompleted, navigate]);

  function handleAliasChange(val: string) {
    if (val.length > MAX_ALIAS_LENGTH) return;
    setAlias(val);
    setAliasError(val.trim().length < 1 ? "El alias no puede estar vacío." : "");
  }

  async function handleFinish() {
    if (!accepted || isSubmitting) return;

    const trimmed = alias.trim();
    if (trimmed.length < 1) {
      setAliasError("El alias no puede estar vacío.");
      return;
    }

    setIsSubmitting(true);
    setAliasError("");

    try {
      await completeOnboarding(trimmed);
      navigate("/", { replace: true });
    } catch {
      setIsSubmitting(false);
      setAliasError("No se pudo inicializar la sesión en tu navegador. Intenta nuevamente.");
    }
  }

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col justify-between">
      {/* Barra de progreso */}
      <div className="w-full h-1 bg-surface-2 flex-none">
        <div
          className="h-full bg-brand-500 transition-all duration-300"
          style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      {/* Contenido dinámico según paso */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 text-center max-w-md mx-auto w-full">
        {step === 0 && <StepConcepto onNext={() => setStep(1)} />}
        {step === 1 && (
          <StepPrivacidad
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <StepAlias
            alias={alias}
            aliasError={aliasError}
            accepted={accepted}
            isSubmitting={isSubmitting}
            onAliasChange={handleAliasChange}
            onRegenerate={() => setAlias(generateAlias())}
            onAcceptChange={setAccepted}
            onFinish={handleFinish}
            onBack={() => setStep(1)}
          />
        )}
      </div>

      {/* Indicadores de puntos inferiores */}
      <div className="flex justify-center gap-2 pb-8 flex-none">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i === step ? "bg-brand-400 scale-110" : "bg-surface-2"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ── Paso 1: Concepto ──────────────────────────────────────────────────

function StepConcepto({ onNext }: { onNext: () => void }) {
  return (
    <div className="animate-fade-in w-full">
      <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-brand-500/20 flex items-center justify-center shadow-lg shadow-brand-500/10">
        <span className="text-4xl">📍</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
        Bienvenido a <span className="text-brand-400">{APP_NAME}</span>
      </h1>
      <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
        Una red social donde las conversaciones suceden por <strong className="text-slate-200">proximidad física</strong>.
        Habla con personas en la misma plaza, mercado o calle, de forma anónima y sin registrarte.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-8 text-xs">
        <Feature emoji="🏘️" label="Por proximidad" />
        <Feature emoji="🎭" label="Sin registro" />
        <Feature emoji="⚡" label="En tiempo real" />
      </div>

      <button
        onClick={onNext}
        className="w-full py-3.5 rounded-2xl bg-brand-500 hover:bg-brand-400 text-white font-semibold text-base transition-colors shadow-lg shadow-brand-500/25 active:scale-[0.99]"
      >
        Empezar
      </button>
    </div>
  );
}

// ── Paso 2: Privacidad ────────────────────────────────────────────────

function StepPrivacidad({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="animate-fade-in w-full">
      <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-emerald-500/20 flex items-center justify-center shadow-lg shadow-emerald-500/10">
        <span className="text-4xl">🔒</span>
      </div>

      <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Tu privacidad</h2>
      <p className="text-slate-400 text-xs sm:text-sm mb-5">
        Diseñado para proteger tu identidad y ubicación.
      </p>

      <div className="space-y-2.5 text-left mb-6 text-xs sm:text-sm">
        <PrivacyItem
          icon="✅"
          label="Tu ubicación GPS exacta nunca sale de este dispositivo"
          color="text-emerald-300"
        />
        <PrivacyItem
          icon="✅"
          label="No guardamos mensajes en el servidor. Solo los retransmite"
          color="text-emerald-300"
        />
        <PrivacyItem
          icon="✅"
          label="Sin datos personales: ni nombre real, correo ni teléfono"
          color="text-emerald-300"
        />
        <PrivacyItem
          icon="⚠️"
          label="El servidor ve tu IP mientras estás conectado (sin guardarla)"
          color="text-amber-300"
        />
      </div>

      <div className="flex gap-2.5">
        <button
          onClick={onBack}
          className="w-1/3 py-3.5 rounded-2xl bg-surface-2 text-slate-300 font-semibold text-sm hover:bg-surface-2/80 transition-colors"
        >
          Atrás
        </button>
        <button
          onClick={onNext}
          className="w-2/3 py-3.5 rounded-2xl bg-brand-500 hover:bg-brand-400 text-white font-semibold text-sm transition-colors shadow-lg shadow-brand-500/25 active:scale-[0.99]"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

// ── Paso 3: Alias Temporal ────────────────────────────────────────────

interface StepAliasProps {
  alias: string;
  aliasError: string;
  accepted: boolean;
  isSubmitting: boolean;
  onAliasChange: (val: string) => void;
  onRegenerate: () => void;
  onAcceptChange: (val: boolean) => void;
  onFinish: () => void;
  onBack: () => void;
}

function StepAlias({
  alias,
  aliasError,
  accepted,
  isSubmitting,
  onAliasChange,
  onRegenerate,
  onAcceptChange,
  onFinish,
  onBack,
}: StepAliasProps) {
  return (
    <div className="animate-fade-in w-full">
      <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-purple-500/20 flex items-center justify-center shadow-lg shadow-purple-500/10">
        <span className="text-4xl">🎭</span>
      </div>

      <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">Tu alias temporal</h2>
      <p className="text-slate-400 text-xs sm:text-sm mb-4">
        Así te verán los demás usuarios. Puedes regenerarlo o editarlo cuando quieras.
      </p>

      {/* Input de alias */}
      <div className="flex gap-2 mb-1">
        <input
          type="text"
          value={alias}
          onChange={(e) => onAliasChange(e.target.value)}
          maxLength={MAX_ALIAS_LENGTH}
          disabled={isSubmitting}
          className="flex-1 px-4 py-3 rounded-xl bg-surface-1 border border-surface-2 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-sm transition-colors"
          placeholder="Tu alias temporal..."
        />
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isSubmitting}
          className="px-3.5 py-3 rounded-xl bg-surface-1 border border-surface-2 text-slate-300 hover:bg-surface-2 text-base transition-colors"
          title="Generar otro alias"
        >
          🔀
        </button>
      </div>

      {aliasError ? (
        <p className="text-red-400 text-xs text-left mb-2">{aliasError}</p>
      ) : (
        <p className="text-slate-500 text-[11px] text-right mb-3">
          {alias.length}/{MAX_ALIAS_LENGTH} caracteres
        </p>
      )}

      {/* Checkbox de aceptación */}
      <label className="flex items-start gap-2.5 mb-5 cursor-pointer text-left p-2.5 rounded-xl bg-surface-1/50 border border-surface-2/40">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onAcceptChange(e.target.checked)}
          disabled={isSubmitting}
          className="mt-0.5 w-4 h-4 rounded accent-brand-500 flex-none"
        />
        <span className="text-slate-400 text-xs leading-snug">
          Acepto las condiciones de uso y confirmo que entiendo que los mensajes se comparten con la comunidad local.
        </span>
      </label>

      {/* Botones de acción */}
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="w-1/3 py-3.5 rounded-2xl bg-surface-2 text-slate-300 font-semibold text-sm hover:bg-surface-2/80 transition-colors"
        >
          Atrás
        </button>
        <button
          type="button"
          onClick={onFinish}
          disabled={!accepted || alias.trim().length < 1 || isSubmitting}
          className="w-2/3 py-3.5 rounded-2xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all shadow-lg shadow-brand-500/25 active:scale-[0.99] flex items-center justify-center"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Iniciando…
            </span>
          ) : (
            "Entrar a ZonaViva"
          )}
        </button>
      </div>
    </div>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────

function Feature({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-surface-1 border border-surface-2/50">
      <span className="text-xl">{emoji}</span>
      <span className="text-slate-400 text-[11px] font-medium">{label}</span>
    </div>
  );
}

function PrivacyItem({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-surface-1 border border-surface-2/40">
      <span className="text-base flex-none">{icon}</span>
      <span className={`text-xs ${color} leading-snug`}>{label}</span>
    </div>
  );
}
