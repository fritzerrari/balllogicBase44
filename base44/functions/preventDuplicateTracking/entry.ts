/**
 * preventDuplicateTracking — Deduplizierungs-Lock für parallele Kameras
 * 
 * Problem: Bei 3+ Kameras können identische Frame-Nummern gleichzeitig
 * verarbeitet werden, was zu Duplikaten in TrackingData führt.
 * 
 * Lösung: Distributed Lock mit Session-ID + Frame-Nummer
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// In-memory locks (kurze TTL: 10s)
const FRAME_LOCKS = new Map(); // Key: "session_id:frame_number", Value: timestamp

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { session_id, frame_number, camera_id } = body;

    if (!session_id || frame_number === undefined) {
      return Response.json({ error: 'Missing session_id or frame_number' }, { status: 400 });
    }

    const lockKey = `${session_id}:${frame_number}`;
    const now = Date.now();

    // Check existing lock
    const existingLock = FRAME_LOCKS.get(lockKey);
    if (existingLock && now - existingLock < 5000) {
      // Lock still active — duplicate detected!
      console.warn(`🔒 Duplicate frame detected: ${lockKey} from camera ${camera_id}`);
      return Response.json({
        success: false,
        reason: 'duplicate_frame',
        message: 'Frame bereits von anderer Kamera verarbeitet',
      });
    }

    // Acquire lock
    FRAME_LOCKS.set(lockKey, now);

    // Cleanup old locks (>10s)
    if (FRAME_LOCKS.size > 1000) {
      for (const [key, time] of FRAME_LOCKS) {
        if (now - time > 10000) FRAME_LOCKS.delete(key);
      }
    }

    return Response.json({
      success: true,
      acquired: true,
      lock_key: lockKey,
      message: 'Lock acquired, safe to process frame',
    });
  } catch (error) {
    console.error('❌ preventDuplicateTracking failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});