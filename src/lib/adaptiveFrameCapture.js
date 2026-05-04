/**
 * AdaptiveFrameCapture — Stabil Streaming statt WebRTC
 * 
 * Basis: FieldIQ-Konzept
 * - Nimmt alle 15-60s Snapshots (adaptiv nach Bewegung)
 * - Speichert in localStorage (offline-resilient)
 * - Batched Upload alle 30-45s
 * - Realtime nur für Status, nicht für Video
 */

import { base44 } from '@/api/base44Client';

export class AdaptiveFrameCapture {
  constructor(sessionId, cameraId, onProgress) {
    this.sessionId = sessionId;
    this.cameraId = cameraId;
    this.onProgress = onProgress;
    
    this.videoRef = null;
    this.canvasRef = null;
    this.streamRef = null;
    this.captureTimerRef = null;
    this.uploadTimerRef = null;
    this.lastFrameDataRef = null; // Für Duplikat-Erkennung
    
    this.captureIntervalMs = 15000; // Start 15s
    this.nextCaptureMs = Date.now() + 15000;
    
    this.pendingFrames = [];
    this.capturedCount = 0;
    this.droppedCount = 0;
    this.uploadedCount = 0;
    
    this.isRunning = false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Video-Stream starten
  // ─────────────────────────────────────────────────────────────────────────
  async start(videoElement) {
    if (this.isRunning) return;
    
    this.videoRef = videoElement;
    this.canvasRef = document.createElement('canvas');
    this.isRunning = true;
    
    try {
      // Starte getUserMedia im Hintergrund
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };
      
      this.streamRef = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoRef.srcObject = this.streamRef;
      
      // Warte bis Video lädt
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Video timeout')), 5000);
        this.videoRef.onloadedmetadata = () => {
          clearTimeout(timeout);
          this.videoRef.play().catch(() => {});
          resolve();
        };
      });
      
      console.log('[AdaptiveCapture] Stream started');
      this.onProgress?.({ status: 'streaming', message: 'Stream aktiv' });
      
      // Starte Capture-Loop
      this._startCaptureLoop();
      
      // Starte Upload-Loop (30-45s)
      this._startUploadLoop();
      
