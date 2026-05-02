/**
 * PlayerBench — Spieler-Auswahl aus dem Kader
 * Zeigt alle Spieler aus dem Kader, die noch nicht auf dem Feld sind.
 */
import { Search } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';

const positionColors = {
  'Torwart': 'text-yellow-400 bg-yellow-400/15',
  'Innenverteidiger': 'text-blue-400 bg-blue-400/15',
  'Außenverteidiger': 'text-blue-300 bg-blue-300/15',
  'Defensives Mittelfeld': 'text-green-400 bg-green-400/15',
  'Zentrales Mittelfeld': 'text-primary bg-primary/15',
  'Offensives Mittelfeld': 'text-orange-400 bg-orange-400/15',
  'Linksaußen': 'text-pink-400 bg-pink-400/15',
  'Rechtsaußen': 'text-pink-400 bg-pink-400/15',
  'Mittelstürmer': 'text-red-400 bg-red-400/15',
};

const positionShort = {
  'Torwart': 'TW', 'Innenverteidiger': 'IV', 'Außenverteidiger': 'AV',
  'Defensives Mittelfeld': 'DM', 'Zentrales Mittelfeld': 'ZM', 'Offensives Mittelfeld': 'OM',
  'Linksaußen': 'LA', 'Rechtsaußen': 'RA', 'Mittelstürmer': 'MS'
};

export default function PlayerBench({ players, placedIds, onAddPlayer, onRemovePlayer }) {
  const [search, setSearch] = useState('');
  const available = players.filter(p =>
    !placedIds.includes(p.id) &&
    (p.name?.toLowerCase().includes(search.toLowerCase()) ||
     p.position?.toLowerCase().includes(search.toLowerCase()))
  );
  const placed = players.filter(p => placedIds.includes(p.id));

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Spieler suchen..." className="pl-8 bg-muted border-border text-xs h-8" />
      </div>

      {/* Available players */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-2">
          Verfügbar ({available.length})
        </div>
        {available.map(p => (
          <button key={p.id} onClick={() => onAddPlayer(p)}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted hover:bg-secondary border border-transparent hover:border-primary/20 transition-all group text-left">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${positionColors[p.position] || 'bg-primary/15 text-primary'}`}>
              {p.number || positionShort[p.position] || p.name?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-foreground truncate">{p.name}</div>
              <div className="text-[10px] text-muted-foreground">{positionShort[p.position] || p.position}</div>
            </div>
            <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">+ Feld</span>
          </button>
        ))}
        {available.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">
            {search ? 'Keine Treffer' : 'Alle Spieler platziert'}
          </div>
        )}
      </div>

      {/* On pitch */}
      {placed.length > 0 && (
        <div className="border-t border-border pt-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-2">
            Auf dem Feld ({placed.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {placed.map(p => (
              <button key={p.id} onClick={() => onRemovePlayer(p.id)}
                title="Vom Feld entfernen"
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-[10px] font-medium hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400 transition-all">
                {p.number ? `#${p.number} ` : ''}{p.name?.split(' ').slice(-1)[0]}
                <span className="text-[9px] opacity-60">✕</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}