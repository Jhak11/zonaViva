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
        <h2 className="text-lg font-bold text-white mb-4">Explorar zona</h2>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {zones.map((zone) => (
            <button
              key={zone.id}
              onClick={() => onSelect(zone)}
              className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors ${
                selected?.id === zone.id
                  ? "bg-brand-500/20 border border-brand-500/30"
                  : "bg-surface-0 border border-surface-2 hover:border-surface-3"
              }`}
            >
              <span className="text-xl flex-none">📍</span>
              <div>
                <p className={`font-medium text-sm ${selected?.id === zone.id ? "text-brand-300" : "text-white"}`}>
                  {zone.name}
                </p>
                <p className="text-slate-400 text-xs">{zone.description}</p>
              </div>
              {selected?.id === zone.id && (
                <span className="ml-auto text-brand-400 flex-none">✓</span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full py-3 rounded-xl bg-surface-2 text-slate-300 hover:bg-surface-1 transition-colors text-sm font-medium"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
