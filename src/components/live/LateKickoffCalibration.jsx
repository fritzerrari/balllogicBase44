/**
 * LateKickoffCalibration — Wenn der Anstoß verpasst wurde
 * Ermöglicht manuelle Team-Kalibrierung zu jedem Zeitpunkt:
 * - Manuelles Seitenzuweisung (Heim = links/rechts)
 * - Aus letzten Frames neu kalibrieren
 * - Halbzeitwechsel berücksichtigen
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { RotateCcw, ArrowLeftRight, CheckCircle2, Loader2, AlertTriangle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function LateKickoffCalibration({ session, onCalibrated }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // null | 'ok' | 'error'
  const [msg, setMsg] = useState('');
  const [homeSide, setHomeSide] = useState('left'); // 'left' | 'right'

  const doCalibrate = async (side) => {
    setLoading(true);
    setStatus(null);
    try {
      // Hole die letzten Tracking-Frames
      const frames = await base44.entities.TrackingData.filter(
        { session_id: session.id }, '-timestamp_ms', 5
      );

      const latest = frames.find(f => f.player_positions?.length >= 10)
        || frames.find(f => f.player_positions?.length >= 6)
        || frames[0];

      if (!latest || !latest.player_positions?.length) {
        setStatus('error');
        setMsg('Keine Spieler erkannt. Warte auf Tracking-Daten.');
        setLoading(false);
        return;
      }

      const players = latest.player_positions;
      const threshold = 50; // Feldmitte
      let homePositions, awayPositions;

      if (side === 'left') {
        homePositions = players.filter(p => p.x < threshold);
        awayPositions = players.filter(p => p.x >= threshold);
      } else {
        homePositions = players.filter(p => p.x >= threshold);
        awayPositions = players.filter(p => p.x < threshold);
      }

      // Fallback: gleichmäßig aufteilen wenn Verteilung sehr ungleich
      if (homePositions.length < 3 || awayPositions.length < 3) {
        const sorted = [...players].sort((a, b) => a.x - b.x);
        const mid = Math.floor(sorted.length / 2);
        homePositions = side === 'left' ? sorted.slice(0, mid) : sorted.slice(mid);
        awayPositions = side === 'left' ? sorted.slice(mid) : sorted.slice(0, mid);
      }

      await base44.entities.LiveSession.update(session.id, {
        kickoff_detected: true,
        kickoff_timestamp: new Date().toISOString(),
        home_team_positions: homePositions.map(p => ({ player_id: p.player_id, x: p.x, y: p.y })),
        away_team_positions: awayPositions.map(p => ({ player_id: p.player_id, x: p.x, y: p.y })),
      });

      setStatus('ok');
      setMsg(`✓ ${homePositions.length} Heim · ${awayPositions.length} Gäste kalibriert`);
      setTimeout(() => onCalibrated?.(), 1500);
    } catch (e) {
      setStatus('error');
      setMsg('Fehler: ' + e.message);
    }
    setLoading(false);
  };

  const swapTeams = async () => {
    if (!session.home_team_positions || !session.away_team_positions) return;
    setLoading(true);
    await base44.entities.LiveSession.update(session.id, {
      home_team_positions: session.away_team_positions,
      away_team_positions: session.home_team_positions,
    });
    setStatus('ok');
    setMsg('Teams getauscht');
    setLoading(false);
    setTimeout(() => onCalibrated?.(), 1000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4 border border-yellow-500/30 bg-yellow-500/5 space-y-3"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-grotesk font-bold text-sm text-foreground">Späte Team-Kalibrierung</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Anstoß verpasst? Kalibriere Teams jetzt aus dem aktuellen Frame.
          </p>
        </div>
      </div>

      {/* Welche Seite ist Heim? */}
      <div>
        <div className="text-[11px] text-muted-foreground mb-2 font-medium">Heimteam spielt gerade auf:</div>
        <div className="flex gap-2">
          <button
            onClick={() => setHomeSide('left')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
              homeSide === 'left' ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-muted border-border text-muted-foreground hover:border-primary/30'
            }`}
          >
            ← Links (Heim)
          </button>
          <button
            onClick={() => setHomeSide('right')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
              homeSide === 'right' ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-muted border-border text-muted-foreground hover:border-primary/30'
            }`}
          >
            Rechts (Heim) →
          </button>
        </div>
      </div>

      {/* Status */}
      {status && (
        <div className={`text-xs px-3 py-2 rounded-lg border flex items-center gap-2 ${
          status === 'ok' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {status === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {msg}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={() => doCalibrate(homeSide)}
          disabled={loading}
          size="sm"
          className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold gap-1.5"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          Jetzt kalibrieren
        </Button>
        {session?.kickoff_detected && (
          <Button onClick={swapTeams} disabled={loading} size="sm" variant="outline" className="gap-1.5">
            <ArrowLeftRight className="w-3.5 h-3.5" /> Teams tauschen
          </Button>
        )}
      </div>

      <div className="text-[10px] text-muted-foreground bg-muted/40 rounded-lg p-2 space-y-0.5">
        <div>💡 Kalibrierung nutzt aktuelle Spielerpositionen aus letztem Frame</div>
        <div>💡 Bei Halbzeit: Teams tauschen (Seitenwechsel)</div>
        <div>💡 Mindestens 6 erkannte Spieler nötig für Kalibrierung</div>
      </div>
    </motion.div>
  );
}