/**
 * aggregatePlayerStats – Live-Spieler-Statistiken aus TrackingData
 * 
 * Berechnet pro Spieler:
 * - Distanz gelaufen
 * - Sprints
 * - Ball-Berührungen
 * - Heatmap
 * - Durchschn. Position
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

    // Alle TrackingData für diese Session laden
    const allTracking = await base44.entities.TrackingData.filter({ session_id });

    if (allTracking.length === 0) {
      return Response.json({ stats: {} });
    }

    // Group by player_id + berechne Statistiken
    const playerStats = {};

    allTracking.forEach(tracking => {
       if (!tracking.player_positions) return;
       // DSGVO-Safety: skip data with anonymize flag
       if (tracking.player_positions.some(p => p.tracking_anonymize)) return;

       tracking.player_positions.forEach(player => {
         // Use explicit player_id, fallback: number + team combo (not x/y which changes)
         const playerId = player.player_id || `player_${player.team || 'unknown'}_${player.number || 'unknown'}`;

        if (!playerStats[playerId]) {
          playerStats[playerId] = {
            player_id: playerId,
            positions: [],
            total_distance_km: 0,
            sprint_count: 0,
            avg_x: 0,
            avg_y: 0,
            heatmap_grid: Array(100).fill(0),
          };
        }

        playerStats[playerId].positions.push({
          x: player.x,
          y: player.y,
          timestamp: tracking.timestamp_ms,
        });

        // Heatmap-Grid update (10x10)
        const gridX = Math.floor((player.x / 100) * 10);
        const gridY = Math.floor((player.y / 100) * 10);
        const gridIndex = gridY * 10 + gridX;
        playerStats[playerId].heatmap_grid[gridIndex]++;
      });
    });

    // Berechne abgeleitete Metriken — OPTIMIERT: Single Pass wo möglich
    Object.values(playerStats).forEach(player => {
      if (player.positions.length < 2) return;

      // Distance + Sprints + Avg Position: Single Loop (O(n) statt O(3n))
      let distance = 0;
      let sprints = 0;
      let sumX = 0, sumY = 0;

      for (let i = 1; i < player.positions.length; i++) {
        const p1 = player.positions[i - 1];
        const p2 = player.positions[i];
        const dx = ((p2.x - p1.x) / 100) * 105;
        const dy = ((p2.y - p1.y) / 100) * 68;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const timeDiff = (p2.timestamp - p1.timestamp) / 1000;

        distance += dist;
        if (dist > 10 && timeDiff < 1) sprints++;
        sumX += p2.x;
        sumY += p2.y;
      }

      player.total_distance_km = Math.round(distance / 1000 * 100) / 100;
      player.sprint_count = sprints;
      player.avg_x = Math.round(sumX / player.positions.length);
      player.avg_y = Math.round(sumY / player.positions.length);

      // Normalize Heatmap — Safety: avoid division by zero
      const maxHeat = Math.max(...player.heatmap_grid) || 1;
      player.heatmap_grid = player.heatmap_grid.map(v => Math.round((v / maxHeat) * 100));
    });

    return Response.json({
      success: true,
      session_id,
      player_count: Object.keys(playerStats).length,
      tracking_frames: allTracking.length,
      stats: playerStats,
    });
  } catch (error) {
    console.error('❌ aggregatePlayerStats failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});