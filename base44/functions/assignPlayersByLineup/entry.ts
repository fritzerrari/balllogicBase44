/**
 * assignPlayersByLineup — Ordnet erkannte Tracker-IDs den Datenbank-Spielern zu
 * 
 * Algorithmus: Nearest-Neighbor-Matching
 * - Heim-Spieler werden den erkannten "home"-Team-Positionen zugeordnet
 * - Gast-Spieler werden den erkannten "away"-Team-Positionen zugeordnet
 * - Matching basiert auf minimaler euklidischer Distanz zwischen
 *   erwarteter Spieler-Position (aus Aufstellung) und erkannter Tracker-Position
 * 
 * Wird beim Anstoß aufgerufen, danach bleibt die Zuordnung für die Session bestehen.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Euklidische Distanz
function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// Nearest-Neighbor-Matching: players → tracker positions
function nearestNeighborMatch(players, trackerPositions) {
  const result = []; // { player_id, tracker_id, x, y, team, distance }
  const usedTrackers = new Set();

  // Verarbeite jeden Spieler
  for (const player of players) {
    let best = null;
    let bestDist = Infinity;

    for (const tp of trackerPositions) {
      const tid = tp.tracker_id ?? `${tp.x.toFixed(1)}_${tp.y.toFixed(1)}`;
      if (usedTrackers.has(tid)) continue;
      const d = dist(player, tp);
      if (d < bestDist) {
        bestDist = d;
        best = { ...tp, tracker_id: tid };
      }
    }

    if (best) {
      usedTrackers.add(best.tracker_id);
      result.push({
        player_id: player.player_id,
        tracker_id: best.tracker_id,
        x: best.x,
        y: best.y,
        team: player.team,
        match_distance: Math.round(bestDist * 10) / 10,
      });
    }
  }

  return result;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { session_id, home_lineup, away_lineup } = await req.json();
    // home_lineup / away_lineup = Array von Player-IDs aus der DB

    if (!session_id) {
      return Response.json({ error: 'Missing session_id' }, { status: 400 });
    }

    // ── Lade Session & Spielerdaten ──────────────────────────────────────────
    const [sessions, allPlayers] = await Promise.all([
      base44.asServiceRole.entities.LiveSession.filter({ id: session_id }),
      base44.asServiceRole.entities.Player.list('-created_date', 200),
    ]);

    const session = sessions[0];
    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    // ── Letzten Tracking-Frame holen ─────────────────────────────────────────
    const recentFrames = await base44.asServiceRole.entities.TrackingData.filter(
      { session_id },
      '-timestamp_ms',
      5
    );

    const bestFrame = recentFrames.find(f => f.player_positions?.length >= 8)
      || recentFrames.find(f => f.player_positions?.length >= 4)
      || recentFrames[0];

    if (!bestFrame?.player_positions?.length) {
      return Response.json({
        error: 'Keine Tracking-Daten — starte zuerst das Tracking',
        mode: 'anonymous',
      }, { status: 202 });
    }

    const trackedHome = bestFrame.player_positions.filter(p => p.team === 'home');
    const trackedAway = bestFrame.player_positions.filter(p => p.team === 'away');

    console.log(`📍 Tracking: ${trackedHome.length} Heim, ${trackedAway.length} Gäste`);

    // ── Aufstellung in Spieler mit erwarteter Position umwandeln ─────────────
    // Wenn keine Aufstellung: anonymes Tracking
    if (!home_lineup?.length && !away_lineup?.length) {
      // Anonymes Tracking: H1-H11 / G1-G11
      const anonHome = trackedHome.map((p, i) => ({ ...p, player_id: `H${i + 1}`, label: `H${i + 1}` }));
      const anonAway = trackedAway.map((p, i) => ({ ...p, player_id: `G${i + 1}`, label: `G${i + 1}` }));

      await base44.asServiceRole.entities.LiveSession.update(session_id, {
        player_assignment_mode: 'anonymous',
        home_team_positions: anonHome,
        away_team_positions: anonAway,
        kickoff_detected: true,
        kickoff_timestamp: new Date().toISOString(),
      });

      return Response.json({
        success: true,
        mode: 'anonymous',
        home_count: anonHome.length,
        away_count: anonAway.length,
        message: `Anonymes Tracking: ${anonHome.length} Heim, ${anonAway.length} Gäste`,
      });
    }

    // ── Lineup-Matching ───────────────────────────────────────────────────────
    const playerMap = Object.fromEntries(allPlayers.map(p => [p.id, p]));

    // Baue Eingabe für Nearest-Neighbor: Player mit erwarteten Positionen
    // Da wir keine echten Startpositionen haben, verwenden wir die Tracker-Positionen direkt
    // und matchen per Reihenfolge (beste verfügbare Strategie ohne GPS)
    const homePlayers = (home_lineup || [])
      .map((pid, i) => ({
        player_id: pid,
        x: trackedHome[i]?.x ?? 25,
        y: trackedHome[i]?.y ?? (i / Math.max(home_lineup.length - 1, 1)) * 100,
        team: 'home',
      }))
      .filter(p => playerMap[p.player_id]);

    const awayPlayers = (away_lineup || [])
      .map((pid, i) => ({
        player_id: pid,
        x: trackedAway[i]?.x ?? 75,
        y: trackedAway[i]?.y ?? (i / Math.max(away_lineup.length - 1, 1)) * 100,
        team: 'away',
      }))
      .filter(p => playerMap[p.player_id]);

    // Matching
    const homeMatched = nearestNeighborMatch(homePlayers, trackedHome);
    const awayMatched = nearestNeighborMatch(awayPlayers, trackedAway);

    // Erstelle angereicherte Positionen mit Player-Namen
    const enrichedHome = homeMatched.map(m => ({
      ...m,
      label: playerMap[m.player_id]
        ? `${playerMap[m.player_id].number ? '#' + playerMap[m.player_id].number + ' ' : ''}${playerMap[m.player_id].name}`
        : m.player_id,
    }));

    const enrichedAway = awayMatched.map(m => ({
      ...m,
      label: playerMap[m.player_id]
        ? `${playerMap[m.player_id].number ? '#' + playerMap[m.player_id].number + ' ' : ''}${playerMap[m.player_id].name}`
        : m.player_id,
    }));

    // ── Session updaten ────────────────────────────────────────────────────────
    await base44.asServiceRole.entities.LiveSession.update(session_id, {
      player_assignment_mode: 'lineup',
      home_team_positions: enrichedHome,
      away_team_positions: enrichedAway,
      kickoff_detected: true,
      kickoff_timestamp: new Date().toISOString(),
      player_assignments: {
        home_lineup,
        away_lineup,
        home_tracker_map: Object.fromEntries(homeMatched.map(m => [m.tracker_id, m.player_id])),
        away_tracker_map: Object.fromEntries(awayMatched.map(m => [m.tracker_id, m.player_id])),
      },
    });

    console.log(`✓ Zuordnung: ${enrichedHome.length} Heim, ${enrichedAway.length} Gäste matched`);

    return Response.json({
      success: true,
      mode: 'lineup',
      home_matched: enrichedHome.length,
      away_matched: enrichedAway.length,
      home_unmatched: home_lineup.length - enrichedHome.length,
      away_unmatched: away_lineup.length - enrichedAway.length,
      message: `${enrichedHome.length + enrichedAway.length} Spieler erfolgreich zugeordnet`,
    });

  } catch (error) {
    console.error('❌ assignPlayersByLineup failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});