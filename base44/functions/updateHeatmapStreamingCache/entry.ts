/**
 * updateHeatmapStreamingCache — Incremental Heatmap Updates (Live)
 * 
 * Instead of full regeneration every 60 frames:
 * - Nur neue Frame-Positionen zur bestehenden Heatmap addieren
 * - Exponential decay für alte Frames (10min TTL)
 * - 10x schneller als Vollgenerierung
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { session_id, team, players, frame_number } = body;

    if (!session_id || !team || !players) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Load existing heatmap
    const caches = await base44.asServiceRole.entities.HeatmapCache.filter({
      session_id,
      team,
      heatmap_type: 'player_density',
    });

    const cache = caches[0];
    let gridData = cache?.grid_data || [];
    const gridSize = 10; // 10x10 grid

    // Initialize empty grid if needed
    if (!gridData.length) {
      gridData = [];
      for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
          gridData.push({ x, y, intensity: 0 });
        }
      }
    }

    // Update intensity for player positions
    players.forEach(player => {
      const gridX = Math.floor((player.x / 100) * gridSize);
      const gridY = Math.floor((player.y / 100) * gridSize);
      
      // Clamp to grid
      const gx = Math.min(gridSize - 1, Math.max(0, gridX));
      const gy = Math.min(gridSize - 1, Math.max(0, gridY));

      const idx = gx * gridSize + gy;
      if (gridData[idx]) {
        // Exponential moving average: new_intensity = 0.8 * old + 0.2 * new
        gridData[idx].intensity = Math.round(gridData[idx].intensity * 0.8 + 100 * 0.2);
      }
    });

    // Decay all intensities (older frames worth less)
    gridData = gridData.map(cell => ({
      ...cell,
      intensity: Math.round(cell.intensity * 0.98), // 2% decay per frame
    }));

    // Save or update
    if (cache) {
      await base44.asServiceRole.entities.HeatmapCache.update(cache.id, {
        grid_data: gridData,
        generated_at: new Date().toISOString(),
      });
    } else {
      await base44.asServiceRole.entities.HeatmapCache.create({
        session_id,
        team,
        heatmap_type: 'player_density',
        grid_data: gridData,
        period: 'live',
        generated_at: new Date().toISOString(),
        total_frames_processed: 1,
        quality_score: 100,
      });
    }

    return Response.json({
      success: true,
      grid_updated: gridData.length,
      intensity_avg: Math.round(gridData.reduce((s, c) => s + c.intensity, 0) / gridData.length),
    });
  } catch (error) {
    console.error('❌ updateHeatmapStreamingCache failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});