/**
 * calculatePossession — Berechne Ball-Besitz-Prozentanteile pro Team
 * 
 * Analysiert alle TrackingData frames und berechnet wer den Ball wann hatte
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

    // Lade alle TrackingData frames
    const allTracking = await base44.entities.TrackingData.filter({
      session_id,
    });

    if (allTracking.length === 0) {
      return Response.json({ success: true, session_id, possession: { home: 0, away: 0, contested: 0 } });
    }

    // Zähle Ball-Besitz pro Team
    let homeCount = 0;
    let awayCount = 0;
    let contestedCount = 0;

    allTracking.forEach(tracking => {
      if (!tracking.ball_possession) {
        contestedCount++;
        return;
      }

      const team = tracking.ball_possession.team;
      const confidence = tracking.ball_possession.confidence || 50;

      // Nur wenn Konfidenz > 60 zählt
      if (confidence < 60) {
        contestedCount++;
        return;
      }

      if (team === 'home') homeCount++;
      else if (team === 'away') awayCount++;
      else contestedCount++;
    });

    // Berechne Prozentanteile
    const total = homeCount + awayCount + contestedCount;
    const possession = {
      home: total > 0 ? Math.round((homeCount / total) * 100) : 0,
      away: total > 0 ? Math.round((awayCount / total) * 100) : 0,
      contested: total > 0 ? Math.round((contestedCount / total) * 100) : 0,
      frames_analyzed: allTracking.length,
    };

    // Speichere in AnalysisReport falls vorhanden
    const sessions = await base44.entities.LiveSession.filter({ id: session_id });
    const matchId = sessions?.[0]?.match_id;

    if (matchId) {
      try {
        const existing = await base44.entities.AnalysisReport.filter({ match_id: matchId });
        if (existing.length > 0) {
          await base44.entities.AnalysisReport.update(existing[0].id, {
            possession_home: possession.home,
            possession_away: possession.away,
          });
        }
      } catch (e) {
        console.warn(`⚠️ AnalysisReport update failed: ${e.message}`);
      }
    }

    console.log(`✅ Possession calculated: Home ${possession.home}% - Away ${possession.away}% (Contested ${possession.contested}%)`);

    return Response.json({
      success: true,
      session_id,
      match_id: matchId,
      possession,
    });
  } catch (error) {
    console.error('❌ calculatePossession failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});