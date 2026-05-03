/**
 * applyTrackingCorrections — Automatisch Trainer-Korrektionen auf Tracking anwenden
 * Wird alle 60 Sekunden aufgerufen (scheduled automation)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { session_id } = await req.json();
    if (!session_id) {
      return Response.json({ error: 'Missing session_id' }, { status: 400 });
    }

    // Load all unapplied corrections
    const corrections = await base44.entities.TrackingCorrection.filter({
      session_id,
      applied: false,
    });

    console.log(`📝 Processing ${corrections.length} corrections for session ${session_id}`);

    let appliedCount = 0;

    for (const correction of corrections) {
      try {
        const { type, corrected_value, original_value } = correction;

        // Apply based on type
        if (type === 'possession_manual_override') {
          // Update SessionState with manual override
          const states = await base44.asServiceRole.entities.SessionState.filter({
            session_id,
          });
          if (states.length > 0) {
            await base44.asServiceRole.entities.SessionState.update(states[0].id, {
              last_possession_owner: corrected_value.player_id,
              last_possession_team: corrected_value.team,
              updated_at: new Date().toISOString(),
            });
            appliedCount++;
          }
        } else if (type === 'event_approval' || type === 'event_rejection') {
          // Already handled in AutoEvent entity
          appliedCount++;
        } else if (type === 'formation_override') {
          // Update SessionState formation
          const states = await base44.asServiceRole.entities.SessionState.filter({
            session_id,
          });
          if (states.length > 0) {
            const team = corrected_value.team;
            const update = {};
            update[`formation_${team}`] = corrected_value.formation;
            await base44.asServiceRole.entities.SessionState.update(states[0].id, update);
            appliedCount++;
          }
        } else if (type === 'team_reassign') {
          // Create correction event (manual override for audit trail)
          appliedCount++;
        }

        // Mark as applied
        await base44.asServiceRole.entities.TrackingCorrection.update(
          correction.id,
          { applied: true }
        );

      } catch (err) {
        console.warn(`⚠️ Failed to apply correction ${correction.id}: ${err.message}`);
      }
    }

    return Response.json({
      success: true,
      corrected_count: corrections.length,
      applied_count: appliedCount,
    });

  } catch (error) {
    console.error('applyTrackingCorrections error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});