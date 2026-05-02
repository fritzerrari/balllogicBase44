/**
 * Players — Kader & Performance-Dashboard
 * Vollständig überarbeitetes Layout mit mobiloptimierter Ansicht
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, X, Zap, Loader2,
  TrendingUp, Target, ChevronRight, Award, BarChart3,
  Search, ChevronLeft, Shield
} from 'lucide-react';
import DsgvoConsentManager from '@/components/players/DsgvoConsentManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';
import { useToast } from '@/components/ui/use-toast';
import LineupBuilder from '@/components/players/LineupBuilder';

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

const positionColors = {
  'Torwart': 'text-yellow-400 bg-yellow-400/15',
  'Innenverteidiger': 'text-blue-400 bg-blue-400/15',
  'Außenverteidiger': 'text-blue-300 bg-blue-300/15',
  'Defensives Mittelfeld': 'text-green-400 bg-green-400/15',
  'Zentrales Mittelfeld': 'text-primary bg-primary/15',
  'Offensives Mittelfeld': 'text-orange-400 bg-orange-400/15',
  'Linksaußen': 'text-pink-400 bg-pink-400/15',
  'Rechtsaußen': 'text-pink-400 bg-pink-400/15',
  'Mittelstürmer': 'text-red-400 bg-red-400/15',
};

export default function Players() {
  const [view, setView] = useState('list'); // 'list' | 'detail' | 'add'
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [form, setForm] = useState({ name: '', number: '', position: POSITIONS[4], team: '' });
  const [generatingFeedback, setGeneratingFeedback] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDsgvo, setShowDsgvo] = useState(false);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      setView('list');
      setForm({ name: '', number: '', position: POSITIONS[4], team: '' });
      toast({ title: '✓ Spieler angelegt' });
    },
  });

  const deletePlayer = useMutation({
    mutationFn: (id) => base44.entities.Player.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      setSelectedPlayer(null);
      setView('list');
    },
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
Statistiken: ${statSummary}
Fokus: Stärken, Entwicklungspotenzial, eine konkrete Trainingsempfehlung.`,
    });

    if (stats[0]) {
      await base44.entities.PlayerStat.update(stats[0].id, { ai_feedback: result });
      queryClient.invalidateQueries({ queryKey: ['player-stats', selectedPlayer?.id] });
    }
    setGeneratingFeedback(false);
    toast({ title: 'KI-Feedback generiert!' });
  };

  const avgStats = stats.length > 0 ? {
    rating: (stats.reduce((s, p) => s + (p.rating || 0), 0) / stats.length).toFixed(1),
    goals: stats.reduce((s, p) => s + (p.goals || 0), 0),
    assists: stats.reduce((s, p) => s + (p.assists || 0), 0),
    duels: ((stats.reduce((s, p) => s + (p.duels_won || 0), 0) / Math.max(1, stats.reduce((s, p) => s + (p.duels_total || 1), 0))) * 100).toFixed(0),
    distance: (stats.reduce((s, p) => s + (p.distance_km || 0), 0) / stats.length).toFixed(1),
  } : null;

  const radarData = avgStats ? [
    { metric: 'Note', value: (avgStats.rating / 10) * 100 },
    { metric: 'Zweikampf', value: parseFloat(avgStats.duels) },
    { metric: 'Tore', value: Math.min(100, (avgStats.goals / stats.length) * 100) },
    { metric: 'Assists', value: Math.min(100, (avgStats.assists / stats.length) * 100) },
    { metric: 'km/Spiel', value: Math.min(100, (parseFloat(avgStats.distance) / 12) * 100) },
  ] : [];

  const filteredPlayers = players.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.position?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openPlayer = (p) => {
    setSelectedPlayer(p);
    setView('detail');
  };

  // ── LIST VIEW ──
  if (view === 'list') return (
    <div className="p-4 lg:p-8 min-h-screen">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-grotesk font-bold text-foreground">Kader</h1>
          <p className="text-muted-foreground text-xs mt-0.5">{players.length} Spieler · Performance-Tracking</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowDsgvo(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-all text-xs font-bold">
            <Shield className="w-3.5 h-3.5" /> DSGVO
          </button>
          <Button onClick={() => setView('add')} className="bg-primary text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> Spieler
          </Button>
        </div>
      </motion.div>

      {/* Search */}
      {players.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Spieler suchen..." className="pl-9 bg-muted border-border" />
        </div>
      )}

      {/* Player Grid */}
      {filteredPlayers.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass rounded-2xl p-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <div className="font-grotesk font-semibold text-foreground mb-1">Noch kein Kader</div>
          <p className="text-sm text-muted-foreground mb-4">Füge Spieler hinzu um ihre Performance zu tracken</p>
          <Button onClick={() => setView('add')} className="bg-primary text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> Ersten Spieler anlegen
          </Button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredPlayers.map((p, i) => (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => openPlayer(p)}
              className="glass rounded-xl p-4 text-left hover:border-primary/40 active:scale-95 transition-all group"
            >
              {/* Avatar */}
              <div className={`w-11 h-11 rounded-full flex items-center justify-center text-base font-grotesk font-bold mb-3 ${positionColors[p.position] || 'bg-primary/15 text-primary'}`}>
                {p.number || positionShort[p.position] || p.name?.[0]}
              </div>
              <div className="text-sm font-grotesk font-semibold text-foreground leading-tight truncate">{p.name}</div>
              <div className={`text-[10px] mt-1 font-medium ${positionColors[p.position]?.split(' ')[0] || 'text-muted-foreground'}`}>
                {positionShort[p.position] || p.position}
              </div>
              {p.team && <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{p.team}</div>}
            </motion.button>
          ))}
        </div>
      )}

      {/* DSGVO Manager */}
      <AnimatePresence>
        {showDsgvo && <DsgvoConsentManager players={players} onClose={() => setShowDsgvo(false)} />}
      </AnimatePresence>
    </div>
  );

  // ── ADD VIEW ──
  if (view === 'add') return (
    <div className="p-4 lg:p-8 min-h-screen max-w-lg mx-auto">
      <button onClick={() => setView('list')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Zurück
      </button>
      <h1 className="text-2xl font-grotesk font-bold text-foreground mb-6">Spieler anlegen</h1>
      <div className="glass rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground mb-1.5 block">Name *</label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Max Mustermann" className="bg-muted border-border" autoFocus />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Nummer</label>
            <Input type="number" value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))}
              placeholder="9" className="bg-muted border-border text-center" />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Position</label>
          <div className="grid grid-cols-3 gap-1.5">
            {POSITIONS.map(pos => (
              <button key={pos} onClick={() => setForm(p => ({ ...p, position: pos }))}
                className={`text-xs py-2 px-2 rounded-lg border transition-all text-center ${form.position === pos ? 'bg-primary/20 border-primary/50 text-primary font-medium' : 'bg-muted border-border text-muted-foreground hover:text-foreground'}`}>
                {pos.split(' ').slice(-1)[0]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Verein / Team</label>
          <Input value={form.team} onChange={e => setForm(p => ({ ...p, team: e.target.value }))}
            placeholder="FC Musterverein" className="bg-muted border-border" />
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={() => createPlayer.mutate({ ...form, number: parseInt(form.number) || undefined })}
            disabled={!form.name || createPlayer.isPending}
            className="flex-1 bg-primary text-primary-foreground gap-2 h-11">
            {createPlayer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Spieler speichern
          </Button>
          <Button variant="outline" onClick={() => setView('list')} className="border-border text-muted-foreground">
            Abbrechen
          </Button>
        </div>
      </div>
    </div>
  );

  // ── DETAIL VIEW ──
  if (view === 'detail' && selectedPlayer) return (
    <div className="p-4 lg:p-8 min-h-screen">
      {/* Back */}
      <button onClick={() => { setView('list'); setSelectedPlayer(null); }}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-4 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Kader
      </button>

      <AnimatePresence mode="wait">
        <motion.div key={selectedPlayer.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

          {/* Hero Card */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-grotesk font-bold border-2 ${positionColors[selectedPlayer.position] || 'bg-primary/15 text-primary'} border-current/20`}>
                {selectedPlayer.number || selectedPlayer.name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-grotesk font-bold text-foreground truncate">{selectedPlayer.name}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge className={`text-[10px] border ${positionColors[selectedPlayer.position] || 'bg-primary/15 text-primary border-primary/30'}`}>
                    {selectedPlayer.position}
                  </Badge>
                  {selectedPlayer.team && <span className="text-xs text-muted-foreground">{selectedPlayer.team}</span>}
                  {selectedPlayer.number && <span className="text-xs text-muted-foreground">#{selectedPlayer.number}</span>}
                </div>
              </div>
              <button onClick={() => deletePlayer.mutate(selectedPlayer.id)}
                className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stats Bar */}
            {avgStats && (
              <div className="grid grid-cols-5 gap-2 mt-5 pt-4 border-t border-border">
                {[
                  { label: 'Ø Note', value: avgStats.rating, highlight: avgStats.rating >= 7 },
                  { label: 'Tore', value: avgStats.goals },
                  { label: 'Assists', value: avgStats.assists },
                  { label: 'Zweikampf', value: `${avgStats.duels}%` },
                  { label: 'Ø km', value: avgStats.distance },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className={`text-lg font-grotesk font-bold ${s.highlight ? 'text-primary' : 'text-foreground'}`}>{s.value}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {!avgStats && (
              <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground text-center">
                Noch keine Spiel-Statistiken · Trage erste Daten ein
              </div>
            )}
          </div>

          {/* Charts */}
          {radarData.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="glass rounded-xl p-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-primary" /> Leistungs-Radar
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
                <div className="glass rounded-xl p-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-primary" /> Noten-Verlauf
                  </h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={[...stats].reverse().map((s, i) => ({ n: `S${i + 1}`, note: s.rating }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="n" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                      <YAxis domain={[0, 10]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                      <Line type="monotone" dataKey="note" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))', r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* AI Feedback */}
          <div className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-primary" /> KI-Spieleranalyse
              </h3>
              <Button size="sm" onClick={handleGenerateFeedback}
                disabled={generatingFeedback || stats.length === 0}
                className="bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30 text-xs gap-1.5 h-7 px-2.5">
                {generatingFeedback ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Analysieren
              </Button>
            </div>
            {stats[0]?.ai_feedback
              ? <p className="text-sm text-foreground/80 leading-relaxed italic">"{stats[0].ai_feedback}"</p>
              : <p className="text-xs text-muted-foreground">{stats.length === 0 ? 'Füge zuerst Spiel-Statistiken hinzu.' : 'Klicke "Analysieren" für KI-Feedback.'}</p>}
          </div>

          {/* Stats per Match */}
          <AddStatForm player={selectedPlayer} matches={matches} onAdd={(data) => createStat.mutate(data)} />

          {/* Match History */}
          {stats.length > 0 && (
            <div className="glass rounded-xl p-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-primary" /> Spiel-Historie ({stats.length})
              </h3>
              <div className="space-y-0 divide-y divide-border/40">
                {stats.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-3 gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{s.match_title || 'Unbekanntes Spiel'}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{s.match_date} · {s.minutes_played}'</div>
                    </div>
                    <div className="flex items-center gap-3 text-xs shrink-0">
                      {s.goals > 0 && <span className="text-primary font-bold">⚽ {s.goals}</span>}
                      {s.assists > 0 && <span className="text-blue-400 font-bold">🅰 {s.assists}</span>}
                      <div className={`text-base font-grotesk font-bold w-8 text-right ${s.rating >= 7 ? 'text-primary' : s.rating >= 5 ? 'text-yellow-400' : 'text-destructive'}`}>
                        {s.rating}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );

  return null;
}

function AddStatForm({ player, matches, onAdd }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    match_id: '', rating: 7, goals: 0, assists: 0,
    distance_km: 10, duels_won: 8, duels_total: 14, minutes_played: 90
  });

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
        className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
        <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-primary" /> Spiel-Statistik eintragen</span>
        <ChevronRight className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-4 space-y-3">
              <select value={form.match_id} onChange={e => setForm(p => ({ ...p, match_id: e.target.value }))}
                className="w-full h-9 bg-muted border border-input rounded-md px-3 text-sm text-foreground">
                <option value="">— Spiel auswählen —</option>
                {matches.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'rating', label: 'Note', step: 0.5 },
                  { key: 'goals', label: 'Tore', step: 1 },
                  { key: 'assists', label: 'Assists', step: 1 },
                  { key: 'minutes_played', label: 'Min.', step: 1 },
                  { key: 'distance_km', label: 'km', step: 0.1 },
                  { key: 'duels_won', label: 'Duelle+', step: 1 },
                  { key: 'duels_total', label: 'Duelle∑', step: 1 },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-[10px] text-muted-foreground mb-1 block">{f.label}</label>
                    <Input type="number" step={f.step} value={form[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="bg-muted border-border text-sm h-8 px-2" />
                  </div>
                ))}
              </div>
              <Button onClick={handleSubmit} disabled={!form.match_id} size="sm"
                className="bg-primary text-primary-foreground gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Eintragen
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}