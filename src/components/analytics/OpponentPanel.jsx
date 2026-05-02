/**
 * OpponentPanel — Gegner-Analyse mit KI-Generierung und Verwaltung
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Zap, Loader2, Plus, ChevronDown, ChevronUp, AlertTriangle, Target, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ManagementSummaryCard from './ManagementSummaryCard';
import ConsequencesPanel from './ConsequencesPanel';
import PlayerRadarCard from './PlayerRadarCard';
import { useToast } from '@/components/ui/use-toast';

const DANGER_COLORS = {
  'niedrig': 'text-primary bg-primary/10 border-primary/30',
  'mittel': 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  'hoch': 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  'sehr hoch': 'text-red-400 bg-red-400/10 border-red-400/30',
};

export default function OpponentPanel({ match }) {
  const [generating, setGenerating] = useState(false);
  const [showAddOpponent, setShowAddOpponent] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newOpp, setNewOpp] = useState({ name: match?.away_team || '', league: '', coach: '', preferred_formation: '', playing_style: 'Konterfußball', danger_level: 'mittel' });
  const [newPlayer, setNewPlayer] = useState({ name: '', number: '', position: 'Zentrales Mittelfeld', danger_rating: 6, strengths: '', weaknesses: '' });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: opponents = [] } = useQuery({
    queryKey: ['opponents'],
    queryFn: () => base44.entities.Opponent.list('-created_date', 20),
  });

  const { data: analyses = [] } = useQuery({
    queryKey: ['team-analyses-opponent'],
    queryFn: () => base44.entities.TeamAnalysis.filter({ analysis_type: 'opponent' }),
  });

  const opponent = opponents.find(o => match?.away_team && o.name.toLowerCase().includes(match.away_team.toLowerCase())) || opponents[0];
  const analysis = analyses.find(a => a.opponent_id === opponent?.id || a.match_id === match?.id);

  const { data: oppPlayers = [] } = useQuery({
    queryKey: ['opponent-players', opponent?.id],
    queryFn: () => base44.entities.OpponentPlayer.filter({ opponent_id: opponent?.id }),
    enabled: !!opponent?.id,
  });

  const createOpponent = useMutation({
    mutationFn: (data) => base44.entities.Opponent.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['opponents'] }); setShowAddOpponent(false); toast({ title: '✓ Gegner angelegt' }); },
  });

  const createPlayer = useMutation({
    mutationFn: (data) => base44.entities.OpponentPlayer.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['opponent-players', opponent?.id] }); setShowAddPlayer(false); toast({ title: '✓ Spieler angelegt' }); },
  });

  const unlockPlayer = useMutation({
    mutationFn: (player) => base44.entities.OpponentPlayer.update(player.id, { unlocked: true }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['opponent-players', opponent?.id] }); toast({ title: '🔓 Detailanalyse freigeschaltet!' }); },
  });

  const handleGenerateAnalysis = async () => {
    if (!opponent) return;
    setGenerating(true);
    const playersText = oppPlayers.map(p => `${p.name} (${p.position}, Gefahr: ${p.danger_rating}/10, Stärken: ${p.strengths || '–'}, Schwächen: ${p.weaknesses || '–'})`).join('\n');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Du bist ein Top-Fußball-Analyst. Erstelle eine hochprofessionelle taktische Gegneranalyse für den Verein "${opponent.name}".
Spielsystem: ${opponent.preferred_formation || '–'}, Spielstil: ${opponent.playing_style || '–'}, Trainer: ${opponent.coach || '–'}
Bekannte Spieler: ${playersText || 'keine Angabe'}
Match-Kontext: ${match?.title || '–'} am ${match?.date || '–'}

Liefere eine detaillierte Analyse mit:
- Management Summary (prägnant, 3-4 Sätze, Trainer-Sprache)
- Stärken (je 4-6 konkrete Punkte)
- Schwachpunkte (je 4-6 konkrete Punkte, SEHR WICHTIG für eigene Taktik)
- Chancen (wie wir den Gegner knacken können, 4-5 Punkte)
- Risiken (was uns gefährlich werden kann, 3-4 Punkte)
- Taktische Beobachtungen (detailliertes Fließtext-Analyse, 2-3 Absätze)
- Konsequenzen & Ableitungen (5-7 direkte Handlungsanweisungen)
- Taktische Empfehlungen gegen genau diesen Gegner (5-7 Punkte, sehr konkret)
- Trainingsschwerpunkte um den Gegner zu bezwingen (4-5 Punkte)
- Pressing-Analyse: Wie/wo pressen? (1-2 Sätze)
- Formations-Analyse: Welche Formation gegen diesen Gegner? (1-2 Sätze)
- Standardsituationen: Chancen bei Standards gegen/für diesen Gegner (1-2 Sätze)
- Gesamtbewertung: Wie gefährlich ist dieser Gegner? (0-100, wobei 100=extrem gefährlich)

Schreibe in professionellem Trainer-Deutsch. Sei sehr konkret, nicht allgemein.`,
      model: 'claude_sonnet_4_6',
      response_json_schema: {
        type: 'object',
        properties: {
          management_summary: { type: 'string' },
          strengths: { type: 'array', items: { type: 'string' } },
          weaknesses: { type: 'array', items: { type: 'string' } },
          opportunities: { type: 'array', items: { type: 'string' } },
          threats: { type: 'array', items: { type: 'string' } },
          tactical_observations: { type: 'string' },
          consequences: { type: 'array', items: { type: 'string' } },
          recommendations: { type: 'array', items: { type: 'string' } },
          training_focus: { type: 'array', items: { type: 'string' } },
          pressing_analysis: { type: 'string' },
          formation_analysis: { type: 'string' },
          set_pieces_analysis: { type: 'string' },
          performance_score: { type: 'number' },
        }
      }
    });

    await base44.entities.TeamAnalysis.create({
      analysis_type: 'opponent',
      opponent_id: opponent.id,
      match_id: match?.id,
      match_title: match?.title,
      generated_at: new Date().toISOString(),
      ...result,
    });
    queryClient.invalidateQueries({ queryKey: ['team-analyses-opponent'] });
    setGenerating(false);
    toast({ title: '✓ Gegneranalyse generiert!' });
  };

  return (
    <div className="space-y-5">
      {/* Opponent Header */}
      {opponent ? (
        <div className="glass rounded-2xl p-5 border border-border">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-red-400" />
                <h2 className="font-grotesk font-bold text-foreground text-lg">{opponent.name}</h2>
                {opponent.danger_level && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${DANGER_COLORS[opponent.danger_level]}`}>
                    {opponent.danger_level.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {opponent.preferred_formation && <span>Formation: <span className="text-foreground font-medium">{opponent.preferred_formation}</span></span>}
                {opponent.playing_style && <span>Stil: <span className="text-foreground font-medium">{opponent.playing_style}</span></span>}
                {opponent.coach && <span>Trainer: <span className="text-foreground font-medium">{opponent.coach}</span></span>}
              </div>
            </div>
            <Button onClick={handleGenerateAnalysis} disabled={generating}
              className="bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 gap-2">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {generating ? 'Analysiere...' : analysis ? 'Neu analysieren' : 'KI-Analyse starten'}
            </Button>
          </div>

          {generating && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
              Claude analysiert den Gegner tiefgreifend... (nutzt mehr Analyse-Credits)
            </div>
          )}
        </div>
      ) : (
        <div className="glass rounded-2xl p-8 text-center border border-dashed border-border">
          <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <div className="font-grotesk font-semibold text-foreground mb-1">Noch kein Gegner erfasst</div>
          <p className="text-sm text-muted-foreground mb-4">Lege den Gegner an um eine KI-Analyse zu starten</p>
          <Button onClick={() => setShowAddOpponent(true)} className="bg-primary text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> Gegner anlegen
          </Button>
        </div>
      )}

      {/* Add Opponent Form */}
      <AnimatePresence>
        {showAddOpponent && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="glass rounded-xl p-4 border border-border space-y-3 overflow-hidden">
            <h3 className="font-grotesk font-semibold text-foreground text-sm">Gegner anlegen</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Input value={newOpp.name} onChange={e => setNewOpp(p=>({...p,name:e.target.value}))} placeholder="Vereinsname*" className="bg-muted border-border" /></div>
              <Input value={newOpp.coach} onChange={e => setNewOpp(p=>({...p,coach:e.target.value}))} placeholder="Trainer" className="bg-muted border-border" />
              <Input value={newOpp.preferred_formation} onChange={e => setNewOpp(p=>({...p,preferred_formation:e.target.value}))} placeholder="Formation (4-3-3)" className="bg-muted border-border" />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createOpponent.mutate({ ...newOpp, last_match_id: match?.id })} disabled={!newOpp.name} className="bg-primary text-primary-foreground gap-2">
                {createOpponent.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Speichern
              </Button>
              <Button variant="outline" onClick={() => setShowAddOpponent(false)} className="border-border text-muted-foreground">Abbrechen</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analysis */}
      {analysis && (
        <>
          <ManagementSummaryCard analysis={analysis} title="Gegner: Management Summary" />
          <ConsequencesPanel analysis={analysis} />
        </>
      )}

      {/* Opponent Players */}
      {opponent && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-grotesk font-semibold text-foreground text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" /> Gegnerspieler ({oppPlayers.length})
              <span className="text-[10px] text-muted-foreground font-normal">Gefährlichste Spieler</span>
            </h3>
            <button onClick={() => setShowAddPlayer(s=>!s)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted border border-border text-xs text-muted-foreground hover:text-foreground transition-all">
              <Plus className="w-3.5 h-3.5" /> Spieler
            </button>
          </div>

          <AnimatePresence>
            {showAddPlayer && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="glass rounded-xl p-4 mb-3 border border-border space-y-3 overflow-hidden">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2"><Input value={newPlayer.name} onChange={e=>setNewPlayer(p=>({...p,name:e.target.value}))} placeholder="Name*" className="bg-muted border-border" /></div>
                  <Input type="number" value={newPlayer.number} onChange={e=>setNewPlayer(p=>({...p,number:e.target.value}))} placeholder="#" className="bg-muted border-border text-center" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={newPlayer.strengths} onChange={e=>setNewPlayer(p=>({...p,strengths:e.target.value}))} placeholder="Stärken" className="bg-muted border-border" />
                  <Input value={newPlayer.weaknesses} onChange={e=>setNewPlayer(p=>({...p,weaknesses:e.target.value}))} placeholder="Schwächen" className="bg-muted border-border" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-muted-foreground flex-shrink-0">Gefahr: {newPlayer.danger_rating}/10</div>
                  <input type="range" min={1} max={10} value={newPlayer.danger_rating} onChange={e=>setNewPlayer(p=>({...p,danger_rating:parseInt(e.target.value)}))} className="flex-1 accent-red-400" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => createPlayer.mutate({ ...newPlayer, opponent_id: opponent.id, opponent_name: opponent.name, number: parseInt(newPlayer.number)||undefined })}
                    disabled={!newPlayer.name} className="bg-primary text-primary-foreground gap-2">
                    {createPlayer.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Speichern
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddPlayer(false)} className="border-border text-muted-foreground">Abbrechen</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {oppPlayers.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {oppPlayers.sort((a,b)=>(b.danger_rating||0)-(a.danger_rating||0)).map(p => (
                <PlayerRadarCard key={p.id} player={p} stats={[]} isOpponent onUnlock={(pl) => unlockPlayer.mutate(pl)} />
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-xl p-4 text-center">
              Noch keine Gegnerspieler erfasst — füge die Schlüsselspieler hinzu für bessere KI-Analyse
            </div>
          )}
        </div>
      )}
    </div>
  );
}