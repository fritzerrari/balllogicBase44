/**
 * mergeMultiCameraDetectionsEnhanced — Multi-Camera Player Matching
 * Mergt Spieler-Detektionen von mehreren Kameras zu konsistenter View
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { session_id, frame_number, lookback_frames = 5 } = await req.json();

    if (!session_id) {
      return Response.json({ error: 'Missing session_id' }, { status: 400 });
    }

    // Load recent tracking data from ALL cameras
    const tracking = await base44.asServiceRole.entities.TrackingData.filter(
      { session_id },
      '-timestamp_ms',
      lookback_frames * 3 // Load more frames for better matching
    );

    if (tracking.length === 0) {
      return Response.json({ merged_count: 0, error: 'No tracking data' });
    }

    // Group by frame_number + camera_id
    const framesByCamera = {};
    tracking.forEach(t => {
      const key = `${t.frame_number}`;
      if (!framesByCamera[key]) framesByCamera[key] = [];
      framesByCamera[key].push(t);
    });

    let mergedCount = 0;
    const mergedFrames = [];

    // Merge players across cameras for each frame
    for (const frameKey of Object.keys(framesByCamera)) {
      const framesForFrame = framesByCamera[frameKey];
      if (framesForFrame.length < 2) continue; // Only merge if 2+ cameras

      const allPlayers = [];
      framesForFrame.forEach(f => {
        if (f.player_positions) {
          f.player_positions.forEach(p => {
            allPlayers.push({ ...p, source_camera: f.frame_number });
          });
        }
      });

      // Match players across cameras (same person detected by multiple cameras)
      const matchedPlayers = matchPlayersAcrossCameras(allPlayers);
      
      // Create merged tracking data (average position)
      const mergedData = {
        session_id,
        frame_number: parseInt(frameKey),
        timestamp_ms: framesForFrame[0].timestamp_ms,
        elapsed_seconds: framesForFrame[0].elapsed_seconds,
        player_positions: mergedData,
        ball_position: framesForFrame[0].ball_position || framesForFrame[1]?.ball_position,
        detection_quality: Math.max(...framesForFrame.map(f => f.detection_quality || 0)),
        source: 'merged_multi_camera',
        is_merged: true,
        camera_count: framesForFrame.length,
      };

      mergedFrames.push(mergedData);
      mergedCount++;
    }

    // Save merged frames (optional — for analytics)
    // for (const merged of mergedFrames.slice(0, 5)) {
    //   await base44.asServiceRole.entities.TrackingData.create(merged);
    // }

    return Response.json({
      merged_count: mergedCount,
      frames_analyzed: tracking.length,
      camera_count: Object.values(framesByCamera).map(f => f.length).join(','),
    });

  } catch (error) {
    console.error('mergeMultiCameraDetectionsEnhanced error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Match players across cameras using spatial proximity + team
 */
function matchPlayersAcrossCameras(players) {
  const merged = [];
  const used = new Set();

  players.forEach((p1, i) => {
    if (used.has(i)) return;
    
    const group = [p1];
    used.add(i);

    // Find similar players from other cameras
    players.forEach((p2, j) => {
      if (i >= j || used.has(j)) return;
      if (p1.team !== p2.team) return; // Must be same team
      
      const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
      
      // If within 10% of field, likely same player
      if (dist < 10) {
        group.push(p2);
        used.add(j);
      }
    });

    // Average position of group
    const avgX = Math.round(group.reduce((sum, p) => sum + p.x, 0) / group.length);
    const avgY = Math.round(group.reduce((sum, p) => sum + p.y, 0) / group.length);
    const avgConf = Math.round(group.reduce((sum, p) => sum + (p.confidence || 0), 0) / group.length);

    merged.push({
      player_id: p1.player_id || `t${p1.tracker_id}`,
      team: p1.team,
      x: avgX,
      y: avgY,
      confidence: avgConf,
      tracker_id: p1.tracker_id,
      camera_sources: group.length,
    });
  });

  return merged;
}