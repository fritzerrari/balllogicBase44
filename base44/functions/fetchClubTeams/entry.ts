/**
 * fetchClubTeams — KI-gestützter Web-Scraper für Vereins-Mannschaften + Kader
 * Strategie: InvokeLLM mit add_context_from_internet=true
 * → holt Daten direkt von Vereinshomepage, fussball.de, kicker.de, transfermarkt.de
 * Kein API-Tier-Problem, funktioniert für JEDEN Verein weltweit.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, team_name, team_label, club_website } = await req.json();

    // ── ACTION: Alle Mannschaften eines Vereins listen ──────────────────────────
    if (action === 'search_teams') {
      if (!team_name) return Response.json({ error: 'team_name required' }, { status: 400 });

      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Suche alle Mannschaften (Teams) des Fußballvereins "${team_name}" in Deutschland.
Durchsuche die offizielle Vereinshomepage, fussball.de, kicker.de und transfermarkt.de.
${club_website ? `Die offizielle Vereinshomepage ist: ${club_website}` : ''}

Ich benötige ALLE Mannschaften: 1. Mannschaft (Herren), Frauen, U19, U17, U15, U13, U11, U9, etc. - ALLE die du findest.
Auch Reservemannschaft, Alte Herren, Damenmannschaft falls vorhanden.

Für jede Mannschaft:
- Exakter Name der Mannschaft (z.B. "Viktoria Aschaffenburg U19")
- Kurzbezeichnung (z.B. "U19", "Herren", "Frauen", "U17")
- Liga/Spielklasse (z.B. "A-Junioren Bayernliga", "Regionalliga Bayern")
- Saison (z.B. "2024/2025")
- Ob du Spieler-Kader-Daten dazu gefunden hast (true/false)
- Ob du Spielplandaten dazu gefunden hast (true/false)`,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: {
            teams: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  label: { type: 'string' },
                  league: { type: 'string' },
                  season: { type: 'string' },
                  has_squad_data: { type: 'boolean' },
                  has_fixture_data: { type: 'boolean' },
                }
              }
            },
            club_website: { type: 'string' },
            note: { type: 'string' },
          }
        }
      });

      return Response.json({
        teams: result.teams || [],
        club_website: result.club_website || null,
        note: result.note || null,
      });
    }

    // ── ACTION: Kader + Spielplan für eine Mannschaft laden ─────────────────────
    if (action === 'fetch_team_data') {
      if (!team_name || !team_label) return Response.json({ error: 'team_name and team_label required' }, { status: 400 });

      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Suche den aktuellen Kader (Spieler) und Spielplan der Mannschaft "${team_name}" (${team_label}) des Fußballvereins.
${club_website ? `Vereinshomepage: ${club_website}` : ''}

Durchsuche: offizielle Vereinshomepage, fussball.de (WICHTIG!), transfermarkt.de, kicker.de, bayernfussball.de.

Für jeden SPIELER benötige ich:
- Vollständiger Name
- Trikotnummer (falls bekannt)
- Position (Torwart / Innenverteidiger / Außenverteidiger / Defensives Mittelfeld / Zentrales Mittelfeld / Offensives Mittelfeld / Linksaußen / Rechtsaußen / Mittelstürmer)
- Alter oder Geburtsjahr (falls bekannt)
- Nationalität (falls bekannt)

Für den SPIELPLAN: Letzte 5 + nächste 10 Spiele:
- Datum (ISO Format YYYY-MM-DD)
- Heimmannschaft
- Gastmannschaft  
- Ergebnis (falls gespielt): Heim-Tore : Gast-Tore
- Wettbewerb/Liga
- Spieltag (falls bekannt)

Gib so viele Spieler wie möglich zurück, mindestens alle die du findest.`,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: {
            players: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  number: { type: 'number' },
                  position: { type: 'string' },
                  age: { type: 'number' },
                  nationality: { type: 'string' },
                }
              }
            },
            matches: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  home_team: { type: 'string' },
                  away_team: { type: 'string' },
                  home_score: { type: 'number' },
                  away_score: { type: 'number' },
                  competition: { type: 'string' },
                  matchday: { type: 'string' },
                  status: { type: 'string' },
                }
              }
            },
            season: { type: 'string' },
            league: { type: 'string' },
            data_source: { type: 'string' },
          }
        }
      });

      // Status normalisieren
      const mappedMatches = (result.matches || []).map(m => ({
        ...m,
        date: m.date ? new Date(m.date).toISOString() : null,
        status: (m.home_score != null && m.away_score != null) ? 'finished'
              : m.status === 'live' ? 'live'
              : m.status === 'postponed' ? 'postponed'
              : 'scheduled',
      })).filter(m => m.date && m.home_team && m.away_team);

      // Positionen auf erlaubte Werte mappen
      const posMap = {
        'torwart': 'Torwart',
        'keeper': 'Torwart',
        'goalkeeper': 'Torwart',
        'innenverteidiger': 'Innenverteidiger',
        'center-back': 'Innenverteidiger',
        'außenverteidiger': 'Außenverteidiger',
        'fullback': 'Außenverteidiger',
        'defensives mittelfeld': 'Defensives Mittelfeld',
        'defensive midfield': 'Defensives Mittelfeld',
        'zentrales mittelfeld': 'Zentrales Mittelfeld',
        'central midfield': 'Zentrales Mittelfeld',
        'mittelfeld': 'Zentrales Mittelfeld',
        'offensives mittelfeld': 'Offensives Mittelfeld',
        'attacking midfield': 'Offensives Mittelfeld',
        'linksaußen': 'Linksaußen',
        'left wing': 'Linksaußen',
        'rechtsaußen': 'Rechtsaußen',
        'right wing': 'Rechtsaußen',
        'mittelstürmer': 'Mittelstürmer',
        'striker': 'Mittelstürmer',
        'forward': 'Mittelstürmer',
        'stürmer': 'Mittelstürmer',
      };

      const validPositions = [
        'Torwart', 'Innenverteidiger', 'Außenverteidiger',
        'Defensives Mittelfeld', 'Zentrales Mittelfeld', 'Offensives Mittelfeld',
        'Linksaußen', 'Rechtsaußen', 'Mittelstürmer'
      ];

      const mappedPlayers = (result.players || []).map(p => {
        const posLower = (p.position || '').toLowerCase().trim();
        const mapped = posMap[posLower] || (validPositions.find(v => v.toLowerCase() === posLower)) || 'Zentrales Mittelfeld';
        return { ...p, position: mapped };
      }).filter(p => p.name);

      return Response.json({
        players: mappedPlayers,
        matches: mappedMatches,
        season: result.season || null,
        league: result.league || null,
        data_source: result.data_source || 'KI-Web-Suche',
        raw_player_count: result.players?.length || 0,
        raw_match_count: result.matches?.length || 0,
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});