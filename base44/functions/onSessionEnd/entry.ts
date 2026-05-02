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

    console.log(`🔥 Session ${sessionId} ended, generating heatmaps...`);

    // Beide Teams, alle Heatmap-Typen
    const teams = ['home', 'away'];
    const types = ['player_density', 'ball_possession'];

    const generated = [];

    for (const team of teams) {
      for (const type of types) {
        try {
          const res = await base44.asServiceRole.functions.invoke('generateHeatmap', {
            session_id: sessionId,
            team,
            heatmap_type: type,
            period: 'full_match',
          });

          if (res?.heatmap?.id) {
            generated.push(`${team}/${type}`);
          }
        } catch (err) {
          console.warn(`Heatmap gen failed ${team}/${type}: ${err.message}`);
        }
      }
    }

    console.log(`✅ Generated ${generated.length} heatmaps:`, generated);

    return Response.json({ success: true, generated });
  } catch (error) {
    console.error('❌ onSessionEnd failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});