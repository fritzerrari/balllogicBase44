/**
 * acquireFrameLock — Distributed Lock für Frame-Verarbeitung
 * 
 * Sichert: Bei parallelen Kameras verarbeitet nur EINE Kamera einen Frame
 * Fallback: Nach 8s Auto-Release (falls Kamera crashed)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const LOCK_TTL_MS = 8000; // Auto-release nach 8s
const LOCK_KEY_PREFIX = 'frame_lock_';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { session_id, frame_number, camera_id } = body;

    if (!session_id || frame_number === undefined || !camera_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const lockKey = `${LOCK_KEY_PREFIX}${session_id}_frame_${frame_number}`;
    const lockValue = `${camera_id}_${Date.now()}`;
    const now = Date.now();

    try {
      // Versuche Lock zu erstellen (Atomare Operation)
      await base44.asServiceRole.entities.AppSetting.create({
        key: lockKey,
        value: lockValue,
        label: `Frame lock - TTL until ${now + LOCK_TTL_MS}`,
      });

      // ✅ Lock erfolgreich erworben
      return Response.json({
        success: true,
        acquired: true,
        lock_id: lockValue,
        expires_at: now + LOCK_TTL_MS,
      });
    } catch (lockErr) {
      // Lock existiert bereits oder Fehler
      if (lockErr.message?.includes('duplicate') || lockErr.message?.includes('already')) {
        // Prüfe ob Lock abgelaufen ist
        const existing = await base44.asServiceRole.entities.AppSetting.filter({
          key: lockKey,
        });

        if (existing.length > 0) {
          const lockValue = existing[0].value;
          const lockTime = parseInt(lockValue.split('_')[1] || 0);
          
          if (now - lockTime > LOCK_TTL_MS) {
            // Lock abgelaufen — delete + acquire
            try {
              await base44.asServiceRole.entities.AppSetting.delete(existing[0].id);
              // Jetzt neu erstellen
              await base44.asServiceRole.entities.AppSetting.create({
                key: lockKey,
                value: lockValue,
                label: `Frame lock - TTL until ${now + LOCK_TTL_MS}`,
              });
              return Response.json({ success: true, acquired: true, lock_id: lockValue });
            } catch (_) {}
          }

          // Lock ist noch aktiv — reject
          return Response.json({
            success: false,
            acquired: false,
            reason: 'lock_held',
            holder: lockValue.split('_')[0],
          });
        }
      }

      // Unerwarteter Fehler
      return Response.json({
        success: false,
        error: lockErr.message,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ acquireFrameLock failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});