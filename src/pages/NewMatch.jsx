/**
 * NewMatch — Wizard für das Anlegen eines neuen Spiels
 * Schritte: 1) Basisdaten → 2) Kamera-Setup → 3) Aufstellung → 4) API-Spielerkennung
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Upload, Camera, Users, Zap, Loader2, Search, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { searchTeam, getTeamMatches, getTeamSquad, formatApiMatch, COMPETITIONS } from '@/lib/footballDataApi';
import LineupBuilder from '@/components/players/LineupBuilder';

const STEPS = [
  { id: 1, label: 'Spieldaten', icon: Zap },
  { id: 2, label: 'Videos', icon: Upload },
  { id: 3, label: 'Aufstellung', icon: Users },
];

const POSITIONS = ['Torwart', 'Innenverteidiger', 'Außenverteidiger', 'Defensives Mittelfeld', 'Zentrales Mittelfeld', 'Offensives Mittelfeld', 'Linksaußen', 'Rechtsaußen', 'Mittelstürmer'];

export default function NewMatch() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 — Basisdaten
  const [form, setForm] = useState({ title: '', date: new Date().toISOString().split('T')[0], home_team: '', away_team: '', venue: '', competition: '', score_home: '', score_away: '' });
  const [apiSearch, setApiSearch] = useState({ loading: false, result: null, error: null });
  const [apiMatches, setApiMatches] = useState([]);

  // Step 2 — Videos
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState([]);

  // Step 3 — Aufstellung
  const [lineup, setLineup] = useState({ home: [], away: [] });
  const [apiSquad, setApiSquad] = useState([]);

  const { data: existingPlayers = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list('-created_date', 50),
  });

  const f = (k) => ({ value: form[k] ?? '', onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) });

  // API: Team suchen + nächste Spiele laden
  const handleApiSearch = async () => {
    if (!form.home_team) return;
    setApiSearch({ loading: true, result: null, error: null });
    const found = await searchTeam(form.home_team).catch(() => null);
    if (!found) {
      setApiSearch({ loading: false, result: null, error: 'Team nicht gefunden. Tipp: Vollständigen Namen eingeben.' });
      return;
    }
    setApiSearch({ loading: false, result: found, error: null });
    // Lade nächste Spiele
    const matches = await getTeamMatches(found.team.id, 'SCHEDULED').catch(() => []);
    setApiMatches(matches.slice(0, 5).map(formatApiMatch));
    // Lade Kader
    const squad = await getTeamSquad(found.team.id).catch(() => []);
    setApiSquad(squad);
  };

  const applyApiMatch = (m) => {
    setForm(p => ({ ...p, title: m.title, home_team: m.home_team, away_team: m.away_team, date: m.date, competition: m.competition, venue: m.venue || p.venue }));
    setApiMatches([]);
  };

  // Video Upload
  const handleUpload = async () => {
    if (!files.length) { setStep(3); return; }
    setUploading(true);
    const urls = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push(file_url);
    }
    setUploadedUrls(urls);
    setUploading(false);
    setStep(3);
  };



  // Speichern
  const handleSave = async () => {
    setSaving(true);
    const matchData = {
      ...form,
      score_home: form.score_home !== '' ? Number(form.score_home) : undefined,
      score_away: form.score_away !== '' ? Number(form.score_away) : undefined,
      video_urls: uploadedUrls,
      camera_count: uploadedUrls.length || 1,
      status: uploadedUrls.length > 0 ? 'uploading' : 'uploading',
      notes: lineup.home.length > 0
        ? `Aufstellung Heim: ${lineup.home.map(p => `${p.number ? p.number + '. ' : ''}${p.name} (${p.position})`).join(', ')} | Gäste: ${lineup.away.map(p => `${p.number ? p.number + '. ' : ''}${p.name}`).join(', ')}`
        : undefined,
    };
    const match = await base44.entities.Match.create(matchData);
    queryClient.invalidateQueries({ queryKey: ['matches'] });
    toast({ title: 'Spiel angelegt!', description: `${match.title} wurde erfolgreich erstellt.` });
    navigate(`/matches/${match.id}`);
  };

  const canNext1 = form.title && form.date && form.home_team && form.away_team;

  return (
    <div className="p-4 lg:p-8 min-h-screen max-w-2xl mx-auto">
      <button onClick={() => navigate('/matches')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Zurück
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-grotesk font-bold text-foreground mb-1">Neues Spiel anlegen</h1>
        <p className="text-sm text-muted-foreground">Schritt {step} von {STEPS.length}</p>
      </div>

      {/* Step Progress */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${step > s.id ? 'bg-primary text-primary-foreground' : step === s.id ? 'bg-primary/20 border-2 border-primary text-primary' : 'bg-muted text-muted-foreground'}`}>
              {step > s.id ? <Check className="w-4 h-4" /> : s.id}
            </div>
            <span className={`text-xs hidden sm:block ${step === s.id ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{s.label}</span>
            {i < STEPS.length - 1 && <div className="flex-1 h-0.5 bg-border mx-2" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ── STEP 1: Spieldaten ── */}
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="glass rounded-xl p-5 space-y-4 mb-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Heimteam *</Label>
                  <div className="flex gap-1">
                    <Input {...f('home_team')} placeholder="FC Bayern" className="bg-muted border-border" />
                    <button onClick={handleApiSearch} className="px-2 rounded-lg bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-all flex-shrink-0" title="In Fußball-Datenbank suchen">
                      {apiSearch.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Auswärtsteam *</Label>
                  <Input {...f('away_team')} placeholder="BVB" className="bg-muted border-border" />
                </div>
              </div>

              {/* API-Suchergebnisse */}
              {apiSearch.error && (
                <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                  {apiSearch.error} · Daten manuell eingeben oder <a href="https://www.football-data.org/client/register" target="_blank" rel="noopener" className="underline">API Key aktivieren</a>
                </div>
              )}
              {apiSearch.result && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs">
                  <div className="text-primary font-bold mb-2">✓ Team gefunden: {apiSearch.result.team.name}</div>
                  {apiMatches.length > 0 && (
                    <div>
                      <div className="text-muted-foreground mb-1">Nächste Spiele — tippen zum Übernehmen:</div>
                      {apiMatches.map((m, i) => (
                        <button key={i} onClick={() => applyApiMatch(m)}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-primary/10 transition-colors border-b border-border/30 last:border-0">
                          <span className="font-medium text-foreground">{m.title}</span>
                          <span className="text-muted-foreground ml-2">{m.date} · {m.competition}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Spieltitel *</Label>
                <Input {...f('title')} placeholder="FC Bayern vs BVB" className="bg-muted border-border" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Datum *</Label>
                  <Input type="date" {...f('date')} className="bg-muted border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Wettbewerb</Label>
                  <Input {...f('competition')} placeholder="Bundesliga" className="bg-muted border-border" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Spielort</Label>
                  <Input {...f('venue')} placeholder="Allianz Arena" className="bg-muted border-border" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Heim-Tore</Label>
                    <Input type="number" min="0" {...f('score_home')} placeholder="—" className="bg-muted border-border text-center" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Gäste-Tore</Label>
                    <Input type="number" min="0" {...f('score_away')} placeholder="—" className="bg-muted border-border text-center" />
                  </div>
                </div>
              </div>
            </div>
            <Button onClick={() => setStep(2)} disabled={!canNext1} className="w-full bg-primary text-primary-foreground gap-2 h-12">
              Weiter <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        )}

        {/* ── STEP 2: Videos ── */}
        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="glass rounded-xl p-5 mb-4">
              <h2 className="font-grotesk font-semibold text-foreground mb-3 flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary" /> Spielvideos hochladen
              </h2>
              <p className="text-xs text-muted-foreground mb-4">Optional — du kannst Videos auch später hochladen.</p>

              <label className="block">
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 transition-all">
                  <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <div className="text-sm text-foreground font-medium">Videos hier ablegen</div>
                  <div className="text-xs text-muted-foreground mt-1">MP4, MOV, AVI — Mehrere Kameras möglich</div>
                </div>
                <input type="file" multiple accept="video/*" className="hidden"
                  onChange={e => setFiles(Array.from(e.target.files))} />
              </label>

              {files.length > 0 && (
                <div className="mt-3 space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-xs">
                      <Camera className="w-3.5 h-3.5 text-primary" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 border-border text-muted-foreground">
                <ArrowLeft className="w-4 h-4 mr-2" /> Zurück
              </Button>
              <Button onClick={handleUpload} disabled={uploading} className="flex-1 bg-primary text-primary-foreground gap-2">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {uploading ? 'Lädt hoch...' : files.length > 0 ? 'Hochladen & Weiter' : 'Überspringen'}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 3: Aufstellung ── */}
        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="glass rounded-xl p-5 mb-4 space-y-6">
              <h2 className="font-grotesk font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Aufstellung (optional)
              </h2>
              <LineupBuilder
                side="home"
                teamName={form.home_team || 'Heim'}
                existingPlayers={existingPlayers}
                lineup={lineup.home}
                onLineupChange={(l) => setLineup(p => ({ ...p, home: l }))}
                apiSquad={apiSquad}
              />
              <div className="border-t border-border" />
              <LineupBuilder
                side="away"
                teamName={form.away_team || 'Gäste'}
                existingPlayers={[]}
                lineup={lineup.away}
                onLineupChange={(l) => setLineup(p => ({ ...p, away: l }))}
                apiSquad={[]}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1 border-border text-muted-foreground">
                <ArrowLeft className="w-4 h-4 mr-2" /> Zurück
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-primary text-primary-foreground gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Speichern...' : 'Spiel anlegen'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}