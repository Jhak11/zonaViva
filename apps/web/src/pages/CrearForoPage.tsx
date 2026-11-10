// ──────────────────────────────────────────────────────────────────────
//  CrearForoPage.tsx - Creación de Foros Temporales de Usuario (Iteración 5)
//  Define ámbito circular GPS, nombre, descripción y regla de extinción N=0.
// ──────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ALLOWED_FORUM_RADII,
  DEFAULT_FORUM_RADIUS,
  MAX_FORUM_DESCRIPTION_LENGTH,
  MAX_USER_FORUMS_PER_CLIENT,
} from "@zonaviva/protocol";
import { useGeoStore } from "@/stores/geoStore";
import { useIdentityStore } from "@/stores/identityStore";
import { useForumStore } from "@/stores/forumStore";
import {
  ArrowLeftIcon,
  MapPinIcon,
  ShieldCheckIcon,
  SparklesIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";

export default function CrearForoPage() {
  const navigate = useNavigate();
  const { session } = useIdentityStore();
  const { userPosition } = useGeoStore();
  const { myUserForums, createTemporaryForum } = useForumStore();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [radius, setRadius] = useState<number>(DEFAULT_FORUM_RADIUS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isAtLimit = myUserForums.length >= MAX_USER_FORUMS_PER_CLIENT;

  const radiusDescriptions: Record<number, { label: string; desc: string }> = {
    50: { label: "50 metros", desc: "Local comercial / Puerta a puerta" },
    100: { label: "100 metros", desc: "Cuadra / Manzana inmediata" },
    200: { label: "200 metros", desc: "Barrio / Plaza / Parque (Recomendado)" },
    500: { label: "500 metros", desc: "Sector vecinal amplio" },
    1000: { label: "1,000 metros", desc: "Distrito / Campus extendido" },
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!session) {
      setFormError("Debes tener una identidad activa en ZonaViva.");
      return;
    }

    if (!userPosition) {
      setFormError("Se requiere señal GPS para anclar el ámbito físico del foro temporal.");
      return;
    }

    if (myUserForums.length >= MAX_USER_FORUMS_PER_CLIENT) {
      setFormError(
        `Has alcanzado el límite de ${MAX_USER_FORUMS_PER_CLIENT} foros simultáneos. Abandona alguno en "Mis foros" para crear uno nuevo.`
      );
      return;
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 3 || trimmedName.length > 50) {
      setFormError("El nombre del foro debe tener entre 3 y 50 caracteres.");
      return;
    }

    const trimmedDesc = description.trim();
    if (trimmedDesc.length > MAX_FORUM_DESCRIPTION_LENGTH) {
      setFormError(
        `La descripción no puede exceder ${MAX_FORUM_DESCRIPTION_LENGTH} caracteres.`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await createTemporaryForum({
        name: trimmedName,
        description: trimmedDesc,
        radius,
        latitude: userPosition.latitude,
        longitude: userPosition.longitude,
        session,
      });

      if (res.success && res.forumId) {
        navigate(`/foro/${res.forumId}`);
      } else {
        setFormError(res.error || "No fue posible crear el foro.");
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  const remainingDescChars = MAX_FORUM_DESCRIPTION_LENGTH - description.length;

  return (
    <div className="min-h-full bg-surface-0 pb-12">
      <div className="max-w-lg mx-auto w-full px-4 pt-4 sm:pt-6">
        {/* Cabecera */}
        <div className="flex items-center gap-3 mb-6 pt-safe">
          <Link
            to="/foros"
            className="w-9 h-9 rounded-xl bg-surface-1 border border-surface-2 hover:bg-surface-2 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>Crear Foro Temporal</span>
              <SparklesIcon className="w-5 h-5 text-brand-400" />
            </h1>
            <p className="text-slate-400 text-xs">
              Foros activos: {myUserForums.length} / {MAX_USER_FORUMS_PER_CLIENT} · Ámbito local de proximidad
            </p>
          </div>
        </div>

        {/* Alerta de límite alcanzado */}
        {isAtLimit && (
          <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5 mb-5 shadow-sm">
            <InformationCircleIcon className="w-5 h-5 flex-none text-amber-400" />
            <span>
              Has alcanzado el límite máximo de {MAX_USER_FORUMS_PER_CLIENT} foros temporales simultáneos ({myUserForums.length} / {MAX_USER_FORUMS_PER_CLIENT}). Abandona o elimina uno en &quot;Mis foros&quot; para crear otro nuevo.
            </span>
          </div>
        )}

        {/* Tarjeta informativa de reglas y ciclo de vida */}
        <div className="p-4 rounded-2xl bg-surface-1/90 border border-surface-2/80 mb-5 text-xs space-y-2">
          <div className="flex items-center gap-2 text-brand-400 font-semibold">
            <ShieldCheckIcon className="w-4 h-4" />
            <span>Reglas del Foro Temporal</span>
          </div>
          <ul className="text-slate-300/80 space-y-1.5 list-disc list-inside">
            <li>
              <strong className="text-slate-200">Ámbito circular:</strong> Solo quienes estén físicamente dentro del radio podrán publicar mensajes.
            </li>
            <li>
              <strong className="text-slate-200">Acceso participante:</strong> Si sales del radio, conservas el chat y sigues leyendo como participante en &quot;Mis foros&quot;.
            </li>
            <li>
              <strong className="text-slate-200">Regla de extinción:</strong> Si todos los participantes abandonan o eliminan el foro, este desaparece para siempre de la red sin dejar huella en ningún servidor.
            </li>
          </ul>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
              {formError}
            </div>
          )}

          {/* Nombre del foro */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
              Nombre del Foro <span className="text-brand-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Feria de trueque artesanal, Taller Huajsapata..."
              maxLength={50}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-1 border border-surface-2 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-brand-500 transition-colors"
            />
            <div className="flex justify-between text-[11px] text-slate-500 mt-1 px-1">
              <span>Mínimo 3 caracteres</span>
              <span>{name.length}/50</span>
            </div>
          </div>

          {/* Descripción opcional */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
              Propósito o descripción (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="¿De qué trata este foro o evento local?..."
              rows={3}
              maxLength={MAX_FORUM_DESCRIPTION_LENGTH}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-1 border border-surface-2 text-white placeholder-slate-500 text-xs sm:text-sm resize-none focus:outline-none focus:border-brand-500 transition-colors"
            />
            <div className="flex justify-end text-[11px] text-slate-500 mt-1 px-1">
              <span className={remainingDescChars < 20 ? "text-amber-400" : ""}>
                {remainingDescChars} restantes
              </span>
            </div>
          </div>

          {/* Selector de Radio circular */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
              Radio de cobertura física <span className="text-brand-400">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALLOWED_FORUM_RADII.map((r) => {
                const isSelected = radius === r;
                const info = radiusDescriptions[r];
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadius(r)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "bg-brand-500/15 border-brand-500 text-white shadow-sm ring-1 ring-brand-500/30"
                        : "bg-surface-1 border-surface-2 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white">
                        {info.label}
                      </span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-brand-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                      {info.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Posición GPS detectada */}
          <div className="p-3.5 rounded-xl bg-surface-1/60 border border-surface-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <MapPinIcon className="w-4 h-4 text-brand-400 flex-none" />
              <span>
                {userPosition
                  ? "Ubicación GPS fijada como centro del foro"
                  : "Esperando señal de geolocalización GPS…"}
              </span>
            </div>
            {userPosition ? (
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Listo
              </span>
            ) : (
              <span className="text-[11px] text-amber-400 animate-pulse">
                Sin señal
              </span>
            )}
          </div>

          {/* Botón de Envío */}
          <button
            type="submit"
            disabled={isSubmitting || !userPosition || !name.trim() || isAtLimit}
            className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm shadow-lg shadow-brand-500/25 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Creando foro temporal…</span>
              </>
            ) : (
              <>
                <span>Crear y Entrar al Foro</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
