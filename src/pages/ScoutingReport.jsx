import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, AlertTriangle, TrendingUp, Shield, Loader2, Target, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ScoutingReport() {
  const navigate = useNavigate();
  const [opponent, setOpponent] = useState('');
  const [loading, setLoading] = useState(false);
  const [scouting, setScouting] = useState(null);

  const { data: matches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: () => base44.entities.Match.list('-date', 50),
  });
  const { data: reports = [] } = useQuery({
    queryKey: ['reports-all'],
    queryFn: () => base44.entities.AnalysisReport.list('-created_date', 50),
  });

  // Find all matches against this opponent
  const opponentMatches = matches.filter(m =>
    m.home_team?.toLowerCase().includes(opponent.toLowerCase()) ||
    m.away_team?.toLowerCase().includes(opponent.toLowerCase())
  );

  const opponents = [...new Set([
    ...matches.map(m => m.home_team),
    ...matches.map(m => m.away_team),
  ])].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

  const handleAnalyze = async () => {
    if (!opponent) return;
    setLoading(true);
    const matchData = opponentMatches.map(m => {
      const r = reports.find(r => r.match_id === m.id);
      return `${m.title} (${m.date}): ${m.score_home}–${m.score_away}, Formation: ${r?.formation_away || '?'}, Pressing: ${r?.pressing_index_away || '?'}/100`;
    }).join('\n');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Du bist Scouting-Analyst. Erstelle ein Gegner-Profil für: ${opponent}
Bekannte Spieldaten:\n${matchData || 'Keine direkten Begegnungen — nutze allgemeines Wissen über dieses Team.'}
Erstelle ein kompaktes Scouting-Profil.`,
      response_json_schema: {
        type: 'object',
        properties: {
          typical_formation: { type: 'string' },
          play_style: { type: 'string' },
          strengths: { type: 'array', items: { type: 'string' } },
          weaknesses: { type: 'array', items: { type: 'string' } },
          danger_players: { type: 'string' },
          tactical_recommendation: { type: 'string' },
          set_piece_warning: { type: 'string' },
          pressing_intensity: { type: 'string' },
        }
      }
    });
    setScouting({ ...result, opponent });
    setLoading(false);
  };

  return (
    <div className="p-6 lg:p-8 min-h-screen max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-grotesk font-bold text-foreground mb-1">Gegner-Scouting</h1>
          <p className="text-muted-foreground">KI-Profil aus eigenen Spielen & Gegner-Daten</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => navigate('/scouting-dashboard')}
          className="gap-2"
        >
          <Target className="w-4 h-4" /> Spieler-Details
        </Button>
      </motion.div>

      <div className="glass rounded-xl p-5 mb-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={opponent}
              onChange={e => setOpponent(e.target.value)}
              placeholder="Gegner eingeben (z.B. Borussia Dortmund)"
              className="pl-9 bg-muted border-border"
              list="opponents-list"
            />
            <datalist id="opponents-list">
              {opponents.map(o => <option key={o} value={o} />)}
            </datalist>
          </div>
          <Button onClick={handleAnalyze} disabled={!opponent || loading} className="bg-primary text-primary-foreground neon-glow gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Analysieren
          </Button>
        </div>
        {opponentMatches.length > 0 && (
          <div className="mt-3 text-xs text-muted-foreground">
            {opponentMatches.length} Begegnung{opponentMatches.length > 1 ? 'en' : ''} in der Datenbank
          </div>
        )}
      </div>

      {loading && (
        <div className="glass rounded-2xl p-12 text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
          <div className="font-grotesk font-semibold text-foreground">Scouting-Profil wird erstellt...</div>
        </div>
      )}

      {scouting && !loading && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="glass rounded-xl p-5">
            <h2 className="font-grotesk font-bold text-xl text-foreground mb-1">{scouting.opponent}</h2>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="text-primary font-bold">{scouting.typical_formation}</span>
              <span>·</span>
              <span>{scouting.pressing_intensity}</span>
            </div>
            <p className="text-sm text-foreground/80 mt-3">{scouting.play_style}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="glass rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3 text-primary">
                <TrendingUp className="w-4 h-4" />
                <h3 className="font-grotesk font-semibold text-sm">Stärken</h3>
              </div>
              <ul className="space-y-1.5">
                {(scouting.strengths || []).map((s, i) => (
                  <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                    <span className="text-primary mt-1">▸</span> {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="glass rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3 text-yellow-400">
                <AlertTriangle className="w-4 h-4" />
                <h3 className="font-grotesk font-semibold text-sm">Schwächen</h3>
              </div>
              <ul className="space-y-1.5">
                {(scouting.weaknesses || []).map((s, i) => (
                  <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                    <span className="text-yellow-400 mt-1">▸</span> {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {scouting.danger_players && (
            <div className="glass rounded-xl p-4 border border-red-500/30 bg-red-500/5">
              <div className="text-xs font-bold uppercase tracking-widest text-red-400 mb-1">Gefahrenspieler</div>
              <p className="text-sm text-foreground/80">{scouting.danger_players}</p>
            </div>
          )}

          <div className="glass rounded-xl p-4 border border-primary/20 bg-primary/5">
            <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Taktische Empfehlung</div>
            <p className="text-sm text-foreground/80">{scouting.tactical_recommendation}</p>
          </div>

          {scouting.set_piece_warning && (
            <div className="glass rounded-xl p-4 border border-orange-500/30 bg-orange-500/5">
              <div className="text-xs font-bold uppercase tracking-widest text-orange-400 mb-1">Standards-Warnung</div>
              <p className="text-sm text-foreground/80">{scouting.set_piece_warning}</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}