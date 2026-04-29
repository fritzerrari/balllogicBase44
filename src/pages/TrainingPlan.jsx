import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Loader2, Dumbbell, Clock, Zap, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

const dayColors = ['bg-primary/10 border-primary/30 text-primary', 'bg-blue-500/10 border-blue-500/30 text-blue-400', 'bg-purple-500/10 border-purple-500/30 text-purple-400', 'bg-orange-500/10 border-orange-500/30 text-orange-400', 'bg-green-500/10 border-green-500/30 text-green-400'];

export default function TrainingPlan() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [nextOpponent, setNextOpponent] = useState('');

  const { data: reports = [] } = useQuery({
    queryKey: ['reports-all'],
    queryFn: () => base44.entities.AnalysisReport.list('-created_date', 3),
  });

  const handleGenerate = async () => {
    setLoading(true);
    const weaknesses = reports.slice(0, 2).map(r =>
      `${r.match_title}: Pressing ${r.pressing_index_home}/100, Kompakt ${r.compactness_home}/100, Transitions ${r.transitions_home}`
    ).join('\n');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Du bist Cheftrainer. Erstelle einen 5-Tage-Trainingsplan basierend auf letzten Analysen.
Bekannte Schwächen:\n${weaknesses || 'Keine Report-Daten — erstelle allgemeinen Plan'}
Nächster Gegner: ${nextOpponent || 'unbekannt'}
Erstelle einen praxisnahen Plan für Mo–Fr.`,
      response_json_schema: {
        type: 'object',
        properties: {
          focus_areas: { type: 'array', items: { type: 'string' } },
          days: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                day: { type: 'string' },
                focus: { type: 'string' },
                duration_min: { type: 'number' },
                exercises: { type: 'array', items: { type: 'string' } },
                intensity: { type: 'string' }
              }
            }
          },
          key_message: { type: 'string' }
        }
      }
    });
    setPlan(result);
    setLoading(false);
  };

  return (
    <div className="p-6 lg:p-8 min-h-screen max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
        <h1 className="text-3xl font-grotesk font-bold text-foreground mb-1">KI-Trainingsplan</h1>
        <p className="text-muted-foreground">Automatisch aus deinen Spielanalysen generiert</p>
      </motion.div>

      {!plan && (
        <div className="glass rounded-xl p-6 mb-6 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 block">Nächster Gegner (optional)</label>
            <input
              value={nextOpponent}
              onChange={e => setNextOpponent(e.target.value)}
              placeholder="z.B. Bayer Leverkusen"
              className="w-full h-9 rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <Button onClick={handleGenerate} disabled={loading} className="w-full bg-primary text-primary-foreground neon-glow gap-2 h-11">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Dumbbell className="w-4 h-4" />}
            Trainingsplan erstellen
          </Button>
        </div>
      )}

      {loading && (
        <div className="glass rounded-2xl p-12 text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
          <div className="font-grotesk font-semibold text-foreground mb-1">KI erstellt Trainingsplan...</div>
          <div className="text-sm text-muted-foreground">Basierend auf euren letzten Analysen</div>
        </div>
      )}

      {plan && !loading && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {plan.key_message && (
            <div className="glass rounded-xl p-4 border border-primary/30 bg-primary/5">
              <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Wochenfokus</div>
              <p className="text-sm font-medium text-foreground">{plan.key_message}</p>
            </div>
          )}

          {plan.focus_areas?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {plan.focus_areas.map((f, i) => (
                <span key={i} className="text-xs px-3 py-1 rounded-full bg-muted border border-border text-muted-foreground">{f}</span>
              ))}
            </div>
          )}

          {(plan.days || []).map((day, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1 rounded-lg text-xs font-bold border ${dayColors[i % dayColors.length]}`}>
                    {day.day}
                  </div>
                  <span className="font-grotesk font-semibold text-foreground text-sm">{day.focus}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {day.duration_min} Min
                  {day.intensity && <span className="ml-1 px-2 py-0.5 rounded-full bg-muted border border-border">{day.intensity}</span>}
                </div>
              </div>
              <ul className="space-y-1">
                {(day.exercises || []).map((ex, j) => (
                  <li key={j} className="text-sm text-foreground/70 flex items-start gap-2">
                    <ChevronRight className="w-3 h-3 text-primary mt-1 flex-shrink-0" />
                    {ex}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}

          <Button onClick={() => setPlan(null)} variant="outline" className="w-full border-border text-muted-foreground">
            Neuen Plan generieren
          </Button>
        </motion.div>
      )}
    </div>
  );
}