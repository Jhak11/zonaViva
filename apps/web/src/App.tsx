import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useIdentityStore } from "@/stores/identityStore";
import { useGeoStore } from "@/stores/geoStore";

// Vistas
import BienvenidaPage from "@/pages/BienvenidaPage";
import InicioPage from "@/pages/InicioPage";
import ForosPage from "@/pages/ForosPage";
import ForoPage from "@/pages/ForoPage";
import AjustesPage from "@/pages/AjustesPage";
import NotFoundPage from "@/pages/NotFoundPage";

// Layout
import AppLayout from "@/layouts/AppLayout";

export default function App() {
  const { session, initSession } = useIdentityStore();
  const { startWatching } = useGeoStore();

  // Inicializar sesión al arrancar
  useEffect(() => {
    initSession();
  }, [initSession]);

  // Si ya hay sesión, empezar a escuchar GPS
  useEffect(() => {
    if (session) {
      startWatching();
    }
  }, [session, startWatching]);

  // Si no hay sesión → onboarding; si la hay → app
  const hasSession = Boolean(session);

  return (
    <Routes>
      {/* Onboarding: solo si NO hay sesión */}
      <Route
        path="/bienvenida"
        element={!hasSession ? <BienvenidaPage /> : <Navigate to="/" replace />}
      />

      {/* App principal: requiere sesión */}
      <Route element={<AppLayout />}>
        <Route
          path="/"
          element={hasSession ? <InicioPage /> : <Navigate to="/bienvenida" replace />}
        />
        <Route
          path="/foros"
          element={hasSession ? <ForosPage /> : <Navigate to="/bienvenida" replace />}
        />
        <Route
          path="/foro/:id"
          element={hasSession ? <ForoPage /> : <Navigate to="/bienvenida" replace />}
        />
        <Route
          path="/ajustes"
          element={hasSession ? <AjustesPage /> : <Navigate to="/bienvenida" replace />}
        />
      </Route>

      {/* Redirigir raíz según estado */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
