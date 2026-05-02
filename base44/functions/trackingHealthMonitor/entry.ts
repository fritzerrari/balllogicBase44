/**
 * trackingHealthMonitor – System-Zustand + Diagnostik
 * 
 * Tracked:
 * - API-Latenz
 * - Erfolgsrate
 * - Circuit Breaker Status
 * - Data Quality
 * - Rate-Limit Warnings
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Last 100 TrackingData entries
    const recentTracking = await base44.entities.TrackingData.list('-timestamp_ms', 100);

    // Berechne Health-Metriken
    const health = {
      total_frames: recentTracking.length,
      successful_frames: recentTracking.filter(t => !t.error).length,
      fallback_frames: recentTracking.filter(t => t.source === 'fallback').length,
      avg_quality: recentTracking.length > 0 ? Math.round(
        recentTracking.reduce((sum, t) => sum + (t.detection_quality || 0), 0) / recentTracking.length
      ) : 0,
      avg_processing_time_ms: recentTracking.length > 0 ? Math.round(
        recentTracking.reduce((sum, t) => sum + (t.processing_time_ms || 0), 0) / recentTracking.length
      ) : 0,
      success_rate: recentTracking.length > 0
        ? Math.round((recentTracking.filter(t => !t.error).length / recentTracking.length) * 100)
        : 0,
      errors: recentTracking
        .filter(t => t.error)
        .map(t => ({ timestamp: t.timestamp_ms, error: t.error }))
        .slice(-10),
    };

    // Auto-Events Health
    const recentAutoEvents = await base44.entities.AutoEvent.list('-timestamp_ms', 100);
    const approvalRate = recentAutoEvents.length > 0
      ? Math.round((recentAutoEvents.filter(e => e.approved_by_trainer).length / recentAutoEvents.length) * 100)
      : 0;

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      tracking: health,
      auto_events: {
        total: recentAutoEvents.length,
        approved: recentAutoEvents.filter(e => e.approved_by_trainer).length,
        rejected: recentAutoEvents.filter(e => e.rejected).length,
        pending: recentAutoEvents.filter(e => !e.approved_by_trainer && !e.rejected).length,
        approval_rate: approvalRate,
      },
      warnings: [
        ...(health.success_rate < 80 ? ['⚠️ Low success rate'] : []),
        ...(health.avg_quality < 60 ? ['⚠️ Low detection quality'] : []),
        ...(health.fallback_frames > health.successful_frames / 2 ? ['⚠️ High fallback usage'] : []),
        ...(health.avg_processing_time_ms > 5000 ? ['⚠️ Slow processing'] : []),
      ],
    });
  } catch (error) {
    console.error('❌ trackingHealthMonitor failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});