export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-screen gap-4 text-center px-6">
      <span className="text-6xl">🗺️</span>
      <h1 className="text-2xl font-bold text-white">Página no encontrada</h1>
      <p className="text-slate-400">La ruta que buscas no existe.</p>
      <a href="/" className="text-brand-400 underline text-sm">Volver al inicio</a>
    </div>
  );
}
