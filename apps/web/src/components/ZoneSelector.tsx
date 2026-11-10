// ──────────────────────────────────────────────────────────────────────
//  Selector de zona manual (bottom sheet)
// ──────────────────────────────────────────────────────────────────────
import type { Zone } from "@zonaviva/protocol";

interface ZoneSelectorProps {
  zones: Zone[];
  selected: Zone | null;
  onSelect: (zone: Zone) => void;
  onClose: () => void;
}

export default function ZoneSelector({ zones, selected, onSelect, onClose }: ZoneSelectorProps) {
  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      {/* Sheet */}
      <div
        className="w-full bg-surface-1 rounded-t-3xl p-5 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-surface-2 rounded-full mx-auto mb-5" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Explorar Zonas de Puno</h2>
          <span className="text-[11px] text-slate-400">Puno MVP</span>
        </div>

        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className={`p-3 rounded-xl border transition-colors ${
                selected?.id === zone.id
                  ? "bg-brand-500/15 border-brand-500/40"
                  : "bg-surface-0 border-surface-2 hover:border-surface-3"
              }`}
            >
              <div
                onClick={() => onSelect(zone)}
                className="flex items-start gap-3 cursor-pointer"
              >
                <span
                  className="w-3.5 h-3.5 rounded-full mt-1 flex-none"
                  style={{ backgroundColor: zone.color || "#0284c7" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`font-semibold text-sm ${selected?.id === zone.id ? "text-brand-300" : "text-white"}`}>
                      {zone.name}
                    </p>
                    {selected?.id === zone.id && (
                      <span className="text-brand-400 text-xs font-bold">Seleccionada</span>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs truncate mt-0.5">{zone.description}</p>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">{zone.cells.length} celdas contiguas</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full py-3 rounded-xl bg-surface-2 text-slate-300 hover:bg-surface-1 transition-colors text-sm font-medium"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
