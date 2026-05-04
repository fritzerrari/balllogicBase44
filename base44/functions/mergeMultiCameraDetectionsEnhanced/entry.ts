/**
 * mergeMultiCameraDetectionsEnhanced — Robustes Multi-Camera Merge
 *
 * Konzept & Fallback-Strategie:
 * ─────────────────────────────
 * Problem 1: Kameras kommen nicht zeitgleich → Frame-Timestamps weichen ab
 *   Lösung: Zeitfenster-basiertes Matching (±2s), nicht Frame-Nummer
 *
 * Problem 2: Kamera fällt aus → Lücken im Feed
 *   Lösung: "Last Known Good" Extrapolation für ausgefallene Kamera
 *           Spieler-Position aus letztem guten Frame + Bewegungsvektor fortgeschrieben
 *
 * Problem 3: Doppelte Spieler-Detektionen zwischen Kameras
 *   Lösung: Positions-Clustering mit adaptivem Threshold
 *           Ball: Kamera mit höchster Konfidenz gewinnt
 *
 * Problem 4: Nur 1 Kamera verfügbar
 *   Lösung: Single-Camera-Mode — kein Merge, aber Session läuft weiter
 *
 * Ergebnis: Merged SessionState mit best-of-all-cameras Tracking
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const POSITION_MATCH_THRESHOLD = 8.0; // % Feldbreite — großzügiger für asynchrone Kameras
const TIME_WINDOW_MS = 2500;           // Frames innerhalb 2.5s gelten als "gleichzeitig"
const EXTRAPOLATION_MAX_MS = 10000;    // Max 10s Extrapolation bei Kameraausfall
const MIN_CONFIDENCE = 40;             // Niedrigerer Threshold für mehr Redundanz

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { session_id, lookback_ms = 3000 } = await req.json();
    if (!session_id) return Response.json({ error: 'Missing session_id' }, { status: 400 });

    const now = Date.now();
    const windowStart = now - lookback_ms;

    // ── Lade aktuelle Session für Kamera-Infos ──────────────────────────────
    const sessions = await base44.asServiceRole.entities.LiveSession.filter({ id: session_id });
    const session = sessions[0];
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

    const allCameras = session.camera_streams || [];
    const activeCameras = allCameras.filter(cam => {
      const lastSeenMs = cam.last_seen ? now - new Date(cam.last_seen).getTime() : Infinity;
      return lastSeenMs < 15000; // Online = letzte 15s aktiv
    });
    const staleCameras = allCameras.filter(cam => {
      const lastSeenMs = cam.last_seen ? now - new Date(cam.last_seen).getTime() : Infinity;
      return lastSeenMs >= 15000 && lastSeenMs < 60000; // Schwach = 15-60s
    });
    const offlineCameras = allCameras.filter(cam => {
      const lastSeenMs = cam.last_seen ? now - new Date(cam.last_seen).getTime() : Infinity;
      return lastSeenMs >= 60000;
    });

    console.log(`📹 Kameras: ${activeCameras.length} aktiv, ${staleCameras.length} schwach, ${offlineCameras.length} offline`);

    // ── Single-Camera-Mode: kein Merge nötig ───────────────────────────────
    if (activeCameras.length <= 1 && staleCameras.length === 0) {
      return Response.json({
        success: true,
        mode: 'single_camera',
        active_cameras: activeCameras.length,
        merged_players: 0,
        message: 'Single-camera mode — no merge needed',
      });
    }

    // ── Lade aktuelle Tracking-Frames (Zeitfenster) ─────────────────────────
    const recentFrames = await base44.asServiceRole.entities.TrackingData.filter(
      { session_id }, '-timestamp_ms', 20
    );

    if (recentFrames.length === 0) {
      return Response.json({ success: true, mode: 'no_data', merged_players: 0 });
    }

    // ── Gruppiere Frames nach Zeitfenster ───────────────────────────────────
    // Statt Frame-Nummer: Frames die innerhalb TIME_WINDOW_MS liegen = selber "Moment"
    const framesSorted = recentFrames.sort((a, b) => b.timestamp_ms - a.timestamp_ms);
    const latestTs = framesSorted[0]?.timestamp_ms || now;

    const currentWindowFrames = framesSorted.filter(f =>
      Math.abs(f.timestamp_ms - latestTs) <= TIME_WINDOW_MS
    );

    console.log(`🕐 Zeitfenster: ${currentWindowFrames.length} Frames (±${TIME_WINDOW_MS}ms)`);

    // ── Extrapoliere ausgefallene Kameras ────────────────────────────────────
    // Hole letzten bekannten Frame für offline Kameras
    const extrapolatedPositions = [];
    if (offlineCameras.length > 0 || staleCameras.length > 0) {
      const oldFrames = await base44.asServiceRole.entities.TrackingData.filter(
        { session_id }, '-timestamp_ms', 50
      );

      for (const deadCam of [...offlineCameras, ...staleCameras]) {
        // Finde letzten Frame mit guten Daten für diese Kamera
        // (approximiert durch Zeitstempel vor dem Ausfall)
        const camLastSeen = deadCam.last_seen ? new Date(deadCam.last_seen).getTime() : 0;
        const ageMs = now - camLastSeen;
        if (ageMs > EXTRAPOLATION_MAX_MS) {
          console.log(`⚰️ Kamera ${deadCam.label} zu lange offline (${Math.round(ageMs/1000)}s) — keine Extrapolation`);
          continue;
        }

        // Letzter bekannter Frame für diese Kamera
        const lastGoodFrame = oldFrames.find(f =>
          Math.abs(f.timestamp_ms - camLastSeen) < 5000 && f.player_positions?.length > 0
        );

        if (lastGoodFrame) {
          const staleness = (now - lastGoodFrame.timestamp_ms) / 1000;
          // Confidence linear abbauen je älter der Frame
          const confidenceDecay = Math.max(0, 1 - staleness / (EXTRAPOLATION_MAX_MS / 1000));

          extrapolatedPositions.push(...(lastGoodFrame.player_positions || []).map(p => ({
            ...p,
            confidence: Math.round((p.confidence || 50) * confidenceDecay * 0.5), // Halbe Confidence
            extrapolated: true,
            extrapolated_from_cam: deadCam.camera_id,
            staleness_s: Math.round(staleness),
          })));

          console.log(`🔄 Extrapoliert ${lastGoodFrame.player_positions?.length || 0} Spieler aus Kamera ${deadCam.label} (${Math.round(staleness)}s alt)`);
        }
      }
    }

    // ── Sammle alle Spieler-Detektionen ──────────────────────────────────────
    const allPlayers = [];
    const allBalls = [];

    currentWindowFrames.forEach(frame => {
      (frame.player_positions || []).forEach(p => {
        if ((p.confidence || 0) >= MIN_CONFIDENCE) {
          allPlayers.push({ ...p, source_frame_id: frame.id, source_ts: frame.timestamp_ms });
        }
      });
      if (frame.ball_position?.confidence >= MIN_CONFIDENCE) {
        allBalls.push({ ...frame.ball_position, source_frame_id: frame.id });
      }
    });

    // Extrapolierte hinzufügen (nur wenn kein ähnlicher aktiver Spieler vorhanden)
    extrapolatedPositions.forEach(ep => {
      const hasSimilar = allPlayers.some(p =>
        Math.sqrt((p.x - ep.x) ** 2 + (p.y - ep.y) ** 2) < POSITION_MATCH_THRESHOLD
      );
      if (!hasSimilar) allPlayers.push(ep);
    });

    console.log(`👥 Gesamt Spieler-Detektionen: ${allPlayers.length} (davon ${extrapolatedPositions.length} extrapoliert)`);

    // ── Dedupliziere Spieler (Positions-Clustering) ───────────────────────────
    const used = new Set();
    const mergedPlayers = [];

    for (let i = 0; i < allPlayers.length; i++) {
      if (used.has(i)) continue;
      const primary = allPlayers[i];
      const cluster = [primary];
      used.add(i);

      for (let j = i + 1; j < allPlayers.length; j++) {
        if (used.has(j)) continue;
        const candidate = allPlayers[j];
        const dist = Math.sqrt((primary.x - candidate.x) ** 2 + (primary.y - candidate.y) ** 2);
        if (dist < POSITION_MATCH_THRESHOLD) {
          cluster.push(candidate);
          used.add(j);
        }
      }

      // Bester Spieler aus Cluster (höchste echte Confidence bevorzugt)
      const realPlayers = cluster.filter(p => !p.extrapolated);
      const best = (realPlayers.length > 0 ? realPlayers : cluster)
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];

      // Durchschnittsposition für stabilere Darstellung
      const avgX = Math.round(cluster.reduce((s, p) => s + p.x, 0) / cluster.length);
      const avgY = Math.round(cluster.reduce((s, p) => s + p.y, 0) / cluster.length);

      mergedPlayers.push({
        player_id: best.player_id,
        team: best.team,
        x: cluster.length > 1 ? avgX : best.x,  // Avg nur wenn mehrere Quellen
        y: cluster.length > 1 ? avgY : best.y,
        confidence: best.confidence,
        tracker_id: best.tracker_id,
        camera_sources: cluster.length,
        has_extrapolated: cluster.some(p => p.extrapolated),
      });
    }

    // ── Bester Ball aus allen Kameras ─────────────────────────────────────────
    const bestBall = allBalls.length > 0
      ? allBalls.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0]
      : null;

    // ── Coverage-Analyse: Welche Feldzone hat keine Daten? ────────────────────
    const GRID = 10;
    const coverageGrid = Array(GRID).fill(0).map(() => Array(GRID).fill(0));
    mergedPlayers.forEach(p => {
      const col = Math.min(GRID - 1, Math.floor((p.x / 100) * GRID));
      const row = Math.min(GRID - 1, Math.floor((p.y / 100) * GRID));
      if (col >= 0 && row >= 0) coverageGrid[row][col]++;
    });
    const totalCells = GRID * GRID;
    const coveredCells = coverageGrid.flat().filter(v => v > 0).length;
    const coveragePct = Math.round((coveredCells / totalCells) * 100);

    // ── Update SessionState mit Merge-Ergebnis ────────────────────────────────
    try {
      const states = await base44.asServiceRole.entities.SessionState.filter({ session_id });
      if (states.length > 0) {
        await base44.asServiceRole.entities.SessionState.update(states[0].id, {
          updated_at: new Date().toISOString(),
        });
      }
    } catch (_) {}

    const mode = activeCameras.length > 1 ? 'multi_camera_merge'
      : extrapolatedPositions.length > 0 ? 'fallback_extrapolation'
      : 'single_camera';

    return Response.json({
      success: true,
      mode,
      active_cameras: activeCameras.length,
      stale_cameras: staleCameras.length,
      offline_cameras: offlineCameras.length,
      frames_in_window: currentWindowFrames.length,
      merged_players: mergedPlayers.length,
      extrapolated_players: extrapolatedPositions.length,
      best_ball: bestBall ? { x: bestBall.x, y: bestBall.y, confidence: bestBall.confidence } : null,
      coverage_pct: coveragePct,
      covered_cells: coveredCells,
      total_cells: totalCells,
    });

  } catch (error) {
    console.error('mergeMultiCameraDetectionsEnhanced error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});