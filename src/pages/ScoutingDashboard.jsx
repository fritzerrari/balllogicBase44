/**
 * ScoutingDashboard – Gegner analysieren vor Spiel
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, Search, Target } from 'lucide-react';
import { Input } from '@/components/ui/input';
import OpponentPlayerCard from '@/components/scouting/OpponentPlayerCard';
import OpponentAnalysisModal from '@/components/scouting/OpponentAnalysisModal';

export default function ScoutingDashboard() {
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [search, setSearch] = useState('');

  const { data: opponents = [] } = useQuery({
    queryKey: ['opponents'],
    queryFn: () => base44.entities.Opponent.list('-danger_level', 50),
  });

  const { data: opponentPlayers = [] } = useQuery({
    queryKey: ['opponent-players', selectedOpponent?.id],
    queryFn: () => selectedOpponent
      ? base44.entities.OpponentPlayer.filter({ opponent_id: selectedOpponent.id })
      : Promise.resolve([]),
    enabled: !!selectedOpponent,
  });

  const filteredPlayers = opponentPlayers.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.position.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 lg:p-8 min-h-screen max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-grotesk font-bold text-foreground flex items-center gap-2 mb-4">
          <Target className="w-6 h-6 text-primary" />
          Gegner-Scouting
        </h1>
      </motion.div>

      {!selectedOpponent ? (
        // Opponent List
        <div className="space-y-3">
          <h2 className="font-grotesk font-semibold text-foreground">Gegnerische Teams</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {opponents.map((opp, i) => (
              <motion.div
                key={opp.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setSelectedOpponent(opp)}
                className="glass rounded-xl p-4 border border-border hover:border-primary/40 cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold text-foreground">{opp.name}</div>
                    <div className="text-xs text-muted-foreground">{opp.league}</div>
                  </div>
                  <div className={`text-xs font-bold px-2 py-1 rounded-lg ${
                    opp.danger_level === 'sehr hoch' ? 'bg-red-500/20 text-red-400' :
                    opp.danger_level === 'hoch' ? 'bg-orange-500/20 text-orange-400' :
                    opp.danger_level === 'mittel' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {opp.danger_level}
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div>
                    <span className="text-muted-foreground">Formation:</span>
                    <span className="text-foreground ml-1 font-bold">{opp.preferred_formation}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Stil:</span>
                    <span className="text-foreground ml-1">{opp.playing_style}</span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-border/30 text-center">
                  <span className="text-xs text-primary font-bold">→ Klick für Spieler</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        // Players View
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-grotesk font-bold text-foreground">{selectedOpponent.name}</h2>
              <p className="text-xs text-muted-foreground mt-1">{selectedOpponent.league} · {selectedOpponent.preferred_formation}</p>
            </div>
            <button
              onClick={() => {
                setSelectedOpponent(null);
                setSearch('');
              }}
              className="px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-bold hover:text-foreground transition-colors"
            >
              ← Zurück
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Nach Spieler oder Position suchen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Players Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredPlayers.map((player, i) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <OpponentPlayerCard
                  player={player}
                  onAnalyze={() => setSelectedPlayer(player)}
                />
              </motion.div>
            ))}
          </div>

          {filteredPlayers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Keine Spieler gefunden
            </div>
          )}
        </div>
      )}

      {/* Analysis Modal */}
      {selectedPlayer && (
        <OpponentAnalysisModal
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}