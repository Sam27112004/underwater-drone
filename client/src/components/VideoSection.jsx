import { useState, useRef, useEffect, useCallback } from 'react';
import DetectionOverlay from './DetectionOverlay.jsx';
import AIPanel from './AIPanel.jsx';

// ── WebM duration fix ─────────────────────────────────────────────────────────
// MediaRecorder produces WebM without a Duration field in the Segment Info block.
// This causes media players to show an infinite/unknown duration so the seekbar
// never moves (though playback works fine and the time counter ticks up).
// We patch the raw EBML bytes to inject the Duration element after recording.
function injectWebmDuration(blob, durationMs) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => {
      const buf  = new Uint8Array(reader.result);
      const view = new DataView(buf.buffer);

      // Search for the Segment Info block (EBML ID 0x1549A966)
      for (let i = 0; i < buf.length - 4; i++) {
        if (
          buf[i]   === 0x15 && buf[i+1] === 0x49 &&
          buf[i+2] === 0xA9 && buf[i+3] === 0x66
        ) {
          // Skip ID (4 bytes) + size (variable, read first byte to determine length)
          let sizeLen = 1;
          const sizeFirst = buf[i + 4];
          if      (sizeFirst >= 0x80) sizeLen = 1;
          else if (sizeFirst >= 0x40) sizeLen = 2;
          else if (sizeFirst >= 0x20) sizeLen = 3;
          else                         sizeLen = 4;

          const contentStart = i + 4 + sizeLen;
          const contentEnd   = contentStart + 100; // scan first 100 bytes of Info

          // Look for Duration element (EBML ID 0x4489) within Info
          for (let j = contentStart; j < Math.min(contentEnd, buf.length - 10); j++) {
            if (buf[j] === 0x44 && buf[j+1] === 0x89) {
              // Duration found — it's an EBML float (size byte follows)
              const floatSize = buf[j+2] & 0x7F; // strip vint marker
              if (floatSize === 4) {
                view.setFloat32(j + 3, durationMs, false);
              } else if (floatSize === 8) {
                view.setFloat64(j + 3, durationMs, false);
              }
              resolve(new Blob([buf], { type: blob.type }));
              return;
            }
          }
          break;
        }
      }
      // Duration element not found — return blob unchanged
      resolve(blob);
    };
    reader.readAsArrayBuffer(blob);
  });
}

