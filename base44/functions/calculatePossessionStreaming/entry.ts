/**
 * calculatePossessionStreaming — Real-time Possession Update
 * Called nach jedem Frame (oder alle 30 frames) um SessionState zu aktualisieren
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { session_id, lookback_frames = 50 } = await req.json();

    if (!session_id) {
      return Response.json({ error: 'Missing session_id' }, { status: 400 });
    }

    // Load recent tracking data
    const tracking = await base44.asServiceRole.entities.TrackingData.filter(
      { session_id },
      '-timestamp_ms',
      lookback_frames
    );

    if (tracking.length === 0) {
      return Response.json({ 
        possession_percentage: { home: 50, away: 50 },
        confidence: 0,
        frames_analyzed: 0,
      });
    }

    // Count ball possession by team
    const homePossFrames = tracking.filter(t => t.ball_possession?.team === 'home').length;
    const awayPossFrames = tracking.filter(t => t.ball_possession?.team === 'away').length;
    const totalPossFrames = homePossFrames + awayPossFrames;

    if (totalPossFrames === 0) {
      return Response.json({
        possession_percentage: { home: 50, away: 50 },
        confidence: 0,
        frames_analyzed: tracking.length,
        reason: 'no_possession_data',
      });
    }

    const homePercent = Math.round((homePossFrames / totalPossFrames) * 100);
    const awayPercent = 100 - homePercent;

    // Update SessionState with rolling average
    const sessionStates = await base44.asServiceRole.entities.SessionState.filter({ session_id });
    const sessionState = sessionStates?.[0];

    if (sessionState) {
      // Rolling average: 70% new data, 30% old data
      const oldHome = sessionState.possession_percentage?.home || 50;
      const newHome = Math.round(homePercent * 0.7 + oldHome * 0.3);
      const newAway = 100 - newHome;

      await base44.asServiceRole.entities.SessionState.update(sessionState.id, {
        possession_percentage: {
          home: newHome,
          away: newAway,
          last_updated_frame: tracking[0]?.frame_number || 0,
        },
      });

      return Response.json({
        possession_percentage: { home: newHome, away: newAway },
        confidence: Math.min(100, (totalPossFrames / lookback_frames) * 100),
        frames_analyzed: tracking.length,
        rolling_average: true,
      });
    }

    return Response.json({
      possession_percentage: { home: homePercent, away: awayPercent },
      confidence: Math.min(100, (totalPossFrames / lookback_frames) * 100),
      frames_analyzed: tracking.length,
    });

  } catch (error) {
    console.error('calculatePossessionStreaming error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});