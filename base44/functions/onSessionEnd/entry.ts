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
          // Fetch tracking data for heatmap generation (safe: may not exist)
          let trackingData = [];
          try {
            trackingData = await base44.asServiceRole.entities.TrackingData.filter({ session_id: sessionId });
          } catch (e) {
            console.warn(`Failed to fetch tracking data for ${team}/${type}: ${e.message}`);
            continue;
          }

          if (trackingData.length === 0) {
            console.warn(`⚠️ No tracking data available for session ${sessionId}/${team}/${type}`);
            continue;
          }

          // Generate grid from tracking data
          const grid = Array(10).fill(0).map(() => Array(10).fill(0));
          trackingData.forEach(frame => {
            if (type === 'player_density') {
              frame.player_positions?.forEach(p => {
                if (p.team === team) {
                  const x = Math.floor((p.x / 100) * 10);
                  const y = Math.floor((p.y / 100) * 10);
                  if (x >= 0 && x < 10 && y >= 0 && y < 10) {
                    grid[y][x] += 10;
                  }
                }
              });
            } else if (type === 'ball_possession') {
              if (frame.ball_position) {
                const x = Math.floor((frame.ball_position.x / 100) * 10);
                const y = Math.floor((frame.ball_position.y / 100) * 10);
                if (x >= 0 && x < 10 && y >= 0 && y < 10) {
                  grid[y][x] += 5;
                }
              }
            }
          });

          // Normalize grid to 0-100
          const flat = grid.flat();
          const max = Math.max(...flat, 1);
          const gridData = [];
          grid.forEach((row, y) => {
            row.forEach((intensity, x) => {
              if (intensity > 0) {
                gridData.push({ x, y, intensity: Math.round((intensity / max) * 100) });
              }
            });
          });

          // Save heatmap cache
          const heatmap = await base44.asServiceRole.entities.HeatmapCache.create({
            session_id: sessionId,
            team,
            heatmap_type: type,
            grid_data: gridData,
            period: 'full_match',
            generated_at: new Date().toISOString(),
            total_frames_processed: trackingData.length,
            quality_score: Math.round((trackingData.filter(t => t.detection_quality > 50).length / trackingData.length) * 100) || 0,
          });

          if (heatmap?.id) {
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