/**
 * logPossessionMetrics — Speichere Possession-Wechsel als MatchEvents
 * Wird aufgerufen wenn possession_change AutoEvent erstellt wird
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { session_id } = body;

    if (!session_id) {
      return Response.json({ error: 'Missing session_id' }, { status: 400 });
    }

    // Lade alle possession_change Events
    const possessionEvents = await base44.entities.AutoEvent.filter({
      session_id,
      type: 'possession_change',
    });

    // Berechne Possession-Statistiken
    const stats = {
      total_changes: possessionEvents.length,
      changes_by_team: { home: 0, away: 0 },
      changes_by_minute: {},
    };

    possessionEvents.forEach(evt => {
      if (evt.team) stats.changes_by_team[evt.team]++;
      
      const minute = evt.minute || 0;
      if (!stats.changes_by_minute[minute]) {
        stats.changes_by_minute[minute] = 0;
      }
      stats.changes_by_minute[minute]++;
    });

    console.log(`✅ Possession metrics: ${stats.total_changes} changes (Home: ${stats.changes_by_team.home}, Away: ${stats.changes_by_team.away})`);

    return Response.json({
      success: true,
      session_id,
      possession_metrics: stats,
    });
  } catch (error) {
    console.error('❌ logPossessionMetrics failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});