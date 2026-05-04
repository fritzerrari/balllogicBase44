/**
 * TeamSelector — Zeigt alle gefundenen Mannschaften eines Vereins
 * und ermöglicht Auswahl + Datenimport für eine Mannschaft
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check, Users, Trophy, MapPin, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

export default function TeamSelector({ clubId, clubName, apiTeamId, onTeamImported }) {
  const [teams, setTeams] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(null); // team_id being imported
  const [importedTeams, setImportedTeams] = useState(new Set());
  const { toast } = useToast();

  const searchTeams = async () => {
    if (!clubName) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke('fetchClubTeams', {
        action: 'search_teams',
        team_name: clubName,
      });
      setTeams(res.data.teams || []);
    } catch (e) {
      toast({ title: '❌ Fehler beim Suchen', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const importTeam = async (team) => {
    setImporting(team.id);
    try {
      // Team-Daten laden (Spielplan + Spieler)
      const res = await base44.functions.invoke('fetchClubTeams', {
        action: 'fetch_team_data',
        team_id: team.id,
      });
      const { matches, players, season } = res.data;

      // Club mit gewähltem Team aktualisieren
      await base44.entities.Club.update(clubId, {
        api_team_id: String(team.id),
        league: team.league || undefined,
      }).catch(() => {});

      // Spielplan importieren
      if (matches?.length > 0) {
        await Promise.all(matches.slice(0, 50).map(m =>
          base44.entities.ClubMatch.create({
            club_id: clubId,
            ...m,
          }).catch(() => {})
        ));
      }

      // Spieler importieren
      if (players?.length > 0) {
        const posMap = {
          'Torwart': 'Torwart',
          'Innenverteidiger': 'Innenverteidiger',
          'Zentrales Mittelfeld': 'Zentrales Mittelfeld',
          'Mittelstürmer': 'Mittelstürmer',
        };
        await Promise.all(players.slice(0, 30).map(p =>
          base44.entities.Player.create({
            name: p.name,
            position: p.position || 'Zentrales Mittelfeld',
            team: team.name,
            club_id: clubId,
            age: p.age,
            nationality: p.nationality,
            api_player_id: p.api_player_id,
            avatar_url: p.avatar_url,
            number: p.number,
          }).catch(() => {})
        ));
      }

      setImportedTeams(prev => new Set([...prev, team.id]));
      toast({
        title: `✓ ${team.name} importiert`,
        description: `${matches?.length || 0} Spiele · ${players?.length || 0} Spieler · Saison ${season}`,
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
      {/* Suche auslösen */}
      {teams === null && (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground mb-3">
            Suche alle Mannschaften von <strong className="text-foreground">„{clubName}"</strong> in der Datenbank
          </p>
          <Button onClick={searchTeams} disabled={loading} className="bg-primary text-primary-foreground gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            Mannschaften suchen
          </Button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Suche läuft...
        </div>
      )}

      {/* Ergebnisse */}
      {teams !== null && !loading && (
        <AnimatePresence>
          {teams.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Keine Mannschaften in der Datenbank gefunden.
              <br />
              <button onClick={() => setTeams(null)} className="text-primary underline text-xs mt-2">Erneut suchen</button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  {teams.length} Mannschaft{teams.length !== 1 ? 'en' : ''} gefunden
                </span>
                <button onClick={() => setTeams(null)} className="text-[10px] text-muted-foreground underline">
                  Neu suchen
                </button>
              </div>
              {teams.map((team, i) => (
                <motion.div
                  key={team.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="glass rounded-xl p-4 flex items-center gap-3"
                >
                  {team.logo ? (
                    <img src={team.logo} alt={team.name} className="w-10 h-10 object-contain flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-grotesk font-bold text-sm text-foreground">{team.name}</div>
                    <div className="flex flex-wrap gap-2 mt-0.5">
                      {team.country && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" /> {team.country}
                        </span>
                      )}
                      {team.founded && (
                        <span className="text-[10px] text-muted-foreground">Gegr. {team.founded}</span>
                      )}
                      {team.venue && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{team.venue}</span>
                      )}
                      {team.national && (
                        <Badge className="text-[9px] bg-yellow-500/15 text-yellow-400 border-yellow-500/20 h-4 px-1.5">Nationalteam</Badge>
                      )}
                    </div>
                  </div>

                  {importedTeams.has(team.id) ? (
                    <div className="flex items-center gap-1 text-primary text-xs font-bold flex-shrink-0">
                      <Check className="w-4 h-4" /> Importiert
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => importTeam(team)}
                      disabled={importing === team.id}
                      className="bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30 text-xs gap-1.5 h-8 flex-shrink-0"
                    >
                      {importing === team.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Download className="w-3.5 h-3.5" />
                      }
                      Importieren
                    </Button>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}