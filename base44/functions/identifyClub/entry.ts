/**
 * identifyClub — Logo hochladen → KI erkennt Verein → Daten aus Web + football-data.org
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';
const FOOTBALL_DATA_KEY = Deno.env.get('FOOTBALL_DATA_API_KEY') || '';

async function searchFootballDataOrg(teamName) {
  if (!FOOTBALL_DATA_KEY) return null;
  try {
    const res = await fetch(`${FOOTBALL_DATA_BASE}/teams?name=${encodeURIComponent(teamName)}`, {
      headers: { 'X-Auth-Token': FOOTBALL_DATA_KEY }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.teams?.[0] || null;
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
    const apiTeam = await searchFootballDataOrg(teamName);
    const currentSeason = new Date().getFullYear().toString();

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