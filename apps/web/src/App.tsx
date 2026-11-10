import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useIdentityStore } from "@/stores/identityStore";
import { useGeoStore } from "@/stores/geoStore";
import { useDirectChatStore } from "@/stores/directChatStore";

// Vistas
import BienvenidaPage from "@/pages/BienvenidaPage";
import InicioPage from "@/pages/InicioPage";
import ForosPage from "@/pages/ForosPage";
import CrearForoPage from "@/pages/CrearForoPage";
import ForoPage from "@/pages/ForoPage";
import ChatPage from "@/pages/ChatPage";
import AjustesPage from "@/pages/AjustesPage";
import NotFoundPage from "@/pages/NotFoundPage";

// Layout
import AppLayout from "@/layouts/AppLayout";

export default function App() {
  const { session, isOnboardingCompleted, isReady, initSession } = useIdentityStore();
  const { startWatching } = useGeoStore();
  const initDirectStore = useDirectChatStore((s) => s.initDirectStore);

  // Inicializar estado de sesión y onboarding al arrancar
  useEffect(() => {
    initSession();
  }, [initSession]);

  // Si ya hay sesión activa, iniciar GPS y canal de mensajería directa
  useEffect(() => {
    if (session) {
      startWatching();
      initDirectStore();
    }
  }, [session, startWatching, initDirectStore]);

  // Pantalla de carga mientras se recupera estado de localStorage
  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-surface-0 text-white">
        <div className="w-12 h-12 rounded-2xl bg-brand-500/20 text-brand-400 flex items-center justify-center text-2xl animate-pulse mb-3">
          📍
        </div>
        <p className="text-slate-400 text-xs font-medium">Iniciando ZonaViva…</p>
      </div>
    );
  }

  return (
    <Routes>
      {/* Onboarding: solo accesible si no se ha completado */}
      <Route
        path="/bienvenida"
        element={
          !isOnboardingCompleted ? <BienvenidaPage /> : <Navigate to="/" replace />
        }
      />

      {/* Rutas principales protegidas por Onboarding */}
      <Route element={<AppLayout />}>
        <Route
          path="/"
          element={
            isOnboardingCompleted ? <InicioPage /> : <Navigate to="/bienvenida" replace />
          }
        />
        <Route
          path="/foros"
          element={
            isOnboardingCompleted ? <ForosPage /> : <Navigate to="/bienvenida" replace />
          }
        />
        <Route
          path="/foros/nuevo"
          element={
            isOnboardingCompleted ? <CrearForoPage /> : <Navigate to="/bienvenida" replace />
          }
        />
        <Route
          path="/foro/:id"
          element={
            isOnboardingCompleted ? <ForoPage /> : <Navigate to="/bienvenida" replace />
          }
        />
        <Route
          path="/chat"
          element={
            isOnboardingCompleted ? <ChatPage /> : <Navigate to="/bienvenida" replace />
          }
        />
        <Route
          path="/ajustes"
          element={
            isOnboardingCompleted ? <AjustesPage /> : <Navigate to="/bienvenida" replace />
          }
        />
      </Route>

      {/* Rutas no encontradas */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
