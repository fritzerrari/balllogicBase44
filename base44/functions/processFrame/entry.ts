/**
 * processFrame — Roboflow Workflow Integration
 * 
 * Workflow: Football Tracking Phase 1
 * Workflow-ID: football-tracking-phase-1-1777785537057
 * 
 * Pipeline:
 *  1. Send frame to Roboflow Workflow (Object Detection + ByteTracker + Keypoints)
 *  2. Parse predictions (person, ball, goal) + tracker_ids
 *  3. Team classification via dominant color comparison against reference images
 *  4. Auto-event detection (ball in penalty/goal area)
 *  5. Save TrackingData + AutoEvents to DB
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ROBOFLOW_API_KEY = Deno.env.get('ROBOFLOW_API_KEY');
const WORKFLOW_URL = 'https://serverless.roboflow.com/fritzs-workspace-fieldiq/workflows/football-tracking-phase-1-1777785537057';

const API_TIMEOUT_MS = 35000; // Roboflow Serverless cold-start kann bis zu 30s dauern
const MAX_RETRIES = 2;
const CONFIDENCE_MIN = 0.4;

// Circuit breaker per session
const circuitBreakerBySession = new Map();
const CIRCUIT_BREAKER_THRESHOLD = 8;
const CIRCUIT_BREAKER_RESET_MS = 30000;

function getCB(sessionId) {
  if (!circuitBreakerBySession.has(sessionId)) {
    circuitBreakerBySession.set(sessionId, { open: false, failures: 0, lastFailTime: 0 });
  }
  if (circuitBreakerBySession.size > 100) {
    const now = Date.now();
    for (const [id, s] of circuitBreakerBySession) {
      if (now - s.lastFailTime > 600000) circuitBreakerBySession.delete(id);
    }
  }
  return circuitBreakerBySession.get(sessionId);
}

function checkCB(sessionId) {
  const s = getCB(sessionId);
  if (!s.open) return true;
  if (Date.now() - s.lastFailTime > CIRCUIT_BREAKER_RESET_MS) {
    s.open = false; s.failures = 0;
    return true;
  }
  return false;
}

function recordFailure(sessionId) {
  const s = getCB(sessionId);
  s.failures++;
  s.lastFailTime = Date.now();
  if (s.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    s.open = true;
    console.warn(`🔴 Circuit Breaker OPEN [${sessionId}]`);
  }
}

/**
 * Call Roboflow Workflow API
 */
