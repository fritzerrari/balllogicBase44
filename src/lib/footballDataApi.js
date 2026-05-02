/**
 * Football-Data.org API — Kostenlose Fußball-Daten
 * Free tier: 10 requests/min, Bundesliga, Premier League, Champions League etc.
 * API Key kostenlos registrieren auf: https://www.football-data.org/client/register
 * 
 * Caching: Ergebnisse werden 30 Minuten im SessionStorage gecacht
 */

const BASE_URL = 'https://api.football-data.org/v4';
const CACHE_TTL = 30 * 60 * 1000; // 30 Minuten

function getApiKey() {
  return (
    import.meta.env.VITE_FOOTBALL_DATA_KEY ||
    window.__FOOTBALL_DATA_KEY__ ||
    localStorage.getItem('football_data_key') ||
    ''
  );
}

function cacheGet(key) {
  try {
    const raw = sessionStorage.getItem(`fd_${key}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { sessionStorage.removeItem(`fd_${key}`); return null; }
    return data;
  } catch { return null; }
}

function cacheSet(key, data) {
  try { sessionStorage.setItem(`fd_${key}`, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

async function apiFetch(path) {
  const key = getApiKey();
  if (!key) throw new Error('KEIN_API_KEY');

  const cached = cacheGet(path);
  if (cached) return cached;

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'X-Auth-Token': key },
  });

  if (res.status === 429) throw new Error('RATE_LIMIT');
  if (!res.ok) throw new Error(`API_ERROR_${res.status}`);

  const data = await res.json();
  cacheSet(path, data);
  return data;
}

// ─── Competitions ─────────────────────────────────────────────────────────────
export const COMPETITIONS = {
  BL1:  { name: 'Bundesliga', country: 'Deutschland' },
  BL2:  { name: '2. Bundesliga', country: 'Deutschland' },
  PL:   { name: 'Premier League', country: 'England' },
  PD:   { name: 'La Liga', country: 'Spanien' },
  SA:   { name: 'Serie A', country: 'Italien' },
  FL1:  { name: 'Ligue 1', country: 'Frankreich' },
  CL:   { name: 'Champions League', country: 'Europa' },
  DFB:  { name: 'DFB-Pokal', country: 'Deutschland' },
};

/**
 * Alle Teams einer Liga suchen
 */
export async function getTeamsByCompetition(competitionCode) {
  const data = await apiFetch(`/competitions/${competitionCode}/teams`);
  return data.teams || [];
}

/**
 * Team anhand von Name suchen (fuzzy)
 */
export async function searchTeam(name) {
  // Probiere Bundesliga zuerst, dann andere Ligen
  for (const code of ['BL1', 'BL2', 'PL', 'PD', 'SA', 'FL1']) {
    try {
      const teams = await getTeamsByCompetition(code);
      const match = teams.find(t =>
        t.name?.toLowerCase().includes(name.toLowerCase()) ||
        t.shortName?.toLowerCase().includes(name.toLowerCase()) ||
        t.tla?.toLowerCase() === name.toLowerCase().slice(0, 3)
      );
      if (match) return { team: match, competition: code };
    } catch {}
  }
  return null;
}

/**
 * Nächste Spiele eines Teams
 */
export async function getTeamMatches(teamId, status = 'SCHEDULED') {
  const data = await apiFetch(`/teams/${teamId}/matches?status=${status}&limit=10`);
  return data.matches || [];
}

/**
 * Kader eines Teams
 */
export async function getTeamSquad(teamId) {
  const data = await apiFetch(`/teams/${teamId}`);
  return data.squad || [];
}

/**
 * Laufende/heutige Spiele
 */
export async function getLiveMatches() {
  const data = await apiFetch('/matches?status=LIVE');
  return data.matches || [];
}

/**
 * Aktuelle Tabelle
 */
export async function getStandings(competitionCode) {
  const data = await apiFetch(`/competitions/${competitionCode}/standings`);
  return data.standings || [];
}

/**
 * Formatiert ein API-Match für TactIQ
 */
export function formatApiMatch(m) {
  return {
    title: `${m.homeTeam?.name} vs ${m.awayTeam?.name}`,
    date: m.utcDate ? m.utcDate.split('T')[0] : '',
    home_team: m.homeTeam?.name || '',
    away_team: m.awayTeam?.name || '',
    competition: m.competition?.name || '',
    score_home: m.score?.fullTime?.home,
    score_away: m.score?.fullTime?.away,
    status: m.status === 'FINISHED' ? 'analyzed' : m.status === 'IN_PLAY' ? 'live' : 'uploading',
    api_id: m.id,
    matchday: m.matchday,
    venue: m.venue || '',
  };
}