// ── Preferred MIME type ───────────────────────────────────────────────────────
// MP4/H.264 (Chrome 105+) embeds duration natively → no post-processing needed.
// VP9 WebM is the fallback.
function getBestMime() {
  const candidates = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm',
  ];
  return candidates.find(m => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * VideoSection
 *
 * Props (video):
 *   connectVideo      (mode, ip, port) => void | Promise<void>
 *   disconnectVideo   () => void
 *   videoMode         'mjpeg' | 'webrtc'
 *   setVideoMode      (mode) => void
 *   videoRef          ref for <video>
 *   mjpegRef          ref for <img>
 *   connected         boolean
 *
 * Props (AI):
 *   detections        Detection[]
 *   selectedModelId   string
 *   onModelChange     (id) => void
 *   modelLoading      boolean
 *   modelError        string | null
 *   inferenceFps      number
 *   aiActive          boolean
 *   onToggleAI        () => void
 */
export default function VideoSection({
  connectVideo,
  disconnectVideo,
  videoMode,
  setVideoMode,
  videoRef,
  mjpegRef,
  connected,
  // AI
  detections,
  selectedModelId,
  onModelChange,
  modelLoading,
  modelError,
  inferenceFps,
  aiActive,
  onToggleAI,
}) {
  const [videoIp, setVideoIp]     = useState('192.168.2.2');
  const [videoPort, setVideoPort] = useState('6020');
  const containerRef              = useRef(null);

  // ── Recording ─────────────────────────────────────────────────────────────
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef          = useRef(null);
  const chunksRef                 = useRef([]);
  const recordingRafRef           = useRef(null);
  const recordingStartRef         = useRef(0);
  // A canvas kept in the DOM so captureStream() receives frames reliably.
  const recordingCanvasRef        = useRef(null);

  const stopRecording = useCallback(() => {
    if (recordingRafRef.current) {
      cancelAnimationFrame(recordingRafRef.current);
      recordingRafRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }, []);

  const startRecording = useCallback(() => {
    const mimeType = getBestMime();
    const isWebm   = mimeType.startsWith('video/webm');
    let stream;

    if (videoMode === 'mjpeg') {
      const img    = mjpegRef.current;
      const canvas = recordingCanvasRef.current;
      if (!img || !img.naturalWidth || !canvas) return;

      // Size the in-DOM canvas to the source image
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx     = canvas.getContext('2d', { willReadFrequently: false });

      // captureStream on a DOM-attached canvas is reliable across all browsers
      stream = canvas.captureStream(30);

      const drawFrame = () => {
        // Draw the current MJPEG frame into the canvas every rAF tick.
        // naturalWidth > 0 guards against drawing a broken / not-yet-loaded image.
        if (img.naturalWidth > 0 && img.complete) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
        recordingRafRef.current = requestAnimationFrame(drawFrame);
      };
      recordingRafRef.current = requestAnimationFrame(drawFrame);

    } else {
      // WebRTC: use the live MediaStream directly from the <video> element
      stream = videoRef.current?.srcObject;
      if (!stream) return;
    }

    chunksRef.current    = [];
    recordingStartRef.current = Date.now();

    const mr = new MediaRecorder(stream, { mimeType });

    mr.ondataavailable = e => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = async () => {
      const duration = Date.now() - recordingStartRef.current;
      const ext      = isWebm ? 'webm' : 'mp4';
      let blob       = new Blob(chunksRef.current, { type: mimeType });

      // MP4 (Chrome) includes duration in the moov atom automatically.
      // WebM needs manual EBML patching.
      if (isWebm) blob = await injectWebmDuration(blob, duration);

      downloadBlob(blob, `rov-${Date.now()}.${ext}`);
    };

    mr.start(100);
    mediaRecorderRef.current = mr;
    setRecording(true);
  }, [videoMode, mjpegRef, videoRef]);

  // Stop recording automatically when stream disconnects
  useEffect(() => {
    if (!connected && recording) stopRecording();
  }, [connected, recording, stopRecording]);

  const isMjpeg = videoMode === 'mjpeg';

  return (
    <section className="viewport-section">
      <div className="video-container" ref={containerRef}>

        {/* ── Video elements ─────────────────────────────────────────── */}
        <video
          id="video-player"
          ref={videoRef}
          className={`hover-target ${isMjpeg ? 'hidden' : ''}`}
          autoPlay
          playsInline
          muted
        />
        <img
          id="mjpeg-player"
          ref={mjpegRef}
          className={`hover-target ${isMjpeg ? '' : 'hidden'}`}
          alt=""
        />

        {/* ── Recording canvas (in DOM so captureStream works; visually hidden) */}
        <canvas ref={recordingCanvasRef} className="recording-canvas" />

        {/* ── No-signal overlay ──────────────────────────────────────── */}
        <div id="video-overlay" className={`video-overlay ${connected ? 'hidden' : ''}`}>
          <div className="no-signal-text">AWAITING FEED</div>
        </div>

        {/* ── Bounding-box canvas (only when detecting) ──────────────── */}
        {aiActive && (
          <DetectionOverlay detections={detections} containerRef={containerRef} />
        )}

        {/* ── Bottom HUD ─────────────────────────────────────────────── */}
        <div className="video-bottom-bar">

          {/* Row 1 — stream controls */}
          <div className="video-controls-panel">

            {/* Left: inputs */}
            <div className="video-ctrl-inputs">
              <div className="video-ctrl-field">
                <span className="video-control-label">HOST</span>
                <input
                  type="text"
                  id="video-ip"
                  className="mono-input hover-target"
                  value={videoIp}
                  onChange={e => setVideoIp(e.target.value)}
                />
              </div>
              <div className="video-ctrl-field">
                <span className="video-control-label">PORT</span>
                <input
                  type="text"
                  id="video-port"
                  className="mono-input hover-target"
                  value={videoPort}
                  onChange={e => setVideoPort(e.target.value)}
                />
              </div>
              <div className="video-ctrl-field">
                <span className="video-control-label">MODE</span>
                <select
                  id="video-mode"
                  className="mono-select hover-target"
                  value={videoMode}
                  onChange={e => setVideoMode(e.target.value)}
                >
                  <option value="mjpeg">MJPEG (RTSP)</option>
                  <option value="webrtc">WebRTC</option>
                </select>
              </div>
            </div>

            {/* Right: actions */}
            <div className="video-ctrl-actions">
              <button
                id="btn-video-connect"
                className={`btn video-hud-btn hover-target ${connected ? 'hidden' : ''}`}
                onClick={() => connectVideo(videoMode, videoIp, videoPort)}
              >
                [ INITIATE ]
              </button>
              <button
                id="btn-video-disconnect"
                className={`btn video-hud-btn hover-target ${connected ? '' : 'hidden'}`}
                onClick={disconnectVideo}
              >
                [ TERMINATE ]
              </button>

              {connected && (
                <>
                  <span className="video-live-badge">LIVE</span>
                  <button
                    className={`btn video-hud-btn hover-target record-btn ${recording ? 'record-btn-active' : ''}`}
                    onClick={recording ? stopRecording : startRecording}
                  >
                    {recording ? '[ STOP REC ]' : '[ RECORD ]'}
                  </button>
                </>
              )}
            </div>

          </div>

          {/* Row 2 — AI detection controls */}
          <AIPanel
            selectedModelId={selectedModelId}
            onModelChange={onModelChange}
            isLoading={modelLoading}
            error={modelError}
            fps={inferenceFps}
            active={aiActive}
            onToggle={onToggleAI}
            videoConnected={connected}
          />

        </div>
      </div>
    </section>
  );
}
