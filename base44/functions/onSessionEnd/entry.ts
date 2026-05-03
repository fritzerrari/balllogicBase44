/**
 * onSessionEnd – Automation: Wenn Session ended → Heatmaps generieren
 * Wird aufgerufen von Entity-Automation bei LiveSession.status = "ended"
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { event, data } = body;

    const sessionId = data?.id;
    if (!sessionId || event?.type !== 'update') {
      return Response.json({ skip: 'Not a session end event' });
    }

    // Assume session is ended (automation triggered by status update)
    // No need for redundant refetch

    console.log(`🔥 Session ${sessionId} ended, generating heatmaps + AI analysis...`);

    // Get session + match for AI analysis trigger
    let matchId = null;
    try {
      const sessions = await base44.asServiceRole.entities.LiveSession.filter({ id: sessionId });
      matchId = sessions[0]?.match_id || null;
    } catch (e) {
      console.warn('Could not fetch session match_id:', e.message);
    }

    const generated = [];

    // Trigger AI analysis if match exists
    if (matchId) {
      try {
        const aiResult = await base44.asServiceRole.functions.invoke('generateAIAnalysis', {
          session_id: sessionId,
          match_id: matchId,
        });
        console.log(`✅ AI Analysis triggered:`, aiResult?.data || aiResult);
      } catch (aiErr) {
        console.warn(`⚠️ AI Analysis failed (non-critical):`, aiErr.message);
      }
    }

    // Aggregate player statistics (distance, sprints, etc.)
    try {
      const statsResult = await base44.asServiceRole.functions.invoke('aggregatePlayerStats', {
        session_id: sessionId,
      });
      console.log(`✅ Player Stats aggregated:`, statsResult?.data?.player_count || 0);
      generated.push('player_stats');
    } catch (statsErr) {
      console.warn(`⚠️ Player Stats aggregation failed:`, statsErr.message);
    }

    // Aggregate duel statistics (wins, losses, etc.)
    try {
      const duelResult = await base44.asServiceRole.functions.invoke('aggregateDuelStats', {
        session_id: sessionId,
      });
      console.log(`✅ Duel Stats aggregated:`, duelResult?.data?.duel_events || 0);
      generated.push('duel_stats');
    } catch (duelErr) {
      console.warn(`⚠️ Duel Stats aggregation failed:`, duelErr.message);
    }

    // Calculate possession percentages
    try {
      const possResult = await base44.asServiceRole.functions.invoke('calculatePossession', {
        session_id: sessionId,
      });
      console.log(`✅ Possession calculated:`, possResult?.data?.possession);
      generated.push('possession');
    } catch (possErr) {
      console.warn(`⚠️ Possession calculation failed:`, possErr.message);
    }

    // Log possession metrics
    try {
      const metricsResult = await base44.asServiceRole.functions.invoke('logPossessionMetrics', {
        session_id: sessionId,
      });
      console.log(`✅ Possession metrics logged:`, metricsResult?.data?.possession_metrics);
      generated.push('possession_metrics');
    } catch (metricsErr) {
      console.warn(`⚠️ Possession metrics logging failed:`, metricsErr.message);
    }

    // Also generate heatmaps via the dedicated function (both periods, all types)
    for (const team of ['home', 'away']) {
      for (const heatmap_type of ['player_density', 'ball_possession']) {
        try {
          await base44.asServiceRole.functions.invoke('generateHeatmap', {
            session_id: sessionId,
            team,
            heatmap_type,
            period: 'full_match',
          });
        } catch (e) {
          console.warn(`Heatmap via function failed ${team}/${heatmap_type}: ${e.message}`);
        }
      }
    }

    return Response.json({ success: true, generated, ai_analysis_triggered: !!matchId });
  } catch (error) {
    console.error('❌ onSessionEnd failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});