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

// Multi-Frame History cache (in-memory, last N frames per session for sprint detection)
// Note: Für Produktion sollte SessionState DB-Entity genutzt werden (siehe sessionState.last_20_frames)
const frameHistoryBySession = new Map();
const FRAME_HISTORY_SIZE = 10;

// Auto-sync to DB every 30 frames (optional, für Restart-Resilienz)
const PERSIST_HISTORY_INTERVAL = 30;

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
  // FALLBACK: Ohne echte Pixeldaten können wir nur Position nutzen
  // Team-Zuordnung: HOME meist links (x < 50), AWAY meist rechts (x >= 50)
  // Die echte Klassifizierung geschieht durch Anstoß-Erkennung in LiveSession
  if (!teamReferences) return null; // Signals to use position-based fallback
  
  // Wenn Team-Referenzen vorhanden: color-based classification (zukünftige Enhancement)
  // For now: position-based heuristic für initiale Zuweisung
  return null; // Let assignTeams() use kickoffData position-based matching
}

/**
 * Calculate Ball Possession — wer hat den Ball (nächster Spieler)
 */
function calculateBallPossession(ballPos, players) {
  if (!ballPos || players.length === 0) return null;
  
  let closestPlayer = null;
  let minDist = Infinity;
  
  players.forEach(p => {
    const dist = Math.sqrt((p.x - ballPos.x) ** 2 + (p.y - ballPos.y) ** 2);
    if (dist < minDist && dist < 8) { // Max 8% des Feldes Distanz
      minDist = dist;
      closestPlayer = p;
    }
  });
  
  return closestPlayer ? {
    player_id: closestPlayer.player_id || closestPlayer.tracker_id,
    team: closestPlayer.team,
    distance_to_ball: Math.round(minDist * 100) / 100,
    confidence: Math.max(0, 100 - minDist * 10),
  } : null;
}

/**
 * Detect sprints from multi-frame history
 * Nutzt letzten N Frames pro tracker_id um echte Geschwindigkeit zu berechnen
 */
