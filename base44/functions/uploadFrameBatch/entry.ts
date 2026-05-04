/**
 * uploadFrameBatch — Empfängt Frames vom AdaptiveFrameCapture
 * Speichert Base64 → JPEG in Storage, sendet an processFrame für Tracking
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'POST only' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { pathname } = new URL(req.url);
    const parts = pathname.split('/');
    const sessionId = parts[parts.length - 2];
    const cameraId = parts[parts.length - 1];

    if (!sessionId || !cameraId) {
      return Response.json({ error: 'Missing session_id or camera_id' }, { status: 400 });
    }

    const body = await req.json();
    const { frames = [], recovery = false, metadata = {} } = body;

    if (!Array.isArray(frames) || frames.length === 0) {
      return Response.json({ error: 'No frames provided' }, { status: 400 });
    }

    // Limit: max 10 frames per batch
    const batch = frames.slice(0, 10);
    const processedFrames = [];

    for (let i = 0; i < batch.length; i++) {
      const frame = batch[i];
      const { data_base64, timestamp_ms, elapsed_seconds } = frame;

      if (!data_base64) continue;

      try {
        // Convert base64 to binary
        const base64Data = data_base64.split(',')[1] || data_base64;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let j = 0; j < binaryString.length; j++) {
          bytes[j] = binaryString.charCodeAt(j);
        }

        // Speichere letzte Frame in SessionState für Trainer-Polling
        try {
          const states = await base44.asServiceRole.entities.SessionState.filter({ session_id: sessionId });
          if (states.length > 0) {
            await base44.asServiceRole.entities.SessionState.update(states[0].id, {
              latest_frame_base64: data_base64,
              latest_frame_timestamp: timestamp_ms,
              latest_camera_id: cameraId,
            }).catch(() => {});
          }
        } catch (_) {}

        // Send zu processFrame für Tracking (async, non-blocking)
        base44.functions.invoke('processFrame', {
          session_id: sessionId,
          camera_id: cameraId,
          frame_base64: data_base64,
          frame_number: i,
          elapsed_seconds: elapsed_seconds || 0,
          timestamp_ms,
          source: 'adaptive_capture',
        }).catch(err => {
          console.warn(`[uploadFrameBatch] processFrame async error: ${err.message}`);
        });

        processedFrames.push({
          timestamp_ms,
          size_bytes: frame.size_bytes || 0,
          status: 'queued',
        });
      } catch (err) {
        console.warn(`[uploadFrameBatch] Frame ${i} processing failed:`, err.message);
      }
    }

    console.log(`✅ Batch upload: ${processedFrames.length}/${batch.length} frames queued for processing`);

    return Response.json({
      success: true,
      frames_processed: processedFrames.length,
      recovery_mode: recovery,
      metadata,
      message: `${processedFrames.length} frames queued for tracking analysis`,
    });
  } catch (error) {
    console.error('❌ uploadFrameBatch failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});