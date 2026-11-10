// ──────────────────────────────────────────────────────────────────────
//  Layout principal con barra de navegación inferior (mobile-first)
// ──────────────────────────────────────────────────────────────────────
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  MapIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  SparklesIcon,
  Cog6ToothIcon,
  BellAlertIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  MapIcon as MapIconSolid,
  ChatBubbleOvalLeftEllipsisIcon as ChatIconSolid,
  SparklesIcon as SparklesIconSolid,
  Cog6ToothIcon as CogIconSolid,
} from "@heroicons/react/24/solid";
import { useEffect } from "react";
import OfflineBanner from "@/components/OfflineBanner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useForumStore } from "@/stores/forumStore";
import { useDirectChatStore } from "@/stores/directChatStore";

export default function AppLayout() {
  const isOnline = useOnlineStatus();
  const location = useLocation();
  const navigate = useNavigate();
  const initNetwork = useForumStore((s) => s.initNetwork);
  const myUserForums = useForumStore((s) => s.myUserForums);

  const inAppNotification = useDirectChatStore((s) => s.inAppNotification);
  const clearInAppNotification = useDirectChatStore((s) => s.clearInAppNotification);
  const requests = useDirectChatStore((s) => s.requests);
  const unreadTotal = useDirectChatStore((s) => s.unreadTotal);

  useEffect(() => {
    initNetwork();
  }, [initNetwork]);

  // Auto-descartar la notificación in-app tras 6 segundos
  useEffect(() => {
    if (inAppNotification) {
      const timer = setTimeout(() => {
        clearInAppNotification();
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [inAppNotification, clearInAppNotification]);

  const handleToastClick = () => {
    clearInAppNotification();
    navigate("/chat?tab=requests");
  };

  const isForosActive = location.pathname.startsWith("/foro");
  const pendingIncomingCount = requests.filter(
    (r) => r.direction === "incoming" && r.status === "pending"
  ).length;
  const totalChatBadge = pendingIncomingCount + unreadTotal;
  const totalForumsUnread = myUserForums.reduce((sum, f) => sum + (f.unreadCount || 0), 0);

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden bg-surface-0 relative">
      {/* Notificación flotante In-App de solicitud o mensaje directo */}
      {inAppNotification && (
        <div className="fixed top-3 left-4 right-4 z-50 max-w-md mx-auto animate-fade-in">
          <div className="bg-surface-1/95 border border-purple-500/50 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md flex items-start gap-3 ring-1 ring-purple-500/20">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center flex-none">
              <BellAlertIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={handleToastClick}>
              <h4 className="text-xs font-bold text-white truncate">{inAppNotification.title}</h4>
              <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2 leading-snug">
                {inAppNotification.message}
              </p>
              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-purple-400 font-semibold">
                <span>Ver solicitudes</span>
                <span>&rarr;</span>
              </div>
            </div>
            <button
              onClick={clearInAppNotification}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              title="Descartar"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Banner de sin conexión */}
      {!isOnline && <OfflineBanner />}

      {/* Contenido principal */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Barra de navegación inferior */}
      <nav className="flex-none border-t border-surface-2 bg-surface-1 pb-safe">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          <NavItem to="/" label="Inicio" OutlineIcon={MapIcon} SolidIcon={MapIconSolid} />
          <NavItem
            to="/foros"
            label="Foros"
            OutlineIcon={ChatBubbleOvalLeftEllipsisIcon}
            SolidIcon={ChatIconSolid}
            forceActive={isForosActive}
            badge={totalForumsUnread}
          />
          <NavItem
            to="/chat"
            label="Chat 1:1"
            OutlineIcon={SparklesIcon}
            SolidIcon={SparklesIconSolid}
            badge={totalChatBadge}
          />
          <NavItem to="/ajustes" label="Ajustes" OutlineIcon={Cog6ToothIcon} SolidIcon={CogIconSolid} />
        </div>
      </nav>
    </div>
  );
}

// ── Ítem de navegación ─────────────────────────────────────────────────
interface NavItemProps {
  to: string;
  label: string;
  OutlineIcon: React.ElementType;
  SolidIcon: React.ElementType;
  forceActive?: boolean;
  badge?: number;
}

function NavItem({ to, label, OutlineIcon, SolidIcon, forceActive, badge }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) => {
        const active = forceActive ?? isActive;
        return `flex flex-col items-center gap-0.5 py-2 px-4 rounded-xl transition-colors relative ${
          active
            ? "text-brand-400 font-semibold"
            : "text-slate-400 hover:text-slate-200"
        }`;
      }}
    >
      {({ isActive }) => {
        const active = forceActive ?? isActive;
        return (
          <>
            <div className="relative">
              {active ? <SolidIcon className="w-6 h-6" /> : <OutlineIcon className="w-6 h-6" />}
              {badge !== undefined && badge > 0 && (
                <span className="absolute -top-1 -right-2 bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[18px] text-center shadow-md border border-surface-1 animate-pulse">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </div>
            <span className="text-[10px]">{label}</span>
          </>
        );
      }}
    </NavLink>
  );
}
