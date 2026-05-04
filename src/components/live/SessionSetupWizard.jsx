/**
 * SessionSetupWizard — Intelligenter 4-Schritt Onboarding-Wizard
 * Für Trainer die noch nie ein Tracking-System benutzt haben.
 * 
 * Schritt 1: Match-Name (wer spielt?) — AUTO-INTELLIGENT mit Heimmannschaft + Gegner aus Spielplan
 * Schritt 2: Kameras (wieviele & wo?)
 * Schritt 3: Spieler-Zuordnung (anonym oder mit Namen — optional!)
 * Schritt 4: Bestätigung & Start
 */
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Camera, Users, CheckCircle2, ChevronRight, ChevronLeft,
  Zap, UserX, UserCheck, Radio, Trophy, Smartphone, Info, Lightbulb, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ─── Step Indicator ──────────────────────────────────────────────────────────
function StepDot({ num, current, done, label }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all border-2 ${
        done    ? 'bg-primary border-primary text-primary-foreground'
        : current ? 'bg-background border-primary text-primary'
        : 'bg-muted border-muted-foreground/20 text-muted-foreground'
      }`}>
        {done ? <CheckCircle2 className="w-4 h-4" /> : num}
      </div>
      <span className={`text-[10px] font-medium hidden sm:block ${current ? 'text-primary' : 'text-muted-foreground'}`}>
        {label}
      </span>
    </div>
  );
}

function StepLine({ done }) {
  return (
    <div className="flex-1 h-0.5 mx-1 mt-[-18px] rounded-full transition-all duration-500"
      style={{ background: done ? 'hsl(var(--primary))' : 'hsl(var(--border))' }} />
  );
}

// ─── Step 1: Match Name (mit Smart-Vorschlag aus Spielplan) ──────────────
function StepMatchName({ value, onChange }) {
  // Lade Heimmannschaft
  const { data: club } = useQuery({
    queryKey: ['club-for-wizard'],
    queryFn: () => base44.entities.Club.list().then(c => c?.[0]),
    staleTime: 300000,
  });

  // Lade Matches für nächste 7 Tage
  const { data: upcomingMatches = [] } = useQuery({
    queryKey: ['upcoming-matches-wizard', club?.id],
    queryFn: async () => {
      if (!club?.id) return [];
      const matches = await base44.entities.ClubMatch.filter({ club_id: club.id }, '-date', 20);
      const now = new Date();
      return matches.filter(m => {
        const mDate = new Date(m.date);
        const diff = mDate.getTime() - now.getTime();
        return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
      }).sort((a, b) => new Date(a.date) - new Date(b.date));
    },
    enabled: !!club?.id,
    staleTime: 60000,
  });

  const homeClubName = club?.name || 'Heimteam';
  const suggestedMatch = upcomingMatches[0];

  // Auto-fill default beim ersten Render
  useEffect(() => {
    if (!value && suggestedMatch) {
      const homeTeam = suggestedMatch.is_home ? homeClubName : suggestedMatch.home_team;
      const awayTeam = suggestedMatch.is_home ? suggestedMatch.away_team : homeClubName;
      onChange(`${homeTeam} vs ${awayTeam}`);
    }
  }, [suggestedMatch?.id]);

  const quickSuggestions = suggestedMatch
    ? [
        { 
          label: suggestedMatch.is_home ? suggestedMatch.away_team : suggestedMatch.home_team,
          emoji: '⚡',
          hint: 'Aus Spielplan',
          action: () => {
            const homeTeam = suggestedMatch.is_home ? homeClubName : suggestedMatch.home_team;
            const awayTeam = suggestedMatch.is_home ? suggestedMatch.away_team : homeClubName;
            onChange(`${homeTeam} vs ${awayTeam}`);
          }
        },
        { label: 'Testspiel', emoji: '🧪', action: () => onChange(`${homeClubName} vs ...`) },
        { label: 'Training', emoji: '🏋️', action: () => onChange(`${homeClubName} Training`) },
      ]
    : [
        { label: 'Heimspiel', emoji: '🏠', action: () => onChange(`${homeClubName} vs ...`) },
        { label: 'Testspiel', emoji: '🧪', action: () => onChange(`${homeClubName} vs ...`) },
        { label: 'Training', emoji: '🏋️', action: () => onChange(`${homeClubName} Training`) },
      ];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="text-5xl mb-3">🏟️</div>
        <h2 className="text-2xl font-grotesk font-bold">Wer spielt heute?</h2>
        <p className="text-sm text-muted-foreground">
          {club ? (
            <>Heim: <strong className="text-primary">{homeClubName}</strong></> 
          ) : (
            'Match auswählen oder manuell eingeben'
          )}
        </p>
      </div>

      <div className="space-y-3">
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={`z.B. ${homeClubName || 'FC Muster'} vs ...`}
          className="text-lg font-bold h-14 text-center"
          autoFocus
        />

        <div className="space-y-2">
          <div className="text-xs text-muted-foreground px-2 font-medium">
            {suggestedMatch ? '⚡ Spielplan-Vorschläge' : '💡 Schnellauswahl'}
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            {quickSuggestions.map((sugg, idx) => (
              <button
                key={idx}
                onClick={sugg.action}
                className="px-3 py-2 rounded-full border border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-all flex items-center gap-1.5 bg-muted/30 hover:bg-muted/60">
                <span>{sugg.emoji}</span>
                <span>{sugg.label}</span>
                {sugg.hint && (
                  <span className="text-[9px] text-primary font-bold">{sugg.hint}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {suggestedMatch && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-xs text-green-400 flex items-start gap-2">
            <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>Im Spielplan gefunden: <strong>{suggestedMatch.is_home ? suggestedMatch.away_team : suggestedMatch.home_team}</strong> am <strong>{new Date(suggestedMatch.date).toLocaleDateString('de')}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 1b: Spieltyp & Feldkonfiguration ──────────────────────────────────
function StepGameConfig({ gameType, onGameTypeChange, playerCount, onPlayerCountChange, fieldSize, onFieldSizeChange }) {
  const gameTypes = [
    { id: 'official', emoji: '🏆', label: 'Offizielles Match', hint: 'Ligaspiel / Pokal' },
    { id: 'friendly', emoji: '⚽', label: 'Freundschaftsspiel', hint: 'Test- oder Trainingsspiel' },
    { id: 'training', emoji: '🏋️', label: 'Trainingseinheit', hint: 'Interner Trainingsbetrieb' },
  ];

  const fieldSizes = [
    { id: 'full', emoji: '📏', label: 'Großfeld', hint: '(105x68m)' },
    { id: 'half', emoji: '📐', label: 'Halbfeld', hint: 'Eine Platzhälfte' },
    { id: 'third', emoji: '🟩', label: 'Drittelfeld', hint: 'Verkleinerter Platz' },
    { id: 'mini', emoji: '🟨', label: 'Minifeld', hint: 'Klein-Futsal (4v4 / 5v5)' },
  ];

  const playerCountOptions = [4, 5, 6, 7, 8, 9, 10, 11];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="text-5xl mb-3">⚙️</div>
        <h2 className="text-2xl font-grotesk font-bold">Spieltyp & Feldgröße</h2>
        <p className="text-sm text-muted-foreground">Das System passt sich automatisch an.</p>
      </div>

      {/* Game Type */}
      <div className="space-y-3">
        <div className="text-xs font-bold uppercase text-muted-foreground">Art des Spiels</div>
        <div className="grid grid-cols-3 gap-2">
          {gameTypes.map(gt => (
            <button key={gt.id} onClick={() => onGameTypeChange(gt.id)}
              className={`p-3 rounded-lg border-2 text-center transition-all ${
                gameType === gt.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-muted/20 hover:border-primary/50'
              }`}>
              <div className="text-2xl mb-1">{gt.emoji}</div>
              <div className="font-bold text-xs">{gt.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{gt.hint}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Field Size */}
      <div className="space-y-3">
        <div className="text-xs font-bold uppercase text-muted-foreground">Spielfeld</div>
        <div className="grid grid-cols-2 gap-2">
          {fieldSizes.map(fs => (
            <button key={fs.id} onClick={() => onFieldSizeChange(fs.id)}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                fieldSize === fs.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-muted/20 hover:border-primary/50'
              }`}>
              <div className="text-xl mb-1">{fs.emoji}</div>
              <div className="font-bold text-xs">{fs.label}</div>
              <div className="text-[10px] text-muted-foreground">{fs.hint}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Player Count */}
      <div className="space-y-3">
        <div className="text-xs font-bold uppercase text-muted-foreground">Spieler pro Team</div>
        <div className="grid grid-cols-4 gap-2">
          {playerCountOptions.map(pc => (
            <button key={pc} onClick={() => onPlayerCountChange(pc)}
              className={`py-3 rounded-lg border-2 font-bold text-sm transition-all ${
                playerCount === pc
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-muted/20 text-foreground hover:border-primary/50'
              }`}>
              {pc}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-400 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>Das Tracking-System passt sich automatisch an die Feldgröße und Spieleranzahl an. Die Erkennungsgenauigkeit wird optimiert.</span>
      </div>
    </div>
  );
}

// ─── Step 3: Kameras ─────────────────────────────────────────────────────────
function StepCameras({ count, onChange }) {
  const options = [
    { n: 1, emoji: '📱', label: 'Eine Kamera', hint: 'Perfekt für Anfänger. Einfach Handy hinstellen.' },
    { n: 2, emoji: '📱📱', label: 'Zwei Kameras', hint: 'Beide Hälftenseiten abdecken.' },
    { n: 3, emoji: '📱📱📱', label: 'Drei Kameras', hint: 'Professionelle Abdeckung des ganzen Feldes.' },
    { n: 4, emoji: '🎥🎥🎥🎥', label: 'Vier Kameras', hint: 'Lückenlose 360°-Feldabdeckung.' },
  ];
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="text-5xl mb-3">📹</div>
        <h2 className="text-2xl font-grotesk font-bold">Wieviele Handys / Kameras?</h2>
        <p className="text-sm text-muted-foreground">Jedes Handy wird zur Kamera. Jeder mit Kamera-Link filmt mit.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map(opt => (
          <button key={opt.n} onClick={() => onChange(opt.n)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              count === opt.n
                ? 'border-primary bg-primary/10'
                : 'border-border bg-muted/20 hover:border-primary/50'
            }`}>
            <div className="text-2xl mb-1">{opt.emoji}</div>
            <div className="font-bold text-sm">{opt.label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{opt.hint}</div>
          </button>
        ))}
      </div>

      <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-400">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>Du bekommst danach automatisch <strong>Kamera-Links</strong> zum Teilen — einfach per WhatsApp an die Kameramänner schicken.</span>
      </div>
    </div>
  );
}

// ─── Step 4: Spieler-Zuordnung ────────────────────────────────────────────────
function StepPlayers({ mode, onChange, homeLineup, awayLineup, onTogglePlayer }) {
  const { data: players = [] } = useQuery({
    queryKey: ['wizard-players'],
    queryFn: () => base44.entities.Player.list('-created_date', 100),
    staleTime: 60000,
  });

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <div className="text-5xl mb-3">👥</div>
        <h2 className="text-2xl font-grotesk font-bold">Spieler-Tracking</h2>
        <p className="text-sm text-muted-foreground">Sollen einzelne Spieler erkannt werden, oder reicht anonymes Tracking?</p>
      </div>

      {/* Mode Selection */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onChange('anonymous')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            mode === 'anonymous' ? 'border-primary bg-primary/10' : 'border-border bg-muted/20 hover:border-primary/50'
          }`}>
          <UserX className="w-6 h-6 text-muted-foreground mb-2" />
          <div className="font-bold text-sm">Anonym</div>
          <div className="text-[11px] text-muted-foreground mt-1">Spieler heißen H1–H11 / G1–G11. Statistiken laufen trotzdem voll!</div>
          <div className="mt-2 text-[10px] bg-green-500/15 text-green-400 px-2 py-1 rounded-full inline-block">⚡ Empfohlen — schnell & einfach</div>
        </button>

        <button onClick={() => onChange('lineup')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            mode === 'lineup' ? 'border-primary bg-primary/10' : 'border-border bg-muted/20 hover:border-primary/50'
          }`}>
          <UserCheck className="w-6 h-6 text-primary mb-2" />
          <div className="font-bold text-sm">Mit Aufstellung</div>
          <div className="text-[11px] text-muted-foreground mt-1">Spieler werden namentlich erkannt. Individuelle Statistiken möglich.</div>
          {players.length === 0 && (
            <div className="mt-2 text-[10px] bg-yellow-500/15 text-yellow-400 px-2 py-1 rounded-full inline-block">⚠️ Keine Spieler in DB</div>
          )}
        </button>
      </div>

      {/* Lineup Selection (wenn mode === 'lineup') */}
      <AnimatePresence>
        {mode === 'lineup' && players.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-3">

            {/* Home */}
            <div>
              <div className="text-xs font-bold text-green-400 mb-2 flex items-center gap-1">
                🏠 Heimteam <span className="text-muted-foreground font-normal">({homeLineup.length}/11)</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto bg-muted/20 rounded-xl p-2">
                {players.map(p => {
                  const inHome = homeLineup.includes(p.id);
                  const inAway = awayLineup.includes(p.id);
                  return (
                    <button key={p.id} disabled={inAway} onClick={() => !inAway && onTogglePlayer(p.id, 'home')}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                        inHome ? 'bg-green-500/20 border-green-500/40 text-green-400'
                        : inAway ? 'opacity-30 cursor-not-allowed bg-muted border-transparent text-muted-foreground'
                        : 'bg-background border-border text-foreground hover:border-green-500/40'
                      }`}>
                      {inHome && '✓ '}{p.number ? `#${p.number} ` : ''}{p.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Away */}
            <div>
              <div className="text-xs font-bold text-red-400 mb-2 flex items-center gap-1">
                ✈️ Gastteam <span className="text-muted-foreground font-normal">({awayLineup.length}/11)</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto bg-muted/20 rounded-xl p-2">
                {players.map(p => {
                  const inHome = homeLineup.includes(p.id);
                  const inAway = awayLineup.includes(p.id);
                  return (
                    <button key={p.id} disabled={inHome} onClick={() => !inHome && onTogglePlayer(p.id, 'away')}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                        inAway ? 'bg-red-500/20 border-red-500/40 text-red-400'
                        : inHome ? 'opacity-30 cursor-not-allowed bg-muted border-transparent text-muted-foreground'
                        : 'bg-background border-border text-foreground hover:border-red-500/40'
                      }`}>
                      {inAway && '✓ '}{p.number ? `#${p.number} ` : ''}{p.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground bg-muted/40 rounded-lg p-2">
              💡 Die automatische Zuordnung erfolgt beim Anstoß anhand der Feldpositionen. Du kannst dies später auch manuell korrigieren.
            </p>
          </motion.div>
        )}

        {mode === 'lineup' && players.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-400 text-center">
            <div className="text-2xl mb-2">⚠️</div>
            Noch keine Spieler in der Datenbank.<br />
            <span className="text-xs text-muted-foreground">Wechsel zu "Anonym" oder lege erst Spieler unter <strong>Spieler</strong> an.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Step 5: Bestätigung ──────────────────────────────────────────────────────
function StepConfirm({ matchTitle, cameraCount, playerMode, homeLineup, awayLineup, gameType, playerCount, fieldSize }) {
  const gameTypeLabel = { official: 'Offizielles Match', friendly: 'Freundschaftsspiel', training: 'Trainingseinheit' }[gameType] || 'Match';
  const fieldSizeLabel = { full: 'Großfeld (105x68m)', half: 'Halbfeld', third: 'Drittelfeld', mini: 'Minifeld' }[fieldSize] || 'Standardfeld';

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <div className="text-5xl mb-3">🚀</div>
        <h2 className="text-2xl font-grotesk font-bold">Alles bereit!</h2>
        <p className="text-sm text-muted-foreground">Überprüfe deine Einstellungen und starte dann.</p>
      </div>

      <div className="space-y-3">
        <div className="bg-muted/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">Match</div>
              <div className="font-bold text-sm">{matchTitle}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 text-blue-400 flex-shrink-0">⚙️</div>
            <div>
              <div className="text-xs text-muted-foreground">Konfiguration</div>
              <div className="font-bold text-sm">{gameTypeLabel} • {playerCount}v{playerCount} • {fieldSizeLabel}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">Kameras</div>
              <div className="font-bold">{cameraCount} Kamera{cameraCount !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-green-400 flex-shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">Spieler-Tracking</div>
              <div className="font-bold">
                {playerMode === 'lineup'
                  ? `Mit Aufstellung (${homeLineup.length + awayLineup.length} Spieler)`
                  : `Anonym (${playerCount} pro Team)`}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-sm text-green-400 space-y-1.5">
          <div className="font-bold mb-2">Was passiert nach dem Start:</div>
          <div className="flex items-start gap-2 text-xs">
            <span className="flex-shrink-0">1️⃣</span>
            <span>Du siehst das <strong>Live-Dashboard</strong> mit allen Kameras</span>
          </div>
          <div className="flex items-start gap-2 text-xs">
            <span className="flex-shrink-0">2️⃣</span>
            <span>Kameramänner erhalten ihre Links → auf Handy öffnen → fertig</span>
          </div>
          <div className="flex items-start gap-2 text-xs">
            <span className="flex-shrink-0">3️⃣</span>
            <span>Beim <strong>Anstoß-Button</strong> drücken → Tracking kalibriert sich automatisch</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN WIZARD ──────────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Match' },
  { label: 'Setup' },
  { label: 'Spieler' },
  { label: 'Kameras' },
  { label: 'Start' },
];

export default function SessionSetupWizard({ onStart, isLoading }) {
  const [step, setStep] = useState(0); // 0-4
  const [matchTitle, setMatchTitle] = useState('');
  const [gameType, setGameType] = useState('official');
  const [playerCount, setPlayerCount] = useState(11);
  const [fieldSize, setFieldSize] = useState('full');
  const [cameraCount, setCameraCount] = useState(1);
  const [playerMode, setPlayerMode] = useState('anonymous');
  const [homeLineup, setHomeLineup] = useState([]);
  const [awayLineup, setAwayLineup] = useState([]);
  const [dir, setDir] = useState(1); // 1=forward, -1=back

  const togglePlayer = (id, team) => {
    if (team === 'home') {
      setHomeLineup(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 11 ? [...prev, id] : prev);
    } else {
      setAwayLineup(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 11 ? [...prev, id] : prev);
    }
  };

  const canNext = () => {
    if (step === 0) return matchTitle.trim().length > 0;
    return true;
  };

  const goNext = () => {
    if (!canNext()) return;
    setDir(1);
    setStep(s => s + 1);
  };

  const goBack = () => {
    setDir(-1);
    setStep(s => s - 1);
  };

  const handleStart = () => {
    const cameras = Array.from({ length: cameraCount }, (_, i) => ({
      camera_id: (i + 1).toString(),
      label: cameraCount === 1 ? 'Hauptkamera' : `Kamera ${i + 1}`,
      stream_url: '',
      status: 'waiting',
      code: Math.random().toString(36).substring(2, 8).toUpperCase(),
    }));

    const playerAssignments = playerMode === 'lineup' && (homeLineup.length > 0 || awayLineup.length > 0)
      ? { mode: 'lineup', home_lineup: homeLineup, away_lineup: awayLineup }
      : { mode: 'anonymous' };

    onStart({
      match_title: matchTitle,
      status: 'active',
      half_time: 1,
      started_at: new Date().toISOString(),
      camera_streams: cameras,
      player_assignment_mode: playerMode,
      player_assignments: playerAssignments,
      game_type: gameType,
      player_count: playerCount,
      field_size: fieldSize,
    });
  };

  const variants = {
    enter: (d) => ({ opacity: 0, x: d > 0 ? 40 : -40 }),
    center: { opacity: 1, x: 0 },
    exit: (d) => ({ opacity: 0, x: d > 0 ? -40 : 40 }),
  };

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-between px-2">
        {STEPS.map((s, i) => (
          <React.Fragment key={i}>
            <StepDot num={i + 1} current={step === i} done={step > i} label={s.label} />
            {i < STEPS.length - 1 && <StepLine done={step > i} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <div className="relative overflow-hidden min-h-[320px]">
        <AnimatePresence custom={dir} mode="wait">
          <motion.div key={step} custom={dir} variants={variants}
            initial="enter" animate="center" exit="exit"
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}>
            {step === 0 && <StepMatchName value={matchTitle} onChange={setMatchTitle} />}
            {step === 1 && (
              <StepGameConfig
                gameType={gameType} onGameTypeChange={setGameType}
                playerCount={playerCount} onPlayerCountChange={setPlayerCount}
                fieldSize={fieldSize} onFieldSizeChange={setFieldSize}
              />
            )}
            {step === 2 && (
              <StepPlayers
                mode={playerMode} onChange={setPlayerMode}
                homeLineup={homeLineup} awayLineup={awayLineup}
                onTogglePlayer={togglePlayer}
              />
            )}
            {step === 3 && <StepCameras count={cameraCount} onChange={setCameraCount} />}
            {step === 4 && (
              <StepConfirm
                matchTitle={matchTitle} cameraCount={cameraCount}
                playerMode={playerMode} homeLineup={homeLineup} awayLineup={awayLineup}
                gameType={gameType} playerCount={playerCount} fieldSize={fieldSize}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 0 && (
          <Button variant="outline" onClick={goBack} className="flex-none gap-1">
            <ChevronLeft className="w-4 h-4" /> Zurück
          </Button>
        )}

        {step < 4 ? (
          <Button onClick={goNext} disabled={!canNext()} className="flex-1 h-12 font-bold gap-2">
            Weiter <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button onClick={handleStart} disabled={isLoading} className="flex-1 h-14 text-base font-bold bg-red-600 hover:bg-red-700 gap-2">
            {isLoading
              ? '⏳ Wird gestartet...'
              : <><Radio className="w-5 h-5 animate-pulse" /> Session starten!</>
            }
          </Button>
        )}
      </div>

      {/* Skip hint on step 2 */}
      {step === 2 && (
        <p className="text-center text-xs text-muted-foreground">
          💡 Kein Stress — du kannst Spieler auch <strong>während</strong> der Session zuordnen.
        </p>
      )}
      
      {/* Info on step 3 */}
      {step === 3 && (
        <p className="text-center text-xs text-muted-foreground">
          💡 Du kannst Kameras auch <strong>während</strong> der Session hinzufügen oder entfernen.
        </p>
      )}
    </div>
  );
}