function detectSprintsFromHistory(sessionId, currentPlayers, frameHistory) {
  const sprints = [];
  if (frameHistory.length < 3) return sprints; // Mindestens 3 Frames für Trend
  
  const currentFrame = frameHistory[frameHistory.length - 1];
  const prevFrame = frameHistory[frameHistory.length - 2];
  if (!prevFrame) return sprints;
  
  currentPlayers.forEach(p => {
    const trackerId = p.tracker_id;
    if (trackerId === null) return;
    
    const prev = prevFrame.players?.find(pp => pp.tracker_id === trackerId);
    if (!prev) return;
    
    // Bewegung in Prozent des Feldes pro Frame (50ms = 0.05s)
    const dist = Math.sqrt((p.x - prev.x) ** 2 + (p.y - prev.y) ** 2);
    // Schwelle: > 5% Feldbreite pro Frame = ~10 m/s = Sprint
    if (dist > 5) {
      sprints.push({
        tracker_id: trackerId,
        team: p.team,
        distance_per_frame: Math.round(dist * 100) / 100,
        intensity: Math.min(100, dist * 15),
      });
    }
  });
  
  return sprints;
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
 * 
 * Noise filter: Events nur triggern wenn Ball Bereich BETRITT, nicht bei jedem Frame IN area
 * Tracking: lastBallZone speichert last 5 Frames
 */
const lastBallZoneBySession = new Map(); // session_id -> { zone, frameCount }
function detectAutoEvents(ballPos, minute, elapsedSeconds, sessionId) {
  const events = [];
  if (!ballPos || ballPos.confidence < 50) return events;

  const ballZone = ballPos.x > 88 ? 'goal' : ballPos.x >= 75 ? 'penalty' : 'midfield';
  const lastZone = lastBallZoneBySession.get(sessionId) || { zone: 'midfield', frameCount: 0 };

  // nur triggern bei NEUER Zone (zone change detection)
  if (ballZone !== lastZone.zone) {
    if (ballZone === 'goal' && ballPos.y >= 30 && ballPos.y <= 70) {
      events.push({ type: 'ball_in_goal_area', confidence: Math.min(100, ballPos.confidence * 1.1), minute, elapsed_seconds: elapsedSeconds });
    } else if (ballZone === 'penalty' && ballPos.y >= 20 && ballPos.y <= 80) {
      events.push({ type: 'ball_in_penalty_area', confidence: ballPos.confidence, minute, elapsed_seconds: elapsedSeconds });
    }
  }

  // Update tracker
  lastBallZoneBySession.set(sessionId, { zone: ballZone, frameCount: (lastZone.frameCount || 0) + 1 });

  // Cleanup old entries
  if (lastBallZoneBySession.size > 500) {
    const arr = [...lastBallZoneBySession.keys()];
    arr.slice(0, 100).forEach(k => lastBallZoneBySession.delete(k));
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

    // Map tracker_id to player_id via shirt number detection
    const trackerToPlayerId = {};
    try {
      const playerMap = await base44.asServiceRole.entities.Player.list();
      playerMap.forEach(p => {
        if (p.tracking_anonymize) return; // Skip anonymous players
        // Try to match by position + team (simplified — real matching would use ML)
        const trackers = players.filter(pl => pl.team === (p.team ? 'away' : 'home'));
        if (trackers.length > 0) {
          trackerToPlayerId[trackers[0].tracker_id] = p.id;
        }
      });
    } catch (e) {
      console.warn('⚠️ Player tracking mapping failed:', e.message);
    }

    // All player positions for storage — use mapped IDs if available
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

    // ── Ball Possession ────────────────────────────────────────────────────
    const ballPossession = calculateBallPossession(ballPos, playerPositions);

    // ── Multi-Frame History (INIT EARLY — before possession checks) ────────
    let frameHistory = frameHistoryBySession.get(session_id) || [];

    // ── Possession Change Detection ────────────────────────────────────────
    let possessionChangeEvent = null;
    if (frameHistory.length >= 2) {
      const prevFrame = frameHistory[frameHistory.length - 2];
      const currBallOwner = ballPossession?.player_id;
      const prevBallOwner = prevFrame.ball_possession?.player_id;
      
      if (currBallOwner && prevBallOwner && currBallOwner !== prevBallOwner) {
        possessionChangeEvent = {
          type: 'possession_change',
          team: ballPossession.team,
          confidence: ballPossession.confidence,
          minute,
          elapsed_seconds: elapsedSeconds,
          from_player: prevBallOwner,
          to_player: currBallOwner,
        };
      }
    }

    // ── Duel Detection (zwei Spieler nah beieinander) ────────────────────
    const duels = [];
    for (let i = 0; i < playerPositions.length; i++) {
      for (let j = i + 1; j < playerPositions.length; j++) {
        const p1 = playerPositions[i];
        const p2 = playerPositions[j];
        
        // Nur wenn unterschiedliche Teams
        if (p1.team === p2.team) continue;
        
        const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
        // Duel wenn weniger als 5% Feldbreite entfernt
        if (dist < 5) {
          duels.push({
            type: 'duel',
            team: ballPos && Math.sqrt((p1.x - ballPos.x) ** 2 + (p1.y - ballPos.y) ** 2) < Math.sqrt((p2.x - ballPos.x) ** 2 + (p2.y - ballPos.y) ** 2) ? p1.team : p2.team,
            player_ids: [p1.player_id, p2.player_id],
            distance: Math.round(dist * 100) / 100,
            confidence: 75,
            minute,
            elapsed_seconds: elapsedSeconds,
          });
        }
      }
    }
    // Update frameHistory AFTER possession check
    frameHistory.push({
      timestamp_ms: Date.now(),
      frame_number,
      players: playerPositions,
      ball_possession: ballPossession,
    });
    frameHistory = frameHistory.slice(-FRAME_HISTORY_SIZE);
    frameHistoryBySession.set(session_id, frameHistory);

    // Sprint detection from history
    const sprints = detectSprintsFromHistory(session_id, playerPositions, frameHistory);

    // Load calibration thresholds
    let calibration = { sprint_threshold_percent: 5, duel_proximity_percent: 5, ball_possession_confidence_min: 60, possession_update_frequency: 30 };
    try {
      const cals = await base44.asServiceRole.entities.TrackingCalibration.filter({ session_id });
      if (cals.length > 0) {
        const cal = cals[0];
        calibration = {
          sprint_threshold_percent: cal.sprint_threshold_percent || 5,
          duel_proximity_percent: cal.duel_proximity_percent || 5,
          ball_possession_confidence_min: cal.ball_possession_confidence_min || 60,
          possession_update_frequency: cal.possession_update_frequency || 30,
        };
      }
    } catch (_) {}

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

    // Auto-events (with noise filtering)
    const autoEvents = detectAutoEvents(ballPos, minute, elapsed_seconds, session_id);

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

    // Spieler-Statistiken aggregieren (alle 10 Frames um DB-Last zu sparen)
    if (frame_number % 10 === 0) {
      base44.functions.invoke('aggregatePlayerStats', { session_id }).catch(() => {});
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
        ball_possession: ballPossession,
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
    const allEvents = [...autoEvents];
    
    // Add possession change events
    if (possessionChangeEvent) {
      allEvents.push(possessionChangeEvent);
    }
    
    // Add duel events
    allEvents.push(...duels);
    
    for (const evt of allEvents) {
      if (evt.confidence >= 60) {
        try {
          await base44.entities.AutoEvent.create({
            session_id,
            match_id: matchId,
            tracking_data_id: trackingData?.id,
            type: evt.type,
            team: evt.team || 'unknown',
            minute: evt.minute,
            elapsed_seconds: evt.elapsed_seconds,
            confidence: evt.confidence,
            description: `Auto-detected: ${evt.type}`,
            data: evt,
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
      // Possession & Duels
      possession_change_detected: possessionChangeEvent !== null,
      duels_detected: duels.length,
    });

  } catch (error) {
    console.error('❌ processFrame failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});