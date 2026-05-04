/**
 * identifyClub — Logo hochladen → KI erkennt Verein → Daten aus api-sports.io
 * API: https://v3.football.api-sports.io/
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const API_SPORTS_BASE = 'https://v3.football.api-sports.io';
const API_SPORTS_KEY = Deno.env.get('FOOTBALL_DATA_API_KEY') || '';

function apiHeaders() {
  return {
    'x-apisports-key': API_SPORTS_KEY,
    'Content-Type': 'application/json',
  };
}

// Suche Team anhand Name bei api-sports.io
async function searchTeam(teamName) {
  if (!API_SPORTS_KEY || !teamName) return null;
  try {
    const res = await fetch(
      `${API_SPORTS_BASE}/teams?search=${encodeURIComponent(teamName)}`,
      { headers: apiHeaders() }
    );
    if (!res.ok) {
      console.error(`api-sports search error: ${res.status}`);
      return null;
    }
    const data = await res.json();
    const results = data.response || [];
    if (!results.length) return null;

    // Bestes Match: exakter Name oder erster Treffer
    const normalized = teamName.toLowerCase().replace(/[^a-z0-9 ]/g, '');
    const exact = results.find(r => {
      const n = (r.team?.name || '').toLowerCase().replace(/[^a-z0-9 ]/g, '');
      return n === normalized;
    });
    return (exact || results[0])?.team || null;
  } catch (e) {
    console.error('searchTeam error:', e.message);
    return null;
  }
}

// Spielplan: nächste + letzte Spiele
async function fetchTeamFixtures(teamId, season) {
  if (!API_SPORTS_KEY || !teamId) return [];
  try {
    const res = await fetch(
      `${API_SPORTS_BASE}/fixtures?team=${teamId}&season=${season}&last=20`,
      { headers: apiHeaders() }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const fixtures = data.response || [];

    // Auch nächste Spiele holen
    const resNext = await fetch(
      `${API_SPORTS_BASE}/fixtures?team=${teamId}&season=${season}&next=20`,
      { headers: apiHeaders() }
    );
    const dataNext = resNext.ok ? await resNext.json() : { response: [] };
    const nextFixtures = dataNext.response || [];

    return [...fixtures, ...nextFixtures].slice(0, 50);
  } catch (e) {
    console.error('fetchTeamFixtures error:', e.message);
    return [];
  }
}

// Spieler des Teams
async function fetchTeamPlayers(teamId, season) {
  if (!API_SPORTS_KEY || !teamId) return [];
  try {
    const res = await fetch(
      `${API_SPORTS_BASE}/players?team=${teamId}&season=${season}`,
      { headers: apiHeaders() }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.response || []).slice(0, 30);
  } catch (e) {
    console.error('fetchTeamPlayers error:', e.message);
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
         Gib zurück: Vereinsname, Kurzname, Land, Stadt, Liga, Gründungsjahr, Stadion, Kapazität, Primärfarbe (HEX), Sekundärfarbe (HEX), Akzentfarbe (HEX), Website-URL, kurze Beschreibung.
         Für die Farben: analysiere die dominierenden Farben des Logos.`
      : `Suche alle verfügbaren Informationen über den Fußballverein "${club_name_hint}".
         Gib zurück: Vereinsname, Kurzname, Land, Stadt, Liga, Gründungsjahr, Stadion, Kapazität, Primärfarbe (HEX), Sekundärfarbe (HEX), Website-URL, kurze Beschreibung.`;

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

    // Step 2: api-sports.io für Live-Daten
    const teamName = aiResult.name || club_name_hint || '';
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const currentSeason = month >= 7 ? year : year - 1;

    const apiTeam = await searchTeam(teamName) || await searchTeam(club_name_hint);

    let fixtures = [];
    let players = [];
    if (apiTeam?.id) {
      [fixtures, players] = await Promise.all([
        fetchTeamFixtures(apiTeam.id, currentSeason),
        fetchTeamPlayers(apiTeam.id, currentSeason),
      ]);
    }

    // Fixtures in ClubMatch-Format umwandeln
    const mappedMatches = fixtures.map(f => ({
      api_match_id: String(f.fixture?.id),
      date: f.fixture?.date,
      matchday: f.league?.round,
      home_team: f.teams?.home?.name,
      away_team: f.teams?.away?.name,
      home_score: f.goals?.home,
      away_score: f.goals?.away,
      status: mapStatus(f.fixture?.status?.short),
      competition: f.league?.name,
      venue: f.fixture?.venue?.name,
      season: `${currentSeason}/${currentSeason + 1}`,
    }));

    // Spieler in Player-Format umwandeln
    const mappedPlayers = players.map(p => ({
      api_player_id: String(p.player?.id),
      name: p.player?.name,
      age: p.player?.age,
      nationality: p.player?.nationality,
      position: mapPosition(p.statistics?.[0]?.games?.position),
      avatar_url: p.player?.photo,
    }));

    return Response.json({
      identification: {
        ...aiResult,
        api_team_id: apiTeam?.id ? String(apiTeam.id) : null,
        ai_identified: true,
        current_season: `${currentSeason}/${currentSeason + 1}`,
        // Logo von API falls vorhanden
        api_logo_url: apiTeam?.logo || null,
      },
      api_matches: mappedMatches,
      api_players: mappedPlayers,
      api_team: apiTeam,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function mapStatus(short) {
  const map = { 'FT': 'finished', 'NS': 'scheduled', 'LIVE': 'live', '1H': 'live', '2H': 'live', 'HT': 'live', 'PST': 'postponed' };
  return map[short] || 'scheduled';
}

function mapPosition(pos) {
  const map = {
    'Goalkeeper': 'Torwart',
    'Defender': 'Innenverteidiger',
    'Midfielder': 'Zentrales Mittelfeld',
    'Attacker': 'Mittelstürmer',
  };
  return map[pos] || pos || 'Zentrales Mittelfeld';
}