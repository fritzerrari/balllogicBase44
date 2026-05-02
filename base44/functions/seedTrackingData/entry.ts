/**
 * seedTrackingData – Mock-Daten für Tests/Entwicklung
 * Erstellt 30 Frames mit 22 Spielern + Ball für echte Pipeline-Tests
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function generatePlayerPositions(frameNum, teamCount = 11) {
  const positions = [];
  
  // Home team (links)
  for (let i = 0; i < teamCount; i++) {
    positions.push({
      player_id: `home_${i}`,
      team: 'home',
      x: 20 + (i % 3) * 15 + Math.sin(frameNum * 0.05 + i) * 5,
      y: 25 + Math.floor(i / 3) * 20 + Math.cos(frameNum * 0.03 + i) * 5,
      confidence: 85 + Math.random() * 15,
    });
  }
  
  // Away team (rechts)
  for (let i = 0; i < teamCount; i++) {
    positions.push({
      player_id: `away_${i}`,
      team: 'away',
      x: 65 + (i % 3) * 15 + Math.sin(frameNum * 0.05 + i + 100) * 5,
      y: 25 + Math.floor(i / 3) * 20 + Math.cos(frameNum * 0.03 + i + 100) * 5,
      confidence: 85 + Math.random() * 15,
    });
  }
  
  return positions;
}

function generateBallPosition(frameNum) {
  return {
    x: 50 + Math.sin(frameNum * 0.1) * 20,
    y: 50 + Math.cos(frameNum * 0.08) * 15,
    confidence: 90,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { session_id, frame_count = 30 } = body;

    if (!session_id) {
      return Response.json({ error: 'Missing session_id' }, { status: 400 });
    }

    // Get session + match
    const sessions = await base44.entities.LiveSession.filter({ id: session_id });
    const session = sessions[0];
    
    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    // Create tracking frames
    const created = [];
    for (let frame = 1; frame <= frame_count; frame++) {
      try {
        const tracking = await base44.entities.TrackingData.create({
          session_id,
          match_id: session.match_id,
          frame_number: frame,
          timestamp_ms: Date.now() - (frame_count - frame) * 500, // Backfill timestamps
          elapsed_seconds: Math.floor(frame * 0.5), // ~0.5s per frame
          ball_position: generateBallPosition(frame),
          player_positions: generatePlayerPositions(frame, 11),
          detection_quality: 85 + Math.random() * 15,
          source: 'mock',
          error: null,
          retry_count: 0,
        });
        
        if (tracking?.id) {
          created.push(tracking.id);
        }
      } catch (e) {
        console.warn(`Frame ${frame} failed:`, e.message);
      }
    }

    console.log(`✅ Created ${created.length} tracking frames for session ${session_id}`);

    return Response.json({
      success: true,
      session_id,
      frames_created: created.length,
      frame_ids: created.slice(0, 5), // Show first 5
    });
  } catch (error) {
    console.error('❌ seedTrackingData failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});