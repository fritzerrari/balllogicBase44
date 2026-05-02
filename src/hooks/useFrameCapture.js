/**
 * useFrameCapture – Captured Canvas-Frames alle Xs Sekunden
 * und sendet sie an processFrame Backend-Funktion
 */
import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const CAPTURE_INTERVAL_MS = 2000; // Alle 2 Sekunden (30 FPS simulation)
const FRAME_QUALITY = 0.6; // JPEG-Qualität
const MAX_RETRY = 2;

export default function useFrameCapture(canvasRef, sessionId, team = 'home', enabled = true) {
  const frameCountRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!enabled || !sessionId || !canvasRef?.current) return;

    const captureFrame = async () => {
      const canvas = canvasRef.current;
      if (!canvas || canvas.width === 0) return;

      try {
        // Canvas → Base64 JPEG
        const base64Frame = canvas.toDataURL('image/jpeg', FRAME_QUALITY).split(',')[1];
        const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const frameNumber = frameCountRef.current++;

        // Sende zu processFrame (non-blocking, retry 2x bei Fehler)
        let retryCount = 0;
        const attemptProcess = async () => {
          try {
            await base44.functions.invoke('processFrame', {
              session_id: sessionId,
              frame_base64: base64Frame,
              frame_number: frameNumber,
              elapsed_seconds: elapsedSeconds,
              team,
            });
          } catch (err) {
            if (retryCount < MAX_RETRY) {
              retryCount++;
              setTimeout(attemptProcess, 500); // Retry nach 500ms
            }
            // Stille Fehler akzeptieren (Server kann Bottleneck sein)
          }
        };

        attemptProcess();
      } catch (err) {
        // Canvas-Fehler (z.B. CORS) — ignorieren, nächster Frame folgt
      }
    };

    intervalRef.current = setInterval(captureFrame, CAPTURE_INTERVAL_MS);

    return () => {
      clearInterval(intervalRef.current);
    };
  }, [enabled, sessionId, canvasRef, team]);

  return { frameCount: frameCountRef.current };
}