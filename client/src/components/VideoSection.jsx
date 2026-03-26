import { useState, useRef, useEffect, useCallback } from 'react';
import DetectionOverlay from './DetectionOverlay.jsx';
import AIPanel from './AIPanel.jsx';
import GalleryPanel from './GalleryPanel.jsx';

// ── WebM duration fix ─────────────────────────────────────────────────────────
function injectWebmDuration(blob, durationMs) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => {
      const buf  = new Uint8Array(reader.result);
      const view = new DataView(buf.buffer);
      for (let i = 0; i < buf.length - 4; i++) {
        if (buf[i]===0x15 && buf[i+1]===0x49 && buf[i+2]===0xA9 && buf[i+3]===0x66) {
          let sizeLen = 1;
          const sf = buf[i + 4];
          if      (sf >= 0x80) sizeLen = 1;
          else if (sf >= 0x40) sizeLen = 2;
          else if (sf >= 0x20) sizeLen = 3;
          else                  sizeLen = 4;
          const cs = i + 4 + sizeLen;
          for (let j = cs; j < Math.min(cs + 100, buf.length - 10); j++) {
            if (buf[j] === 0x44 && buf[j+1] === 0x89) {
              const fsz = buf[j+2] & 0x7F;
              if (fsz === 4) view.setFloat32(j + 3, durationMs, false);
              else if (fsz === 8) view.setFloat64(j + 3, durationMs, false);
              resolve(new Blob([buf], { type: blob.type }));
              return;
            }
          }
          break;
        }
      }
      resolve(blob);
    };
    reader.readAsArrayBuffer(blob);
  });
}

