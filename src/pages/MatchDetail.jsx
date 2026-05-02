import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Zap, BarChart3, Video, Clock, Camera, Upload, X, Plus, Cpu } from 'lucide-react';
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
  const [showVideoUpload, setShowVideoUpload] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

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

  const handleVideoUpload = async () => {
    if (!uploadFiles.length) return;
    setUploading(true);
    const newUrls = [];
    for (const file of uploadFiles) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      newUrls.push(file_url);
    }
    const combined = [...(match.video_urls || []), ...newUrls];
    await updateMutation.mutateAsync({ video_urls: combined, camera_count: combined.length });
    setUploadFiles([]);
    setShowVideoUpload(false);
    toast({ title: `${newUrls.length} Video(s) hochgeladen!` });
    setUploading(false);
  };

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

        {/* Videos + nachträglicher Upload */}
        <div className="glass rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" />
              <h2 className="font-grotesk font-semibold text-foreground">
                {match.video_urls?.length > 0
                  ? `${match.video_urls.length} Kamera-Perspektive${match.video_urls.length > 1 ? 'n' : ''}`
                  : 'Videos'}
              </h2>
            </div>
            <button
              onClick={() => setShowVideoUpload(v => !v)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Video hochladen
            </button>
          </div>

          {match.video_urls?.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 mb-3">
              {match.video_urls.map((url, i) => (
                <div key={i} className="bg-muted rounded-lg p-3 flex items-center gap-2">
                  <Video className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Kamera {i + 1}</span>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline ml-auto">Ansehen</a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mb-3">Noch keine Videos hochgeladen.</p>
          )}

          {/* Upload-Bereich (optional, ausblendbar) */}
          {showVideoUpload && (
            <div className="border-t border-border pt-3 space-y-3">
              <label className="block cursor-pointer">
                <div className="border-2 border-dashed border-border rounded-xl p-5 text-center hover:border-primary/40 transition-all">
                  <Upload className="w-7 h-7 text-muted-foreground mx-auto mb-1.5" />
                  <div className="text-sm text-foreground font-medium">MP4, MOV, AVI auswählen</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Mehrere Kameraperspektiven möglich</div>
                </div>
                <input type="file" multiple accept="video/*" className="hidden"
                  onChange={e => setUploadFiles(prev => [...prev, ...Array.from(e.target.files)])} />
              </label>
              {uploadFiles.length > 0 && (
                <div className="space-y-1.5">
                  {uploadFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-xs">
                      <Video className="w-3.5 h-3.5 text-primary" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <button onClick={() => setUploadFiles(prev => prev.filter((_, idx) => idx !== i))}>
                        <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  ))}
                  <Button onClick={handleVideoUpload} disabled={uploading} size="sm"
                    className="bg-primary text-primary-foreground gap-2 w-full">
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {uploading ? 'Lädt hoch...' : `${uploadFiles.length} Video(s) hochladen`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="grid sm:grid-cols-2 gap-4">
          {match.status === 'analyzed' ? (
            <>
              <Link to={`/analytics?match=${match.id}`} className="sm:col-span-2">
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 neon-glow gap-2 h-12 text-base">
                  <Cpu className="w-5 h-5" /> Analytics Cockpit — Tiefenanalyse →
                </Button>
              </Link>
              <Link to={`/tactics/${match.id}`}>
                <Button variant="outline" className="w-full border-primary/30 text-primary hover:bg-primary/10 gap-2">
                  <BarChart3 className="w-4 h-4" /> Taktik-Analyse
                </Button>
              </Link>
              <Link to={`/halftime/${match.id}`}>
                <Button variant="outline" className="w-full border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 gap-2">
                  <Clock className="w-4 h-4" /> Halbzeit-Analyse
                </Button>
              </Link>
              <Link to={`/matchprep`} className="sm:col-span-2">
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