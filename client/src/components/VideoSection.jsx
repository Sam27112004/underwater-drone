import { useState, useRef } from 'react';
import DetectionOverlay from './DetectionOverlay.jsx';
import AIPanel from './AIPanel.jsx';

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

        {/* ── No-signal overlay ──────────────────────────────────────── */}
        <div id="video-overlay" className={`video-overlay ${connected ? 'hidden' : ''}`}>
          <div className="no-signal-text">AWAITING FEED</div>
        </div>

        {/* ── Bounding-box canvas (only when detecting) ──────────────── */}
        {aiActive && (
          <DetectionOverlay detections={detections} containerRef={containerRef} />
        )}

        {/* ── Bottom HUD: video controls + AI panel ──────────────────── */}
        <div className="video-bottom-bar">

          {/* Row 1 — stream controls */}
          <div className="video-controls-panel">
            <div>
              <span className="video-control-label">HOST</span>
              <br />
              <input
                type="text"
                id="video-ip"
                className="mono-input hover-target"
                value={videoIp}
                onChange={e => setVideoIp(e.target.value)}
              />
            </div>
            <div>
              <span className="video-control-label">PORT</span>
              <br />
              <input
                type="text"
                id="video-port"
                className="mono-input hover-target"
                value={videoPort}
                onChange={e => setVideoPort(e.target.value)}
              />
            </div>
            <div>
              <span className="video-control-label">MODE</span>
              <br />
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

            <button
              id="btn-video-connect"
              className={`btn hover-target ${connected ? 'hidden' : ''}`}
              style={{ marginLeft: 'auto' }}
              onClick={() => connectVideo(videoMode, videoIp, videoPort)}
            >
              [ INITIATE ]
            </button>
            <button
              id="btn-video-disconnect"
              className={`btn hover-target ${connected ? '' : 'hidden'}`}
              style={{ marginLeft: 'auto' }}
              onClick={disconnectVideo}
            >
              [ TERMINATE ]
            </button>
            <div
              id="video-info"
              className={connected ? '' : 'hidden'}
              style={{ alignSelf: 'center', marginLeft: '1rem' }}
            >
              <span
                id="video-status"
                style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
              >
                LIVE
              </span>
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
