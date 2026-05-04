/**
 * uploadFrames — Simple, robust HTTP POST handler für Frame-Uploads
 * Speichert zu SessionState (für Trainer-Dashboard)
 * Sendet zu processFrame für Tracking (async, non-blocking)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'POST only' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { session_id, camera_id, frames = [] } = body;

    if (!session_id || !camera_id) {
      return Response.json({ error: 'Missing session_id or camera_id' }, { status: 400 });
    }

    if (!Array.isArray(frames) || frames.length === 0) {
      return Response.json({ error: 'No frames' }, { status: 400 });
    }

    console.log(`[uploadFrames] Received ${frames.length} frames from ${camera_id}`);

    // Process each frame
    let processedCount = 0;
    for (const frame of frames.slice(0, 5)) {
      if (!frame.data_base64) continue;

      try {
        // 1. Save latest frame to SessionState (for dashboard polling)
        const states = await base44.asServiceRole.entities.SessionState.filter(
          { session_id }
        );

        if (states.length === 0) {
          // Auto-create SessionState
          await base44.asServiceRole.entities.SessionState.create({
            session_id,
            frame_count: 1,
            last_frame_number: 0,
            latest_frame_base64: frame.data_base64,
            latest_frame_timestamp: frame.timestamp_ms,
            latest_camera_id: camera_id,
            possession_percentage: { home: 50, away: 50, last_updated_frame: 0 },
            detection_quality_avg: 0,
            updated_at: new Date().toISOString(),
          }).catch(e => {
            console.warn('[uploadFrames] SessionState create failed:', e.message);
          });
        } else {
          // Update existing
          await base44.asServiceRole.entities.SessionState.update(states[0].id, {
            latest_frame_base64: frame.data_base64,
            latest_frame_timestamp: frame.timestamp_ms,
            latest_camera_id: camera_id,
            frame_count: (states[0].frame_count || 0) + 1,
            updated_at: new Date().toISOString(),
          }).catch(() => {});
        }

        // 2. Queue frame for Roboflow detection (async, don't wait)
        base44.asServiceRole.functions
          .invoke('processFrame', {
            session_id,
            camera_id,
            frame_base64: frame.data_base64,
            timestamp_ms: frame.timestamp_ms,
            source: 'mobile_camera',
          })
          .catch(e => {
            console.warn('[uploadFrames] processFrame queue failed:', e.message);
          });

        processedCount++;
      } catch (err) {
        console.warn(`[uploadFrames] Frame processing error: ${err.message}`);
      }
    }

    console.log(`✅ Processed ${processedCount} frames`);

    return Response.json({
      success: true,
      frames_processed: processedCount,
      message: `${processedCount} frames queued for analysis`,
    });
  } catch (error) {
    console.error('[uploadFrames] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});