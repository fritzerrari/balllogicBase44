/**
 * processFrame — Production-Ready Roboflow + Fallback mit Fehlertoleranz
 * 
 * Features:
 * - Exponential Backoff Retry (3x)
 * - Timeout + Circuit Breaker
 * - Graceful Degradation (Fallback zu letztem erfolgreichen Frame)
 * - Comprehensive Logging + Health-Monitoring
 * - Data Validation + Error Recovery
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ROBOFLOW_API_KEY = Deno.env.get('ROBOFLOW_API_KEY');
const API_TIMEOUT_MS = 8000; // Timeout nach 8s
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = [500, 1500, 3000]; // Exponential backoff
const CIRCUIT_BREAKER_THRESHOLD = 5; // Failure threshold
const CIRCUIT_BREAKER_RESET_MS = 60000; // Reset nach 60s

// Global Circuit Breaker State
let circuitBreakerState = { open: false, failures: 0, lastFailTime: 0 };

const THRESHOLDS = {
  CONFIDENCE_MIN: 0.5,
  BALL_IN_PENALTY: { x_min: 0.75, x_max: 1.0, y_min: 0.2, y_max: 0.8 },
  BALL_IN_GOAL_AREA: { x_min: 0.88, x_max: 1.0, y_min: 0.3, y_max: 0.7 },
};

/**
 * Circuit Breaker Pattern — schützt vor API-Überlastung
 */
function checkCircuitBreaker() {
  if (!circuitBreakerState.open) return true;
  
  const timeSinceLastFailure = Date.now() - circuitBreakerState.lastFailTime;
  if (timeSinceLastFailure > CIRCUIT_BREAKER_RESET_MS) {
    console.log('🟢 Circuit Breaker Reset — Retry Roboflow');
    circuitBreakerState = { open: false, failures: 0, lastFailTime: 0 };
    return true;
  }
  return false;
}

function recordFailure() {
  circuitBreakerState.failures++;
  circuitBreakerState.lastFailTime = Date.now();
  if (circuitBreakerState.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitBreakerState.open = true;
    console.warn(`🔴 Circuit Breaker OPEN — ${circuitBreakerState.failures} failures`);
  }
}

/**
 * Roboflow API mit Retry + Timeout
 */
async function callRoboflowWithRetry(base64Frame) {
  if (!checkCircuitBreaker()) {
    console.warn('⚠️ Circuit breaker open, using fallback');
    return null;
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      const response = await fetch(
        `https://api.roboflow.com/api/v1/project/football-tracking/detect?api_key=${ROBOFLOW_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `imageData=${encodeURIComponent(base64Frame)}`,
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 100)}`);
      }

      const data = await response.json();
      circuitBreakerState.failures = 0; // Reset on success
      console.log(`✅ Roboflow API success (attempt ${attempt + 1})`);
      return data;
    } catch (error) {
      const isTimeout = error.name === 'AbortError';
      const backoffMs = RETRY_BACKOFF_MS[attempt] || RETRY_BACKOFF_MS[2];
      
      console.warn(
        `⚠️ Roboflow attempt ${attempt + 1}/${MAX_RETRIES} failed (${isTimeout ? 'timeout' : 'error'}): ${error.message}`
      );

      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, backoffMs));
      } else {
        recordFailure();
        return null; // All retries exhausted
      }
    }
  }

  return null;
}

/**
 * Validiere + normalisiere Detections
 */
function validateAndNormalize(predictions, imageWidth, imageHeight) {
  if (!predictions || !Array.isArray(predictions)) return [];

  return predictions
    .filter(p => p && p.confidence >= THRESHOLDS.CONFIDENCE_MIN)
    .map(pred => ({
      x: Math.round((pred.x / imageWidth) * 100),
      y: Math.round((pred.y / imageHeight) * 100),
      confidence: Math.round(pred.confidence * 100),
      class: pred.class || 'unknown',
      width: pred.width ? Math.round((pred.width / imageWidth) * 100) : 0,
      height: pred.height ? Math.round((pred.height / imageHeight) * 100) : 0,
    }))
    .slice(0, 50); // Safety limit
}

/**
 * Auto-Event Detection mit Confidence-Filtering
 */
