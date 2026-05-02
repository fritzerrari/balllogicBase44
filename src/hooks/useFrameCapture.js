/**
 * useFrameCapture – Captured Canvas-Frames alle 2s
 * und sendet sie an processFrame Backend-Funktion mit besserer Fehlerbehandlung
 */
import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

const CAPTURE_INTERVAL_MS = 2000; // Alle 2 Sekunden
const FRAME_QUALITY = 0.6; // JPEG-Qualität
const MAX_RETRY = 2;

export default function useFrameCapture(canvasRef, sessionId, team = 'home', enabled = true) {
  const frameCountRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const intervalRef = useRef(null);
  const [trackingStatus, setTrackingStatus] = useState('idle'); // 'idle' | 'capturing' | 'error'
  const errorCountRef = useRef(0);

  useEffect(() => {
    if (!enabled || !sessionId || !canvasRef?.current) {
      setTrackingStatus('idle');
      return;
    }

    setTrackingStatus('capturing');
    errorCountRef.current = 0;

    const captureFrame = async () => {
      try {
        const canvas = canvasRef?.current;
        if (!canvas || !canvas.getContext || canvas.width === 0 || canvas.height === 0) {
          console.warn('⚠️ Canvas not ready');
          return;
        }

        // Canvas → Base64 JPEG
        let base64Frame;
        try {
          base64Frame = canvas.toDataURL('image/jpeg', FRAME_QUALITY).split(',')[1];
        } catch (corsErr) {
          console.warn('⚠️ Canvas CORS error — skipping frame');
          return;
        }

        if (!base64Frame || base64Frame.length < 100) {
          console.warn('⚠️ Frame data too small or invalid');
          return;
        }

        const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const frameNumber = frameCountRef.current++;

        // Sende zu processFrame mit Retry
        let success = false;
        for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
          try {
            const response = await base44.functions.invoke('processFrame', {
              session_id: sessionId,
              frame_base64: base64Frame,
              frame_number: frameNumber,
              elapsed_seconds: elapsedSeconds,
              team,
            });

            if (response?.data?.success) {
              errorCountRef.current = 0;
              console.log(
                `✓ Frame ${frameNumber} processed — ${response.data.players_detected} players, ` +
                `ball: ${response.data.ball_detected ? '✓' : '✗'}, quality: ${response.data.quality_score}`
              );
              success = true;
              break;
            }
          } catch (err) {
            if (attempt < MAX_RETRY) {
              await new Promise(r => setTimeout(r, 500 * (attempt + 1))); // Backoff
            } else {
              throw err;
            }
          }
        }

        if (!success) {
          errorCountRef.current++;
        }
      } catch (err) {
        errorCountRef.current++;
        console.error(`❌ Frame capture error:`, err.message);

        // Stop tracking nach 5 Fehlern
        if (errorCountRef.current >= 5) {
          setTrackingStatus('error');
          clearInterval(intervalRef.current);
          console.error('❌ Tracking stopped — too many consecutive errors');
        }
      }
    };

    intervalRef.current = setInterval(captureFrame, CAPTURE_INTERVAL_MS);

    // Initial capture after short delay
    const initialCapture = setTimeout(captureFrame, 300);

    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(initialCapture);
      setTrackingStatus('idle');
    };
  }, [enabled, sessionId, team, canvasRef]);

  return { frameCount: frameCountRef.current, trackingStatus };
}