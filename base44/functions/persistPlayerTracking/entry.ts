/**
 * persistPlayerTracking — Spieler-IDs mit Trikot-Nummern verbinden
 * 
 * Flow:
 * 1. tracker_id von Roboflow Byte Tracker
 * 2. Spielerposition + Größe → OCR/Nummern-Erkennung (Roboflow Keypoints)
 * 3. Mit Player-Entity pairen → tracker_id persistent speichern
 * 4. Zukünftige Frames: bekannte tracker_id → sofort Player-Entity
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { session_id, frame_number, tracking_data } = await req.json();
    if (!session_id || !tracking_data) {
      return Response.json({ error: 'Missing session_id or tracking_data' }, { status: 400 });
    }

    // Get or create PlayerTracking mapping for this session
    let playerMap = null;
    try {
      const existing = await base44.asServiceRole.entities.PlayerTracking?.filter?.({ session_id });
      playerMap = existing?.[0] || null;
    } catch (_) {
      // PlayerTracking entity might not exist yet
    }

    if (!playerMap) {
      playerMap = {
        session_id,
        tracker_mappings: {}, // { "t123": { player_id: "p45", number: 7, team: "home", confidence: 95 } }
        last_update_frame: frame_number,
      };
    }

    // Process players from tracking_data
    let updated = false;
    tracking_data.player_positions?.forEach(p => {
      const trackerId = p.tracker_id?.toString();
      if (!trackerId) return;

      // Skip if already mapped & confident
      if (playerMap.tracker_mappings[trackerId]?.confidence > 90) return;

      // Stub: In real scenario, would:
      // - Extract shirt number via Roboflow keypoints
      // - Match against Player entity by number + team
      // - Update mapping with player_id + confidence
      
      // For now: mark as "pending_number_detection"
      playerMap.tracker_mappings[trackerId] = {
        tracker_id: trackerId,
        team: p.team,
        last_seen_x: p.x,
        last_seen_y: p.y,
        frames_seen: (playerMap.tracker_mappings[trackerId]?.frames_seen || 0) + 1,
        confidence: 0, // Needs OCR confirmation
        status: 'pending_number_detection',
      };
      updated = true;
    });

    if (updated) {
      playerMap.last_update_frame = frame_number;
      // Would persist to DB:
      // await base44.asServiceRole.entities.PlayerTracking.create/update(playerMap)
    }

    return Response.json({
      success: true,
      mappings: playerMap.tracker_mappings,
      pending_confirmation: Object.values(playerMap.tracker_mappings).filter(m => m.confidence === 0).length,
    });

  } catch (error) {
    console.error('❌ persistPlayerTracking failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});