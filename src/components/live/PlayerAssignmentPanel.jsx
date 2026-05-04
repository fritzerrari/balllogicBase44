/**
 * PlayerAssignmentPanel — Spieler-Zuordnung beim Anstoß
 * 
 * Modus 1 (Ohne Aufstellung): Tracking läuft anonym als H1-H11 / G1-G11
 * Modus 2 (Mit Aufstellung): Trainer gibt Startelf ein → Auto-Matching per Position
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Zap, Check, X, ChevronDown, ChevronUp, Loader2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Positions-Mapping für automatisches Matching (y-Koordinate Erwartungswert)
const POSITION_Y_HINTS = {
  'Torwart':               50,
  'Innenverteidiger':      50,
  'Außenverteidiger':      30,
  'Defensives Mittelfeld': 50,
  'Zentrales Mittelfeld':  50,
  'Offensives Mittelfeld': 50,
  'Linksaußen':            20,
  'Rechtsaußen':           80,
  'Mittelstürmer':         50,
};

// Distanz zwischen zwei Punkten
function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// Auto-Matching: ordne Spieler-Liste den Tracker-Positionen per nächstem Nachbarn zu
function autoMatchPlayers(players, trackerPositions) {
  if (!trackerPositions?.length || !players?.length) return {};
  
  const assignments = {};
  const usedTrackers = new Set();
  
  // Sortiere Spieler nach Position-Typ für bessere Zuordnung
  const sorted = [...players].sort((a, b) => {
    const ya = POSITION_Y_HINTS[a.position] ?? 50;
    const yb = POSITION_Y_HINTS[b.position] ?? 50;
    return ya - yb;
  });
  
  sorted.forEach(player => {
    const expectedY = POSITION_Y_HINTS[player.position] ?? 50;
    // Finde nächsten freien Tracker
    let best = null;
    let bestDist = Infinity;
    trackerPositions.forEach(tp => {
      if (usedTrackers.has(tp.tracker_id ?? tp.x)) return;
      const d = dist({ x: tp.x, y: tp.y }, { x: 25, y: expectedY }); // x=25 = linke Seite Home
      if (d < bestDist) { bestDist = d; best = tp; }
    });
    if (best) {
      assignments[best.tracker_id ?? `${best.x}_${best.y}`] = player.id;
      usedTrackers.add(best.tracker_id ?? best.x);
    }
  });
  
  return assignments;
}

export default function PlayerAssignmentPanel({ session, onAssigned }) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState('anonymous'); // 'anonymous' | 'lineup'
  const [homeLineup, setHomeLineup] = useState([]); // selected player IDs for home
  const [awayLineup, setAwayLineup] = useState([]); // selected player IDs for away
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Spieler aus DB laden
  const { data: allPlayers = [] } = useQuery({
    queryKey: ['players-for-assignment'],
    queryFn: () => base44.entities.Player.list('-created_date', 100),
    staleTime: 60000,
  });

  // Letzte Tracking-Positionen für Auto-Match
  const { data: latestTracking } = useQuery({
    queryKey: ['tracking-for-assignment', session?.id],
    queryFn: () => base44.entities.TrackingData.filter({ session_id: session.id }, '-timestamp_ms', 1),
    select: d => d?.[0],
    staleTime: 10000,
    enabled: !!session?.id,
  });

  const homePlayers = allPlayers.filter(p => homeLineup.includes(p.id));
  const awayPlayers = allPlayers.filter(p => awayLineup.includes(p.id));

  const togglePlayer = (playerId, team) => {
    if (team === 'home') {
      setHomeLineup(prev =>
        prev.includes(playerId)
          ? prev.filter(id => id !== playerId)
          : prev.length < 11 ? [...prev, playerId] : prev
      );
    } else {
      setAwayLineup(prev =>
        prev.includes(playerId)
          ? prev.filter(id => id !== playerId)
          : prev.length < 11 ? [...prev, playerId] : prev
      );
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let assignmentData = { mode };

      if (mode === 'lineup' && latestTracking?.player_positions) {
        const homePositions = latestTracking.player_positions.filter(p => p.team === 'home');
        const awayPositions = latestTracking.player_positions.filter(p => p.team === 'away');

        const homeAssignments = autoMatchPlayers(homePlayers, homePositions);
        const awayAssignments = autoMatchPlayers(awayPlayers, awayPositions);

        assignmentData = {
          ...assignmentData,
          home_lineup: homeLineup,
          away_lineup: awayLineup,
          home_tracker_assignments: homeAssignments,
          away_tracker_assignments: awayAssignments,
        };
      }

      // Speichere in Session
      await base44.entities.LiveSession.update(session.id, {
        player_assignment_mode: mode,
        player_assignments: assignmentData,
      });

      setSaved(true);
      if (onAssigned) onAssigned(assignmentData);
      setTimeout(() => setExpanded(false), 1000);
    } catch (e) {
      // ignore
    }
    setSaving(false);
  };

  if (saved) {
    return (
      <div className="glass rounded-xl p-3 border border-primary/20 flex items-center gap-2 text-xs text-primary">
        <UserCheck className="w-4 h-4" />
        {mode === 'lineup' ? `Aufstellung gespeichert (${homeLineup.length} + ${awayLineup.length} Spieler)` : 'Anonymes Tracking aktiv'}
      </div>
    );
  }

  return (
    <div className="glass rounded-xl border border-border overflow-hidden">
      {/* Header Toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold">Spieler-Zuordnung</span>
          <Badge variant="outline" className="text-[10px]">Optional</Badge>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-border">

              {/* Mode Toggle */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setMode('anonymous')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    mode === 'anonymous'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  🔢 Anonym (H1-H11)
                </button>
                <button
                  onClick={() => setMode('lineup')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    mode === 'lineup'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  👤 Mit Aufstellung
                </button>
              </div>

              {mode === 'anonymous' && (
                <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground">
                  <p>Tracking läuft ohne individuelle Zuordnung.</p>
                  <p className="mt-1">Spieler werden als <strong className="text-foreground">H1–H11</strong> (Heim) und <strong className="text-foreground">G1–G11</strong> (Gäste) geführt. Statistiken (Laufwege, Ballkontakte) werden trotzdem erfasst.</p>
                </div>
              )}

              {mode === 'lineup' && (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5">
                    <strong className="text-blue-400">Auto-Matching:</strong> Nach dem Anstoß werden Spieler anhand ihrer Feldposition automatisch zugeordnet. Maximal 11 pro Team.
                  </div>

                  {/* Home Team */}
                  <div>
                    <div className="text-xs font-bold text-green-400 mb-2">🏠 Heimteam ({homeLineup.length}/11)</div>
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                      {allPlayers.map(p => {
                        const isHome = homeLineup.includes(p.id);
                        const isAway = awayLineup.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => !isAway && togglePlayer(p.id, 'home')}
                            disabled={isAway}
                            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                              isHome
                                ? 'bg-green-500/20 border border-green-500/40 text-green-400'
                                : isAway
                                  ? 'opacity-30 cursor-not-allowed bg-muted text-muted-foreground'
                                  : 'bg-muted text-muted-foreground hover:text-foreground border border-transparent hover:border-border'
                            }`}
                          >
                            {isHome && <Check className="w-2.5 h-2.5 inline mr-1" />}
                            {p.number ? `#${p.number} ` : ''}{p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Away Team */}
                  <div>
                    <div className="text-xs font-bold text-red-400 mb-2">✈️ Gastteam ({awayLineup.length}/11)</div>
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                      {allPlayers.map(p => {
                        const isHome = homeLineup.includes(p.id);
                        const isAway = awayLineup.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => !isHome && togglePlayer(p.id, 'away')}
                            disabled={isHome}
                            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                              isAway
                                ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                                : isHome
                                  ? 'opacity-30 cursor-not-allowed bg-muted text-muted-foreground'
                                  : 'bg-muted text-muted-foreground hover:text-foreground border border-transparent hover:border-border'
                            }`}
                          >
                            {isAway && <Check className="w-2.5 h-2.5 inline mr-1" />}
                            {p.number ? `#${p.number} ` : ''}{p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full gap-2"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Speichern...</>
                  : <><Zap className="w-4 h-4" /> Zuordnung aktivieren</>
                }
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}