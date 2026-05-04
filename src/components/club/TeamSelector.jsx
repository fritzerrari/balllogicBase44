/**
 * TeamSelector — KI-Web-Suche: alle Mannschaften eines Vereins + Kader-/Spielplan-Import
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check, Users, MapPin, Download, Globe, Sparkles, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

export default function TeamSelector({ clubId, clubName, clubWebsite, onTeamImported }) {
  const [teams, setTeams] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(null);
  const [importedTeams, setImportedTeams] = useState({});  // label -> { players, matches }
  const [note, setNote] = useState(null);
  const { toast } = useToast();

  const searchTeams = async () => {
    if (!clubName) return;
    setLoading(true);
    setTeams(null);
    setNote(null);
    try {
      const res = await base44.functions.invoke('fetchClubTeams', {
        action: 'search_teams',
        team_name: clubName,
        club_website: clubWebsite || null,
      });
      setTeams(res.data.teams || []);
      setNote(res.data.note || null);
    } catch (e) {
      toast({ title: '❌ Fehler beim Suchen', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const importTeam = async (team) => {
    const key = team.label || team.name;
    setImporting(key);
    try {
      const res = await base44.functions.invoke('fetchClubTeams', {
        action: 'fetch_team_data',
        team_name: team.name,
        team_label: team.label,
        club_website: clubWebsite || null,
      });
      const { players, matches, season, league, data_source } = res.data;

      // Spielplan importieren
      let matchCount = 0;
      if (matches?.length > 0) {
        await Promise.all(matches.slice(0, 60).map(m =>
          base44.entities.ClubMatch.create({
            club_id: clubId,
            api_match_id: `ai-${team.label}-${m.date}-${m.home_team}`.replace(/\s+/g, '-').toLowerCase(),
            date: m.date,
            matchday: m.matchday ? String(m.matchday) : null,
            home_team: m.home_team,
            away_team: m.away_team,
            home_score: m.home_score ?? null,
            away_score: m.away_score ?? null,
            status: m.status || 'scheduled',
            competition: m.competition || league || team.league,
            season: season || team.season,
          }).catch(() => {})
        ));
        matchCount = matches.length;
      }

      // Spieler importieren
      let playerCount = 0;
      if (players?.length > 0) {
        await Promise.all(players.slice(0, 40).map(p =>
          base44.entities.Player.create({
            name: p.name,
            position: p.position || 'Zentrales Mittelfeld',
            team: team.name,
            club_id: clubId,
            age: p.age || null,
            nationality: p.nationality || null,
            number: p.number || null,
          }).catch(() => {})
        ));
        playerCount = players.length;
      }

      setImportedTeams(prev => ({ ...prev, [key]: { players: playerCount, matches: matchCount, source: data_source } }));

      toast({
        title: `✓ ${team.name} importiert`,
        description: `${playerCount} Spieler · ${matchCount} Spiele · Quelle: ${data_source || 'KI-Web-Suche'}`,
      });
      if (onTeamImported) onTeamImported(team);
    } catch (e) {
      toast({ title: '❌ Import fehlgeschlagen', description: e.message, variant: 'destructive' });
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* KI-Info Banner */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
        <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
        <span>
          Die KI durchsucht das Internet (Vereinshomepage, fussball.de, transfermarkt.de, kicker.de) und findet <strong className="text-foreground">alle Mannschaften</strong> — 1. Herren, Frauen, U19, U17, U15 usw. — auch ohne API-Zugang.
        </span>
      </div>

      {/* Suche auslösen */}
      {teams === null && !loading && (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground mb-3">
            Alle Mannschaften von <strong className="text-foreground">„{clubName}"</strong> per KI-Web-Suche finden
          </p>
          <Button onClick={searchTeams} className="bg-primary text-primary-foreground gap-2">
            <Sparkles className="w-4 h-4" /> Mannschaften suchen
          </Button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground text-sm">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <div className="text-center">
            <div className="font-medium text-foreground text-sm mb-1">KI durchsucht das Internet...</div>
            <div className="text-xs">Vereinshomepage · fussball.de · transfermarkt.de · kicker.de</div>
          </div>
        </div>
      )}

      {/* Ergebnisse */}
      {teams !== null && !loading && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              {teams.length} Mannschaft{teams.length !== 1 ? 'en' : ''} gefunden
            </span>
            <button onClick={searchTeams} className="text-[10px] text-primary underline flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" /> Erneut suchen
            </button>
          </div>

          {note && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-muted text-[10px] text-muted-foreground">
              <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
              {note}
            </div>
          )}

          {teams.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Keine Mannschaften gefunden. Überprüfe den Vereinsnamen.
            </div>
          ) : (
            <AnimatePresence>
              {teams.map((team, i) => {
                const key = team.label || team.name;
                const imported = importedTeams[key];
                const isImporting = importing === key;

                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="glass rounded-xl p-4 flex items-center gap-3"
                  >
                    {/* Label Badge */}
                    <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-primary leading-tight text-center px-1">{team.label || '1.'}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-grotesk font-bold text-sm text-foreground">{team.name}</div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {team.league && (
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {team.league}
                          </span>
                        )}
                        {team.season && (
                          <span className="text-[10px] text-muted-foreground">{team.season}</span>
                        )}
                        {team.has_squad_data && (
                          <Badge className="text-[9px] h-4 px-1.5 bg-green-500/15 text-green-400 border-green-500/20">
                            Kader verfügbar
                          </Badge>
                        )}
                        {team.has_fixture_data && (
                          <Badge className="text-[9px] h-4 px-1.5 bg-blue-500/15 text-blue-400 border-blue-500/20">
                            Spielplan verfügbar
                          </Badge>
                        )}
                      </div>
                      {imported && (
                        <div className="text-[10px] text-muted-foreground mt-1">
                          ✓ {imported.players} Spieler · {imported.matches} Spiele importiert
                          {imported.source && <span className="ml-1 opacity-60">· {imported.source}</span>}
                        </div>
                      )}
                    </div>

                    {imported ? (
                      <div className="flex items-center gap-1 text-primary text-xs font-bold flex-shrink-0">
                        <Check className="w-4 h-4" /> OK
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => importTeam(team)}
                        disabled={isImporting}
                        className="bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30 text-xs gap-1.5 h-8 flex-shrink-0 min-w-[90px]"
                      >
                        {isImporting
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Lade...</>
                          : <><Download className="w-3.5 h-3.5" /> Importieren</>
                        }
                      </Button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      )}
    </div>
  );
}