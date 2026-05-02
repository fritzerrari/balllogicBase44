/**
 * API-Football (api-football.com via RapidAPI)
 * API Key: a04c18ecb582e77420da7237a6ef4703
 * Host: v3.football.api-sports.io  (direkt, kein RapidAPI-Proxy nötig)
 * Docs: https://www.api-football.com/documentation-v3
 *
 * Caching: 30 Minuten im SessionStorage
 */

const BASE_URL = 'https://v3.football.api-sports.io';
const API_KEY = 'a04c18ecb582e77420da7237a6ef4703';
const CACHE_TTL = 30 * 60 * 1000;

function cacheGet(key) {
  try {
    const raw = sessionStorage.getItem(`af_${key}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { sessionStorage.removeItem(`af_${key}`); return null; }
    return data;
  } catch { return null; }
}

function cacheSet(key, data) {
  try { sessionStorage.setItem(`af_${key}`, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

async function apiFetch(path) {
  const cacheKey = path.replace(/\//g, '_');
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'x-apisports-key': API_KEY,
    },
  });

  if (res.status === 429) throw new Error('RATE_LIMIT');
  if (!res.ok) throw new Error(`API_ERROR_${res.status}`);

  const data = await res.json();
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API_ERRORS: ${JSON.stringify(data.errors)}`);
  }
  cacheSet(cacheKey, data);
  return data;
}

// ─── Leagues ──────────────────────────────────────────────────────────────────
export const COMPETITIONS = {
  78:  { name: 'Bundesliga', country: 'Deutschland' },
  79:  { name: '2. Bundesliga', country: 'Deutschland' },
  39:  { name: 'Premier League', country: 'England' },
  140: { name: 'La Liga', country: 'Spanien' },
  135: { name: 'Serie A', country: 'Italien' },
  61:  { name: 'Ligue 1', country: 'Frankreich' },
  2:   { name: 'Champions League', country: 'Europa' },
  81:  { name: 'DFB-Pokal', country: 'Deutschland' },
};

/**
 * Team anhand von Name suchen
 * @returns {team, league} | null
 */
export async function searchTeam(name) {
  const data = await apiFetch(`/teams?search=${encodeURIComponent(name)}`);
  const results = data.response || [];
  if (results.length === 0) return null;
  return { team: results[0].team, league: results[0].league };
}

/**
 * Nächste Spiele eines Teams
 */
export async function getTeamMatches(teamId, status = 'NS') {
  // NS = Not Started (geplant), status can also be: FT (finished), LIVE etc.
  const season = new Date().getFullYear();
  const data = await apiFetch(`/fixtures?team=${teamId}&season=${season}&status=${status}&next=10`);
  return data.response || [];
}

/**
 * Kader eines Teams
 */
export async function getTeamSquad(teamId) {
  const data = await apiFetch(`/players/squads?team=${teamId}`);
  const squads = data.response || [];
  if (squads.length === 0) return [];
  return squads[0].players || [];
}

/**
 * Aktuelle Tabelle einer Liga
 */
export async function getStandings(leagueId) {
  const season = new Date().getFullYear();
  const data = await apiFetch(`/standings?league=${leagueId}&season=${season}`);
  return data.response || [];
}

/**
 * Laufende Spiele
 */
export async function getLiveMatches() {
  const data = await apiFetch('/fixtures?live=all');
  return data.response || [];
}

/**
 * Spieler-Statistiken für ein Team in einer Saison
 */
export async function getPlayerStats(teamId, season) {
  const s = season || new Date().getFullYear();
  const data = await apiFetch(`/players?team=${teamId}&season=${s}`);
  return data.response || [];
}

/**
 * Formatiert ein API-Football Fixture für TactIQ
 */
export function formatApiMatch(fixture) {
  const f = fixture.fixture;
  const h = fixture.teams?.home;
  const a = fixture.teams?.away;
  const g = fixture.goals;
  return {
    title: `${h?.name} vs ${a?.name}`,
    date: f?.date ? f.date.split('T')[0] : '',
    home_team: h?.name || '',
    away_team: a?.name || '',
    competition: fixture.league?.name || '',
    score_home: g?.home,
    score_away: g?.away,
    status: f?.status?.short === 'FT' ? 'analyzed' : f?.status?.short === 'LIVE' ? 'live' : 'uploading',
    api_id: f?.id,
    venue: f?.venue?.name || '',
  };
}