function detectAutoEvents(ballPos, playerPositions, minute, elapsedSeconds) {
  const events = [];

  if (!ballPos || ballPos.confidence < THRESHOLDS.CONFIDENCE_MIN * 100) {
    return events;
  }

  // Ball im Strafraum
  if (ballPos.x >= THRESHOLDS.BALL_IN_PENALTY.x_min &&
      ballPos.y >= THRESHOLDS.BALL_IN_PENALTY.y_min &&
      ballPos.y <= THRESHOLDS.BALL_IN_PENALTY.y_max) {
    events.push({
      type: 'ball_in_penalty_area',
      confidence: ballPos.confidence,
      minute,
      elapsed_seconds: elapsedSeconds,
    });
  }

  // Ball im Tor-Bereich
  if (ballPos.x >= THRESHOLDS.BALL_IN_GOAL_AREA.x_min &&
      ballPos.y >= THRESHOLDS.BALL_IN_GOAL_AREA.y_min &&
      ballPos.y <= THRESHOLDS.BALL_IN_GOAL_AREA.y_max) {
    events.push({
      type: 'ball_in_goal_area',
      confidence: Math.min(100, ballPos.confidence * 1.1),
      minute,
      elapsed_seconds: elapsedSeconds,
    });
  }

  return events;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { session_id, frame_base64, frame_number, elapsed_seconds, team } = body;

    if (!session_id || !frame_base64) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Roboflow API Call mit Fallback
    let detections = null;
    let source = 'roboflow';
    let error = null;

    detections = await callRoboflowWithRetry(frame_base64);

    if (!detections) {
      // Fallback: Hole letzten erfolgreichen Frame
      console.warn('📼 Falling back to last successful tracking data');
      try {
        const lastTracking = await base44.entities.TrackingData.list('-timestamp_ms', 1).catch(() => []);
        if (lastTracking?.[0]?.player_positions) {
          detections = {
            predictions: [
              { x: 50, y: 50, confidence: 0.5, class: 'ball' },
              ...lastTracking[0].player_positions.slice(0, 22).map(p => ({
                x: p.x, y: p.y, confidence: p.confidence / 100, class: 'player'
              }))
            ]
          };
          source = 'fallback';
          error = 'Roboflow unavailable, using last frame';
        }
      } catch (_) {
        detections = { predictions: [] };
        error = 'Complete API failure — no tracking data';
      }
    }

    // Parse Detections
    const ballPredictions = detections.predictions.filter(p => p.class === 'ball');
    const playerPredictions = detections.predictions.filter(p => p.class === 'player');

    const ballPos = ballPredictions.length > 0 ? {
      x: Math.round((ballPredictions[0].x / (detections.image?.width || 1920)) * 100),
      y: Math.round((ballPredictions[0].y / (detections.image?.height || 1080)) * 100),
      confidence: Math.round(ballPredictions[0].confidence * 100),
    } : null;

    const playerPositions = validateAndNormalize(
      playerPredictions,
      detections.image?.width || 1920,
      detections.image?.height || 1080
    );

    // Quality Score
    const qualityScore = Math.round(
      (ballPredictions.length > 0 ? 50 : 0) +
      Math.min(50, (playerPredictions.length / 22) * 50)
    );

    // Get Session für Match-ID
    const session = await base44.entities.LiveSession.filter({ id: session_id });
    const sessionData = session[0];
    const minute = sessionData ? Math.floor(elapsed_seconds / 60) : 0;

    // Auto-Events
    const autoEvents = detectAutoEvents(ballPos, playerPositions, minute, elapsed_seconds);

    // Save TrackingData
    const trackingData = await base44.entities.TrackingData.create({
      session_id,
      match_id: sessionData?.match_id,
      frame_number,
      timestamp_ms: Date.now(),
      elapsed_seconds,
      ball_position: ballPos,
      player_positions: playerPositions,
      detection_quality: qualityScore,
      source,
      error: error || null,
      retry_count: 0,
    });

    // Save Auto-Events (nur high-confidence)
    const savedAutoEvents = [];
    for (const evt of autoEvents) {
      if (evt.confidence >= 60) {
        const autoEvent = await base44.entities.AutoEvent.create({
          session_id,
          match_id: sessionData?.match_id,
          tracking_data_id: trackingData.id,
          type: evt.type,
          team: team || 'unknown',
          minute: evt.minute,
          elapsed_seconds: evt.elapsed_seconds,
          confidence: evt.confidence,
          description: `Auto-detected: ${evt.type}`,
          data: { ball: ballPos, players: playerPositions },
          approved_by_trainer: false,
          rejected: false,
          timestamp_ms: Date.now(),
        });
        savedAutoEvents.push(autoEvent);
      }
    }

    const processingTime = Date.now() - startTime;

    return Response.json({
      success: true,
      tracking_data: trackingData.id,
      auto_events: savedAutoEvents.length,
      quality_score: qualityScore,
      ball_detected: ballPos !== null,
      players_detected: playerPositions.length,
      source,
      processing_time_ms: processingTime,
      error: error,
      circuit_breaker_state: circuitBreakerState,
    });
  } catch (error) {
    console.error('❌ processFrame failed:', error);
    return Response.json(
      { error: error.message, circuit_breaker_state: circuitBreakerState },
      { status: 500 }
    );
  }
});