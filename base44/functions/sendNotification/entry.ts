/**
 * sendNotification – Echtzeit-Notifications bei wichtigen Events
 * 
 * Triggered bei:
 * - Auto-Events (Tore, Offsidse)
 * - Critical moments
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Rate-limiting: Track recent notifications per session
const notificationCache = new Map(); // sessionId → { type → timestamp }
const RATE_LIMIT_MS = {
  goal: 2000,      // Max 1 goal per 2 seconds
  red_card: 5000,  // Max 1 red card per 5 seconds
  default: 1000,
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { session_id, event_type, event_data, message } = body;

    if (!session_id || !event_type) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // RATE-LIMITING: prevent spam
    const cacheKey = `${session_id}:${event_type}`;
    const lastNotification = notificationCache.get(cacheKey) || 0;
    const rateLimitMs = RATE_LIMIT_MS[event_type] || RATE_LIMIT_MS.default;
    const timeSinceLastNotification = Date.now() - lastNotification;

    if (timeSinceLastNotification < rateLimitMs) {
      console.warn(`⏱️ Rate limit: ${event_type} notification throttled (${Math.round(rateLimitMs - timeSinceLastNotification)}ms cooldown)`);
      return Response.json({ 
        success: false, 
        throttled: true,
        message: 'Notification throttled by rate limiter'
      }, { status: 429 });
    }

    // Update cache
    notificationCache.set(cacheKey, Date.now());
    
    // Cleanup old entries (defensive memory management)
    if (notificationCache.size > 1000) {
      const entries = Array.from(notificationCache.entries());
      entries.slice(0, 100).forEach(([k]) => notificationCache.delete(k));
    }

    // Wichtige Events
    const priorityEvents = {
      goal: { title: '⚽ TOR!', level: 'critical' },
      offside: { title: '🚩 Abseits', level: 'warning' },
      red_card: { title: '🟥 Rote Karte', level: 'warning' },
      ball_in_goal_area: { title: '⚠️ Torraum', level: 'info' },
    };

    const eventConfig = priorityEvents[event_type] || { title: event_type, level: 'info' };

    // Notifications werden via Base44 Broadcasting gemacht
    // Hier nur Log + optional: Email/Push später
    const notification = {
      session_id,
      type: event_type,
      title: eventConfig.title,
      message: message || `Event: ${event_type}`,
      level: eventConfig.level,
      timestamp_ms: Date.now(),
      data: event_data,
    };

    console.log(`📢 Notification: ${notification.title} - ${notification.message}`);

    // Optional: Base44 SendEmail für critical events
    if (eventConfig.level === 'critical' && user.email) {
      try {
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: `🚨 ${notification.title} - Session`,
          body: `${notification.message}\n\nTimestamp: ${new Date().toLocaleString('de-DE')}`,
        });
      } catch (_) {}
    }

    return Response.json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error('❌ sendNotification failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});