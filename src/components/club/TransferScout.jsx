/**
 * TransferScout — KI-Transferempfehlungen + ablaufende Verträge
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, AlertTriangle, TrendingUp, Eye, X, Check, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';

const statusColors = {
  suggested: 'bg-primary/10 text-primary border-primary/20',
  watching: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  contacted: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  rejected: 'bg-muted text-muted-foreground border-border',
};
const statusLabels = { suggested: 'Empfohlen', watching: 'Beobachte', contacted: 'Kontaktiert', rejected: 'Abgelehnt' };

export default function TransferScout({ clubId }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const queryClient = useQueryClient();

  const { data: targets = [], isLoading } = useQuery({
    queryKey: ['transfer-targets', clubId],
    queryFn: () => base44.entities.TransferTarget.filter({ club_id: clubId }, '-recommendation_score', 20),
    enabled: !!clubId,
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players-club', clubId],
    queryFn: () => base44.entities.Player.filter({ club_id: clubId }),
    enabled: !!clubId,
  });

  const updateTarget = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TransferTarget.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transfer-targets', clubId] }),
  });

  const deleteTarget = useMutation({
    mutationFn: (id) => base44.entities.TransferTarget.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transfer-targets', clubId] }),
  });

  const handleAnalyze = async () => {
    setAnalyzing(true);
    const res = await base44.functions.invoke('analyzeSquadNeeds', { club_id: clubId });
    setLastResult(res.data);
    queryClient.invalidateQueries({ queryKey: ['transfer-targets', clubId] });
    setAnalyzing(false);
  };

  // Ablaufende Verträge
  const expiringContracts = players.filter(p => {
    if (!p.contract_until) return false;
    const days = differenceInDays(new Date(p.contract_until), new Date());
    return days >= 0 && days <= 365;
  }).sort((a, b) => new Date(a.contract_until) - new Date(b.contract_until));

  return (
    <div className="space-y-6">
      {/* Ablaufende Verträge */}
      {expiringContracts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" /> Ablaufende Verträge
          </h3>
          <div className="space-y-2">
            {expiringContracts.map(p => {
              const days = differenceInDays(new Date(p.contract_until), new Date());
              const urgent = days <= 90;
              return (
                <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border ${urgent ? 'bg-red-500/5 border-red-500/20' : 'bg-yellow-500/5 border-yellow-500/20'}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${urgent ? 'bg-red-500 animate-pulse' : 'bg-yellow-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground">{p.position}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-xs font-bold ${urgent ? 'text-red-400' : 'text-yellow-400'}`}>
                      {format(new Date(p.contract_until), 'dd.MM.yyyy', { locale: de })}
                    </div>
                    <div className="text-[9px] text-muted-foreground">{days} Tage</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KI-Analyse Button */}
      <div className="glass rounded-xl p-4 border border-primary/20 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">KI-Kaderanalyse & Transfermarkt</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Die KI analysiert Ihren Kader, identifiziert schwache Positionen und empfiehlt konkrete Transferziele aus dem aktuellen Markt.
        </p>
        <Button onClick={handleAnalyze} disabled={analyzing} className="w-full bg-primary text-primary-foreground gap-2">
          {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysiere Kader & Markt...</> : <><Sparkles className="w-4 h-4" /> Kader jetzt analysieren</>}
        </Button>

        {lastResult?.squad_assessment && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="p-3 rounded-lg bg-muted/50 text-xs text-foreground/80 italic leading-relaxed">
            "{lastResult.squad_assessment}"
          </motion.div>
        )}

        {lastResult?.weak_positions?.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground">Schwache Positionen:</span>
            {lastResult.weak_positions.map(p => (
              <span key={p} className="text-[10px] bg-destructive/10 text-destructive border border-destructive/20 px-1.5 py-0.5 rounded">
                {p}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Transfer-Targets */}
      {(targets.length > 0 || isLoading) && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-primary" /> Transfer-Kandidaten ({targets.length})
          </h3>
          <div className="space-y-3">
            {targets.map(t => (
              <motion.div key={t.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`glass rounded-xl p-4 border ${t.status === 'rejected' ? 'opacity-40' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-grotesk font-bold text-foreground">{t.player_name}</span>
                      <Badge className={`text-[9px] border ${statusColors[t.status]}`}>{statusLabels[t.status]}</Badge>
                      {t.recommendation_score && (
                        <span className="ml-auto text-[10px] text-primary font-bold flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5" /> {t.recommendation_score}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                      <span>{t.position}</span>
                      {t.age && <span>{t.age} J.</span>}
                      {t.current_club && <span>{t.current_club}</span>}
                      {t.market_value && <span className="text-primary font-medium">{t.market_value}</span>}
                      {t.contract_until && <span>Vertrag bis {t.contract_until}</span>}
                    </div>
                    {t.strengths && (
                      <div className="text-[10px] text-foreground/70 mt-1.5 leading-relaxed">
                        <span className="text-green-400 font-medium">+ </span>{t.strengths}
                      </div>
                    )}
                    {t.weaknesses && (
                      <div className="text-[10px] text-foreground/60 leading-relaxed">
                        <span className="text-red-400 font-medium">− </span>{t.weaknesses}
                      </div>
                    )}
                    {t.ai_recommendation && (
                      <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/10 text-[10px] text-foreground/70 italic">
                        "{t.ai_recommendation}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Status-Aktionen */}
                {t.status !== 'rejected' && (
                  <div className="flex gap-1.5 mt-3 pt-3 border-t border-border/50">
                    {t.status === 'suggested' && (
                      <Button size="sm" onClick={() => updateTarget.mutate({ id: t.id, data: { status: 'watching' } })}
                        className="flex-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 h-7 text-[10px] gap-1">
                        <Eye className="w-3 h-3" /> Beobachten
                      </Button>
                    )}
                    {t.status === 'watching' && (
                      <Button size="sm" onClick={() => updateTarget.mutate({ id: t.id, data: { status: 'contacted' } })}
                        className="flex-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 h-7 text-[10px] gap-1">
                        <Check className="w-3 h-3" /> Kontaktiert
                      </Button>
                    )}
                    <Button size="sm" onClick={() => updateTarget.mutate({ id: t.id, data: { status: 'rejected' } })}
                      variant="outline" className="border-border text-muted-foreground h-7 text-[10px] gap-1">
                      <X className="w-3 h-3" /> Ablehnen
                    </Button>
                    <button onClick={() => deleteTarget.mutate(t.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}