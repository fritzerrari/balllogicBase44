/**
 * detectFormation – Auto-Erkennung von Formation aus Spieler-Positionen
 * 
 * Erkennt: 4-4-2, 4-3-3, 3-5-2, 5-3-2, 4-2-3-1 etc.
 * Basierend auf Y-Position (vertikal) → Reihen
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function detectFormationFromPositions(homePositions, awayPositions) {
  const formations = {};

  for (const [team, positions] of [['home', homePositions], ['away', awayPositions]]) {
    if (!positions || positions.length < 6) {
      formations[team] = 'unknown';
      continue;
    }

    // Sortiere nach Y-Position (0=Torwart hinten, 100=Stürmer vorne)
    const sortedByY = [...positions].sort((a, b) => a.y - b.y);

    // Teile in 4 Zonen auf (Torwart, Abwehr, Mittelfeld, Angriff)
    const goalkeeper = sortedByY.slice(0, 1);
    const defenders = sortedByY.filter(p => p.y >= 5 && p.y <= 35);
    const midfielders = sortedByY.filter(p => p.y > 35 && p.y <= 70);
    const forwards = sortedByY.filter(p => p.y > 70);

    const defCount = defenders.length;
    const midCount = midfielders.length;
    const fwdCount = forwards.length;

    // Mapping zu bekannten Formationen
    let formation = 'unknown';
    if (defCount === 4 && midCount === 4 && fwdCount === 2) formation = '4-4-2';
    else if (defCount === 4 && midCount === 3 && fwdCount === 3) formation = '4-3-3';
    else if (defCount === 3 && midCount === 5 && fwdCount === 2) formation = '3-5-2';
    else if (defCount === 5 && midCount === 3 && fwdCount === 2) formation = '5-3-2';
    else if (defCount === 4 && midCount === 2 && fwdCount === 4) formation = '4-2-3-1';
    else if (defCount === 3 && midCount === 4 && fwdCount === 3) formation = '3-4-3';
    else if (defCount === 5 && midCount === 4 && fwdCount === 1) formation = '5-4-1';
    else {
      formation = `${defCount}-${midCount}-${fwdCount}`;
    }

    formations[team] = {
      formation,
      defenders: defCount,
      midfielders: midCount,
      forwards: fwdCount,
      confidence: Math.round((positions.reduce((sum, p) => sum + p.confidence, 0) / positions.length)),
    };
  }

  return formations;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { session_id } = body;

    if (!session_id) {
      return Response.json({ error: 'Missing session_id' }, { status: 400 });
    }

    // Hole letzte 20 TrackingData entries für diese Session
    const recentTracking = await base44.entities.TrackingData.filter({ session_id }, '-timestamp_ms', 20);

    if (recentTracking.length === 0) {
      return Response.json({ formations: {} });
    }

    // Group positions by team
    const allHomePositions = [];
    const allAwayPositions = [];

    recentTracking.forEach(tracking => {
      tracking.player_positions?.forEach(player => {
        if (player.team === 'home') allHomePositions.push(player);
        else if (player.team === 'away') allAwayPositions.push(player);
      });
    });

    // Detektiere Formation
    const formations = detectFormationFromPositions(allHomePositions, allAwayPositions);

    // Speichere aktuelle Formation als Metadata
    const session = await base44.entities.LiveSession.filter({ id: session_id });
    if (session[0]) {
      await base44.entities.LiveSession.update(session[0].id, {
        formation_home: formations.home?.formation || 'unknown',
        formation_away: formations.away?.formation || 'unknown',
      }).catch(() => {});
    }

    return Response.json({
      success: true,
      session_id,
      formations,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ detectFormation failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});