async function callRoboflowWorkflow(base64Frame, sessionId, url = WORKFLOW_URL) {
  if (!checkCB(sessionId)) {
    console.warn(`⚠️ Circuit breaker open [${sessionId}]`);
    return null;
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: ROBOFLOW_API_KEY,
          inputs: {
            image: {
              type: 'base64',
              value: base64Frame,
            },
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 200)}`);
      }

      const data = await response.json();
      getCB(sessionId).failures = 0;
      console.log(`✅ Roboflow Workflow success [${sessionId}] attempt ${attempt + 1}`);
      return data;
    } catch (err) {
      console.warn(`⚠️ Roboflow attempt ${attempt + 1}/${MAX_RETRIES}: ${err.message}`);
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
      } else {
        recordFailure(sessionId);
        return null;
      }
    }
  }
  return null;
}

/**
 * Parse Roboflow Workflow response
 * 
 * Roboflow Serverless Workflow response structure:
 * { "outputs": [ { "<block_name>": { "predictions": [...], "image": { "width": ..., "height": ... } } } ] }
 * 
 * Block names vary by workflow config — we search all output blocks.
 */
function parseWorkflowResponse(data) {
  // Log raw structure for debugging
  if (data) console.log('🔍 Roboflow response structure:', JSON.stringify(data).slice(0, 500));

  let predictions = [];
  let fieldKeypoints = [];
  let imageWidth = 1920;
  let imageHeight = 1080;

  // Roboflow Serverless Workflows: outputs is an array of output objects
  if (Array.isArray(data?.outputs)) {
    for (const outputBlock of data.outputs) {
      for (const blockValue of Object.values(outputBlock)) {
        if (blockValue?.predictions && Array.isArray(blockValue.predictions)) {
          predictions = blockValue.predictions;
        }
        if (blockValue?.image?.width) imageWidth = blockValue.image.width;
        if (blockValue?.image?.height) imageHeight = blockValue.image.height;
        if (blockValue?.keypoints) fieldKeypoints = blockValue.keypoints;
      }
    }
  }

  // Fallback: flat structure (older Roboflow API / direct inference)
  if (predictions.length === 0) {
    predictions = data?.predictions || data?.output?.predictions || [];
    if (data?.image?.width) imageWidth = data.image.width;
    if (data?.image?.height) imageHeight = data.image.height;
  }

  console.log(`📊 Parsed: ${predictions.length} predictions, ${imageWidth}x${imageHeight}`);

  return { predictions, fieldKeypoints, imageWidth, imageHeight };
}

/**
 * Parse predictions into players, balls, goals
 */
function parsePredictions(predictions, imageWidth, imageHeight) {
  const players = [];
  const balls = [];
  const goals = [];

  if (!Array.isArray(predictions)) return { players, balls, goals };

  predictions.forEach(det => {
    const confidence = det.confidence || 0;
    if (confidence < CONFIDENCE_MIN) return;

    const cls = (det.class || det.class_name || '').toLowerCase();
    const trackId = det.tracker_id ?? det.track_id ?? null;

    // Normalize coordinates to 0-100
    let x, y, w, h;
    if (det.bbox) {
      // bbox format: { x, y, width, height } (center coords)
      x = Math.round((det.bbox.x / imageWidth) * 100);
      y = Math.round((det.bbox.y / imageHeight) * 100);
      w = Math.round((det.bbox.width / imageWidth) * 100);
      h = Math.round((det.bbox.height / imageHeight) * 100);
    } else {
      x = Math.round(((det.x || 0) / imageWidth) * 100);
      y = Math.round(((det.y || 0) / imageHeight) * 100);
      w = Math.round(((det.width || 0) / imageWidth) * 100);
      h = Math.round(((det.height || 0) / imageHeight) * 100);
    }

    const entry = { x, y, width: w, height: h, confidence: Math.round(confidence * 100), tracker_id: trackId };

    if (cls === 'person' || cls === 'player' || cls === 'goalkeeper') {
      players.push({ ...entry, class: 'person', rawClass: cls });
    } else if (cls === 'ball' || cls === 'football') {
      balls.push({ ...entry, class: 'ball' });
    } else if (cls === 'goal' || cls === 'goalpost') {
      goals.push({ ...entry, class: 'goal' });
    }
  });

  return { players, balls, goals };
}

/**
 * Team classification via dominant color comparison
 * Compares a player's crop color against stored reference colors
 */
function rgbDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function classifyPlayerTeam(playerX, playerY, playerW, playerH, teamReferences) {
  // Without actual pixel data here, we use tracker_id parity as fallback
  // Real color classification happens when reference colors are stored in AppSettings
  if (!teamReferences || !teamReferences.team_a_color) return 'home';

  // teamReferences: { team_a_color: {r,g,b}, team_b_color: {r,g,b}, referee_color: {r,g,b} }
  // Without canvas pixel access in Deno, we return 'home'/'away' based on tracker_id
  // Full color classification would require passing cropped pixel data from frontend
  return null; // signals to use tracker_id fallback
}

/**
 * Assign teams to players
 * Priorität:
 * 1. Farbbasierte Klassifizierung (wenn Team-Referenzen vorhanden)
 * 2. Position relative zu Anstoß-Kalibrierung (wenn verfügbar)
 * 3. Fallback: tracker_id Parität
 */
function assignTeams(players, teamReferences, kickoffData) {
  return players.map(p => {
    // 1. Farbbasiert
    const classified = classifyPlayerTeam(p.x, p.y, p.width, p.height, teamReferences);
    if (classified) return { ...p, team: classified };

    // 2. Position relativ zu Anstoß-Kalibrierung
    if (kickoffData?.home_positions && kickoffData?.away_positions) {
      const distToHome = kickoffData.home_positions.reduce(
        (min, ref) => Math.min(min, Math.sqrt((p.x - ref.x) ** 2 + (p.y - ref.y) ** 2)),
        Infinity
      );
      const distToAway = kickoffData.away_positions.reduce(
        (min, ref) => Math.min(min, Math.sqrt((p.x - ref.x) ** 2 + (p.y - ref.y) ** 2)),
        Infinity
      );
      if (distToHome < distToAway) return { ...p, team: 'home' };
      if (distToAway < distToHome) return { ...p, team: 'away' };
    }

    // 3. Fallback: tracker_id Parität
    if (p.tracker_id !== null && p.tracker_id !== undefined) {
      return { ...p, team: p.tracker_id % 2 === 0 ? 'home' : 'away' };
    }

    return { ...p, team: 'home' };
  });
}

/**
 * Build tracking status for frontend badge
 */
function getTrackingStatus(players, balls) {
  const hasPlayers = players.length > 0;
  const hasBall = balls.length > 0;

  const teamA = players.filter(p => p.team === 'home').length;
  const teamB = players.filter(p => p.team === 'away').length;
  const referee = players.filter(p => p.team === 'referee').length;

  return {
    status: (hasPlayers && hasBall) ? 'active' : hasPlayers ? 'partial' : 'inactive',
    playerCount: players.length,
    ballDetected: hasBall,
    teams: { teamA, teamB, referee },
  };
}

/**
 * Detect sprints — Geschwindigkeitsspitzen
 * Nutzt tracker_id & Position um Bewegungsgeschwindigkeit zu berechnen
 * (echte Multi-Frame-Analyse würde in separater Funktion laufen, hier nur Stub)
 */
function detectSprints(players, prevPlayerMap = null) {
  const sprints = [];
  if (!prevPlayerMap) return sprints; // Erste Frame = keine History

  players.forEach(p => {
    if (p.tracker_id === null) return;
    const prev = prevPlayerMap.get(p.tracker_id);
    if (!prev) return;

    const dist = Math.sqrt((p.x - prev.x) ** 2 + (p.y - prev.y) ** 2);
    // Schwelle: Bewegung > 8% des Feldes pro Frame = Sprint (kann kalibriert werden)
    if (dist > 8) {
      sprints.push({ tracker_id: p.tracker_id, team: p.team, intensity: Math.min(100, dist * 10) });
    }
  });

  return sprints;
}

/**
 * Auto-event detection from ball position
 */
function detectAutoEvents(ballPos, minute, elapsedSeconds) {
  const events = [];
  if (!ballPos || ballPos.confidence < 50) return events;

  // Ball in penalty area (right side: x > 75, y between 20-80)
  if (ballPos.x >= 75 && ballPos.y >= 20 && ballPos.y <= 80) {
    events.push({ type: 'ball_in_penalty_area', confidence: ballPos.confidence, minute, elapsed_seconds: elapsedSeconds });
  }
  // Ball in goal area (right side: x > 88, y between 30-70)
  if (ballPos.x >= 88 && ballPos.y >= 30 && ballPos.y <= 70) {
    events.push({ type: 'ball_in_goal_area', confidence: Math.min(100, ballPos.confidence * 1.1), minute, elapsed_seconds: elapsedSeconds });
  }

  return events;
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const startTime = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { session_id, frame_base64, frame_number = 0, elapsed_seconds = 0 } = body;

    if (!session_id || !frame_base64) {
      return Response.json({ error: 'Missing session_id or frame_base64' }, { status: 400 });
    }

    // Load settings from AppSettings (workflow ID + team references)
    let teamReferences = null;
    let workflowUrl = WORKFLOW_URL;
    let kickoffData = null;
    try {
      const settings = await base44.asServiceRole.entities.AppSetting.list();
      const wfSetting = settings?.find(s => s.key === 'roboflow_workflow_id');
      if (wfSetting?.value) {
        const val = wfSetting.value.trim();
        if (val.startsWith('http')) {
          workflowUrl = val;
        } else {
          workflowUrl = `https://serverless.roboflow.com/fritzs-workspace-fieldiq/workflows/${val}`;
        }
      }
      const teamSetting = settings?.find(s => s.key === 'team_references');
      if (teamSetting?.value) teamReferences = JSON.parse(teamSetting.value);
    } catch (_) { /* use defaults */ }

    // Load kickoff calibration data (falls verfügbar)
    try {
      const sessions = await base44.asServiceRole.entities.LiveSession.filter({ id: session_id });
      if (sessions?.[0]?.kickoff_detected && sessions[0]?.home_team_positions) {
        kickoffData = {
          home_positions: sessions[0].home_team_positions,
          away_positions: sessions[0].away_team_positions,
        };
      }
    } catch (_) { /* Fallback zu anderen Methoden */ }

    // ── Call Roboflow Workflow ──────────────────────────────────────────────
    let workflowResult = null;
    let source = 'roboflow';
    let detectionError = null;

    workflowResult = await callRoboflowWorkflow(frame_base64, session_id, workflowUrl);

    if (!workflowResult) {
      console.warn('📼 Roboflow Workflow unavailable — saving empty frame');
      source = 'manual';
      detectionError = 'Roboflow unavailable';
    }

    // ── Parse Response ─────────────────────────────────────────────────────
    const { predictions, fieldKeypoints, imageWidth, imageHeight } = workflowResult
      ? parseWorkflowResponse(workflowResult)
      : { predictions: [], fieldKeypoints: [], imageWidth: 1920, imageHeight: 1080 };

    const { players: rawPlayers, balls, goals } = parsePredictions(predictions, imageWidth, imageHeight);

    // Assign teams
    const players = assignTeams(rawPlayers, teamReferences, kickoffData);

    // Ball position (best confidence)
    const ballPos = balls.length > 0
      ? balls.sort((a, b) => b.confidence - a.confidence)[0]
      : null;

    // Persist tracker_id → player_id mappings
    let playerTrackingResult = null;
    try {
      playerTrackingResult = await base44.functions.invoke('persistPlayerTracking', {
        session_id,
        tracking_data: players,
      });
    } catch (e) {
      console.warn('⚠️ persistPlayerTracking failed:', e.message);
    }

    // All player positions for storage — use mapped IDs if available
    const trackerToPlayerId = playerTrackingResult?.mappings || {};
    const playerPositions = players.map(p => {
      const trackerId = p.tracker_id;
      let playerId = trackerId ? `t${trackerId}` : `p${p.x}_${p.y}`;
      
      // Use real player_id if mapped
      if (trackerId && trackerToPlayerId[trackerId]) {
        playerId = trackerToPlayerId[trackerId];
      }
      
      return {
        player_id: playerId,
        team: p.team,
        x: p.x,
        y: p.y,
        confidence: p.confidence,
        tracker_id: p.tracker_id,
      };
    });

    // Quality score
    const qualityScore = Math.round(
      (ballPos ? 50 : 0) + Math.min(50, (players.length / 22) * 50)
    );

    // Tracking status for frontend
    const trackingStatus = getTrackingStatus(players, balls);

    // Get session match_id
    let matchId = null;
    try {
      const sessions = await base44.entities.LiveSession.filter({ id: session_id });
      matchId = sessions?.[0]?.match_id || null;
    } catch (_) {}

    const minute = Math.floor(elapsed_seconds / 60);

    // Auto-events
    const autoEvents = detectAutoEvents(ballPos, minute, elapsed_seconds);

    // Sprints erkennen (benötigt History — hier nur Stub)
    const sprints = detectSprints(players);

    // Formation erkennen (live, alle 30 Frames)
    let formationChange = null;
    if (frame_number % 30 === 0) {
      try {
        formationChange = await base44.functions.invoke('detectFormation', {
          players,
          session_id,
          frame_number,
        });
      } catch (_) {}
    }

    // ── Save TrackingData ──────────────────────────────────────────────────
    let trackingData = null;
    try {
      trackingData = await base44.entities.TrackingData.create({
        session_id,
        match_id: matchId,
        frame_number,
        timestamp_ms: Date.now(),
        elapsed_seconds,
        ball_position: ballPos,
        player_positions: playerPositions,
        detection_quality: qualityScore,
        source,
        error: detectionError,
        retry_count: 0,
      });
    } catch (dbErr) {
      console.error('❌ Failed to save TrackingData:', dbErr.message);
      return Response.json({ error: `DB write failed: ${dbErr.message}` }, { status: 500 });
    }

    // ── Save Auto-Events ───────────────────────────────────────────────────
    const savedAutoEvents = [];
    for (const evt of autoEvents) {
      if (evt.confidence >= 60) {
        try {
          await base44.entities.AutoEvent.create({
            session_id,
            match_id: matchId,
            tracking_data_id: trackingData?.id,
            type: evt.type,
            team: 'unknown',
            minute: evt.minute,
            elapsed_seconds: evt.elapsed_seconds,
            confidence: evt.confidence,
            description: `Auto-detected: ${evt.type}`,
            data: { ball: ballPos, players: playerPositions },
            approved_by_trainer: false,
            rejected: false,
            timestamp_ms: Date.now(),
          });
          savedAutoEvents.push(evt.type);
        } catch (e) {
          console.warn(`⚠️ Auto-event save failed: ${e.message}`);
        }
      }
    }

    return Response.json({
      success: true,
      tracking_data_id: trackingData?.id,
      // Tracking status for frontend badge
      tracking_status: trackingStatus,
      // Counts
      players_detected: players.length,
      ball_detected: ballPos !== null,
      goals_detected: goals.length,
      auto_events: savedAutoEvents.length,
      sprints_detected: sprints.length,
      // Quality
      quality_score: qualityScore,
      source,
      processing_time_ms: Date.now() - startTime,
      error: detectionError,
      // Formation
      formation_change: formationChange,
      // Field calibration status
      field_calibrated: fieldKeypoints.length >= 4,
      field_keypoints_count: fieldKeypoints.length,
    });

  } catch (error) {
    console.error('❌ processFrame failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});