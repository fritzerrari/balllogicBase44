import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Zap, AlertTriangle, TrendingUp, Shield, Target, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

// Compact, coach-first halftime analysis — max 3 blocks, no walls of text
export default function HalftimeReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [halftimeData, setHalftimeData] = useState(null);

  const { data: match } = useQuery({
    queryKey: ['match', id],
    queryFn: () => base44.entities.Match.filter({ id }),
    select: d => d?.[0],
  });

  const { data: report } = useQuery({
    queryKey: ['report', id],
    queryFn: () => base44.entities.AnalysisReport.filter({ match_id: id }),
    select: d => d?.[0],
    enabled: !!id,
  });

  const handleGenerate = async () => {
    setLoading(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Du bist Co-Trainer. Erstelle eine KURZE Halbzeitansprache (max 3 Punkte, je 1 Satz).
Spiel: ${match?.title}
Formation Heim: ${report?.formation_home || 'unbekannt'} | Gäste: ${report?.formation_away || 'unbekannt'}
Pressing-Index Heim: ${report?.pressing_index_home || 50} | Gäste: ${report?.pressing_index_away || 50}
Schlüsselszenen 1. Halbzeit: ${report?.key_moments?.slice(0,3).map(m => m.description).join('; ') || 'keine'}
WICHTIG: Nur 3 Punkte. Jeder Punkt max 15 Wörter. Für Trainer-Ohr optimiert — keine Fachbegriffe.`,
      response_json_schema: {
        type: 'object',
        properties: {
          score_assessment: { type: 'string' },
          main_problem: { type: 'string' },
          tactical_fix: { type: 'string' },
          motivation: { type: 'string' },
          focus_player: { type: 'string' },
          warning: { type: 'string' },
        }
      }
    });
    setHalftimeData(result);
    setLoading(false);
  };

  const blocks = halftimeData ? [
    { icon: Target, label: 'Stand & Lage', text: halftimeData.score_assessment, color: 'text-primary border-primary/30 bg-primary/10' },
    { icon: AlertTriangle, label: 'Hauptproblem', text: halftimeData.main_problem, color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' },
    { icon: Zap, label: 'Sofort-Maßnahme', text: halftimeData.tactical_fix, color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
    { icon: TrendingUp, label: 'Motivation', text: halftimeData.motivation, color: 'text-green-400 border-green-500/30 bg-green-500/10' },
    halftimeData.warning && { icon: Shield, label: 'Achtung', text: halftimeData.warning, color: 'text-red-400 border-red-500/30 bg-red-500/10' },
  ].filter(Boolean) : [];

  return (
    <div className="p-6 lg:p-8 min-h-screen max-w-xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> Zurück
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-2xl font-grotesk font-bold text-foreground">Halbzeit-Analyse</h1>
            <p className="text-xs text-muted-foreground">Kurz & knackig — für die Kabine</p>
          </div>
        </div>

        {match && (
          <div className="glass rounded-xl p-4 mb-6 flex items-center justify-between">
            <div>
              <div className="font-grotesk font-semibold text-foreground text-sm">{match.title}</div>
              {(match.score_home !== undefined) && (
                <div className="text-xs text-muted-foreground">Stand: {match.score_home} – {match.score_away}</div>
              )}
            </div>
            <div className="text-2xl font-grotesk font-bold text-foreground">45'</div>
          </div>
        )}

        {!halftimeData && !loading && (
          <div className="glass rounded-2xl p-8 text-center">
            <Clock className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h2 className="font-grotesk font-bold text-foreground text-lg mb-2">Halbzeit-Analyse starten</h2>
            <p className="text-sm text-muted-foreground mb-6">KI erstellt in 5 Sekunden 3–4 präzise Coaching-Punkte für die Kabine.</p>
            <Button onClick={handleGenerate} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold gap-2 w-full h-12 text-base">
              <Zap className="w-5 h-5" /> Jetzt analysieren
            </Button>
          </div>
        )}

        {loading && (
          <div className="glass rounded-2xl p-10 text-center">
            <Loader2 className="w-10 h-10 text-yellow-400 animate-spin mx-auto mb-4" />
            <div className="font-grotesk font-semibold text-foreground mb-1">KI analysiert erste Halbzeit...</div>
            <div className="text-sm text-muted-foreground">~5 Sekunden</div>
          </div>
        )}

        {halftimeData && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {blocks.map((block, i) => {
              const Icon = block.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`rounded-xl p-4 border flex items-start gap-3 ${block.color}`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest mb-1 opacity-70">{block.label}</div>
                    <div className="text-sm font-medium leading-snug">{block.text}</div>
                  </div>
                </motion.div>
              );
            })}
            {halftimeData.focus_player && (
              <div className="glass rounded-xl p-4 border border-purple-500/30 bg-purple-500/10 text-purple-300">
                <div className="text-xs font-bold uppercase tracking-widest mb-1 opacity-70">Fokus-Spieler</div>
                <div className="text-sm font-medium">{halftimeData.focus_player}</div>
              </div>
            )}
            <Button onClick={handleGenerate} variant="outline" className="w-full mt-2 border-border text-muted-foreground hover:text-foreground" disabled={loading}>
              Neu generieren
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}