/**
 * generateSessionAnalysis — Nach Session-Ende: KI-Analyse aller Daten
 * Erstellt TeamAnalysis mit SWOT, Taktik-Insights, Spieler-Bewertungen
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { session_id, match_id } = body;
    if (!session_id || !match_id) {
      return Response.json({ error: 'Missing session_id or match_id' }, { status: 400 });
    }

    // Lade Session + Events
    const sessions = await base44.entities.LiveSession.filter({ id: session_id });
    if (!sessions.length) return Response.json({ error: 'Session not found' }, { status: 404 });

    const session = sessions[0];
    const events = await base44.entities.MatchEvent.filter({ session_id }).catch(() => []);
    const trackingData = await base44.entities.TrackingData.filter({ session_id }, '-timestamp_ms', 50).catch(() => []);
    const sessionState = await base44.entities.SessionState.filter({ session_id }).catch(() => []);

    // Aggregiere Metriken
    const goals = events.filter(e => e.type === 'goal');
    const chances = events.filter(e => e.type === 'chance');
    const possessionData = sessionState[0]?.possession_percentage || { home: 50, away: 50 };
    const qualityScore = sessionState[0]?.detection_quality_avg || 0;
    const formations = {
      home: sessionState[0]?.formation_home || '?',
      away: sessionState[0]?.formation_away || '?',
    };

    // KI-Analyse per LLM
    const analysisPrompt = `
Du analysierst ein Fußball-Spiel basierend auf echtem Tracking-Daten.

**Match:** ${session.match_title}
**Dauer:** ${Math.round((new Date(session.ended_at) - new Date(session.started_at)) / 60000)} Minuten
**Events:** ${events.length} (Tore: ${goals.length}, Chancen: ${chances.length})
**Ballbesitz:** Heim ${possessionData.home}% vs. Gäste ${possessionData.away}%
**Formationen:** Heim: ${formations.home}, Gäste: ${formations.away}
**Tracking-Qualität:** ${qualityScore}%

Gib eine kompakte SWOT-Analyse für das Heimteam (max 100 Wörter pro Punkt):
- **Stärken:** Was lief gut?
- **Schwächen:** Was lief schlecht?
- **Chancen:** Wie kann man besser werden?
- **Bedrohungen:** Was könnte problematisch sein?

Zusätzlich:
- **Taktische Observations:** Formation, Spielweise, Pressing
- **Top 3 Empfehlungen:** Konkrete Trainings-Maßnahmen
- **Performance Score:** 0-100 Gesamtbewertung
    `;

    const llmResult = await base44.integrations.Core.InvokeLLM({
      prompt: analysisPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          strengths: { type: 'array', items: { type: 'string' } },
          weaknesses: { type: 'array', items: { type: 'string' } },
          opportunities: { type: 'array', items: { type: 'string' } },
          threats: { type: 'array', items: { type: 'string' } },
          tactical_observations: { type: 'string' },
          recommendations: { type: 'array', items: { type: 'string' } },
          performance_score: { type: 'number' },
        },
      },
    }).catch(err => {
      console.warn(`⚠️ LLM analysis failed: ${err.message}`);
      return {
        strengths: ['Daten verfügbar'],
        weaknesses: ['Analyse fehlgeschlagen'],
        opportunities: [],
        threats: [],
        tactical_observations: 'Session beendet',
        recommendations: ['Daten checken'],
        performance_score: qualityScore,
      };
    });

    // Erstelle TeamAnalysis
    const analysis = await base44.entities.TeamAnalysis.create({
      match_id: match_id,
      match_title: session.match_title,
      analysis_type: 'own_team',
      generated_at: new Date().toISOString(),
      management_summary: `${session.match_title}: ${goals.filter(g => g.team === 'home').length}:${goals.filter(g => g.team === 'away').length}. Ballbesitz: ${possessionData.home}%. Qualität: ${qualityScore}%.`,
      strengths: llmResult.strengths || [],
      weaknesses: llmResult.weaknesses || [],
      opportunities: llmResult.opportunities || [],
      threats: llmResult.threats || [],
      tactical_observations: llmResult.tactical_observations || '',
      recommendations: llmResult.recommendations || [],
      performance_score: llmResult.performance_score || qualityScore,
      raw_metrics: {
        possession_avg: possessionData.home,
        goals_scored: goals.filter(g => g.team === 'home').length,
        chances_created: chances.filter(c => c.team === 'home').length,
        tracking_quality: qualityScore,
        events_total: events.length,
        formations: formations,
      },
    });

    console.log(`✅ Analysis generated for ${session.match_title} — Score: ${llmResult.performance_score}`);

    return Response.json({
      success: true,
      analysis_id: analysis.id,
      performance_score: llmResult.performance_score,
      summary: llmResult.tactical_observations,
    });
  } catch (error) {
    console.error('❌ generateSessionAnalysis failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});