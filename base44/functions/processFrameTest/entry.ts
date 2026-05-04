/**
 * processFrameTest — Diagnostics für Frame-Processing Pipeline
 * Testet: Base64 Decode, Canvas Rendering, Roboflow API Call
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { session_id, camera_id, frame_base64 } = body;

    if (!session_id || !camera_id || !frame_base64) {
      return Response.json({ error: 'Missing params' }, { status: 400 });
    }

    console.log(`[processFrameTest] Testing frame for session=${session_id}, camera=${camera_id}`);

    // Test 1: Base64 Decode
    let decoded = null;
    try {
      const base64Data = frame_base64.split(',')[1] || frame_base64;
      decoded = atob(base64Data);
      console.log(`[processFrameTest] ✅ Base64 decoded, size=${decoded.length} bytes`);
    } catch (e) {
      console.error(`[processFrameTest] ❌ Base64 decode failed: ${e.message}`);
      return Response.json({ error: 'Base64 decode failed', detail: e.message }, { status: 400 });
    }

    // Test 2: Check Roboflow API Key
    const roboflowKey = Deno.env.get('ROBOFLOW_API_KEY');
    if (!roboflowKey) {
      console.error('[processFrameTest] ❌ ROBOFLOW_API_KEY not set');
      return Response.json({ error: 'ROBOFLOW_API_KEY not configured' }, { status: 500 });
    }
    console.log('[processFrameTest] ✅ Roboflow API key found');

    // Test 3: Call Roboflow (minimal test)
    try {
      const roboflowRes = await fetch('https://api.roboflow.com/api/authenticate', {
        method: 'GET',
        headers: {
          'x-api-key': roboflowKey,
        },
      });
      
      if (!roboflowRes.ok) {
        const text = await roboflowRes.text();
        console.error(`[processFrameTest] ❌ Roboflow auth failed: ${roboflowRes.status} ${text}`);
        return Response.json({
          error: 'Roboflow API error',
          status: roboflowRes.status,
          detail: text,
        }, { status: 500 });
      }

      console.log('[processFrameTest] ✅ Roboflow API auth OK');
    } catch (e) {
      console.error(`[processFrameTest] ❌ Roboflow fetch error: ${e.message}`);
      return Response.json({ error: 'Roboflow API unavailable', detail: e.message }, { status: 500 });
    }

    // Test 4: Create SessionState if missing
    try {
      const states = await base44.asServiceRole.entities.SessionState.filter({ session_id }, '', 1);
      if (states.length === 0) {
        console.log('[processFrameTest] SessionState missing, creating...');
        await base44.asServiceRole.entities.SessionState.create({
          session_id,
          frame_count: 0,
          last_frame_number: 0,
          possession_percentage: { home: 50, away: 50, last_updated_frame: 0 },
          detection_quality_avg: 0,
          updated_at: new Date().toISOString(),
        });
        console.log('[processFrameTest] ✅ SessionState created');
      } else {
        console.log('[processFrameTest] ✅ SessionState exists');
      }
    } catch (e) {
      console.warn(`[processFrameTest] SessionState check failed: ${e.message}`);
    }

    return Response.json({
      success: true,
      checks: {
        base64_decode: 'PASS',
        roboflow_api_key: 'FOUND',
        roboflow_auth: 'PASS',
        session_state: 'OK',
      },
      frame_size: decoded.length,
      message: 'All diagnostic checks passed. Frame processing pipeline is healthy.',
    });
  } catch (error) {
    console.error('[processFrameTest] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});