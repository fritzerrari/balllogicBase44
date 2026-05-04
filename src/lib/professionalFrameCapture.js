/**
 * Professional Frame Capture Engine
 * 
 * Kontinuierliche Video-Verarbeitung mit lokalen Queues:
 * - requestAnimationFrame für echtes 15-30 fps capture
 * - Lokale Queue (max 30 frames)
 * - Intelligente Batch-Uploads (Queue > 5 OR 2s elapsed)
 * - SessionState Real-time Updates
 * - localStorage Fallback bei Offline
 */

export class ProfessionalFrameCapture {
  constructor(options = {}) {
    this.sessionId = options.sessionId;
    this.cameraId = options.cameraId;
    this.onFrameQueued = options.onFrameQueued || (() => {});
    this.onUploadSuccess = options.onUploadSuccess || (() => {});
    this.onUploadError = options.onUploadError || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});

    // Queue management
    this.frameQueue = [];
    this.maxQueueSize = 30;
    this.minBatchSize = 5;
    this.maxWaitMs = 2000; // Max 2s before upload

    // State
    this.isCapturing = false;
    this.isUploading = false;
    this.lastUploadTime = Date.now();
    this.capturedCount = 0;
    this.uploadedCount = 0;
    this.droppedCount = 0;

    // DOM Refs
    this.videoRef = null;
    this.canvasRef = null;

    // Animation frame
    this.rafId = null;

    // Upload timer
    this.uploadTimerId = null;
  }

  /**
   * Start capturing frames from video element
   */
  startCapture(videoRef, canvasRef) {
    if (this.isCapturing) return;

    this.videoRef = videoRef;
    this.canvasRef = canvasRef;
    this.isCapturing = true;
    this.capturedCount = 0;
    this.droppedCount = 0;
    this.frameQueue = [];

    console.log('[ProfessionalFrameCapture] ✅ Starting capture loop');

    // Load any queued frames from localStorage
    this._loadOfflineQueue();

    // Start RAF loop
    this._captureLoop();

    // Start upload timer (check queue every 1s)
    this.uploadTimerId = setInterval(() => {
      const timeSinceUpload = Date.now() - this.lastUploadTime;
      if (
        this.frameQueue.length >= this.minBatchSize ||
        (this.frameQueue.length > 0 && timeSinceUpload > this.maxWaitMs)
      ) {
        this.uploadBatch();
      }
    }, 1000);

    this.onStatusChange('capturing');
  }

  /**
   * Stop capturing
   */
  stopCapture() {
    if (!this.isCapturing) return;

    this.isCapturing = false;

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.uploadTimerId) {
      clearInterval(this.uploadTimerId);
      this.uploadTimerId = null;
    }

    console.log(`[ProfessionalFrameCapture] ⏹️ Stopped. Captured: ${this.capturedCount}, Uploaded: ${this.uploadedCount}, Dropped: ${this.droppedCount}`);

    // Upload remaining frames
    if (this.frameQueue.length > 0) {
      this.uploadBatch();
    }

    this.onStatusChange('stopped');
  }

  /**
   * Main capture loop — called every frame
   */
  _captureLoop() {
    if (!this.isCapturing) return;

    try {
      const video = this.videoRef;
      const canvas = this.canvasRef;

      if (!video || !canvas || video.readyState < 2) {
        // Video not ready yet
        this.rafId = requestAnimationFrame(() => this._captureLoop());
        return;
      }

      // Capture frame to canvas
      const ctx = canvas.getContext('2d');
      canvas.width = 320;
      canvas.height = 180;
      ctx.drawImage(video, 0, 0, 320, 180);

      // Convert to base64
      const base64 = canvas.toDataURL('image/jpeg', 0.6);

      if (base64 && base64.length > 100) {
        this._addFrameToQueue({
          data_base64: base64,
          timestamp_ms: Date.now(),
          elapsed_seconds: 0, // Updated by caller
        });
      }

      this.capturedCount++;
    } catch (err) {
      console.warn('[ProfessionalFrameCapture] Capture error:', err.message);
      this.droppedCount++;
    }

    // Schedule next frame
    this.rafId = requestAnimationFrame(() => this._captureLoop());
  }

  /**
   * Add frame to queue
   */
  _addFrameToQueue(frame) {
    if (this.frameQueue.length >= this.maxQueueSize) {
      // Drop oldest frame (FIFO)
      this.frameQueue.shift();
      this.droppedCount++;
      console.warn('[ProfessionalFrameCapture] Queue full, dropped oldest frame');
    }

    this.frameQueue.push(frame);

    this.onFrameQueued({
      queueSize: this.frameQueue.length,
      capturedCount: this.capturedCount,
      uploadedCount: this.uploadedCount,
      droppedCount: this.droppedCount,
    });
  }

  /**
   * Upload batch of frames
   */
  async uploadBatch() {
    if (this.isUploading || this.frameQueue.length === 0) return;

    this.isUploading = true;

    try {
      const batch = this.frameQueue.splice(0, this.minBatchSize);
      const { base44 } = await import('@/api/base44Client');

      console.log(`[ProfessionalFrameCapture] 📤 Uploading ${batch.length} frames...`);

      const response = await base44.functions.invoke('uploadFrameBatch', {
        session_id: this.sessionId,
        camera_id: this.cameraId,
        frames: batch,
        recovery: false,
        metadata: {
          captured_count: this.capturedCount,
          queue_size_before: batch.length + this.frameQueue.length,
        },
      });

      if (response?.data?.success) {
        this.uploadedCount += batch.length;
        this.lastUploadTime = Date.now();
        console.log(`[ProfessionalFrameCapture] ✅ Uploaded ${batch.length} frames`);
        this.onUploadSuccess({ uploadedCount: batch.length, queueSize: this.frameQueue.length });
      } else {
        throw new Error(response?.data?.error || 'Upload failed');
      }
    } catch (err) {
      console.error('[ProfessionalFrameCapture] Upload error:', err.message);

      // Save to localStorage as fallback
      this._saveOfflineQueue();

      this.onUploadError({
        error: err.message,
        queueSize: this.frameQueue.length,
      });
    } finally {
      this.isUploading = false;
    }
  }

  /**
   * Save queue to localStorage (offline resilience)
   */
  _saveOfflineQueue() {
    if (this.frameQueue.length === 0) return;

    try {
      const key = `offline_frames_${this.sessionId}`;
      const data = {
        sessionId: this.sessionId,
        cameraId: this.cameraId,
        frames: this.frameQueue,
        savedAt: Date.now(),
        count: this.frameQueue.length,
      };
      localStorage.setItem(key, JSON.stringify(data));
      console.log(`[ProfessionalFrameCapture] 💾 Saved ${this.frameQueue.length} frames to localStorage`);
    } catch (err) {
      console.warn('[ProfessionalFrameCapture] localStorage save failed:', err.message);
    }
  }

  /**
   * Load frames from localStorage (offline recovery)
   */
  _loadOfflineQueue() {
    try {
      const key = `offline_frames_${this.sessionId}`;
      const stored = localStorage.getItem(key);

      if (stored) {
        const data = JSON.parse(stored);
        const ageMs = Date.now() - data.savedAt;

        // Only restore frames < 5 minutes old
        if (ageMs < 300000 && data.frames && data.frames.length > 0) {
          this.frameQueue = [...data.frames];
          console.log(`[ProfessionalFrameCapture] 📥 Restored ${data.frames.length} frames from localStorage`);

          // Immediately try to upload
          setTimeout(() => this.uploadBatch(), 500);
        }

        localStorage.removeItem(key);
      }
    } catch (err) {
      console.warn('[ProfessionalFrameCapture] localStorage load failed:', err.message);
    }
  }

  /**
   * Get current stats
   */
  getStats() {
    return {
      isCapturing: this.isCapturing,
      isUploading: this.isUploading,
      queueSize: this.frameQueue.length,
      capturedCount: this.capturedCount,
      uploadedCount: this.uploadedCount,
      droppedCount: this.droppedCount,
      estimatedFps: this.capturedCount > 0 ? 30 : 0, // RAF target
    };
  }
}