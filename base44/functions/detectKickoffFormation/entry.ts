/**
 * detectKickoffFormation — Erfasst Spielerpositionen beim Anstoß zur Teamerkennung
 * 
 * Workflow:
 * 1. Warte auf nächsten Frame aus useFrameCapture (max 3s)
 * 2. Erfasse alle Spielerpositionen + Speichere in LiveSession.home_team_positions / away_team_positions
 * 3. Home-Team = linke Hälfte (x < 50), Away-Team = rechte Hälfte (x > 50)
 * 4. Zukünftige Spieler-IDs werden nach Position zugeordnet
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const KICKOFF_WAIT_MS = 3000; // 3s Fenster für Frame-Erfassung

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { session_id } = await req.json();
    if (!session_id) {
      return Response.json({ error: 'Missing session_id' }, { status: 400 });
    }

    console.log(`🟢 Kickoff Detection für Session ${session_id}`);

    // ── Hole letzten Frame aus TrackingData ──────────────────────────────────
    let trackingFrames = [];
    try {
      trackingFrames = await base44.entities.TrackingData.filter(
        { session_id },
        '-timestamp_ms',
        10
      );
    } catch (e) {
      console.warn('⚠️ TrackingData fetch failed:', e.message);
    }

    if (trackingFrames.length === 0) {
      return Response.json(
        { error: 'Keine Tracking-Daten verfügbar — warte auf nächsten Frame' },
        { status: 202 }
      );
    }

    // Besten Frame suchen (nicht unbedingt 20 Spieler — auch 6+ reicht)
    const latestFrame = trackingFrames.find(f => f.player_positions?.length >= 10)
      || trackingFrames.find(f => f.player_positions?.length >= 6)
      || trackingFrames[0];

    if (!latestFrame?.player_positions || latestFrame.player_positions.length < 4) {
      return Response.json(
        {
          error: 'Zu wenig Spieler erkannt (min. 4 benötigt)',
          players_detected: latestFrame?.player_positions?.length || 0,
        },
        { status: 202 }
      );
    }

    // ── Teile Spieler nach Position ──────────────────────────────────────────
    const homeTeam = [];
    const awayTeam = [];

    latestFrame.player_positions.forEach((player) => {
      if (player.x < 50) {
        homeTeam.push(player);
      } else {
        awayTeam.push(player);
      }
    });

    console.log(
      `✓ Kickoff: ${homeTeam.length} Heim (links) + ${awayTeam.length} Gäste (rechts)`
    );

    // ── Speichere Session mit Kickoff-Daten ──────────────────────────────────
    const updateData = {
      kickoff_detected: true,
      kickoff_timestamp: new Date().toISOString(),
      home_team_positions: homeTeam.map((p) => ({
        player_id: p.player_id,
        x: p.x,
        y: p.y,
      })),
      away_team_positions: awayTeam.map((p) => ({
        player_id: p.player_id,
        x: p.x,
        y: p.y,
      })),
    };

    await base44.entities.LiveSession.update(session_id, updateData);

    // ── Speichere Kickoff-Referenzframe ──────────────────────────────────────
    // Dieser Frame wird später für die Auto-Team-Zuweisung neuer Spieler verwendet
    await base44.entities.TrackingData.create({
      session_id,
      frame_number: -1, // Spezialmarker für Kickoff-Frame
      timestamp_ms: Date.now(),
      elapsed_seconds: 0,
      source: 'kickoff_calibration',
      player_positions: latestFrame.player_positions,
      detection_quality: latestFrame.detection_quality,
    });

    return Response.json({
      success: true,
      kickoff_calibrated: true,
      home_team_count: homeTeam.length,
      away_team_count: awayTeam.length,
      message: `Anstoß erfasst: ${homeTeam.length} vs ${awayTeam.length} Spieler`,
    });
  } catch (error) {
    console.error('❌ detectKickoffFormation failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});