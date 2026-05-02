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
      formations[team] = { formation: 'unknown', confidence: 0 };
      continue;
    }

    // Sortiere nach Y-Position (0=Torwart hinten, 100=Stürmer vorne)
    const sortedByY = [...positions].sort((a, b) => a.y - b.y);

    // Flexible Zonen-Grenzen für Robustheit
    const avg_y = positions.reduce((s, p) => s + p.y, 0) / positions.length;
    const half_field = avg_y / 2;
    
    const goalkeeper = sortedByY.slice(0, 1);
    const defenders = sortedByY.filter(p => p.y >= 0 && p.y <= 30);
    const midfielders = sortedByY.filter(p => p.y > 30 && p.y <= 65);
    const forwards = sortedByY.filter(p => p.y > 65);

    const defCount = Math.max(1, defenders.length);
    const midCount = Math.max(0, midfielders.length);
    const fwdCount = Math.max(1, forwards.length);

    // Intelligente Heuristik statt exakte Matches
    let formation = 'unknown';
    const total = defCount + midCount + fwdCount;
    
    if (total <= 11) {
      // Def-heavy
      if (defCount >= 5) formation = '5-3-2';
      // Mid-balanced
      else if (midCount >= 4) {
        if (fwdCount >= 3) formation = '3-4-3';
        else if (fwdCount === 2) formation = '4-4-2';
        else formation = '4-5-1';
      }
      // Standard formations
      else if (defCount === 4 && fwdCount === 3) formation = '4-3-3';
      else if (defCount === 4 && fwdCount === 2) formation = '4-4-2';
      else if (defCount === 4) formation = '4-2-3-1';
      else formation = `${defCount}-${midCount}-${fwdCount}`;
    } else {
      formation = `${defCount}-${midCount}-${fwdCount}`;
    }

    formations[team] = {
      formation,
      defenders: defCount,
      midfielders: midCount,
      forwards: fwdCount,
      confidence: Math.round((positions.reduce((sum, p) => sum + p.confidence, 0) / positions.length)),
      dynamic_detected: true, // Mark as dynamically detected, not static
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

    // Speichere Formation Timeline (nicht static!)
    const timestamp = new Date().toISOString();
    const formationHistory = {
      timestamp,
      home: formations.home,
      away: formations.away,
    };

    // Speichere in TrackingData als Metadaten statt Session
    const session = await base44.entities.LiveSession.filter({ id: session_id });
    if (session[0]) {
      // Aktualisiere nur wenn Formation sich changed
      const prevFormation = {
        home: session[0].formation_home,
        away: session[0].formation_away,
      };
      if (JSON.stringify(prevFormation) !== JSON.stringify({ home: formations.home?.formation, away: formations.away?.formation })) {
        await base44.entities.LiveSession.update(session[0].id, {
          formation_home: formations.home?.formation || 'unknown',
          formation_away: formations.away?.formation || 'unknown',
          last_formation_change: timestamp,
        }).catch(() => {});
      }
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