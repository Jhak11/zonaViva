// Banner de estado de sin conexión
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 border-b border-amber-500/30 text-amber-300 text-sm">
      <span>📡</span>
      <span>Sin conexión – los mensajes se enviarán al reconectar.</span>
    </div>
  );
}
