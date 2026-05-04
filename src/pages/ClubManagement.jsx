/**
 * ClubManagement — Vereins-Dashboard
 * Logo → KI-Erkennung → Vereinsfarben → Spielplan → Spieler → Transfer-Scout
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Plus, Edit2, Check, X, ChevronLeft, Loader2,
  Calendar, Users, TrendingUp, Palette, Sparkles, Globe,
  Trophy, MapPin, Shield, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import ClubLogoUpload from '@/components/club/ClubLogoUpload';
import ClubColorThemePicker from '@/components/club/ClubColorThemePicker';
import ClubSchedule from '@/components/club/ClubSchedule';
import TransferScout from '@/components/club/TransferScout';
import TeamSelector from '@/components/club/TeamSelector';
import { applyClubTheme } from '@/lib/clubTheme';

const FORMATIONS = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3', '5-3-2', '4-1-4-1'];

export default function ClubManagement() {
  const [view, setView] = useState('list'); // list | create | detail
  const [selectedClub, setSelectedClub] = useState(null);
  const [createForm, setCreateForm] = useState({ name: '' });
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [importingData, setImportingData] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clubs = [], isLoading } = useQuery({
    queryKey: ['clubs'],
    queryFn: () => base44.entities.Club.list('-created_date', 20),
  });

  const createClub = useMutation({
    mutationFn: (data) => base44.entities.Club.create(data),
    onSuccess: (club) => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      setSelectedClub(club);
      setView('detail');
      toast({ title: '✓ Verein angelegt' });
    },
  });

  const updateClub = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Club.update(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      setSelectedClub(updated);
      setEditMode(false);
      toast({ title: '✓ Verein aktualisiert' });
    },
  });

  const deleteClub = useMutation({
    mutationFn: (id) => base44.entities.Club.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      setView('list');
      setSelectedClub(null);
    },
  });

  // Nach KI-Erkennung: Daten automatisch in Formular + DB übernehmen
  const handleIdentified = async (data) => {
    const { identification, api_matches, api_players, logo_url } = data;
    if (!identification) return;

    const clubData = {
      ...identification,
      logo_url,
    };

    let club;
    if (selectedClub) {
      const res = await base44.entities.Club.update(selectedClub.id, clubData);
      club = res;
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      setSelectedClub(res);
    } else {
      club = await base44.entities.Club.create(clubData);
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      setSelectedClub(club);
      setView('detail');
    }

    // Farben sofort anwenden
    if (identification.primary_color) {
      applyClubTheme(identification.primary_color, identification.secondary_color, identification.accent_color);
      toast({ title: '🎨 Vereinsfarben erkannt und angewendet!', description: identification.name });
    }

    // Spielplan importieren
    if (api_matches?.length > 0 && club?.id) {
      setImportingData(true);
      try {
        const season = identification.current_season || new Date().getFullYear() + '/' + (new Date().getFullYear() + 1);
        await Promise.all(api_matches.slice(0, 50).map(m =>
          base44.entities.ClubMatch.create({
            club_id: club.id,
            api_match_id: String(m.id),
            date: m.utcDate,
            matchday: m.matchday,
            home_team: m.homeTeam?.name || m.homeTeam?.shortName || 'Heim',
            away_team: m.awayTeam?.name || m.awayTeam?.shortName || 'Gast',
            home_score: m.score?.fullTime?.home ?? null,
            away_score: m.score?.fullTime?.away ?? null,
            status: m.status?.toLowerCase() === 'finished' ? 'finished' :
                    m.status?.toLowerCase() === 'in_play' ? 'live' :
                    m.status?.toLowerCase() === 'postponed' ? 'postponed' : 'scheduled',
            competition: m.competition?.name || identification.league,
            venue: m.venue || identification.stadium,
            season,
          }).catch(() => {})
        ));
        toast({ title: `📅 ${api_matches.length} Spiele importiert` });
      } finally {
        setImportingData(false);
        queryClient.invalidateQueries({ queryKey: ['club-matches', club.id] });
      }
    }

    // Spieler importieren
    if (api_players?.length > 0 && club?.id) {
      const posMap = {
        'Goalkeeper': 'Torwart',
        'Centre-Back': 'Innenverteidiger', 'Right-Back': 'Außenverteidiger', 'Left-Back': 'Außenverteidiger',
        'Defensive Midfield': 'Defensives Mittelfeld', 'Central Midfield': 'Zentrales Mittelfeld',
        'Attacking Midfield': 'Offensives Mittelfeld',
        'Left Winger': 'Linksaußen', 'Right Winger': 'Rechtsaußen',
        'Centre-Forward': 'Mittelstürmer', 'Striker': 'Mittelstürmer',
      };
      await Promise.all(api_players.slice(0, 25).map(p =>
        base44.entities.Player.create({
          name: p.name,
          position: posMap[p.position] || 'Zentrales Mittelfeld',
          team: identification.name,
          club_id: club.id,
          age: p.dateOfBirth ? Math.floor((new Date() - new Date(p.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)) : undefined,
          nationality: p.nationality,
          api_player_id: String(p.id),
          contract_until: p.contract?.until || undefined,
        }).catch(() => {})
      ));
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['players-club', club.id] });
      toast({ title: `👤 ${api_players.length} Spieler importiert` });
    }
  };

  const openClub = (club) => {
    setSelectedClub(club);
    setView('detail');
    // Theme wiederherstellen wenn Farben gesetzt
    if (club.primary_color && club.colors_applied_to_theme) {
      applyClubTheme(club.primary_color, club.secondary_color, club.accent_color);
    }
  };

  const startEdit = () => {
    setEditForm({ ...selectedClub });
    setEditMode(true);
  };

  const saveEdit = () => {
    updateClub.mutate({ id: selectedClub.id, data: editForm });
  };

  // ── LIST ──
  if (view === 'list') return (
    <div className="p-4 lg:p-8 min-h-screen max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-grotesk font-bold">Vereins-Management</h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            {clubs.length} {clubs.length === 1 ? 'Verein' : 'Vereine'} · KI-Erkennung · Spielplan · Transfer-Scout
          </p>
        </div>
        <Button onClick={() => setView('create')} className="bg-primary text-primary-foreground gap-2">
          <Plus className="w-4 h-4" /> Verein anlegen
        </Button>
      </motion.div>

      {isLoading && <div className="text-center py-12 text-muted-foreground text-sm"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /></div>}

      {clubs.length === 0 && !isLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass rounded-2xl p-12 text-center border border-primary/20">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <div className="font-grotesk font-semibold text-foreground mb-1">Noch kein Verein angelegt</div>
          <p className="text-sm text-muted-foreground mb-4">Lade ein Vereins-Logo hoch — die KI erkennt den Verein automatisch und importiert Spielplan, Spieler und Statistiken.</p>
          <Button onClick={() => setView('create')} className="bg-primary gap-2">
            <Plus className="w-4 h-4" /> Ersten Verein anlegen
          </Button>
        </motion.div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {clubs.map((club, i) => (
          <motion.button key={club.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
            onClick={() => openClub(club)}
            className="glass rounded-xl p-5 text-left hover:border-primary/40 transition-all group">
            <div className="flex items-center gap-3 mb-3">
              {club.logo_url ? (
                <img src={club.logo_url} alt={club.name} className="w-12 h-12 object-contain rounded-lg" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-grotesk font-bold text-foreground truncate">{club.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{club.league || club.city || '—'}</div>
              </div>
            </div>
            {/* Farb-Punkte */}
            {club.primary_color && (
              <div className="flex gap-1.5">
                {[club.primary_color, club.secondary_color, club.accent_color].filter(Boolean).map((c, j) => (
                  <div key={j} className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
                ))}
                {club.colors_applied_to_theme && (
                  <span className="text-[9px] text-primary ml-1 font-bold">● Theme aktiv</span>
                )}
              </div>
            )}
            {club.standard_formation && (
              <div className="text-[10px] text-muted-foreground mt-1.5">Formation: {club.standard_formation}</div>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );

  // ── CREATE ──
  if (view === 'create') return (
    <div className="p-4 lg:p-8 min-h-screen max-w-xl mx-auto">
      <button onClick={() => setView('list')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6">
        <ChevronLeft className="w-4 h-4" /> Zurück
      </button>
      <h1 className="text-2xl font-grotesk font-bold mb-6">Verein anlegen</h1>

      <div className="space-y-6">
        {/* Logo Upload + KI-Erkennung */}
        <div className="glass rounded-xl p-5">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> KI-Logo-Erkennung
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Lade das Vereinslogo hoch — die KI erkennt den Verein automatisch und importiert Spielplan, Spieler, Farben und alle verfügbaren Daten.
          </p>
          <ClubLogoUpload onIdentified={handleIdentified} />
        </div>

        {/* Oder manuell anlegen */}
        <div className="glass rounded-xl p-5">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-muted-foreground" /> Oder manuell anlegen
          </h2>
          <div className="space-y-3">
            <Input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Vereinsname..." className="bg-muted border-border" />
            <Button onClick={() => createClub.mutate(createForm)} disabled={!createForm.name || createClub.isPending}
              className="w-full bg-primary text-primary-foreground gap-2">
              {createClub.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Verein anlegen
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── DETAIL ──
  if (view === 'detail' && selectedClub) return (
    <div className="p-4 lg:p-8 min-h-screen max-w-4xl mx-auto">
      <button onClick={() => { setView('list'); setEditMode(false); }}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-4">
        <ChevronLeft className="w-4 h-4" /> Alle Vereine
      </button>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-5 mb-4 border border-primary/20">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            {selectedClub.logo_url ? (
              <img src={selectedClub.logo_url} alt={selectedClub.name} className="w-20 h-20 object-contain rounded-xl shadow-lg" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-primary/15 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {editMode ? (
              <div className="space-y-2">
                <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="bg-muted border-border font-grotesk font-bold text-lg" />
                <div className="grid grid-cols-2 gap-2">
                  <Input value={editForm.league || ''} onChange={e => setEditForm(f => ({ ...f, league: e.target.value }))}
                    placeholder="Liga" className="bg-muted border-border text-sm h-8" />
                  <Input value={editForm.city || ''} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="Stadt" className="bg-muted border-border text-sm h-8" />
                  <Input value={editForm.stadium || ''} onChange={e => setEditForm(f => ({ ...f, stadium: e.target.value }))}
                    placeholder="Stadion" className="bg-muted border-border text-sm h-8" />
                  <Input type="number" value={editForm.founded || ''} onChange={e => setEditForm(f => ({ ...f, founded: parseInt(e.target.value) }))}
                    placeholder="Gegründet" className="bg-muted border-border text-sm h-8" />
                  <Input value={editForm.website || ''} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))}
                    placeholder="Website" className="bg-muted border-border text-sm h-8" />
                  <select value={editForm.standard_formation || ''} onChange={e => setEditForm(f => ({ ...f, standard_formation: e.target.value }))}
                    className="h-8 bg-muted border border-input rounded-md px-2 text-sm text-foreground">
                    <option value="">Formation...</option>
                    {FORMATIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <textarea value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Vereinsbeschreibung..." rows={2}
                  className="w-full bg-muted border border-input rounded-md px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEdit} disabled={updateClub.isPending}
                    className="bg-primary text-primary-foreground gap-1.5 h-8 text-xs">
                    {updateClub.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Speichern
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditMode(false)} className="border-border h-8 text-xs">
                    Abbrechen
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-grotesk font-bold text-foreground">{selectedClub.name}</h1>
                  {selectedClub.short_name && <span className="text-xs text-muted-foreground">({selectedClub.short_name})</span>}
                  {selectedClub.ai_identified && (
                    <Badge className="text-[9px] bg-primary/15 text-primary border-primary/20 gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" /> KI erkannt
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                  {selectedClub.league && <span className="flex items-center gap-1"><Trophy className="w-3 h-3" /> {selectedClub.league}</span>}
                  {selectedClub.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {selectedClub.city}</span>}
                  {selectedClub.founded && <span>Gegr. {selectedClub.founded}</span>}
                  {selectedClub.stadium && <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> {selectedClub.stadium}</span>}
                  {selectedClub.standard_formation && <span className="text-primary font-medium">{selectedClub.standard_formation}</span>}
                </div>
                {selectedClub.description && (
                  <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed line-clamp-2">{selectedClub.description}</p>
                )}
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={startEdit} variant="outline" className="border-border text-muted-foreground h-7 text-[11px] gap-1">
                    <Edit2 className="w-3 h-3" /> Bearbeiten
                  </Button>
                  {selectedClub.website && (
                    <a href={selectedClub.website} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="border-border text-muted-foreground h-7 text-[11px] gap-1">
                        <Globe className="w-3 h-3" /> Website
                      </Button>
                    </a>
                  )}
                  <Button size="sm" variant="outline" onClick={() => deleteClub.mutate(selectedClub.id)}
                    className="border-destructive/30 text-destructive h-7 text-[11px] ml-auto gap-1 hover:bg-destructive/10">
                    <X className="w-3 h-3" /> Löschen
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Farb-Punkte */}
        {selectedClub.primary_color && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
            <span className="text-[10px] text-muted-foreground">Vereinsfarben:</span>
            {[selectedClub.primary_color, selectedClub.secondary_color, selectedClub.accent_color].filter(Boolean).map((c, i) => (
              <div key={i} className="w-4 h-4 rounded-full border border-border/50" style={{ backgroundColor: c }} title={c} />
            ))}
          </div>
        )}
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="teams" className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-muted mb-4">
          <TabsTrigger value="teams" className="text-xs">👥 Mannschaften</TabsTrigger>
          <TabsTrigger value="schedule" className="text-xs">📅 Spielplan</TabsTrigger>
          <TabsTrigger value="scout" className="text-xs">🔭 Transfer</TabsTrigger>
          <TabsTrigger value="logo" className="text-xs">🎨 Farben</TabsTrigger>
          <TabsTrigger value="import" className="text-xs">⬇️ Daten</TabsTrigger>
        </TabsList>

        <TabsContent value="teams">
          <div className="glass rounded-xl p-5">
            <h2 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Mannschaften
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Suche alle Mannschaften des Vereins in der Datenbank und importiere Spielplan + Spieler pro Team.
            </p>
            <TeamSelector
              clubId={selectedClub.id}
              clubName={selectedClub.short_name || selectedClub.name}
              apiTeamId={selectedClub.api_team_id}
              onTeamImported={() => {
                queryClient.invalidateQueries({ queryKey: ['club-matches', selectedClub.id] });
                queryClient.invalidateQueries({ queryKey: ['players'] });
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="schedule">
          <ClubSchedule clubId={selectedClub.id} clubName={selectedClub.name} />
        </TabsContent>

        <TabsContent value="scout">
          <TransferScout clubId={selectedClub.id} />
        </TabsContent>

        <TabsContent value="logo">
          <div className="space-y-4">
            <div className="glass rounded-xl p-5">
              <h2 className="text-sm font-bold text-foreground mb-3">Logo aktualisieren</h2>
              <ClubLogoUpload onIdentified={handleIdentified} existingLogo={selectedClub.logo_url} />
            </div>
            <div className="glass rounded-xl p-5">
              <ClubColorThemePicker
                club={selectedClub}
                onUpdate={(colorData) => updateClub.mutate({ id: selectedClub.id, data: colorData })}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="import">
          <div className="glass rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" /> Daten neu importieren
            </h2>
            <p className="text-xs text-muted-foreground">
              Lade erneut das Vereinslogo hoch oder gib den Vereinsnamen ein — die KI sucht aktuelle Spielplan-Daten, Spieler und News aus dem Internet.
            </p>
            <ClubLogoUpload onIdentified={handleIdentified} existingLogo={selectedClub.logo_url} />
            {importingData && (
              <div className="flex items-center gap-2 text-xs text-primary">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Importiere Spielplan und Spieler...
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  return null;
}