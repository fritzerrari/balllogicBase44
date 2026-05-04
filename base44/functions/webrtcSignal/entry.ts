/**
 * WebRTC Signaling Server
 * Speichert SDP Offers/Answers und ICE Candidates in AppSetting-Tabelle
 * als einfaches Polling-basiertes Signaling (kein WebSocket nötig)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, session_id, camera_id, data } = body;

    if (!session_id || !camera_id) {
      return Response.json({ error: 'Missing session_id or camera_id' }, { status: 400 });
    }

    const key = `webrtc_${session_id}_cam${camera_id}`;

    if (action === 'set_offer') {
      // Camera sends SDP offer
      const existing = await base44.asServiceRole.entities.AppSetting.filter({ key });
      const payload = {
        key,
        value: JSON.stringify({
          offer: data.offer,
          ice_camera: data.ice_candidates || [],
          ice_viewer: [],
          answer: null,
          updated_at: Date.now(),
        }),
        label: `WebRTC signal for cam ${camera_id} in session ${session_id}`,
      };
      if (existing.length > 0) {
        await base44.asServiceRole.entities.AppSetting.update(existing[0].id, payload);
      } else {
        await base44.asServiceRole.entities.AppSetting.create(payload);
      }
      return Response.json({ ok: true });
    }

    if (action === 'add_ice_camera') {
      // Camera adds ICE candidates
      const existing = await base44.asServiceRole.entities.AppSetting.filter({ key });
      if (existing.length === 0) return Response.json({ ok: true });
      const current = JSON.parse(existing[0].value || '{}');
      current.ice_camera = [...(current.ice_camera || []), ...(data.candidates || [])];
      current.updated_at = Date.now();
      await base44.asServiceRole.entities.AppSetting.update(existing[0].id, {
        value: JSON.stringify(current),
      });
      return Response.json({ ok: true });
    }

    if (action === 'set_answer') {
      // Viewer sends SDP answer
      const existing = await base44.asServiceRole.entities.AppSetting.filter({ key });
      if (existing.length === 0) return Response.json({ error: 'No offer found' }, { status: 404 });
      const current = JSON.parse(existing[0].value || '{}');
      current.answer = data.answer;
      current.ice_viewer = data.ice_candidates || [];
      current.updated_at = Date.now();
      await base44.asServiceRole.entities.AppSetting.update(existing[0].id, {
        value: JSON.stringify(current),
      });
      return Response.json({ ok: true });
    }

    if (action === 'add_ice_viewer') {
      // Viewer adds ICE candidates
      const existing = await base44.asServiceRole.entities.AppSetting.filter({ key });
      if (existing.length === 0) return Response.json({ ok: true });
      const current = JSON.parse(existing[0].value || '{}');
      current.ice_viewer = [...(current.ice_viewer || []), ...(data.candidates || [])];
      current.updated_at = Date.now();
      await base44.asServiceRole.entities.AppSetting.update(existing[0].id, {
        value: JSON.stringify(current),
      });
      return Response.json({ ok: true });
    }

    if (action === 'get_signal') {
      // Both sides poll this to get the latest signal state
      const existing = await base44.asServiceRole.entities.AppSetting.filter({ key });
      if (existing.length === 0) return Response.json({ signal: null });
      const signal = JSON.parse(existing[0].value || '{}');
      return Response.json({ signal });
    }

    if (action === 'clear') {
      const existing = await base44.asServiceRole.entities.AppSetting.filter({ key });
      if (existing.length > 0) {
        await base44.asServiceRole.entities.AppSetting.delete(existing[0].id);
      }
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});