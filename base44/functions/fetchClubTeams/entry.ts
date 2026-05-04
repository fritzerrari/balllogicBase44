/**
 * fetchClubTeams — Holt alle Mannschaften eines Vereins + Spielplan/Spieler für eine Mannschaft
 * API: https://v3.football.api-sports.io/
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const API_BASE = 'https://v3.football.api-sports.io';
const API_KEY = Deno.env.get('FOOTBALL_DATA_API_KEY') || '';

function headers() {
  return { 'x-apisports-key': API_KEY };
}

// Suche alle Teams die zum Verein gehören (gleicher Name-Prefix)
async function searchAllTeams(teamName) {
  const res = await fetch(`${API_BASE}/teams?search=${encodeURIComponent(teamName)}`, { headers: headers() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.response || [];
}

async function fetchFixtures(teamId, season) {
  const [resLast, resNext] = await Promise.all([
    fetch(`${API_BASE}/fixtures?team=${teamId}&season=${season}&last=20`, { headers: headers() }),
    fetch(`${API_BASE}/fixtures?team=${teamId}&season=${season}&next=20`, { headers: headers() }),
  ]);
  const last = resLast.ok ? (await resLast.json()).response || [] : [];
  const next = resNext.ok ? (await resNext.json()).response || [] : [];
  return [...last, ...next];
}

async function fetchPlayers(teamId, season) {
  const res = await fetch(`${API_BASE}/players?team=${teamId}&season=${season}`, { headers: headers() });
  if (!res.ok) return [];
  return (await res.json()).response || [];
}

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
  return map[pos] || 'Zentrales Mittelfeld';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, team_name, team_id } = await req.json();
    const now = new Date();
    const month = now.getMonth() + 1;
    const season = month >= 7 ? now.getFullYear() : now.getFullYear() - 1;

    // ACTION: Alle Mannschaften suchen
    if (action === 'search_teams') {
      if (!team_name) return Response.json({ error: 'team_name required' }, { status: 400 });
      const results = await searchAllTeams(team_name);

      // Gruppiere nach Vereins-Cluster (ähnliche Namen)
      const teams = results.map(r => ({
        id: r.team.id,
        name: r.team.name,
        code: r.team.code,
        country: r.team.country,
        founded: r.team.founded,
        logo: r.team.logo,
        national: r.team.national,
        venue: r.venue?.name,
        venue_capacity: r.venue?.capacity,
        venue_city: r.venue?.city,
      }));

      return Response.json({ teams, season: `${season}/${season + 1}` });
    }

    // ACTION: Spielplan + Spieler für eine Mannschaft laden
    if (action === 'fetch_team_data') {
      if (!team_id) return Response.json({ error: 'team_id required' }, { status: 400 });

      const [fixtures, players] = await Promise.all([
        fetchFixtures(team_id, season),
        fetchPlayers(team_id, season),
      ]);

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
        season: `${season}/${season + 1}`,
      }));

      const mappedPlayers = players.map(p => ({
        api_player_id: String(p.player?.id),
        name: p.player?.name,
        age: p.player?.age,
        nationality: p.player?.nationality,
        position: mapPosition(p.statistics?.[0]?.games?.position),
        avatar_url: p.player?.photo,
        number: p.statistics?.[0]?.games?.number,
      }));

      return Response.json({
        matches: mappedMatches,
        players: mappedPlayers,
        season: `${season}/${season + 1}`,
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});