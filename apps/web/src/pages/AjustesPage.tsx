// ──────────────────────────────────────────────────────────────────────
//  V8 – Ajustes y privacidad (Iteración 3 mejorada)
//  Gestión de foros con copia local: salir por foro o de todos.
// ──────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { useIdentityStore } from "@/stores/identityStore";
import { useGeoStore } from "@/stores/geoStore";
import { useForumStore } from "@/stores/forumStore";
import { generateAlias } from "@/modules/identity";
import { APP_NAME, MAX_ALIAS_LENGTH, ZONES_BY_ID, FORUM_PREFIX_ZONE } from "@zonaviva/protocol";
import {
  getStorageStats,
  requestStoragePersistence,
  getLocalForumList,
} from "@/db/storage";
import { TrashIcon } from "@heroicons/react/24/outline";

interface ForumEntry {
  id: string;
  name: string;
  messageCount: number;
}

export default function AjustesPage() {
  const { session, setAlias, renewSession } = useIdentityStore();
  const { permission, effectiveZone: getEffectiveZone, manualZone } = useGeoStore();
  const currentZone = getEffectiveZone();
  const { leaveForumPermanently, leaveAllForums } = useForumStore();

  const [editingAlias, setEditingAlias] = useState(false);
  const [aliasInput, setAliasInput] = useState(session?.alias ?? "");
  const [aliasError, setAliasError] = useState("");
  const [renewConfirm, setRenewConfirm] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);

  // Estadísticas de almacenamiento local
  const [stats, setStats] = useState({
    messageCount: 0,
    forumCount: 0,
    outboxCount: 0,
    isPersistent: false,
  });
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [persistMsg, setPersistMsg] = useState<string | null>(null);

  // Lista de foros con copia local
  const [localForums, setLocalForums] = useState<ForumEntry[]>([]);
  const [leavingForum, setLeavingForum] = useState<string | null>(null);
  const [leaveForumConfirm, setLeaveForumConfirm] = useState<string | null>(null);
  const [leaveAllConfirm, setLeaveAllConfirm] = useState(false);
  const [leavingAll, setLeavingAll] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [s, forums] = await Promise.all([getStorageStats(), getLocalForumList()]);
      setStats(s);
      setLocalForums(
        forums.map((f) => {
          // Intentar resolver nombre legible desde las zonas
          let displayName = f.name;
          if (f.id.startsWith(FORUM_PREFIX_ZONE)) {
            const zid = f.id.slice(FORUM_PREFIX_ZONE.length);
            if (ZONES_BY_ID[zid]) displayName = ZONES_BY_ID[zid].name;
          }
          return { id: f.id, name: displayName, messageCount: f.messageCount };
        })
      );
    } catch {
      // Ignorar fallo de lectura de stats
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleRequestPersist() {
    const granted = await requestStoragePersistence();
    setStats((prev) => ({ ...prev, isPersistent: granted }));
    setPersistMsg(
      granted
        ? "✅ Almacenamiento persistente concedido. Tus copias no serán borradas automáticamente por el navegador."
        : "⚠️ El navegador rechazó la persistencia estricta. Las copias locales se mantendrán mientras haya espacio en disco."
    );
  }

  async function handleClearData() {
    if (!clearConfirm) {
      setClearConfirm(true);
      return;
    }
    setClearing(true);
    await leaveAllForums();
    await loadData();
    setClearing(false);
    setClearConfirm(false);
  }

  async function handleLeaveForum(forumId: string) {
    if (leaveForumConfirm !== forumId) {
      setLeaveForumConfirm(forumId);
      return;
    }
    setLeavingForum(forumId);
    await leaveForumPermanently(forumId);
    setLeavingForum(null);
    setLeaveForumConfirm(null);
    await loadData();
  }

  async function handleLeaveAll() {
    if (!leaveAllConfirm) {
      setLeaveAllConfirm(true);
      return;
    }
    setLeavingAll(true);
    await leaveAllForums();
    setLeavingAll(false);
    setLeaveAllConfirm(false);
    await loadData();
  }

  if (!session) return null;

  function handleAliasSave() {
    const trimmed = aliasInput.trim();
    if (trimmed.length < 1) {
      setAliasError("El alias no puede estar vacío.");
      return;
    }
    setAlias(trimmed);
    setEditingAlias(false);
    setAliasError("");
  }

  async function handleRenewSession() {
    if (!renewConfirm) {
      setRenewConfirm(true);
      return;
    }
    setIsRenewing(true);
    await renewSession();
    await loadData();
    setAliasInput(useIdentityStore.getState().session?.alias ?? "");
    setRenewConfirm(false);
    setIsRenewing(false);
  }

  const effectiveZone = manualZone ?? currentZone;

  return (
    <div className="min-h-full bg-surface-0">
      {/* Cabecera */}
      <header className="px-4 pt-6 pb-4 pt-safe">
        <h1 className="text-2xl font-bold text-white tracking-tight">Ajustes y Privacidad</h1>
        <p className="text-slate-400 text-xs mt-1">
          Tu identidad es temporal y tus conversaciones viven en tu dispositivo.
        </p>
      </header>

      <div className="px-4 pb-24 space-y-4 max-w-lg mx-auto">
        {/* ── Sección: Identidad ── */}
        <Section title="Identidad temporal">
          <div className="space-y-3">
            {/* Alias actual */}
            <InfoRow
              label="Alias visible"
              value={
                editingAlias ? (
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={aliasInput}
                      onChange={(e) => {
                        if (e.target.value.length <= MAX_ALIAS_LENGTH) setAliasInput(e.target.value);
                        setAliasError("");
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-surface-0 border border-surface-2 text-white text-xs focus:outline-none focus:border-brand-500"
                      autoFocus
                    />
                    <button onClick={handleAliasSave} className="text-brand-400 text-xs font-semibold">
                      Guardar
                    </button>
                    <button onClick={() => { setEditingAlias(false); setAliasInput(session.alias); }} className="text-slate-500 text-xs">
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-brand-400 font-medium">{session.alias}</span>
                    <button
                      onClick={() => { setEditingAlias(true); setAliasInput(session.alias); }}
                      className="text-slate-500 hover:text-white text-xs underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setAliasInput(generateAlias())}
                      className="text-slate-500 hover:text-white text-xs"
                      title="Generar alias aleatorio"
                    >
                      🔀
                    </button>
                  </div>
                )
              }
            />
            {aliasError && <p className="text-red-400 text-xs">{aliasError}</p>}

            <InfoRow label="Sesión creada" value={new Date(session.createdAt).toLocaleString("es-PE")} />
            <InfoRow
              label="Clave pública"
              value={
                <div className="flex items-center gap-1.5">
                  <span
                    className="font-mono text-xs text-brand-400 break-all"
                    title={session.publicKey}
                  >
                    {session.publicKey.slice(0, 10)}…{session.publicKey.slice(-10)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans">(P-256)</span>
                </div>
              }
            />

            {/* Renovar sesión */}
            <div className="pt-2">
              {renewConfirm && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl mb-2 space-y-1.5">
                  <p className="text-red-300 font-semibold text-xs flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>Reinicio a nuevo usuario limpio</span>
                  </p>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Al renovar sesión se destruyen las claves actuales y se genera una <strong>identidad completamente nueva</strong>. Como nuevo usuario en la red, <strong>se limpiará tu historial local de foros, mensajes y contactos guardados</strong>.
                  </p>
                  <p className="text-purple-300 text-[11px] leading-relaxed">
                    💡 <em>¿Solo quieres cambiar tu nombre?</em> Usa <strong>"Editar"</strong> junto a tu alias arriba para cambiar tu apodo sin perder tus contactos ni tu historial.
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                {renewConfirm && (
                  <button
                    onClick={() => setRenewConfirm(false)}
                    className="py-2.5 px-3 rounded-xl bg-surface-2 hover:bg-surface-3 text-slate-300 text-xs font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={handleRenewSession}
                  disabled={isRenewing}
                  className={`flex-1 py-2.5 rounded-xl font-medium text-xs transition-colors ${
                    renewConfirm
                      ? "bg-red-600 hover:bg-red-500 text-white font-semibold shadow-md shadow-red-900/30"
                      : "bg-surface-2 text-slate-300 hover:bg-surface-1 border border-surface-2"
                  }`}
                >
                  {isRenewing
                    ? "Renovando identidad limpia…"
                    : renewConfirm
                    ? "Confirmar e iniciar como usuario nuevo"
                    : "🔄 Renovar sesión y claves (Nuevo usuario)"}
                </button>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Sección: Foros con copia local ── */}
        <Section title="Foros guardados en este dispositivo">
          <div className="space-y-3 text-xs">
            {localForums.length === 0 ? (
              <p className="text-slate-500 text-center py-2">
                No hay ningún foro con copia local guardada.
              </p>
            ) : (
              <>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Estos foros tienen historial guardado en tu dispositivo. "Salir del foro" borra tu copia local; las copias de otros usuarios no se ven afectadas.
                </p>
                <div className="space-y-2">
                  {localForums.map((forum) => {
                    const isConfirming = leaveForumConfirm === forum.id;
                    const isProcessing = leavingForum === forum.id;
                    return (
                      <div
                        key={forum.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-0 border border-surface-2/60"
                      >
                        <div className="min-w-0">
                          <p className="text-white font-medium text-xs truncate">{forum.name}</p>
                          <p className="text-slate-500 text-[11px]">
                            {forum.messageCount} {forum.messageCount === 1 ? "mensaje" : "mensajes"} guardados
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-none">
                          {isConfirming && (
                            <span className="text-red-400 text-[11px] font-medium">¿Seguro?</span>
                          )}
                          <button
                            onClick={() => handleLeaveForum(forum.id)}
                            disabled={isProcessing}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                              isConfirming
                                ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
                                : "bg-surface-2/70 text-slate-400 hover:text-red-300 border border-surface-2"
                            }`}
                          >
                            <TrashIcon className="w-3 h-3" />
                            {isProcessing ? "Saliendo…" : isConfirming ? "Confirmar" : "Salir"}
                          </button>
                          {isConfirming && (
                            <button
                              onClick={() => setLeaveForumConfirm(null)}
                              className="text-slate-500 hover:text-white text-[11px] px-1.5"
                            >
                              No
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Botón salir de todos */}
                <div className="pt-2 border-t border-surface-2/40">
                  {leaveAllConfirm && (
                    <p className="text-red-400 text-[11px] mb-2 leading-relaxed">
                      ⚠️ Esto borra las copias de TODOS los foros de este dispositivo. Las copias de otros usuarios no se ven afectadas.
                    </p>
                  )}
                  <button
                    onClick={handleLeaveAll}
                    disabled={leavingAll}
                    className={`w-full py-2.5 rounded-xl font-medium transition-colors ${
                      leaveAllConfirm
                        ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
                        : "bg-surface-2/70 text-slate-400 hover:text-red-300 border border-surface-2"
                    }`}
                  >
                    {leavingAll
                      ? "Saliendo de todos los foros…"
                      : leaveAllConfirm
                      ? "Sí, salir de todos los foros"
                      : "🗑️ Salir de todos los foros"}
                  </button>
                  {leaveAllConfirm && (
                    <button
                      onClick={() => setLeaveAllConfirm(false)}
                      className="w-full mt-1.5 py-2 rounded-xl text-slate-500 hover:text-white text-xs transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </Section>

        {/* ── Sección: Almacenamiento local e IndexedDB ── */}
        <Section title="Almacenamiento Local (IndexedDB)">
          <div className="space-y-3 text-xs">
            <InfoRow label="Mensajes guardados" value={<span className="font-semibold text-white">{stats.messageCount}</span>} />
            <InfoRow label="Foros conservados" value={<span className="font-semibold text-white">{stats.forumCount}</span>} />
            {stats.outboxCount > 0 && (
              <InfoRow
                label="Bandeja de salida pendiente"
                value={<span className="font-semibold text-amber-400">{stats.outboxCount} mensajes</span>}
              />
            )}
            <InfoRow
              label="Estado persistencia"
              value={
                <span className={stats.isPersistent ? "text-emerald-400 font-medium" : "text-slate-400"}>
                  {stats.isPersistent ? "Protegido contra limpieza" : "Estándar"}
                </span>
              }
            />

            {!stats.isPersistent && (
              <button
                onClick={handleRequestPersist}
                className="w-full py-2 rounded-xl bg-surface-2 hover:bg-surface-2/80 text-brand-300 font-medium transition-colors"
              >
                🛡️ Solicitar almacenamiento persistente al navegador
              </button>
            )}

            {persistMsg && (
              <p className="p-2 rounded-lg bg-surface-0 border border-surface-2 text-slate-300 text-[11px] leading-relaxed">
                {persistMsg}
              </p>
            )}

            {/* Borrado de datos */}
            <div className="pt-2 border-t border-surface-2/40">
              {clearConfirm && (
                <p className="text-red-400 text-[11px] mb-2 leading-relaxed">
                  ⚠️ ¿Seguro que deseas eliminar todos los mensajes e historiales guardados en este dispositivo? Esta acción es irreversible.
                </p>
              )}
              <button
                onClick={handleClearData}
                disabled={clearing}
                className={`w-full py-2.5 rounded-xl font-medium transition-colors ${
                  clearConfirm
                    ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
                    : "bg-surface-2/70 text-slate-400 hover:text-red-300 border border-surface-2"
                }`}
              >
                {clearing
                  ? "Borrando almacenamiento…"
                  : clearConfirm
                  ? "Sí, borrar todo el historial local"
                  : "🗑️ Borrar copias de foros de este dispositivo"}
              </button>
            </div>
          </div>
        </Section>

        {/* ── Sección: Ubicación ── */}
        <Section title="Ubicación">
          <div className="space-y-3">
            <InfoRow
              label="Permiso de GPS"
              value={
                <span className={
                  permission === "granted" ? "text-emerald-400" :
                  permission === "denied" ? "text-red-400" :
                  "text-amber-400"
                }>
                  {permission === "granted" ? "✅ Concedido" :
                   permission === "denied" ? "❌ Denegado" :
                   permission === "unavailable" ? "🚫 No disponible" :
                   "⏳ Sin decidir"}
                </span>
              }
            />
            <InfoRow
              label="Zona detectada"
              value={effectiveZone
                ? <span className="text-brand-400 font-medium">{effectiveZone.name}</span>
                : <span className="text-slate-500">Fuera de zonas</span>}
            />

            {permission === "denied" && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-amber-300 text-xs">
                  Para activar la ubicación, ve a los ajustes de tu navegador y permite el acceso para esta página.
                </p>
              </div>
            )}
          </div>
        </Section>

        {/* ── Sección: Privacidad explicada ── */}
        <Section title="Qué datos se comparten">
          <div className="space-y-2 text-xs text-slate-400">
            <PrivacyRow
              icon="✅"
              text="Tu ubicación exacta nunca sale de este dispositivo."
              ok
            />
            <PrivacyRow
              icon="✅"
              text={`${APP_NAME} no almacena mensajes. El servidor solo los reenvía en tiempo real y firma su sello.`}
              ok
            />
            <PrivacyRow
              icon="✅"
              text="No hay nombre real, correo ni número de teléfono."
              ok
            />
            <PrivacyRow
              icon="⚠️"
              text="El servidor ve tu dirección IP mientras estás conectado (no se guarda en logs)."
            />
            <PrivacyRow
              icon="⚠️"
              text="Tu zona aproximada se comparte al unirte a una sala para recibir mensajes de esa zona."
            />
          </div>
        </Section>

        {/* ── Sección: Instalar PWA ── */}
        <Section title="Instalar la aplicación">
          <p className="text-slate-400 text-xs mb-2 leading-relaxed">
            Puedes instalar {APP_NAME} en tu dispositivo como una aplicación web progresiva (PWA). Funciona sin conexión y carga al instante.
          </p>
          <p className="text-slate-500 text-[11px] leading-relaxed">
            • En iOS: Safari → Compartir → Añadir a pantalla de inicio.<br />
            • En Android: el navegador mostrará un aviso de instalación automáticamente.
          </p>
        </Section>
      </div>
    </div>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-1 rounded-2xl p-4 border border-surface-2/60">
      <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">{title}</h2>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-slate-400 flex-none">{label}</span>
      <div className="text-right">{value}</div>
    </div>
  );
}

function PrivacyRow({ icon, text, ok }: { icon: string; text: string; ok?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="flex-none mt-0.5">{icon}</span>
      <span className={ok ? "text-emerald-300" : "text-amber-300"}>{text}</span>
    </div>
  );
}
