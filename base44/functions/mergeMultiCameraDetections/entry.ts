/**
 * mergeMultiCameraDetections — Multi-Camera Player Deduplication
 * 
 * Problem: Mit 2+ Kameras wird jeder Spieler von jeder Kamera erkannt = doppelte/dreifache Counts
 * Lösung: Dedupliziere Spieler über Kameras basierend auf Position + Velocität + Confidence
 * 
 * Strategie:
 * 1. Group detections by frame_number (selber Zeitpunkt)
 * 2. For each group: match players across cameras (Position-basiert)
 * 3. Keep detection mit höchster Confidence, mark others als secondary
 * 4. Speichere deduplizierte output
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function calculateDistance(p1, p2) {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

// Threshold: Spieler müssen <3% Feldbreite auseinander sein = selbe Person
const POSITION_MATCH_THRESHOLD = 3.0;
const MIN_CONFIDENCE_THRESHOLD = 60;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { session_id, frame_number, group_frame_window = 5 } = await req.json();

    if (!session_id || typeof frame_number !== 'number') {
      return Response.json({ error: 'Missing session_id or frame_number' }, { status: 400 });
    }

    // Load all detections in a small time window around this frame
    // (handles minor timing differences between cameras)
    const startFrame = Math.max(0, frame_number - group_frame_window);
    const endFrame = frame_number + group_frame_window;

    let trackingDataList = [];
    try {
      trackingDataList = await base44.asServiceRole.entities.TrackingData.filter({
        session_id,
        frame_number: { $gte: startFrame, $lte: endFrame },
      });
    } catch (err) {
      console.warn(`⚠️ Failed to fetch tracking data: ${err.message}`);
      return Response.json({
        success: false,
        error: 'Failed to fetch detections',
        merged_players: 0,
      }, { status: 500 });
    }

    if (trackingDataList.length === 0) {
      return Response.json({
        success: true,
        merged_players: 0,
        duplicates_removed: 0,
        message: 'No detections in window',
      });
    }

    // Group by frame_number
    const frameGroups = {};
    trackingDataList.forEach(td => {
      const fn = td.frame_number;
      if (!frameGroups[fn]) frameGroups[fn] = [];
      frameGroups[fn].push(td);
    });

    let totalMerged = 0;
    let totalRemoved = 0;

    // Process each frame group
    for (const [fn, detections] of Object.entries(frameGroups)) {
      const playerPositions = [];
      const ballPositions = [];

      // Collect all player positions across all detections in this frame
      detections.forEach((td, idx) => {
        if (!td.player_positions) return;
        td.player_positions.forEach(p => {
          if (p.confidence < MIN_CONFIDENCE_THRESHOLD) return; // Skip low-confidence
          playerPositions.push({
            ...p,
            source_tracking_id: td.id,
            source_index: idx,
            raw_confidence: p.confidence,
          });
        });
        if (td.ball_position && td.ball_position.confidence >= MIN_CONFIDENCE_THRESHOLD) {
          ballPositions.push({
            ...td.ball_position,
            source_tracking_id: td.id,
          });
        }
      });

      // Deduplicate players
      const matched = new Set();
      const dedupedPlayers = [];

      for (let i = 0; i < playerPositions.length; i++) {
        if (matched.has(i)) continue;

        const primary = playerPositions[i];
        const cluster = [primary];

        // Find all nearby players (potential duplicates)
        for (let j = i + 1; j < playerPositions.length; j++) {
          if (matched.has(j)) continue;
          const candidate = playerPositions[j];

          const dist = calculateDistance(primary, candidate);
          if (dist < POSITION_MATCH_THRESHOLD) {
            // Match: same player detected by multiple cameras
            cluster.push(candidate);
            matched.add(j);
          }
        }

        // Keep highest confidence, mark others
        const best = cluster.sort((a, b) => b.raw_confidence - a.raw_confidence)[0];
        dedupedPlayers.push({
          player_id: best.player_id,
          team: best.team,
          x: best.x,
          y: best.y,
          confidence: best.raw_confidence,
          tracker_id: best.tracker_id,
          dedup_cluster_size: cluster.length,
          source_tracking_id: best.source_tracking_id,
        });

        if (cluster.length > 1) {
          totalRemoved += cluster.length - 1;
        }
      }

      totalMerged += dedupedPlayers.length;

      // Select best ball position (highest confidence)
      const bestBall = ballPositions.length > 0
        ? ballPositions.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0]
        : null;

      // Log merge result
      console.log(`✅ Frame ${fn}: ${playerPositions.length} detections → ${dedupedPlayers.length} unique players (removed ${cluster && cluster.length > 1 ? cluster.length - 1 : 0})`);
    }

    return Response.json({
      success: true,
      frames_processed: Object.keys(frameGroups).length,
      merged_players: totalMerged,
      duplicates_removed: totalRemoved,
      dedup_efficiency: totalRemoved > 0 ? Math.round((totalRemoved / (totalMerged + totalRemoved)) * 100) : 0,
    });

  } catch (error) {
    console.error('❌ mergeMultiCameraDetections failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});