/**
 * simpleFrameUpload — Ultra-reliable HTTP-basiertes Frame-Streaming
 * 
 * KEIN async nonsense, KEIN WebRTC, nur robustes HTTP POST
 * - Frames alle 30-60s (adaptive)
 * - Direct fetch() zum Backend
 * - localStorage Fallback bei Fehler
 * - Status-Tracking für UI
 */

export class SimpleFrameUpload {
  constructor(videoElement, sessionId, cameraId, onProgress = null) {
    this.videoEl = videoElement;
    this.sessionId = sessionId;
    this.cameraId = cameraId;
    this.onProgress = onProgress;

    this.canvasEl = document.createElement('canvas');
    this.isRunning = false;
    this.pendingFrames = [];
    this.uploadInProgress = false;

    // Stats
    this.stats = {
      capturedCount: 0,
      uploadedCount: 0,
      failedCount: 0,
      lastUploadMs: 0,
      lastUploadSuccess: false,
    };

    // Timing
    this.captureIntervalMs = 35000; // 35s default
    this.uploadIntervalMs = 40000; // 40s
    this.nextCaptureMs = Date.now() + 35000;
    this.captureTimerId = null;
    this.uploadTimerId = null;
    this.lastFrameHash = null;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[SimpleFrameUpload] Started');

    // Recover from localStorage
    this._recoverFrames();

    // Start loops
    this._scheduleNextCapture();
    this._scheduleNextUpload();

    this.onProgress?.({ status: 'started', stats: this.stats });
  }

  stop() {
    this.isRunning = false;
    clearTimeout(this.captureTimerId);
    clearTimeout(this.uploadTimerId);
    console.log('[SimpleFrameUpload] Stopped');
  }

  _scheduleNextCapture() {
    if (!this.isRunning) return;

    const now = Date.now();
    const delay = Math.max(100, this.nextCaptureMs - now);

    this.captureTimerId = setTimeout(() => {
      this._captureFrame();
      this._scheduleNextCapture();
    }, delay);
  }

  _scheduleNextUpload() {
    if (!this.isRunning) return;

    this.uploadTimerId = setTimeout(() => {
      this._uploadBatch();
      this._scheduleNextUpload();
    }, this.uploadIntervalMs);
  }

  _captureFrame() {
    if (!this.videoEl || this.videoEl.readyState < 2) {
      console.warn('[SimpleFrameUpload] Video not ready');
      return;
    }

    try {
      const canvas = this.canvasEl;
      canvas.width = this.videoEl.videoWidth || 1280;
      canvas.height = this.videoEl.videoHeight || 720;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(this.videoEl, 0, 0);

      // Zu JPEG komprimieren
      canvas.toBlob((blob) => {
        if (!blob) return;

        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target.result;

          // Duplikat-Check (einfaches Hash)
          const hash = this._quickHash(base64);
          if (this.lastFrameHash === hash) {
            console.log('[SimpleFrameUpload] Duplicate frame, skipping');
            return;
          }
          this.lastFrameHash = hash;

          // Add to pending
          this.pendingFrames.push({
            timestamp_ms: Date.now(),
            data_base64: base64,
            size_bytes: blob.size,
          });

          this.stats.capturedCount++;
          this.onProgress?.({
            status: 'captured',
            stats: this.stats,
            pending: this.pendingFrames.length,
          });

          console.log(
            `[SimpleFrameUpload] Captured frame ${this.stats.capturedCount} (${blob.size} bytes, pending: ${this.pendingFrames.length})`
          );

          // Auto-upload if 3+ frames
          if (this.pendingFrames.length >= 3) {
            this._uploadBatch();
          }
        };
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.65);

      // Nächste Capture in 35-60s
      this.nextCaptureMs = Date.now() + 35000 + Math.random() * 25000;
    } catch (err) {
      console.error('[SimpleFrameUpload] Capture failed:', err);
    }
  }

  async _uploadBatch() {
    if (!this.isRunning || this.uploadInProgress || this.pendingFrames.length === 0) {
      return;
    }

    this.uploadInProgress = true;
    const batch = this.pendingFrames.splice(0, 5); // Max 5 frames per upload

    try {
      console.log(`[SimpleFrameUpload] Uploading batch of ${batch.length} frames...`);

      const response = await fetch('/api/frames', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: this.sessionId,
          camera_id: this.cameraId,
          frames: batch,
          timestamp: Date.now(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success || data.frames_processed > 0) {
        this.stats.uploadedCount += batch.length;
        this.stats.lastUploadMs = Date.now();
        this.stats.lastUploadSuccess = true;

        console.log(
          `✅ Uploaded ${batch.length} frames (total: ${this.stats.uploadedCount})`
        );

        this.onProgress?.({
          status: 'uploaded',
          stats: this.stats,
          uploadedCount: batch.length,
        });
      } else {
        throw new Error('Server returned success=false');
      }
    } catch (err) {
      console.error('[SimpleFrameUpload] Upload failed:', err);

      // Restore frames
      this.pendingFrames = [...batch, ...this.pendingFrames];
      this.stats.failedCount += batch.length;
      this.stats.lastUploadSuccess = false;

      // Save to localStorage
      this._saveToStorage();

      this.onProgress?.({
        status: 'error',
        stats: this.stats,
        error: err.message,
        pending: this.pendingFrames.length,
      });
    } finally {
      this.uploadInProgress = false;
    }
  }

  _saveToStorage() {
    try {
      const key = `frames_${this.sessionId}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify([...stored, ...this.pendingFrames]));
      console.log(`[SimpleFrameUpload] Saved ${this.pendingFrames.length} frames to localStorage`);
    } catch (e) {
      console.warn('[SimpleFrameUpload] localStorage save failed:', e.message);
    }
  }

  _recoverFrames() {
    try {
      const key = `frames_${this.sessionId}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      if (stored.length > 0) {
        console.log(`[SimpleFrameUpload] Recovered ${stored.length} frames from localStorage`);
        this.pendingFrames = stored;
        localStorage.removeItem(key);
        // Upload immediately
        setTimeout(() => this._uploadBatch(), 500);
      }
    } catch (e) {
      console.warn('[SimpleFrameUpload] Recovery failed:', e.message);
    }
  }

  _quickHash(str) {
    let hash = 0;
    for (let i = 0; i < Math.min(str.length, 100); i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return hash;
  }

  getStats() {
    return {
      ...this.stats,
      pending: this.pendingFrames.length,
    };
  }
}