// ──────────────────────────────────────────────────────────────────────
//  Layout principal con barra de navegación inferior (mobile-first)
// ──────────────────────────────────────────────────────────────────────
import { Outlet, NavLink } from "react-router-dom";
import { MapIcon, ChatBubbleOvalLeftEllipsisIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import { MapIcon as MapIconSolid, ChatBubbleOvalLeftEllipsisIcon as ChatIconSolid, Cog6ToothIcon as CogIconSolid } from "@heroicons/react/24/solid";
import OfflineBanner from "@/components/OfflineBanner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export default function AppLayout() {
  const isOnline = useOnlineStatus();

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden bg-surface-0">
      {/* Banner de sin conexión */}
      {!isOnline && <OfflineBanner />}

      {/* Contenido principal */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Barra de navegación inferior */}
      <nav className="flex-none border-t border-surface-2 bg-surface-1 pb-safe">
        <div className="flex justify-around items-center h-16">
          <NavItem to="/" label="Inicio" OutlineIcon={MapIcon} SolidIcon={MapIconSolid} />
          <NavItem to="/foros" label="Foros" OutlineIcon={ChatBubbleOvalLeftEllipsisIcon} SolidIcon={ChatIconSolid} />
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
}

function NavItem({ to, label, OutlineIcon, SolidIcon }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 py-2 px-4 rounded-xl transition-colors ${
          isActive
            ? "text-brand-400"
            : "text-surface-3 hover:text-slate-300"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive
            ? <SolidIcon className="w-6 h-6" />
            : <OutlineIcon className="w-6 h-6" />}
          <span className="text-[10px] font-medium">{label}</span>
        </>
      )}
    </NavLink>
  );
}