function getBestMime() {
  const candidates = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  return candidates.find(m => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

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
  // Inspection / tagging
  telemetry,
  onTagFrame,
  activeTab,
  onTabChange,
  // Gallery
  tags,
  onDeleteTag,
}) {
  const [videoIp, setVideoIp]     = useState('192.168.2.2');
  const [videoPort, setVideoPort] = useState('6020');
  const containerRef              = useRef(null);

  // ── Recording ──────────────────────────────────────────────────────────────
  const [recording, setRecording]  = useState(false);
  const mediaRecorderRef           = useRef(null);
  const chunksRef                  = useRef([]);
  const recordingRafRef            = useRef(null);
  const recordingStartRef          = useRef(0);
  const recordingCanvasRef         = useRef(null);

  // ── Tag flash ──────────────────────────────────────────────────────────────
  const [tagFlash, setTagFlash] = useState(false);

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
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: false });
      stream    = canvas.captureStream(30);
      const drawFrame = () => {
        if (img.naturalWidth > 0 && img.complete)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        recordingRafRef.current = requestAnimationFrame(drawFrame);
      };
      recordingRafRef.current = requestAnimationFrame(drawFrame);
    } else {
      stream = videoRef.current?.srcObject;
      if (!stream) return;
    }

    chunksRef.current         = [];
    recordingStartRef.current = Date.now();
    const mr = new MediaRecorder(stream, { mimeType });
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = async () => {
      const duration = Date.now() - recordingStartRef.current;
      const ext      = isWebm ? 'webm' : 'mp4';
      let blob       = new Blob(chunksRef.current, { type: mimeType });
      if (isWebm) blob = await injectWebmDuration(blob, duration);
      downloadBlob(blob, `rov-${Date.now()}.${ext}`);
    };
    mr.start(100);
    mediaRecorderRef.current = mr;
    setRecording(true);
  }, [videoMode, mjpegRef, videoRef]);

  useEffect(() => {
    if (!connected && recording) stopRecording();
  }, [connected, recording, stopRecording]);

  // ── Frame capture + tagging ────────────────────────────────────────────────
  const captureFrame = useCallback(() => {
    const source = videoMode === 'mjpeg' ? mjpegRef.current : videoRef.current;
    if (!source) return null;
    const w = videoMode === 'mjpeg'
      ? (source.naturalWidth  || source.offsetWidth)
      : (source.videoWidth    || source.offsetWidth);
    const h = videoMode === 'mjpeg'
      ? (source.naturalHeight || source.offsetHeight)
      : (source.videoHeight   || source.offsetHeight);
    if (!w || !h) return null;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(source, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.85);
  }, [videoMode, mjpegRef, videoRef]);

  const handleTagFrame = useCallback(() => {
    if (!connected) return;
    const dataUrl = captureFrame();
    if (!dataUrl) return;
    setTagFlash(true);
    setTimeout(() => setTagFlash(false), 500);
    onTagFrame?.(dataUrl);
  }, [connected, captureFrame, onTagFrame]);

  // ── T hotkey ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = e => {
      if ((e.key !== 't' && e.key !== 'T')
        || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      handleTagFrame();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleTagFrame]);

  const isMjpeg = videoMode === 'mjpeg';
  const inFeed  = activeTab === 'feed';

  return (
    <section className="viewport-section">

      {/* ── Tab strip ─────────────────────────────────────────────────────── */}
      <div className="view-tab-strip">
        <button
          className={`view-tab ${inFeed ? 'view-tab-active' : ''}`}
          onClick={() => onTabChange('feed')}
        >LIVE FEED</button>
        <button
          className={`view-tab ${!inFeed ? 'view-tab-active' : ''}`}
          onClick={() => onTabChange('gallery')}
        >GALLERY {tags?.length > 0 && <span className="view-tab-badge">{tags.length}</span>}</button>
      </div>

      <div className="video-container" ref={containerRef}>

        {/*
          Video elements are ALWAYS in the DOM — never unmounted.
          Switching to Gallery overlays on top; the stream stays alive.
        */}
        <video
          id="video-player"
          ref={videoRef}
          className={`hover-target ${isMjpeg ? 'hidden' : ''}`}
          autoPlay playsInline muted
        />
        <img
          id="mjpeg-player"
          ref={mjpegRef}
          className={`hover-target ${isMjpeg ? '' : 'hidden'}`}
          alt=""
        />

        {/* Recording canvas — must stay in DOM for captureStream */}
        <canvas ref={recordingCanvasRef} className="recording-canvas" />

        {/* No-signal overlay — only meaningful in feed tab */}
        <div id="video-overlay" className={`video-overlay ${connected || !inFeed ? 'hidden' : ''}`}>
          <div className="no-signal-text">AWAITING FEED</div>
        </div>

        {/* Tag shutter flash */}
        {tagFlash && <div className="tag-shutter" />}

        {/* Detection canvas */}
        {aiActive && inFeed && (
          <DetectionOverlay detections={detections} containerRef={containerRef} />
        )}

        {/* ── Gallery overlay (z-index above video, below HUD) ────────────── */}
        {!inFeed && (
          <div className="gallery-view">
            <GalleryPanel tags={tags ?? []} onDelete={onDeleteTag} />
          </div>
        )}

        {/* ── Bottom HUD — feed tab only ───────────────────────────────────── */}
        {inFeed && (
          <div className="video-bottom-bar">

            <div className="video-controls-panel">

              {/* Row 1 — inputs */}
              <div className="video-ctrl-inputs">
                <div className="video-ctrl-field">
                  <span className="video-control-label">HOST</span>
                  <input
                    type="text" id="video-ip"
                    className="mono-input hover-target"
                    value={videoIp} onChange={e => setVideoIp(e.target.value)}
                  />
                </div>
                <div className="video-ctrl-field">
                  <span className="video-control-label">PORT</span>
                  <input
                    type="text" id="video-port"
                    className="mono-input hover-target"
                    value={videoPort} onChange={e => setVideoPort(e.target.value)}
                  />
                </div>
                <div className="video-ctrl-field">
                  <span className="video-control-label">MODE</span>
                  <select
                    id="video-mode"
                    className="mono-select hover-target"
                    value={videoMode} onChange={e => setVideoMode(e.target.value)}
                  >
                    <option value="mjpeg">MJPEG (RTSP)</option>
                    <option value="webrtc">WebRTC</option>
                  </select>
                </div>
              </div>

              {/* Row 2 — actions */}
              <div className="video-ctrl-actions">
                <button
                  id="btn-video-connect"
                  className={`btn video-hud-btn hover-target ${connected ? 'hidden' : ''}`}
                  onClick={() => connectVideo(videoMode, videoIp, videoPort)}
                >[ INITIATE ]</button>
                <button
                  id="btn-video-disconnect"
                  className={`btn video-hud-btn hover-target ${connected ? '' : 'hidden'}`}
                  onClick={disconnectVideo}
                >[ TERMINATE ]</button>

                {connected && (
                  <>
                    <span className="video-live-badge">LIVE</span>
                    <button
                      className={`btn video-hud-btn hover-target record-btn ${recording ? 'record-btn-active' : ''}`}
                      onClick={recording ? stopRecording : startRecording}
                    >{recording ? '[ STOP REC ]' : '[ RECORD ]'}</button>
                    <button
                      className="btn video-hud-btn hover-target"
                      onClick={handleTagFrame}
                      title="Tag frame with telemetry + detections (hotkey: T)"
                    >[ TAG ]</button>
                  </>
                )}
              </div>

            </div>

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
        )}

      </div>
    </section>
  );
}
