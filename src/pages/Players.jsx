/**
 * Players — Spieler-Kader & Performance-Tracking (GAMECHANGER)
 * Jeder Spieler hat ein Leistungsprofil über alle Spiele hinweg.
 * KI generiert individuelles Feedback pro Spieler & Spiel.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, X, Zap, Loader2, Star,
  TrendingUp, Target, ChevronRight, User, Award, BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useToast } from '@/components/ui/use-toast';

const POSITIONS = [
  'Torwart', 'Innenverteidiger', 'Außenverteidiger',
  'Defensives Mittelfeld', 'Zentrales Mittelfeld', 'Offensives Mittelfeld',
  'Linksaußen', 'Rechtsaußen', 'Mittelstürmer'
];

const positionShort = {
  'Torwart': 'TW', 'Innenverteidiger': 'IV', 'Außenverteidiger': 'AV',
  'Defensives Mittelfeld': 'DM', 'Zentrales Mittelfeld': 'ZM', 'Offensives Mittelfeld': 'OM',
  'Linksaußen': 'LA', 'Rechtsaußen': 'RA', 'Mittelstürmer': 'MS'
};

export default function Players() {
  const [showForm, setShowForm] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [form, setForm] = useState({ name: '', number: '', position: POSITIONS[4], team: '' });
  const [generatingFeedback, setGeneratingFeedback] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list('-created_date', 50),
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['matches-all'],
    queryFn: () => base44.entities.Match.list('-date', 20),
  });

  const { data: stats = [] } = useQuery({
    queryKey: ['player-stats', selectedPlayer?.id],
    queryFn: () => base44.entities.PlayerStat.filter({ player_id: selectedPlayer?.id }),
    enabled: !!selectedPlayer,
  });

  const createPlayer = useMutation({
    mutationFn: (data) => base44.entities.Player.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['players'] }); setShowForm(false); setForm({ name: '', number: '', position: POSITIONS[4], team: '' }); },
  });

  const deletePlayer = useMutation({
    mutationFn: (id) => base44.entities.Player.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['players'] }); setSelectedPlayer(null); },
  });

  const createStat = useMutation({
    mutationFn: (data) => base44.entities.PlayerStat.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['player-stats', selectedPlayer?.id] }),
  });

  const handleGenerateFeedback = async () => {
    if (!selectedPlayer || stats.length === 0) return;
    setGeneratingFeedback(true);
    const statSummary = stats.map(s =>
      `${s.match_title}: Note ${s.rating}/10, Tore ${s.goals}, Assists ${s.assists}, km ${s.distance_km}, Duelle ${s.duels_won}/${s.duels_total}`
    ).join('\n');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Du bist ein Fußball-Trainer. Gib eine kurze, präzise Leistungsbeurteilung (max 3 Sätze) für diesen Spieler:
Name: ${selectedPlayer.name}, Position: ${selectedPlayer.position}
Statistiken der letzten Spiele:
${statSummary}
Fokussiere auf: Stärken, Entwicklungspotenzial, eine konkrete Trainingsempfehlung.`,
    });

    // Speichere Feedback im letzten Stat
    if (stats[0]) {
      await base44.entities.PlayerStat.update(stats[0].id, { ai_feedback: result });
      queryClient.invalidateQueries({ queryKey: ['player-stats', selectedPlayer?.id] });
    }
    setGeneratingFeedback(false);
    toast({ title: 'KI-Feedback generiert!' });
  };

  // Durchschnittswerte für Radar-Chart
  const avgStats = stats.length > 0 ? {
    rating: (stats.reduce((s, p) => s + (p.rating || 0), 0) / stats.length).toFixed(1),
    goals: stats.reduce((s, p) => s + (p.goals || 0), 0),
    assists: stats.reduce((s, p) => s + (p.assists || 0), 0),
    duels: stats.length > 0 ? ((stats.reduce((s, p) => s + (p.duels_won || 0), 0) / Math.max(1, stats.reduce((s, p) => s + (p.duels_total || 1), 0))) * 100).toFixed(0) : 0,
    distance: (stats.reduce((s, p) => s + (p.distance_km || 0), 0) / stats.length).toFixed(1),
  } : null;

  const radarData = avgStats ? [
    { metric: 'Note', value: (avgStats.rating / 10) * 100 },
    { metric: 'Zweikampf %', value: parseFloat(avgStats.duels) },
    { metric: 'Tore/Spiel', value: Math.min(100, (avgStats.goals / stats.length) * 100) },
    { metric: 'Assists/Spiel', value: Math.min(100, (avgStats.assists / stats.length) * 100) },
    { metric: 'km/Spiel', value: Math.min(100, (parseFloat(avgStats.distance) / 12) * 100) },
  ] : [];

  return (
    <div className="p-6 lg:p-8 min-h-screen">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-grotesk font-bold text-foreground">Kader & Performance</h1>
            <p className="text-muted-foreground text-sm mt-1">Spieler-Profile mit KI-Leistungsanalyse</p>
          </div>
          <Button onClick={() => setShowForm(s => !s)} className="bg-primary text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> Spieler hinzufügen
          </Button>
        </div>
      </motion.div>

      {/* Add Player Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="glass rounded-xl p-5 mb-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Name *</label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Max Mustermann" className="bg-muted border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Trikotnummer</label>
                <Input type="number" value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} placeholder="9" className="bg-muted border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Position</label>
                <select value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))}
                  className="w-full h-9 bg-muted border border-input rounded-md px-3 text-sm text-foreground">
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Team/Verein</label>
                <Input value={form.team} onChange={e => setForm(p => ({ ...p, team: e.target.value }))} placeholder="FC Musterverein" className="bg-muted border-border" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createPlayer.mutate({ ...form, number: parseInt(form.number) || undefined })}
                disabled={!form.name || createPlayer.isPending} className="bg-primary text-primary-foreground">
                Speichern
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Abbrechen</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Player Grid */}
        <div className="lg:col-span-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3">
            {players.length === 0 && (
              <div className="col-span-full glass rounded-xl p-8 text-center">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Noch keine Spieler. Füge deinen Kader hinzu!</p>
              </div>
            )}
            {players.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}>
                <button onClick={() => setSelectedPlayer(selectedPlayer?.id === p.id ? null : p)}
                  className={`w-full glass rounded-xl p-4 text-left transition-all hover:border-primary/40 ${selectedPlayer?.id === p.id ? 'border-primary/60 bg-primary/5' : ''}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mb-2 ${selectedPlayer?.id === p.id ? 'bg-primary text-primary-foreground' : 'bg-primary/15 text-primary'}`}>
                    {p.number || positionShort[p.position] || p.name[0]}
                  </div>
                  <div className="text-sm font-grotesk font-semibold text-foreground leading-tight">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{p.position}</div>
                </button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Player Detail */}
        <div className="lg:col-span-8">
          {!selectedPlayer ? (
            <div className="glass rounded-xl p-12 text-center h-full flex flex-col items-center justify-center">
              <User className="w-12 h-12 text-muted-foreground mb-4" />
              <div className="font-grotesk font-semibold text-foreground mb-1">Spieler auswählen</div>
              <div className="text-sm text-muted-foreground">Klicke einen Spieler an um das Performance-Profil zu sehen</div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={selectedPlayer.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                {/* Header */}
                <div className="glass rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center text-xl font-grotesk font-bold text-primary">
                        {selectedPlayer.number || selectedPlayer.name[0]}
                      </div>
                      <div>
                        <h2 className="text-xl font-grotesk font-bold text-foreground">{selectedPlayer.name}</h2>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge className="bg-primary/15 text-primary border-primary/30 text-xs">{selectedPlayer.position}</Badge>
                          {selectedPlayer.team && <span className="text-xs text-muted-foreground">{selectedPlayer.team}</span>}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => deletePlayer.mutate(selectedPlayer.id)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Avg Stats */}
                  {avgStats && (
                    <div className="grid grid-cols-5 gap-3 mt-4 pt-4 border-t border-border">
                      {[
                        { label: 'Ø Note', value: avgStats.rating },
                        { label: 'Tore', value: avgStats.goals },
                        { label: 'Assists', value: avgStats.assists },
                        { label: 'Zweikampf', value: `${avgStats.duels}%` },
                        { label: 'Ø km', value: avgStats.distance },
                      ].map(s => (
                        <div key={s.label} className="text-center">
                          <div className="text-lg font-grotesk font-bold text-foreground">{s.value}</div>
                          <div className="text-[10px] text-muted-foreground">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Charts: Radar + Trend */}
                {radarData.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="glass rounded-xl p-5">
                      <h3 className="text-sm font-grotesk font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary" /> Leistungs-Radar
                      </h3>
                      <ResponsiveContainer width="100%" height={180}>
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="hsl(var(--border))" />
                          <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                          <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                    {stats.length >= 2 && (
                      <div className="glass rounded-xl p-5">
                        <h3 className="text-sm font-grotesk font-semibold text-foreground mb-3 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-primary" /> Noten-Verlauf
                        </h3>
                        <ResponsiveContainer width="100%" height={180}>
                          <LineChart data={[...stats].reverse().map((s, i) => ({ spiel: `S${i + 1}`, note: s.rating, tore: s.goals, assists: s.assists }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="spiel" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                            <YAxis domain={[0, 10]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                            <Line type="monotone" dataKey="note" name="Note" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))', r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Feedback */}
                <div className="glass rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-grotesk font-semibold text-foreground flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" /> KI-Spieleranalyse
                    </h3>
                    <Button size="sm" onClick={handleGenerateFeedback} disabled={generatingFeedback || stats.length === 0}
                      className="bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30 text-xs gap-1.5">
                      {generatingFeedback ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                      KI-Feedback
                    </Button>
                  </div>
                  {stats[0]?.ai_feedback
                    ? <p className="text-sm text-foreground/80 leading-relaxed italic">"{stats[0].ai_feedback}"</p>
                    : <p className="text-xs text-muted-foreground">{stats.length === 0 ? 'Füge zuerst Spiel-Statistiken hinzu.' : 'Klicke "KI-Feedback" um eine Analyse zu generieren.'}</p>
                  }
                </div>

                {/* Stats per Match */}
                <AddStatForm player={selectedPlayer} matches={matches} onAdd={(data) => createStat.mutate(data)} />

                {stats.length > 0 && (
                  <div className="glass rounded-xl p-5">
                    <h3 className="text-sm font-grotesk font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Award className="w-4 h-4 text-primary" /> Spiel-Historie ({stats.length})
                    </h3>
                    <div className="space-y-2">
                      {stats.map(s => (
                        <div key={s.id} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0 gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">{s.match_title || 'Unbekanntes Spiel'}</div>
                            <div className="text-xs text-muted-foreground">{s.match_date}</div>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
                            {s.goals > 0 && <span className="text-primary font-bold">⚽ {s.goals}</span>}
                            {s.assists > 0 && <span className="text-blue-400 font-bold">🅰 {s.assists}</span>}
                            {s.minutes_played && <span>{s.minutes_played}'</span>}
                          </div>
                          <div className={`text-lg font-grotesk font-bold flex-shrink-0 ${s.rating >= 7 ? 'text-primary' : s.rating >= 5 ? 'text-yellow-400' : 'text-destructive'}`}>
                            {s.rating}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}

function AddStatForm({ player, matches, onAdd }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ match_id: '', rating: 7, goals: 0, assists: 0, distance_km: 10, duels_won: 8, duels_total: 14, minutes_played: 90 });

  const handleSubmit = () => {
    const match = matches.find(m => m.id === form.match_id);
    onAdd({
      ...form,
      player_id: player.id,
      player_name: player.name,
      match_title: match?.title || 'Unbekanntes Spiel',
      match_date: match?.date || new Date().toISOString().split('T')[0],
      rating: parseFloat(form.rating),
      goals: parseInt(form.goals),
      assists: parseInt(form.assists),
      distance_km: parseFloat(form.distance_km),
      duels_won: parseInt(form.duels_won),
      duels_total: parseInt(form.duels_total),
      minutes_played: parseInt(form.minutes_played),
    });
    setOpen(false);
  };

  return (
    <div className="glass rounded-xl p-4">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-sm font-grotesk font-semibold text-foreground">
        <span className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Spiel-Statistik eintragen</span>
        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-4 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Spiel</label>
                <select value={form.match_id} onChange={e => setForm(p => ({ ...p, match_id: e.target.value }))}
                  className="w-full h-9 bg-muted border border-input rounded-md px-3 text-sm text-foreground">
                  <option value="">— Spiel wählen —</option>
                  {matches.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'rating', label: 'Note (1-10)', step: 0.5 },
                  { key: 'goals', label: 'Tore', step: 1 },
                  { key: 'assists', label: 'Assists', step: 1 },
                  { key: 'minutes_played', label: 'Minuten', step: 1 },
                  { key: 'distance_km', label: 'km gelaufen', step: 0.1 },
                  { key: 'duels_won', label: 'Duelle gew.', step: 1 },
                  { key: 'duels_total', label: 'Duelle ges.', step: 1 },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-[10px] text-muted-foreground mb-1 block">{f.label}</label>
                    <Input type="number" step={f.step} value={form[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="bg-muted border-border text-sm h-8 px-2" />
                  </div>
                ))}
              </div>
              <Button onClick={handleSubmit} disabled={!form.match_id} size="sm" className="bg-primary text-primary-foreground gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Eintragen
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}