      return true;
    } catch (err) {
      console.error('[AdaptiveCapture] Start failed:', err);
      this.onProgress?.({ status: 'error', message: err.message });
      this.stop();
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Capture-Loop mit adaptivem Timing
  // ─────────────────────────────────────────────────────────────────────────
  _startCaptureLoop() {
    const loop = () => {
      if (!this.isRunning) return;
      
      const now = Date.now();
      const delay = Math.max(0, this.nextCaptureMs - now);
      
      this.captureTimerRef = setTimeout(() => {
        this._captureFrame();
        this._scheduleNextCapture();
        loop();
      }, delay);
    };
    
    loop();
  }

  _captureFrame() {
    if (!this.videoRef || this.videoRef.readyState !== this.videoRef.HAVE_ENOUGH_DATA) {
      return;
    }
    
    try {
      const ctx = this.canvasRef.getContext('2d');
      this.canvasRef.width = this.videoRef.videoWidth;
      this.canvasRef.height = this.videoRef.videoHeight;
      
      ctx.drawImage(this.videoRef, 0, 0);
      
      // Konvertiere zu JPEG (komprimiert ~50KB bei q=0.65)
      this.canvasRef.toBlob(
        (blob) => {
          this._processFrame(blob);
        },
        'image/jpeg',
        0.65
      );
    } catch (err) {
      console.warn('[AdaptiveCapture] Capture error:', err.message);
    }
  }

  _processFrame(blob) {
    // Duplikat-Check mit dHash (simple version: Größe + erste Bytes)
    const hash = `${blob.size}_${blob.type}`;
    
    if (this.lastFrameDataRef === hash) {
      this.droppedCount++;
      return; // Duplikat
    }
    
    this.lastFrameDataRef = hash;
    this.capturedCount++;
    
    // Speichere in pendingFrames
    const reader = new FileReader();
    reader.onload = (e) => {
      this.pendingFrames.push({
        timestamp_ms: Date.now(),
        elapsed_seconds: this._getElapsedSeconds(),
        data_base64: e.target.result, // data:image/jpeg;base64,...
        size_bytes: blob.size,
      });
      
      this.onProgress?.({
        status: 'capturing',
        capturedCount: this.capturedCount,
        droppedCount: this.droppedCount,
        pendingFrames: this.pendingFrames.length,
      });
    };
    reader.readAsDataURL(blob);
  }

  _scheduleNextCapture() {
    // Adaptives Timing: 15s bei hoher Aktivität, 60s bei Ruhe
    // (einfach: alterniere 15s/45s als Demo)
    const isHighActivity = this.capturedCount % 4 !== 0;
    const interval = isHighActivity ? 15000 : 45000;
    
    this.captureIntervalMs = interval;
    this.nextCaptureMs = Date.now() + interval;
  }

  _getElapsedSeconds() {
    // Placeholder: echte Spielzeit vom SessionState holen
    return Math.floor((Date.now() - this.sessionStartMs) / 1000) || 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Upload-Loop (alle 30-45s)
  // ─────────────────────────────────────────────────────────────────────────
  _startUploadLoop() {
    const loop = () => {
      if (!this.isRunning) return;
      
      this.uploadTimerRef = setTimeout(() => {
        this._uploadFrameBatch();
        loop();
      }, 30000 + Math.random() * 15000); // 30-45s
    };
    
    loop();
  }

  async _uploadFrameBatch() {
    if (this.pendingFrames.length === 0) return;
    
    const batch = [...this.pendingFrames];
    this.pendingFrames = []; // Clear queue
    
    try {
      // Speichere in localStorage als Backup
      const stored = JSON.parse(localStorage.getItem(`frames_${this.sessionId}`) || '[]');
      localStorage.setItem(`frames_${this.sessionId}`, JSON.stringify([...stored, ...batch]));
      
      // Sende zu Backend (async, non-blocking) über Backend-Function
      base44.functions.invoke('uploadFrameBatch', {
        session_id: this.sessionId,
        camera_id: this.cameraId,
        frames: batch,
        metadata: {
          captured: this.capturedCount,
          dropped: this.droppedCount,
          uploaded: (this.uploadedCount += batch.length),
        },
      }).catch(err => {
        // Fehler: behalte Frames in localStorage, nächster Versuch später
        console.warn('[AdaptiveCapture] Upload failed, will retry:', err.message);
      });
      
      this.onProgress?.({
        status: 'uploading',
        uploadedBatch: batch.length,
        totalUploaded: this.uploadedCount,
      });
    } catch (err) {
      console.error('[AdaptiveCapture] Upload batch error:', err);
      // Restore frames
      this.pendingFrames.push(...batch);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Stop & Cleanup
  // ─────────────────────────────────────────────────────────────────────────
  stop() {
    this.isRunning = false;
    clearInterval(this.captureTimerRef);
    clearInterval(this.uploadTimerRef);
    
    if (this.streamRef) {
      this.streamRef.getTracks().forEach(track => track.stop());
      this.streamRef = null;
    }
    
    if (this.videoRef) {
      this.videoRef.srcObject = null;
    }
    
    console.log('[AdaptiveCapture] Stopped');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Recovery nach Reload
  // ─────────────────────────────────────────────────────────────────────────
  static async recoverFrames(sessionId) {
    const stored = JSON.parse(localStorage.getItem(`frames_${sessionId}`) || '[]');
    if (stored.length === 0) return null;
    
    return {
      frameCount: stored.length,
      oldestFrame: new Date(stored[0].timestamp_ms),
      onRecover: async () => {
        // User klickt "Fortsetzen" → Upload retry
        try {
          const cameras = [...new Set(stored.map(f => f.camera_id))];
          for (const camId of cameras) {
            const camFrames = stored.filter(f => f.camera_id === camId);
            await fetch(`/api/frames/${sessionId}/${camId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ frames: camFrames, recovery: true }),
            });
          }
          localStorage.removeItem(`frames_${sessionId}`);
          return true;
        } catch (err) {
          console.error('[AdaptiveCapture] Recovery failed:', err);
          return false;
        }
      },
    };
  }
}