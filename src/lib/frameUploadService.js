/**
 * frameUploadService — Standalone Frames von Kamera zu Backend
 * 
 * Pipeline:
 * 1. Capture Video-Frame alle 2-3 Sekunden
 * 2. Komprimiere zu JPEG (50KB max)
 * 3. Batch in localStorage (3-5 Frames)
 * 4. Upload zu uploadFrameBatch Endpoint
 * 5. Clear localStorage nach erfolgreichen Upload
 * 
 * OFFLINE-RESILIENT: Bei Fehler → localStorage speichern → Retry bei nächstem Boot
 */

import { base44 } from '@/api/base44Client';

class FrameUploadService {
  constructor(videoElement, sessionId, cameraId, onProgress = null) {
    this.videoEl = videoElement;
    this.sessionId = sessionId;
    this.cameraId = cameraId;
    this.onProgress = onProgress;

    this.canvasEl = document.createElement('canvas');
    this.isRunning = false;
    this.pendingFrames = [];
    this.uploadInProgress = false;
    this.consecutiveErrors = 0;
    this.maxConsecutiveErrors = 5;

    // Timing — ADAPTIVE (intelligent, nicht konstant)
    this.minCaptureIntervalMs = 30000; // Min 30s (bei hoher Aktivität)
    this.maxCaptureIntervalMs = 60000; // Max 60s (bei Ruhe)
    this.currentIntervalMs = 45000; // Start bei 45s
    this.uploadIntervalMs = 45000; // Batch upload alle 45s
    this.captureTimerId = null;
    this.uploadTimerId = null;
    
    // Bewegungs-Tracking
    this.lastFrameHash = null;
    this.movementThreshold = 0.15; // Pixel-Change > 15% = capture sofort

    // Stats
    this.stats = {
      capturedCount: 0,
      uploadedCount: 0,
      failedCount: 0,
      pendingFrames: 0,
    };
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[FrameUploadService] Started for session:', this.sessionId);

    // Recover any pending frames from localStorage
    this._recoverPendingFrames();

    // Start capture loop
    this._startCaptureLoop();

    // Start upload loop
    this._startUploadLoop();

    this.onProgress?.({ status: 'started', stats: this.stats });
  }

  stop() {
    this.isRunning = false;
    clearInterval(this.captureTimerId);
    clearInterval(this.uploadTimerId);
    console.log('[FrameUploadService] Stopped');
  }

  _startCaptureLoop() {
    // Initial capture
    this._captureFrame();
    
    // Adaptive loop — Interval passt sich an Bewegung an
    const loop = () => {
      const delay = Math.max(0, this.currentIntervalMs - Date.now() + (this.lastCaptureTimeMs || Date.now()));
      this.captureTimerId = setTimeout(() => {
        this._captureFrame();
        loop();
      }, Math.min(delay, this.currentIntervalMs));
    };
    loop();
  }

