import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Zap, Loader2, Target, AlertTriangle, Users, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function MatchPrep() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ opponent: '', competition: '', venue: 'away' });
  const [prep, setPrep] = useState(null);
  const [loading, setLoading] = useState(false);

  const { data: reports = [] } = useQuery({
    queryKey: ['reports-all'],
    queryFn: () => base44.entities.AnalysisReport.list('-created_date', 3),
  });

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    const recentData = reports.slice(0, 3).map(r =>
      `${r.match_title}: Formation ${r.formation_home}, Pressing ${r.pressing_index_home}, Besitz ${r.possession_home?.toFixed(0)}%`
    ).join('\n');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Du bist Cheftrainer. Erstelle einen Matchplan für das nächste Spiel.
Gegner: ${form.opponent}
Wettbewerb: ${form.competition || 'Unbekannt'}
Ort: ${form.venue === 'home' ? 'Heimspiel' : 'Auswärtsspiel'}
Unsere letzten Analysen:\n${recentData || 'Keine Daten'}
Erstelle einen konkreten Matchplan.`,
      response_json_schema: {
        type: 'object',
        properties: {
          recommended_formation: { type: 'string' },
          game_plan: { type: 'string' },
          pressing_instructions: { type: 'string' },
          set_pieces_focus: { type: 'string' },
          key_players_to_watch: { type: 'string' },
          warnings: { type: 'array', items: { type: 'string' } },
          tips: { type: 'array', items: { type: 'string' } },
          motivational_message: { type: 'string' }
        }
      }
    });
    setPrep(result);
    setLoading(false);
  };

  const f = (k) => ({ value: form[k], onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) });

  return (
    <div className="p-6 lg:p-8 min-h-screen max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> Zurück
        </button>
        <h1 className="text-3xl font-grotesk font-bold text-foreground mb-1">Spielvorbereitung</h1>
        <p className="text-muted-foreground mb-8">KI-Matchplan mit Formations-Empfehlung</p>

        {!prep && (
          <form onSubmit={handleGenerate} className="glass rounded-xl p-6 space-y-4 mb-6">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">Nächster Gegner *</Label>
              <Input {...f('opponent')} placeholder="z.B. Borussia Dortmund" required className="bg-muted border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">Wettbewerb</Label>
              <Input {...f('competition')} placeholder="z.B. Bundesliga" className="bg-muted border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Spielort</Label>
              <div className="flex gap-3">
                {[['home', 'Heimspiel'], ['away', 'Auswärtsspiel']].map(([v, l]) => (
                  <button
                    key={v} type="button"
                    onClick={() => setForm(p => ({ ...p, venue: v }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${form.venue === v ? 'bg-primary/15 border-primary/50 text-primary' : 'bg-muted border-border text-muted-foreground hover:border-primary/20'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={loading || !form.opponent} className="w-full bg-primary text-primary-foreground neon-glow gap-2 h-11">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Matchplan generieren
            </Button>
          </form>
        )}

        {loading && (
          <div className="glass rounded-2xl p-12 text-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
            <div className="font-grotesk font-semibold text-foreground">KI erstellt Matchplan...</div>
          </div>
        )}

        {prep && !loading && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="glass rounded-xl p-5 border border-primary/30">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-grotesk font-bold text-2xl text-foreground">vs {form.opponent}</h2>
                <div className="text-3xl font-grotesk font-bold text-primary">{prep.recommended_formation}</div>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">{prep.game_plan}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="glass rounded-xl p-4">
                <div className="flex items-center gap-2 text-primary mb-2 text-xs font-bold uppercase tracking-widest">
                  <Zap className="w-3.5 h-3.5" /> Pressing
                </div>
                <p className="text-sm text-foreground/80">{prep.pressing_instructions}</p>
              </div>
              <div className="glass rounded-xl p-4">
                <div className="flex items-center gap-2 text-blue-400 mb-2 text-xs font-bold uppercase tracking-widest">
                  <Target className="w-3.5 h-3.5" /> Standards
                </div>
                <p className="text-sm text-foreground/80">{prep.set_pieces_focus}</p>
              </div>
            </div>

            {prep.key_players_to_watch && (
              <div className="glass rounded-xl p-4 border border-yellow-500/20 bg-yellow-500/5">
                <div className="text-xs font-bold uppercase tracking-widest text-yellow-400 mb-1">Gefahrenspieler beobachten</div>
                <p className="text-sm text-foreground/80">{prep.key_players_to_watch}</p>
              </div>
            )}

            {prep.warnings?.length > 0 && (
              <div className="glass rounded-xl p-4 border border-red-500/20">
                <div className="flex items-center gap-2 text-red-400 mb-2 text-xs font-bold uppercase tracking-widest">
                  <AlertTriangle className="w-3.5 h-3.5" /> Warnungen
                </div>
                <ul className="space-y-1">
                  {prep.warnings.map((w, i) => <li key={i} className="text-sm text-foreground/80">⚠ {w}</li>)}
                </ul>
              </div>
            )}

            {prep.tips?.length > 0 && (
              <div className="glass rounded-xl p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Taktische Tipps</div>
                <ul className="space-y-1">
                  {prep.tips.map((t, i) => <li key={i} className="text-sm text-foreground/80">▸ {t}</li>)}
                </ul>
              </div>
            )}

            {prep.motivational_message && (
              <div className="glass rounded-xl p-4 border border-primary/20 bg-primary/5 text-center">
                <p className="text-sm font-medium text-primary italic">"{prep.motivational_message}"</p>
              </div>
            )}

            <Button onClick={() => setPrep(null)} variant="outline" className="w-full border-border text-muted-foreground">
              Neuen Plan erstellen
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}