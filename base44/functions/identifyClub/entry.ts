/**
 * identifyClub — Logo hochladen → KI erkennt Verein → Daten aus Web + football-data.org
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';
const FOOTBALL_DATA_KEY = Deno.env.get('FOOTBALL_DATA_API_KEY') || '';

// Mapping bekannter Ligen zu football-data.org Kompetitions-IDs
const LEAGUE_IDS = {
  'bundesliga': 'BL1', 'bundesliga 1': 'BL1', '1. bundesliga': 'BL1',
  '2. bundesliga': 'BL2',
  'premier league': 'PL',
  'la liga': 'PD', 'primera division': 'PD',
  'serie a': 'SA',
  'ligue 1': 'FL1',
  'eredivisie': 'DED',
  'primeira liga': 'PPL',
  'championship': 'ELC',
  'champions league': 'CL', 'uefa champions league': 'CL',
};

function getCompetitionId(leagueName) {
  if (!leagueName) return 'BL1';
  const lower = leagueName.toLowerCase();
  for (const [key, id] of Object.entries(LEAGUE_IDS)) {
    if (lower.includes(key)) return id;
  }
  return null;
}

async function searchFootballDataOrg(teamName, leagueName) {
  if (!FOOTBALL_DATA_KEY) return null;
  try {
    // Versuche über Ligateams zu suchen
    const competitionId = getCompetitionId(leagueName);
    if (!competitionId) return null;

    const res = await fetch(`${FOOTBALL_DATA_BASE}/competitions/${competitionId}/teams`, {
      headers: { 'X-Auth-Token': FOOTBALL_DATA_KEY }
    });
    if (!res.ok) {
      console.error(`football-data API error: ${res.status} ${await res.text()}`);
      return null;
    }
    const data = await res.json();
    const teams = data.teams || [];

    // Fuzzy-Match auf Teamnamen
    const normalized = teamName.toLowerCase().replace(/[^a-z0-9 ]/g, '');
    const match = teams.find(t => {
      const n = (t.name || '').toLowerCase().replace(/[^a-z0-9 ]/g, '');
      const sn = (t.shortName || '').toLowerCase().replace(/[^a-z0-9 ]/g, '');
      return n.includes(normalized.split(' ')[0]) || normalized.includes(sn) || sn.includes(normalized.split(' ')[0]);
    });
    return match || null;
  } catch {
    return null;
  }
}

async function fetchTeamMatches(teamId, season) {
  if (!FOOTBALL_DATA_KEY || !teamId) return [];
  try {
    const res = await fetch(`${FOOTBALL_DATA_BASE}/teams/${teamId}/matches?season=${season}&limit=40`, {
      headers: { 'X-Auth-Token': FOOTBALL_DATA_KEY }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.matches || [];
  } catch {
    return [];
  }
}

async function fetchTeamPlayers(teamId) {
  if (!FOOTBALL_DATA_KEY || !teamId) return [];
  try {
    const res = await fetch(`${FOOTBALL_DATA_BASE}/teams/${teamId}`, {
      headers: { 'X-Auth-Token': FOOTBALL_DATA_KEY }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.squad || [];
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { logo_url, club_name_hint } = body;

    // Step 1: KI erkennt Verein aus Logo + Name
    const identificationPrompt = logo_url
      ? `Analysiere dieses Fußball-Vereins-Logo und identifiziere den Verein. 
         ${club_name_hint ? `Hinweis: Der Name könnte "${club_name_hint}" sein.` : ''}
         Gib zurück: Vereinsname, Kurzname, Land, Stadt, Liga, Gründungsjahr, Stadion, Primärfarbe (HEX), Sekundärfarbe (HEX), Akzentfarbe (HEX), Website-URL, kurze Beschreibung.
         Für die Farben: analysiere die dominierenden Farben des Logos.
         Suche aktuelle Informationen über den Verein.`
      : `Suche alle verfügbaren Informationen über den Fußballverein "${club_name_hint}".
         Gib zurück: Vereinsname, Kurzname, Land, Stadt, Liga, Gründungsjahr, Stadion, Primärfarbe (HEX), Sekundärfarbe (HEX), Website-URL, kurze Beschreibung.`;

    const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: identificationPrompt,
      add_context_from_internet: true,
      file_urls: logo_url ? [logo_url] : undefined,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          short_name: { type: 'string' },
          country: { type: 'string' },
          city: { type: 'string' },
          league: { type: 'string' },
          founded: { type: 'number' },
          stadium: { type: 'string' },
          stadium_capacity: { type: 'number' },
          primary_color: { type: 'string' },
          secondary_color: { type: 'string' },
          accent_color: { type: 'string' },
          website: { type: 'string' },
          description: { type: 'string' },
          confidence: { type: 'number' }
        }
      }
    });

    // Step 2: football-data.org für API-Daten (falls verfügbar)
    const teamName = aiResult.name || club_name_hint || '';
    const apiTeam = await searchFootballDataOrg(teamName, aiResult.league);
    // Fußball-Saison: August-Juli Zyklus → aktuelle Saison bestimmen
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    const currentSeason = month >= 7 ? year.toString() : (year - 1).toString(); // Saison startet im Juli

    let matches = [];
    let players = [];
    if (apiTeam?.id) {
      [matches, players] = await Promise.all([
        fetchTeamMatches(apiTeam.id, currentSeason),
        fetchTeamPlayers(apiTeam.id)
      ]);
    }

    return Response.json({
      identification: {
        ...aiResult,
        api_team_id: apiTeam?.id ? String(apiTeam.id) : null,
        ai_identified: true,
        current_season: `${currentSeason}/${parseInt(currentSeason) + 1}`
      },
      api_matches: matches.slice(0, 50),
      api_players: players.slice(0, 30),
      api_team: apiTeam
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});