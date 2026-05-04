/**
 * finalizeSession – Session beenden + Auto-Report generieren
 * 
 * Workflow:
 * 1. Session.status = ended
 * 2. Match.status = analyzed
 * 3. Sammle alle Events
 * 4. Erstelle SessionReport
 * 5. Trigger AnalysisReport via LLM (optional)
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

    // 1. Lade Session
    const sessions = await base44.entities.LiveSession.filter({ id: session_id });
    if (!sessions.length) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    const session = sessions[0];
    // Safety: ensure both timestamps exist
    const sessionDuration = (session.ended_at && session.started_at)
      ? Math.round((new Date(session.ended_at) - new Date(session.started_at)) / 1000)
      : 0;

    // 2. Update Session + Match Status
    await base44.entities.LiveSession.update(session.id, {
      status: 'ended',
      ended_at: new Date().toISOString(),
    });

    // Update Match status if associated
    if (session.match_id) {
      await base44.entities.Match.update(session.match_id, { status: 'analyzed' }).catch(err => {
        console.warn(`⚠️ Match update failed: ${err.message}`);
      });
    }

    // 3. Sammle Events (mit error handling)
    let events = [];
    try {
      events = await base44.entities.MatchEvent.filter({ session_id: session.id }).catch(() => []);
    } catch (_) {
      console.warn('⚠️ Event collection failed, continuing with empty list');
    }
    const goals = events.filter(e => e.type === 'goal');
    const cards = events.filter(e => e.type === 'yellow_card' || e.type === 'red_card');
    const subs = events.filter(e => e.type === 'substitution');

    // 4. Erstelle SessionReport
    const report = await base44.entities.SessionReport.create({
      session_id: session.id,
      match_id: session.match_id || '',
      match_title: session.match_title,
      report_type: 'post_session',
      generated_at: new Date().toISOString(),
      event_count: events.length,
      goals: goals.map(e => ({ minute: e.minute, team: e.team, description: e.description })),
      cards: cards.map(e => ({ minute: e.minute, team: e.team, type: e.type })),
      substitutions: subs.map(e => ({ minute: e.minute, team: e.team })),
      key_events: events.slice(0, 20),
      summary: `Session "${session.match_title}" — ${events.length} Events in ${Math.floor(sessionDuration / 60)}min. ${goals.length} Tore, ${cards.length} Karten, ${subs.length} Wechsel.`,
    });

    // 5. Trigger KI-Analyse (async, non-blocking)
    base44.functions.invoke('generateSessionAnalysis', {
      session_id: session.id,
      match_id: session.match_id,
    }).then(res => {
      console.log(`✅ Analysis queued: ${res?.data?.analysis_id}`);
    }).catch(err => {
      console.warn(`⚠️ Analysis trigger failed: ${err.message}`);
    });

    // 6. Cleanup: FunkMessages löschen
    try {
      const funkMsgs = await base44.entities.FunkMessage.filter({ session_id: session.id });
      await Promise.all(funkMsgs.map(m => base44.entities.FunkMessage.delete(m.id)));
    } catch (_) {}

    return Response.json({
      success: true,
      session_id: session.id,
      report_id: report.id,
      event_count: events.length,
      duration_seconds: sessionDuration,
      goals: goals.length,
      cards: cards.length,
      subs: subs.length,
    });
  } catch (error) {
    console.error('❌ finalizeSession failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});