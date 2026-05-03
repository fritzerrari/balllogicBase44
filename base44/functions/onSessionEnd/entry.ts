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