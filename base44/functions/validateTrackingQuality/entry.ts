/**
 * validateTrackingQuality — Echtzeit-Qualitätsprüfung für Tracking
 * Warnungen bei: Detection < 40, Frames mit 0 Spielern, inconsistente Daten
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { session_id, last_n_frames = 100 } = body;

    if (!session_id) {
      return Response.json({ error: 'Missing session_id' }, { status: 400 });
    }

    // Lade letzten N Frames
    const allTracking = await base44.entities.TrackingData.filter({
      session_id,
    });

    const recentFrames = allTracking.slice(-last_n_frames);

    if (recentFrames.length === 0) {
      return Response.json({ success: true, session_id, quality_ok: true, warnings: [] });
    }

    const warnings = [];
    let qualitySum = 0;
    let emptyFrames = 0;
    let lowConfidenceEvents = 0;

    recentFrames.forEach((frame, idx) => {
      const quality = frame.detection_quality || 0;
      qualitySum += quality;

      // Alert 1: Detection Quality < 40
      if (quality < 40) {
        lowConfidenceEvents++;
      }

      // Alert 2: Keine Spieler erkannt
      if (!frame.player_positions || frame.player_positions.length === 0) {
        emptyFrames++;
      }

      // Alert 3: Ball Position aber kein Ballbesitz
      if (frame.ball_position && !frame.ball_possession) {
        lowConfidenceEvents++;
      }
    });

    const avgQuality = Math.round(qualitySum / recentFrames.length);

    // Generate warnings
    if (avgQuality < 40) {
      warnings.push({
        severity: 'critical',
        message: `Durchschn. Detection Quality nur ${avgQuality}% — Tracking unreliabel`,
        recommendation: 'Überprüfe Kamera-Blickwinkel, Beleuchtung',
      });
    }

    if (emptyFrames > last_n_frames * 0.1) {
      warnings.push({
        severity: 'warning',
        message: `${emptyFrames}/${recentFrames.length} Frames ohne Spieler-Erkennung`,
        recommendation: 'Feldkalibrierung überprüfen',
      });
    }

    if (lowConfidenceEvents > last_n_frames * 0.2) {
      warnings.push({
        severity: 'warning',
        message: `Viele Low-Confidence Events — Ball-Tracking instabil`,
        recommendation: 'Roboflow Workflow-Parameter überprüfen',
      });
    }

    return Response.json({
      success: true,
      session_id,
      frames_analyzed: recentFrames.length,
      quality_ok: avgQuality >= 50 && warnings.length === 0,
      avg_quality: avgQuality,
      empty_frames: emptyFrames,
      low_confidence_events: lowConfidenceEvents,
      warnings,
    });
  } catch (error) {
    console.error('❌ validateTrackingQuality failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});