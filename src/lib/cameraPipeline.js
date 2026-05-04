/**
 * cameraPipeline — Ultra-minimal, Rate-Limit-safe Frame Pipeline
 * 
 * KEINE React Query Polling
 * KEINE SessionState Filter-Queries
 * Nur: Capture → Upload → Done
 * 
 * Trainer-Dashboard empfängt via WebSocket Subscription (nicht Polling)
 */
import { base44 } from '@/api/base44Client';

export class CameraPipeline {
  constructor(videoElement, sessionId, cameraId, onProgress = null) {
    this.videoEl = videoElement;
    this.sessionId = sessionId;
    this.cameraId = cameraId;
    this.onProgress = onProgress;

    this.canvasEl = document.createElement('canvas');
    this.isRunning = false;
    this.pendingFrames = [];
    this.lastFrameHash = null;
    this.timerId = null;
    this.uploadRetries = 0;
    this.maxRetries = 3;

    this.stats = {
      capturedCount: 0,
      uploadedCount: 0,
      failedCount: 0,
      lastError: null,
    };
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[CameraPipeline] Started for ${this.cameraId}`);
    
    // Recovery
    this._loadFromStorage();
    
    // Simple interval: capture + upload every 40s
    this.timerId = setInterval(() => {
      if (this.isRunning) {
        this._captureAndUpload();
      }
    }, 40000);

    // Initial capture ASAP
    this._captureAndUpload();
    
    this.onProgress?.({ type: 'started', stats: this.stats });
  }

  stop() {
    this.isRunning = false;
    clearInterval(this.timerId);
  }

  async _captureAndUpload() {
    if (!this.videoEl || this.videoEl.readyState < 2) return;

    try {
      const canvas = this.canvasEl;
      canvas.width = this.videoEl.videoWidth || 1280;
      canvas.height = this.videoEl.videoHeight || 720;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.videoEl, 0, 0);

      canvas.toBlob(async (blob) => {
        if (!blob) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target.result;
          const hash = this._hash(base64);

          // Skip duplicate
          if (this.lastFrameHash === hash) return;
          this.lastFrameHash = hash;

          this.stats.capturedCount++;
          this.onProgress?.({ type: 'captured', stats: this.stats });

          // Upload immediately (don't batch)
          this._upload([{ timestamp_ms: Date.now(), data_base64: base64 }]);
        };
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.6);
    } catch (err) {
      console.error('[CameraPipeline] Capture failed:', err);
    }
  }

  async _upload(frames) {
    if (this.uploadRetries >= this.maxRetries) {
      console.warn('[CameraPipeline] Max retries exceeded, backing off');
      this._saveToStorage(frames);
      return;
    }

    try {
      console.log(`[CameraPipeline] Uploading ${frames.length} frames...`);

      const res = await base44.functions.invoke('uploadFrames', {
        session_id: this.sessionId,
        camera_id: this.cameraId,
        frames,
      });

      if (res?.data?.success || res?.data?.frames_processed) {
        this.stats.uploadedCount += frames.length;
        this.uploadRetries = 0;
        this.stats.lastError = null;
        console.log(`✅ Uploaded ${frames.length} frames`);
        this.onProgress?.({ type: 'uploaded', stats: this.stats });
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      this.uploadRetries++;
      this.stats.lastError = err.message;
      console.warn(`[CameraPipeline] Upload error (retry ${this.uploadRetries}):`, err.message);

      // Retry in 10s
      setTimeout(() => {
        if (this.isRunning) {
          this.uploadRetries = Math.max(0, this.uploadRetries - 1);
          this._upload(frames);
        }
      }, 10000);

      this._saveToStorage(frames);
    }
  }

  _saveToStorage(frames) {
    try {
      const key = `cam_frames_${this.sessionId}`;
      localStorage.setItem(key, JSON.stringify(frames));
    } catch (e) {
      console.warn('[CameraPipeline] Storage failed:', e.message);
    }
  }

  _loadFromStorage() {
    try {
      const key = `cam_frames_${this.sessionId}`;
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      if (data.length > 0) {
        console.log(`[CameraPipeline] Recovered ${data.length} frames from storage`);
        this._upload(data);
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('[CameraPipeline] Load failed:', e.message);
    }
  }

  _hash(str) {
    let h = 0;
    for (let i = 0; i < Math.min(str.length, 50); i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return h;
  }

  getStats() {
    return { ...this.stats };
  }
}