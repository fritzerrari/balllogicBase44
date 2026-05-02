/**
 * assignBallPossession – Bestimmt welcher Spieler den Ball hat
 * 
 * Basierend auf:
 * - Nähe zum Ball
 * - Körperhöhe + Ball-Höhe
 * - Team-Kontext (Possession-Wechsel)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function findBallOwner(ballPos, playerPositions, lastOwner = null) {
  if (!ballPos || !playerPositions?.length) {
    return null;
  }

  // Finde Spieler am nächsten zum Ball
  let closest = null;
  let minDist = Infinity;

  playerPositions.forEach(player => {
    const dx = (player.x - ballPos.x) / 100 * 105; // Feldgröße in Metern
    const dy = (player.y - ballPos.y) / 100 * 68;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Spieler sollte Ball-Nähe sein (<5m)
    if (dist < 5 && dist < minDist) {
      minDist = dist;
      // Confidence: höher wenn näher dran, aber nie negativ
      const proximityConfidence = Math.max(30, 100 - (dist * 10));
      closest = {
        player_id: player.player_id,
        team: player.team,
        distance_m: Math.round(dist * 100) / 100,
        confidence: Math.round(Math.min(100, Math.max(0, proximityConfidence)) * (player.confidence / 100)) || 50,
      };
    }
  });

  return closest;
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

    // Hole letzte 50 TrackingData entries FÜR DIESE SESSION (nicht alle!)
    const recentTracking = await base44.entities.TrackingData.filter({ session_id }, '-timestamp_ms', 50);

    if (recentTracking.length === 0) {
      return Response.json({ possession_data: [] });
    }

    let lastOwner = null;
    const possessionData = [];

    recentTracking.reverse().forEach((tracking, idx) => {
      const owner = findBallOwner(tracking.ball_position, tracking.player_positions, lastOwner);

      if (owner) {
        // Possession-Wechsel erkennen
        const possessionChanged = lastOwner && lastOwner.team !== owner.team;

        possessionData.push({
          timestamp_ms: tracking.timestamp_ms,
          frame_number: tracking.frame_number,
          ball_owner: owner,
          possession_changed: possessionChanged,
          elapsed_seconds: tracking.elapsed_seconds,
        });

        lastOwner = owner;
      }
    });

    // Kalkuliere Possession-Prozente
    const homeFrames = possessionData.filter(p => p.ball_owner?.team === 'home').length;
    const awayFrames = possessionData.filter(p => p.ball_owner?.team === 'away').length;
    const total = homeFrames + awayFrames;

    const stats = {
      home_possession_pct: total > 0 ? Math.round((homeFrames / total) * 100) : 0,
      away_possession_pct: total > 0 ? Math.round((awayFrames / total) * 100) : 0,
      possession_changes: possessionData.filter(p => p.possession_changed).length,
      frames_tracked: possessionData.length,
    };

    return Response.json({
      success: true,
      session_id,
      possession_data: possessionData.slice(-20), // Last 20 frames
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ assignBallPossession failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});