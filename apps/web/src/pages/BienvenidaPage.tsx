// ──────────────────────────────────────────────────────────────────────
//  V1 – Onboarding / Bienvenida
//  Solo se muestra la primera vez (sin sesión).
//  3 pantallas: concepto → privacidad → alias
// ──────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIdentityStore } from "@/stores/identityStore";
import { generateAlias } from "@/modules/identity";
import { APP_NAME } from "@zonaviva/protocol";
import { MAX_ALIAS_LENGTH } from "@zonaviva/protocol";

const TOTAL_STEPS = 3;

export default function BienvenidaPage() {
  const [step, setStep] = useState(0);
  const [alias, setAlias] = useState(() => generateAlias());
  const [aliasError, setAliasError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const navigate = useNavigate();
  const { session, setAlias: saveAlias } = useIdentityStore();

  // Si ya hay sesión (raro llegar aquí), redirigir
  if (session) {
    navigate("/", { replace: true });
    return null;
  }

  function handleAliasChange(val: string) {
    if (val.length > MAX_ALIAS_LENGTH) return;
    setAlias(val);
    setAliasError(val.trim().length < 1 ? "El alias no puede estar vacío." : "");
  }

  async function handleFinish() {
    if (!accepted) return;
    if (alias.trim().length < 1) {
      setAliasError("El alias no puede estar vacío.");
      return;
    }
    // La sesión ya se generó en initSession (App.tsx).
    // Solo actualizamos el alias si el usuario lo cambió.
    saveAlias(alias.trim());
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      {/* Barra de progreso */}
      <div className="w-full h-1 bg-surface-2">
        <div
          className="h-full bg-brand-500 transition-all duration-500"
          style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      {/* Contenido de cada paso */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center">
        {step === 0 && <StepConcepto onNext={() => setStep(1)} />}
        {step === 1 && <StepPrivacidad onNext={() => setStep(2)} />}
        {step === 2 && (
          <StepAlias
            alias={alias}
            aliasError={aliasError}
            accepted={accepted}
            onAliasChange={handleAliasChange}
            onRegenerate={() => setAlias(generateAlias())}
            onAcceptChange={setAccepted}
            onFinish={handleFinish}
          />
        )}
      </div>

      {/* Indicadores de puntos */}
      <div className="flex justify-center gap-2 pb-10">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i === step ? "bg-brand-400" : "bg-surface-2"
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
    <div className="onboarding-slide max-w-sm w-full">
      {/* Icono */}
      <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-brand-500/20 flex items-center justify-center">
        <span className="text-5xl">📍</span>
      </div>

      <h1 className="text-3xl font-bold text-white mb-3">
        Bienvenido a <span className="text-brand-400">{APP_NAME}</span>
      </h1>
      <p className="text-slate-400 text-base leading-relaxed mb-8">
        Una red social donde las conversaciones suceden por <strong className="text-slate-200">proximidad física</strong>.
        Habla con personas en la misma plaza, mercado o barrio, de forma anónima y sin registrarte.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-10 text-sm">
        <Feature emoji="🏘️" label="Por zona" />
        <Feature emoji="🎭" label="Anónimo" />
        <Feature emoji="⚡" label="En tiempo real" />
      </div>

      <button
        onClick={onNext}
        className="w-full py-4 rounded-2xl bg-brand-500 hover:bg-brand-400 text-white font-semibold text-lg transition-colors"
      >
        Empezar
      </button>
    </div>
  );
}

// ── Paso 2: Privacidad ────────────────────────────────────────────────

function StepPrivacidad({ onNext }: { onNext: () => void }) {
  return (
    <div className="onboarding-slide max-w-sm w-full">
      <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-emerald-500/20 flex items-center justify-center">
        <span className="text-5xl">🔒</span>
      </div>

      <h2 className="text-2xl font-bold text-white mb-3">Tu privacidad</h2>
      <p className="text-slate-400 text-sm mb-6">
        Queremos ser transparentes sobre cómo funciona {APP_NAME}.
      </p>

      <div className="space-y-3 text-left mb-8">
        <PrivacyItem
          icon="✅"
          label="Tu ubicación exacta nunca sale de este dispositivo"
          color="text-emerald-400"
        />
        <PrivacyItem
          icon="✅"
          label="No guardamos mensajes en el servidor. Solo los reenvía."
          color="text-emerald-400"
        />
        <PrivacyItem
          icon="✅"
          label="No hay registro con nombre real ni correo"
          color="text-emerald-400"
        />
        <PrivacyItem
          icon="⚠️"
          label="El servidor sí ve tu dirección IP mientras estás conectado"
          color="text-amber-400"
        />
        <PrivacyItem
          icon="⚠️"
          label="Tu zona aproximada (barrio/sector) se comparte con el servidor"
          color="text-amber-400"
        />
      </div>

      <button
        onClick={onNext}
        className="w-full py-4 rounded-2xl bg-brand-500 hover:bg-brand-400 text-white font-semibold text-lg transition-colors"
      >
        Entendido, continuar
      </button>
    </div>
  );
}

// ── Paso 3: Alias ─────────────────────────────────────────────────────

interface StepAliasProps {
  alias: string;
  aliasError: string;
  accepted: boolean;
  onAliasChange: (val: string) => void;
  onRegenerate: () => void;
  onAcceptChange: (val: boolean) => void;
  onFinish: () => void;
}

function StepAlias({
  alias, aliasError, accepted,
  onAliasChange, onRegenerate, onAcceptChange, onFinish,
}: StepAliasProps) {
  return (
    <div className="onboarding-slide max-w-sm w-full">
      <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-purple-500/20 flex items-center justify-center">
        <span className="text-5xl">🎭</span>
      </div>

      <h2 className="text-2xl font-bold text-white mb-2">Tu alias temporal</h2>
      <p className="text-slate-400 text-sm mb-6">
        Así te verán los demás. Puedes cambiarlo o generar uno nuevo en cualquier momento desde Ajustes.
      </p>

      <div className="flex gap-2 mb-1">
        <input
          type="text"
          value={alias}
          onChange={(e) => onAliasChange(e.target.value)}
          maxLength={MAX_ALIAS_LENGTH}
          className="flex-1 px-4 py-3 rounded-xl bg-surface-1 border border-surface-2 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
          placeholder="Tu alias..."
          aria-label="Alias temporal"
        />
        <button
          onClick={onRegenerate}
          className="px-4 py-3 rounded-xl bg-surface-1 border border-surface-2 text-slate-300 hover:bg-surface-2 transition-colors"
          title="Generar otro alias"
          aria-label="Regenerar alias"
        >
          🔀
        </button>
      </div>

      {aliasError && (
        <p className="text-red-400 text-xs text-left mb-3">{aliasError}</p>
      )}
      <p className="text-slate-500 text-xs text-right mb-6">
        {alias.length}/{MAX_ALIAS_LENGTH}
      </p>

      {/* Checkbox de aceptación */}
      <label className="flex items-start gap-3 mb-8 cursor-pointer text-left">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onAcceptChange(e.target.checked)}
          className="mt-0.5 w-5 h-5 rounded accent-brand-500 flex-none"
        />
        <span className="text-slate-400 text-sm">
          Tengo al menos 16 años y acepto los{" "}
          <a href="/acerca" className="text-brand-400 underline">términos de uso</a>{" "}
          y la{" "}
          <a href="/ajustes" className="text-brand-400 underline">política de privacidad</a>.
        </span>
      </label>

      <button
        onClick={onFinish}
        disabled={!accepted || alias.trim().length < 1}
        className="w-full py-4 rounded-2xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-lg transition-colors"
      >
        Entrar a ZonaViva
      </button>
    </div>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────

function Feature({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-2xl">{emoji}</span>
      <span className="text-slate-400 text-xs">{label}</span>
    </div>
  );
}

function PrivacyItem({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-1">
      <span className="text-lg flex-none">{icon}</span>
      <span className={`text-sm ${color}`}>{label}</span>
    </div>
  );
}
