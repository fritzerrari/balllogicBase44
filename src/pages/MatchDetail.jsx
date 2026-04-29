import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Zap, BarChart3, Video, Clock, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

const statusConfig = {
  uploading: { label: 'Upload ausstehend', class: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  processing: { label: 'KI analysiert...', class: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  analyzed: { label: 'Analyse abgeschlossen', class: 'bg-primary/15 text-primary border-primary/30' },
  live: { label: '● LIVE', class: 'bg-red-500/15 text-red-400 border-red-500/30' },
  failed: { label: 'Fehler', class: 'bg-destructive/15 text-destructive border-destructive/30' },
};

export default function MatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [analyzing, setAnalyzing] = useState(false);

  const { data: match, isLoading } = useQuery({
    queryKey: ['match', id],
    queryFn: () => base44.entities.Match.filter({ id }),
    select: (data) => data?.[0],
  });

  const { data: report } = useQuery({
    queryKey: ['report', id],
    queryFn: () => base44.entities.AnalysisReport.filter({ match_id: id }),
    select: (data) => data?.[0],
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Match.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['match', id] }),
  });

  const createReportMutation = useMutation({
    mutationFn: (data) => base44.entities.AnalysisReport.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['report', id] }),
  });

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await updateMutation.mutateAsync({ status: 'processing' });

      const prompt = `Du bist ein KI-Fußball-Analyst. Analysiere folgendes Spiel und erstelle eine detaillierte taktische Analyse:

Spiel: ${match?.title}
Heimteam: ${match?.home_team}
Auswärtsteam: ${match?.away_team}
Datum: ${match?.date}
Ergebnis: ${match?.score_home ?? '?'} - ${match?.score_away ?? '?'}
Wettbewerb: ${match?.competition || 'Unbekannt'}

Erstelle eine realistische, detaillierte taktische Analyse mit konkreten Zahlen für alle Metriken.
Die Analyse soll für einen Profi-Trainer nützlich sein.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            possession_home: { type: 'number' },
            possession_away: { type: 'number' },
            pressing_index_home: { type: 'number' },
            pressing_index_away: { type: 'number' },
            pressing_height_home: { type: 'number' },
            pressing_height_away: { type: 'number' },
            compactness_home: { type: 'number' },
            compactness_away: { type: 'number' },
            formation_home: { type: 'string' },
            formation_away: { type: 'string' },
            ball_recoveries_home: { type: 'number' },
            ball_recoveries_away: { type: 'number' },
            transitions_home: { type: 'number' },
            transitions_away: { type: 'number' },
            sprint_data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  interval: { type: 'string' },
                  home_intensity: { type: 'number' },
                  away_intensity: { type: 'number' }
                }
              }
            },
            formation_changes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  minute: { type: 'number' },
                  team: { type: 'string' },
                  from_formation: { type: 'string' },
                  to_formation: { type: 'string' },
                  trigger: { type: 'string' }
                }
              }
            },
            key_moments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  minute: { type: 'number' },
                  type: { type: 'string' },
                  description: { type: 'string' },
                  team: { type: 'string' }
                }
              }
            },
            danger_zones: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                  intensity: { type: 'number' },
                  team: { type: 'string' }
                }
              }
            },
            ai_summary: { type: 'string' },
            ai_recommendations: { type: 'string' }
          }
        }
      });

      await createReportMutation.mutateAsync({
        match_id: id,
        match_title: match?.title,
        generated_at: new Date().toISOString(),
        ...result
      });

      await updateMutation.mutateAsync({ status: 'analyzed' });
      toast({ title: 'Analyse abgeschlossen!', description: 'KI-Report wurde erfolgreich erstellt.' });
    } catch (err) {
      await updateMutation.mutateAsync({ status: 'failed' });
      toast({ title: 'Fehler', description: 'Analyse konnte nicht durchgeführt werden.', variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!match) return null;

  const sc = statusConfig[match.status];

  return (
    <div className="p-6 lg:p-8 min-h-screen max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <button onClick={() => navigate('/matches')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Zurück
        </button>

        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <Badge className={`text-xs border mb-3 ${sc.class}`}>{sc.label}</Badge>
              <h1 className="text-2xl lg:text-3xl font-grotesk font-bold text-foreground mb-1">{match.title}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {format(new Date(match.date), 'dd. MMMM yyyy', { locale: de })}</span>
                {match.competition && <span>· {match.competition}</span>}
                {match.venue && <span>· {match.venue}</span>}
              </div>
            </div>
            {match.score_home !== undefined && (
              <div className="text-center">
                <div className="text-4xl font-grotesk font-bold text-foreground">{match.score_home} – {match.score_away}</div>
                <div className="text-xs text-muted-foreground mt-1">Endstand</div>
              </div>
            )}
          </div>

          {/* Teams */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border text-center">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Heimteam</div>
              <div className="font-grotesk font-semibold text-foreground">{match.home_team}</div>
            </div>
            <div className="flex items-center justify-center text-muted-foreground">vs</div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Auswärtsteam</div>
              <div className="font-grotesk font-semibold text-foreground">{match.away_team}</div>
            </div>
          </div>
        </div>

        {/* Videos */}
        {match.video_urls?.length > 0 && (
          <div className="glass rounded-xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Camera className="w-4 h-4 text-primary" />
              <h2 className="font-grotesk font-semibold text-foreground">{match.video_urls.length} Kamera-Perspektive{match.video_urls.length > 1 ? 'n' : ''}</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {match.video_urls.map((url, i) => (
                <div key={i} className="bg-muted rounded-lg p-3 flex items-center gap-2">
                  <Video className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Kamera {i + 1}</span>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline ml-auto">Ansehen</a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="grid sm:grid-cols-2 gap-4">
          {match.status === 'analyzed' ? (
            <>
              <Link to={`/tactics/${match.id}`} className="sm:col-span-2">
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 neon-glow gap-2 h-12 text-base">
                  <BarChart3 className="w-5 h-5" /> Taktische Analyse ansehen →
                </Button>
              </Link>
              <Link to={`/halftime/${match.id}`}>
                <Button variant="outline" className="w-full border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 gap-2">
                  <Clock className="w-4 h-4" /> Halbzeit-Analyse
                </Button>
              </Link>
              <Link to={`/matchprep`}>
                <Button variant="outline" className="w-full border-border text-muted-foreground hover:text-foreground gap-2">
                  <Zap className="w-4 h-4" /> Nächstes Spiel vorbereiten
                </Button>
              </Link>
            </>
          ) : match.status === 'processing' && analyzing ? (
            <div className="sm:col-span-2 glass rounded-xl p-6 text-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
              <div className="font-grotesk font-semibold text-foreground mb-1">KI analysiert das Spiel...</div>
              <div className="text-sm text-muted-foreground">Formation, Pressing, Müdigkeit, Umschalten...</div>
            </div>
          ) : (
            <Button
              onClick={handleAnalyze}
              className="sm:col-span-2 bg-primary text-primary-foreground hover:bg-primary/90 neon-glow gap-2 h-12 text-base"
              disabled={analyzing}
            >
              <Zap className="w-5 h-5" /> KI-Analyse starten
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}