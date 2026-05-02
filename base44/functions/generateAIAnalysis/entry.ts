/**
 * generateAIAnalysis – KI-basierte Match-Analyse
 * Triggered by onSessionEnd automation
 * Erstellt TeamAnalysis Records mit LLM-Insights
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
    const { session_id, match_id } = body;

    if (!session_id || !match_id) {
      return Response.json({ error: 'Missing session_id or match_id' }, { status: 400 });
    }

    // Get match info
    const matches = await base44.entities.Match.filter({ id: match_id });
    const match = matches[0];
    if (!match) {
      return Response.json({ error: 'Match not found' }, { status: 404 });
    }

    // Get tracking data for context
    const trackingData = await base44.entities.TrackingData.filter({ session_id });
    const events = await base44.entities.MatchEvent.filter({ session_id });

    if (trackingData.length === 0) {
      return Response.json({ 
        success: false, 
        message: 'No tracking data available for analysis' 
      });
    }

    // Build context for LLM
    const context = {
      match: match.title,
      tracking_frames: trackingData.length,
      events: events.length,
      avg_quality: Math.round(trackingData.reduce((s, t) => s + (t.detection_quality || 0), 0) / trackingData.length),
      players_tracked: new Set(trackingData.flatMap(t => t.player_positions?.map(p => p.player_id) || [])).size,
    };

    // Call LLM for analysis
    const analysis = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze this football match tracking data:
        Match: ${context.match}
        Frames analyzed: ${context.tracking_frames}
        Detection quality: ${context.avg_quality}%
        Unique players tracked: ${context.players_tracked}
        Events recorded: ${context.events}
        
        Provide a tactical analysis in German with:
        1. SWOT (strengths, weaknesses, opportunities, threats)
        2. Key observations
        3. Training recommendations
        4. Performance score (0-100)`,
      response_json_schema: {
        type: "object",
        properties: {
          management_summary: { type: "string" },
          strengths: { type: "array", items: { type: "string" } },
          weaknesses: { type: "array", items: { type: "string" } },
          opportunities: { type: "array", items: { type: "string" } },
          threats: { type: "array", items: { type: "string" } },
          tactical_observations: { type: "string" },
          recommendations: { type: "array", items: { type: "string" } },
          training_focus: { type: "array", items: { type: "string" } },
          performance_score: { type: "number" },
        },
      },
    });

    // Save as TeamAnalysis
    const teamAnalysis = await base44.entities.TeamAnalysis.create({
      match_id,
      match_title: match.title,
      analysis_type: 'own_team',
      generated_at: new Date().toISOString(),
      management_summary: analysis.management_summary,
      strengths: analysis.strengths || [],
      weaknesses: analysis.weaknesses || [],
      opportunities: analysis.opportunities || [],
      threats: analysis.threats || [],
      tactical_observations: analysis.tactical_observations,
      recommendations: analysis.recommendations || [],
      training_focus: analysis.training_focus || [],
      performance_score: Math.round(analysis.performance_score || 0),
      raw_metrics: context,
    });

    console.log(`✅ AI Analysis created for match ${match_id}`);

    return Response.json({
      success: true,
      analysis_id: teamAnalysis?.id,
      context,
    });
  } catch (error) {
    console.error('❌ generateAIAnalysis failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});