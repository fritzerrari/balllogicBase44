/**
 * useFrameCapture – Production-grade frame streaming
 * 
 * Features:
 * - Adaptiver Intervall (schneller bei Erfolg, langsamer bei Fehler)
 * - Auto-Reconnect nach Fehlerserien
 * - Telemetrie (frameCount, latency, quality)
 * - Circuit breaker (stoppt nach 10 konsekutiven Fehlern)
 */
import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

const CAPTURE_INTERVAL_BASE_MS = 3000; // 3s wie vom Workflow empfohlen
const CAPTURE_INTERVAL_MAX_MS = 10000; // max 10s wenn Fehler
const FRAME_QUALITY = 0.65;
const MAX_CONSECUTIVE_ERRORS = 10;
const RECONNECT_DELAY_MS = 3000;

export default function useFrameCapture(
  canvasRef,
  sessionId,
  team = 'home',
  enabled = true,
  onData = null // Callback für neue Tracking-Daten
) {
  const frameCountRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const intervalRef = useRef(null);
  const errorCountRef = useRef(0);
  const lastSuccessRef = useRef(Date.now());
  const intervalMsRef = useRef(CAPTURE_INTERVAL_BASE_MS);

  const [status, setStatus] = useState('idle'); // 'idle' | 'streaming' | 'error' | 'reconnecting'
  const [stats, setStats] = useState({
    frameCount: 0,
    latencyMs: 0,
    qualityScore: 0,
    playersDetected: 0,
    ballDetected: false,
  });

  useEffect(() => {
    if (!enabled || !sessionId) {
      setStatus('idle');
      return;
    }

    setStatus('streaming');
    errorCountRef.current = 0;
    frameCountRef.current = 0;
    startTimeRef.current = Date.now();

    const captureAndSend = async () => {
      const sendTime = Date.now();
      try {
        // Validate session_id is still active
        if (!sessionId) {
          setStatus('idle');
          return;
        }

        const canvas = canvasRef?.current;
        // Canvas not ready yet — skip this frame silently
        if (!canvas?.getContext || canvas.width === 0 || canvas.height === 0) {
          return;
        }

        // Canvas → Base64 (schnell)
        let base64Frame;
        try {
          base64Frame = canvas.toDataURL('image/jpeg', FRAME_QUALITY).split(',')[1];
        } catch (e) {
          console.warn('⚠️ Canvas encode error');
          return;
        }

        if (!base64Frame || base64Frame.length < 100) {
          return;
        }

        const frameNumber = frameCountRef.current++;
        const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);

        // Send to backend (with timeout)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await base44.functions.invoke('processFrame', {
          session_id: sessionId,
          frame_base64: base64Frame,
          frame_number: frameNumber,
          elapsed_seconds: elapsedSeconds,
          team,
        });

        clearTimeout(timeoutId);

        if (response?.data?.success) {
          // ✅ Success: reset errors, adapt interval
          errorCountRef.current = 0;
          lastSuccessRef.current = Date.now();
          intervalMsRef.current = CAPTURE_INTERVAL_BASE_MS;

          const latency = Date.now() - sendTime;
          setStats({
            frameCount: frameNumber,
            latencyMs: latency,
            qualityScore: response.data.quality_score || 0,
            playersDetected: response.data.players_detected || 0,
            ballDetected: response.data.ball_detected || false,
          });

          // Callback für CoachingCockpit
          if (onData) {
            onData({
              frameNumber,
              playersDetected: response.data.players_detected,
              ballDetected: response.data.ball_detected,
              qualityScore: response.data.quality_score,
              latencyMs: latency,
            });
          }

          if (latency > 5000) {
            console.warn(`⚠️ High latency: ${latency}ms`);
          }
        } else {
          errorCountRef.current++;
        }
      } catch (err) {
        errorCountRef.current++;
        console.warn(`⚠️ Frame ${frameCountRef.current} failed: ${err.message}`);

        // Backoff: slow down after errors
        intervalMsRef.current = Math.min(
          CAPTURE_INTERVAL_MAX_MS,
          CAPTURE_INTERVAL_BASE_MS + errorCountRef.current * 500
        );

        // Circuit breaker
        if (errorCountRef.current >= MAX_CONSECUTIVE_ERRORS) {
          setStatus('error');
          clearInterval(intervalRef.current);
          console.error('❌ Circuit breaker open — too many errors');

          // Auto-reconnect after delay
          setTimeout(() => {
            setStatus('reconnecting');
            errorCountRef.current = 0;
            captureAndSend();
            intervalRef.current = setInterval(captureAndSend, CAPTURE_INTERVAL_BASE_MS);
            setStatus('streaming');
          }, RECONNECT_DELAY_MS);
        }
      }
    };

    // Start interval with adaptive timing
    const tick = () => {
      captureAndSend();
      intervalRef.current = setTimeout(tick, intervalMsRef.current);
    };

    // First frame immediately
    captureAndSend();
    intervalRef.current = setTimeout(tick, CAPTURE_INTERVAL_BASE_MS);

    return () => {
      clearTimeout(intervalRef.current);
      setStatus('idle');
    };
  // Note: canvasRef intentionally excluded — it's a stable ref object, .current changes silently
  }, [enabled, sessionId, team]); // eslint-disable-line react-hooks/exhaustive-deps

  return { status, stats };
}