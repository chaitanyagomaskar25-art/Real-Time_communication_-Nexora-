/**
 * Browser-based Stream Composition & MediaRecorder Utility for WebRTC Mesh
 * Composes video tracks (canvas rendering) and mixes participant audio tracks (Web Audio API)
 */
export class StreamComposer {
  constructor({ width = 1280, height = 720, fps = 30 } = {}) {
    this.width = width;
    this.height = height;
    this.fps = fps;

    this.canvas = null;
    this.ctx = null;
    this.animationFrameId = null;
    this.audioContext = null;
    this.audioDestination = null;
    this.connectedAudioSources = new Map();
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.startTime = null;
    this.timerInterval = null;
    this.duration = 0;
  }

  // Pick best supported MIME type
  static getSupportedMimeType() {
    if (typeof window === 'undefined' || !window.MediaRecorder) {
      return 'video/webm';
    }
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'video/webm';
  }

  // Initialize canvas and audio destination
  setup() {
    if (typeof document === 'undefined') return;

    // 1. Off-screen Canvas for video composition
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d');

    // 2. Web Audio Context for multi-track audio mixing
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      try {
        this.audioContext = new AudioContextClass();
        this.audioDestination = this.audioContext.createMediaStreamDestination();
      } catch (err) {
        console.warn('Could not initialize AudioContext for stream mixing:', err);
      }
    }
  }

  // Mix an audio stream / track into the audio destination
  addAudioStream(stream, id = 'default') {
    if (!this.audioContext || !this.audioDestination || !stream) return;
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    try {
      if (this.connectedAudioSources.has(id)) {
        try {
          this.connectedAudioSources.get(id).disconnect();
        } catch {
          // Safe ignore disconnection error
        }
      }
      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.audioDestination);
      this.connectedAudioSources.set(id, source);
    } catch (err) {
      console.warn(`Failed to connect audio track [${id}]:`, err);
    }
  }

  // Start continuous canvas rendering of meeting layout
  startCanvasLoop({ localStream, remoteStreams = {}, presentationStream = null }) {
    if (!this.ctx || !this.canvas) return;

    const render = () => {
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      // Dark background
      ctx.fillStyle = '#0f172a'; // slate-900
      ctx.fillRect(0, 0, w, h);

      // 1. Presentation / Screen Share prominent layout
      if (presentationStream && presentationStream.active) {
        const videoElement = this.getOrCreateVideoElement('presentation', presentationStream);
        if (videoElement && videoElement.readyState >= 2) {
          ctx.drawImage(videoElement, 0, 0, w, h);
        }

        // Draw small host PiP in top-right
        if (localStream && localStream.active) {
          const pipW = Math.floor(w * 0.2);
          const pipH = Math.floor(h * 0.2);
          const pipX = w - pipW - 16;
          const pipY = 16;

          ctx.fillStyle = '#1e293b';
          ctx.fillRect(pipX, pipY, pipW, pipH);
          const localVideo = this.getOrCreateVideoElement('local', localStream);
          if (localVideo && localVideo.readyState >= 2) {
            ctx.drawImage(localVideo, pipX, pipY, pipW, pipH);
          }
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 2;
          ctx.strokeRect(pipX, pipY, pipW, pipH);
        }
      }
      // 2. Multi-user Participant Grid Layout
      else {
        const streams = [];
        if (localStream) streams.push({ id: 'local', stream: localStream, name: 'Host (You)' });
        Object.entries(remoteStreams).forEach(([id, p]) => {
          if (p.stream) streams.push({ id, stream: p.stream, name: p.userName || 'Participant' });
        });

        const count = streams.length || 1;
        const cols = count === 1 ? 1 : count <= 4 ? 2 : 3;
        const rows = Math.ceil(count / cols);
        const cellW = w / cols;
        const cellH = h / rows;

        streams.forEach((item, index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          const x = col * cellW;
          const y = row * cellH;

          // Cell frame
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(x + 4, y + 4, cellW - 8, cellH - 8);

          // Video frame
          const videoElement = this.getOrCreateVideoElement(item.id, item.stream);
          if (videoElement && videoElement.readyState >= 2) {
            ctx.drawImage(videoElement, x + 4, y + 4, cellW - 8, cellH - 8);
          } else {
            // Placeholder avatar
            ctx.fillStyle = '#334155';
            ctx.fillRect(x + 4, y + 4, cellW - 8, cellH - 8);
            ctx.fillStyle = '#ffffff';
            ctx.font = '24px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(item.name.charAt(0).toUpperCase(), x + cellW / 2, y + cellH / 2);
          }

          // Participant name banner
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(x + 8, y + cellH - 36, Math.min(200, cellW - 16), 28);
          ctx.fillStyle = '#ffffff';
          ctx.font = '14px Inter, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(item.name, x + 16, y + cellH - 18);
        });
      }

      // Watermark & Time indicator
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)'; // Red REC dot
      ctx.beginPath();
      ctx.arc(28, 28, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('REC NEXORA', 44, 33);

      this.animationFrameId = requestAnimationFrame(render);
    };

    render();
  }

  // Create hidden video element to feed the canvas
  getOrCreateVideoElement(id, stream) {
    if (!this._videoCache) this._videoCache = new Map();
    if (!this._videoCache.has(id)) {
      const v = document.createElement('video');
      v.muted = true;
      v.autoplay = true;
      v.playsInline = true;
      v.srcObject = stream;
      v.play().catch(() => {});
      this._videoCache.set(id, v);
      return v;
    }
    const existing = this._videoCache.get(id);
    if (existing.srcObject !== stream) {
      existing.srcObject = stream;
      existing.play().catch(() => {});
    }
    return existing;
  }

  // Start recording the composite stream
  start({ localStream, remoteStreams = {}, presentationStream = null }) {
    this.setup();
    this.recordedChunks = [];
    this.duration = 0;
    this.startTime = Date.now();

    // Start video canvas rendering
    this.startCanvasLoop({ localStream, remoteStreams, presentationStream });

    // Mix all available audio tracks
    if (localStream) this.addAudioStream(localStream, 'local');
    if (presentationStream) this.addAudioStream(presentationStream, 'presentation');
    Object.entries(remoteStreams).forEach(([id, p]) => {
      if (p.stream) this.addAudioStream(p.stream, id);
    });

    // Generate composite MediaStream
    let compositeStream;
    try {
      compositeStream = this.canvas.captureStream(this.fps);
      if (this.audioDestination && this.audioDestination.stream.getAudioTracks().length > 0) {
        compositeStream.addTrack(this.audioDestination.stream.getAudioTracks()[0]);
      }
    } catch (err) {
      console.warn('Canvas captureStream failed, using local stream fallback:', err);
      compositeStream = presentationStream || localStream;
    }

    const mimeType = StreamComposer.getSupportedMimeType();
    const recorderOptions = {};
    if (mimeType) recorderOptions.mimeType = mimeType;

    try {
      this.mediaRecorder = new MediaRecorder(compositeStream, {
        ...recorderOptions,
        videoBitsPerSecond: 2500000 // 2.5 Mbps crisp video
      });
    } catch {
      this.mediaRecorder = new MediaRecorder(compositeStream, recorderOptions);
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    // Collect data every 1000ms
    this.mediaRecorder.start(1000);

    // Duration timer
    this.timerInterval = setInterval(() => {
      this.duration = Math.round((Date.now() - this.startTime) / 1000);
    }, 1000);

    return {
      status: 'recording',
      mimeType,
      startTime: this.startTime
    };
  }

  // Stop recording and compile final Blob
  stop() {
    return new Promise((resolve, reject) => {
      const mimeType = StreamComposer.getSupportedMimeType() || 'video/webm';

      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        return resolve({ blob: new Blob(this.recordedChunks, { type: mimeType }), duration: this.duration });
      }

      this.mediaRecorder.onstop = () => {
        try {
          const actualMime = this.mediaRecorder?.mimeType || mimeType;
          const blob = new Blob(this.recordedChunks, { type: actualMime });
          this.cleanup();
          resolve({ blob, duration: this.duration, mimeType: actualMime });
        } catch (err) {
          this.cleanup();
          reject(err);
        }
      };

      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.requestData();
        }
      } catch {
        // Safe ignore
      }

      try {
        this.mediaRecorder.stop();
      } catch (err) {
        this.cleanup();
        reject(err);
      }
    });
  }

  // Cleanup resources
  cleanup() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

    if (this._videoCache) {
      this._videoCache.forEach((v) => {
        v.srcObject = null;
        v.remove();
      });
      this._videoCache.clear();
    }

    if (this.audioContext) {
      const ctx = this.audioContext;
      this.audioContext = null;
      try {
        if (ctx.state !== 'closed') {
          ctx.close().catch(() => {});
        }
      } catch {
        // Safe ignore close error
      }
    }
  }
}
