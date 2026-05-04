/**
 * updateSessionStats — Automatisch SessionState + Live-Stats aktualisieren
 * Läuft regelmäßig, um Ballbesitz, Possession %, etc. zu berechnen
 * 
 * Aufgerufen von: Scheduler alle 10 Sekunden
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { session_id } = body;

    if (!session_id) {
      return Response.json({ error: 'Missing session_id' }, { status: 400 });
    }

    // 1. Lade alle neuen TrackingData seit letztem Update
    const tracking = await base44.entities.TrackingData.filter(
      { session_id },
      '-frame_number',
      100
    );

    if (tracking.length === 0) {
      return Response.json({ success: true, reason: 'No tracking data yet' });
    }

    // 2. Lade aktuelle SessionState
    const sessionStates = await base44.entities.SessionState.filter({ session_id });
    const sessionState = sessionStates[0];

    if (!sessionState) {
      return Response.json({ error: 'SessionState not found' }, { status: 404 });
    }

    // 3. Berechne Possession aus letzten 50 Frames
    const recentFrames = tracking.slice(0, 50);
    let homeCount = 0;
    let awayCount = 0;
    let contestedCount = 0;

    recentFrames.forEach(frame => {
      if (!frame.ball_possession) {
        contestedCount++;
        return;
      }

      const confidence = frame.ball_possession.confidence || 0;
      if (confidence < 60) {
        contestedCount++;
        return;
      }

      if (frame.ball_possession.team === 'home') homeCount++;
      else if (frame.ball_possession.team === 'away') awayCount++;
      else contestedCount++;
    });

    const total = homeCount + awayCount + contestedCount;
    const possession = {
      home: total > 0 ? Math.round((homeCount / total) * 100) : 50,
      away: total > 0 ? Math.round((awayCount / total) * 100) : 50,
      last_updated_frame: Math.max(...recentFrames.map(f => f.frame_number || 0)),
    };

    // 4. Detektiere Chancen (Ball im Strafraum)
    const chances = {
      home: 0,
      away: 0,
    };

    recentFrames.forEach(frame => {
      if (frame.ball_position) {
        // Strafraum: x < 20% (home) oder x > 80% (away), y zwischen 30-70
        const x = frame.ball_position.x || 50;
        const y = frame.ball_position.y || 50;

        if (x < 20 && y > 30 && y < 70) chances.home++;
        if (x > 80 && y > 30 && y < 70) chances.away++;
      }
    });

    // 5. Erkenne Dangerous Situations (mehrere Spieler dicht beim Ball)
    let dangerousSituations = 0;
    recentFrames.forEach(frame => {
      if (!frame.ball_position || !frame.player_positions) return;

      const nearBall = frame.player_positions.filter(p => {
        const dist = Math.sqrt(
          Math.pow(p.x - frame.ball_position.x, 2) +
          Math.pow(p.y - frame.ball_position.y, 2)
        );
        return dist < 5; // Dicht beim Ball
      });

      if (nearBall.length >= 3) dangerousSituations++;
    });

    // 6. Update SessionState
    await base44.entities.SessionState.update(sessionState.id, {
      frame_count: tracking.length,
      last_frame_number: Math.max(...tracking.map(t => t.frame_number || 0)),
      possession_percentage: possession,
      detection_quality_avg: Math.round(
        tracking.reduce((sum, t) => sum + (t.detection_quality || 0), 0) / tracking.length
      ),
      updated_at: new Date().toISOString(),
    });

    // 7. Auto-erstelle AutoEvents falls nicht vorhanden
    const existingAutoEvents = await base44.entities.AutoEvent.filter({
      session_id,
      type: 'ball_in_penalty_area',
    });

    // Nur erstelle neue Events wenn wenige vorhanden (nicht duplizieren)
    if (existingAutoEvents.length === 0 && chances.home > 0) {
      await base44.entities.AutoEvent.create({
        session_id,
        type: 'ball_in_penalty_area',
        team: 'home',
        confidence: 80,
        timestamp_ms: Date.now(),
        description: `Ball im Strafraum (${chances.home}x in letzten Frames)`,
      });
    }

    if (existingAutoEvents.length === 0 && chances.away > 0) {
      await base44.entities.AutoEvent.create({
        session_id,
        type: 'ball_in_penalty_area',
        team: 'away',
        confidence: 80,
        timestamp_ms: Date.now(),
        description: `Ball im Strafraum (${chances.away}x in letzten Frames)`,
      });
    }

    if (dangerousSituations > 3) {
      await base44.entities.AutoEvent.create({
        session_id,
        type: 'dangerous_situation',
        confidence: 85,
        timestamp_ms: Date.now(),
        description: `Kritische Spielsituation erkannt`,
      });
    }

    console.log(`✅ Session stats updated: Possession ${possession.home}%-${possession.away}%, ${chances.home} home chances, ${chances.away} away chances`);

    return Response.json({
      success: true,
      session_id,
      possession,
      chances,
      dangerous_situations: dangerousSituations,
      frames_analyzed: recentFrames.length,
    });
  } catch (error) {
    console.error('❌ updateSessionStats failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});