  _captureFrame() {
    if (!this.videoEl || this.videoEl.readyState < 2) {
      return; // Video not ready
    }

    try {
      const canvas = this.canvasEl;
      canvas.width = this.videoEl.videoWidth;
      canvas.height = this.videoEl.videoHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.videoEl, 0, 0);

      // Convert to JPEG (quality 0.65 ≈ 45KB per frame)
      canvas.toBlob(
        (blob) => this._processFrame(blob),
        'image/jpeg',
        0.65
      );
      
      this.lastCaptureTimeMs = Date.now();
    } catch (err) {
      console.warn('[FrameUploadService] Capture error:', err.message);
    }
  }

  _processFrame(blob) {
    // Early exit: Bewegungs-Duplikat-Erkennung (Hashing)
    const pixelData = this._getPixelHash();
    if (this.lastFrameHash && this._hammingDistance(this.lastFrameHash, pixelData) < this.movementThreshold) {
      // Zu wenig Bewegung — Skip diese Frame
      this.stats.droppedCount = (this.stats.droppedCount || 0) + 1;
      
      // Aber: Bei Ruhe → nächste Capture länger warten (Energie sparen)
      this.currentIntervalMs = Math.min(this.currentIntervalMs + 5000, this.maxCaptureIntervalMs);
      this.onProgress?.({ status: 'idle', stats: this.stats });
      return;
    }
    
    // Movement detected → nächste Capture schneller
    this.currentIntervalMs = Math.max(this.currentIntervalMs - 10000, this.minCaptureIntervalMs);
    this.lastFrameHash = pixelData;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target.result; // data:image/jpeg;base64,...

      this.pendingFrames.push({
        timestamp_ms: Date.now(),
        elapsed_seconds: Math.floor((Date.now() - this.startTimeMs) / 1000) || 0,
        data_base64: base64Data,
        size_bytes: blob.size,
      });

      this.stats.capturedCount++;
      this.stats.pendingFrames = this.pendingFrames.length;

      this.onProgress?.({ status: 'capturing', stats: this.stats });

      // Auto-upload if we have 3+ frames
      if (this.pendingFrames.length >= 3) {
        this._uploadBatch();
      }
    };
    reader.readAsDataURL(blob);
  }

  // Einfaches Pixel-Hashing für Bewegungserkennung
  _getPixelHash() {
    const canvas = this.canvasEl;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let hash = 0;
    // Sample every 100th pixel für Performance
    for (let i = 0; i < data.length; i += 400) {
      hash ^= (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    }
    return hash;
  }

  // Hamming Distance für Ähnlichkeit
  _hammingDistance(hash1, hash2) {
    let xor = hash1 ^ hash2;
    let distance = 0;
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
    return distance / 32; // Normalize to 0-1
  }

  _startUploadLoop() {
    this.uploadTimerId = setInterval(() => {
      this._uploadBatch();
    }, this.uploadIntervalMs);
  }

  async _uploadBatch() {
    if (this.uploadInProgress || this.pendingFrames.length === 0) return;
    if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
      console.warn('[FrameUploadService] Too many consecutive errors, giving up');
      return;
    }

    this.uploadInProgress = true;
    const batch = [...this.pendingFrames];
    this.pendingFrames = [];

    try {
      // Invoke backend function
      const response = await base44.functions.invoke('uploadFrameBatch', {
        session_id: this.sessionId,
        camera_id: this.cameraId,
        frames: batch,
        metadata: {
          captured: this.stats.capturedCount,
          uploaded: this.stats.uploadedCount,
          failed: this.stats.failedCount,
        },
      });

      if (response?.data?.success) {
        this.stats.uploadedCount += batch.length;
        this.consecutiveErrors = 0;
        this.onProgress?.({ status: 'uploaded', stats: this.stats, framesCount: batch.length });
        console.log(`✅ Uploaded ${batch.length} frames`);
      } else {
        throw new Error('Upload returned success=false');
      }
    } catch (err) {
      this.consecutiveErrors++;
      this.stats.failedCount += batch.length;
      
      // Restore frames to pending on error (localStorage acts as backup)
      this.pendingFrames = [...batch, ...this.pendingFrames];
      this.stats.pendingFrames = this.pendingFrames.length;

      // Save to localStorage for recovery
      this._savePendingFramesToStorage();

      console.warn(`[FrameUploadService] Upload error (${this.consecutiveErrors}/${this.maxConsecutiveErrors}):`, err.message);
      this.onProgress?.({ status: 'error', stats: this.stats, error: err.message });
    } finally {
      this.uploadInProgress = false;
    }
  }

  _savePendingFramesToStorage() {
    try {
      const key = `frames_${this.sessionId}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify([...stored, ...this.pendingFrames]));
    } catch (e) {
      console.warn('[FrameUploadService] localStorage save failed:', e.message);
    }
  }

  _recoverPendingFrames() {
    try {
      const key = `frames_${this.sessionId}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      if (stored.length > 0) {
        console.log(`[FrameUploadService] Recovered ${stored.length} frames from localStorage`);
        this.pendingFrames = [...stored];
        this.stats.pendingFrames = this.pendingFrames.length;
        // Clear localStorage after recovery
        localStorage.removeItem(key);
        // Attempt immediate upload
        setTimeout(() => this._uploadBatch(), 1000);
      }
    } catch (e) {
      console.warn('[FrameUploadService] Recovery failed:', e.message);
    }
  }

  setStartTime(ms) {
    this.startTimeMs = ms;
  }

  getStats() {
    return { ...this.stats, pendingFrames: this.pendingFrames.length };
  }
}

export default FrameUploadService;