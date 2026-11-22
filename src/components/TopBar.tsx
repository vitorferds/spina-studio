import React from 'react';
import { ARCHETYPE_PRESETS, ArchetypeId } from '../types/studio';

interface TopBarProps {
  activeArchetype: ArchetypeId;
  onSelectArchetype: (id: ArchetypeId) => void;
  onOpenExport: () => void;
}

const ARCHETYPE_IDS: ArchetypeId[] = ['spine', 'thorn', 'neotribal', 'chain', 'fiber'];

export const TopBar: React.FC<TopBarProps> = ({
  activeArchetype,
  onSelectArchetype,
  onOpenExport,
}) => {
  return (
    <header className="fixed top-0 inset-x-0 z-30 h-14 px-6 flex items-center justify-between gap-8 bg-[#0b0c0f]/95 border-b border-white/10">
      {/* Zone 1: Single text element wordmark */}
      <span className="font-display text-lg font-bold tracking-tight text-zinc-100 whitespace-nowrap shrink-0">
        Spina Studio
      </span>

      {/* Zone 2: 5 concise single-line archetype tabs */}
      <nav
        aria-label="Arquétipos 3D"
        className="flex items-center gap-6 overflow-x-auto no-scrollbar"
      >
        {ARCHETYPE_IDS.map((id) => {
          const isActive = activeArchetype === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectArchetype(id)}
              className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-sm ${
                isActive
                  ? 'text-cyan-300'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {ARCHETYPE_PRESETS[id].label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 right-0 -bottom-1 h-[2px] bg-cyan-400"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="shrink-0">
        <button
          type="button"
          onClick={onOpenExport}
          className="px-4 py-2 text-xs font-semibold tracking-wide bg-cyan-400 text-zinc-950 rounded-md hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          Exportar Mídia
        </button>
      </div>
    </header>
  );
};
