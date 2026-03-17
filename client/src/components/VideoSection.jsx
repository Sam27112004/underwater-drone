import { useState } from 'react';

/**
 * VideoSection (UI-only)
 *
 * Props:
 *   connectVideo: (mode, ip, port) => void | Promise<void>
 *   disconnectVideo: () => void
 *   videoMode: 'mjpeg' | 'webrtc'
 *   setVideoMode: (mode) => void
 *   videoRef: React ref for <video>
 *   mjpegRef: React ref for <img>
 *   connected: boolean
 */
export default function VideoSection({
  connectVideo,
  disconnectVideo,
  videoMode,
  setVideoMode,
  videoRef,
  mjpegRef,
  connected,
}) {
  const [videoIp, setVideoIp] = useState('192.168.2.2');
  const [videoPort, setVideoPort] = useState('6020');

  const isMjpeg = videoMode === 'mjpeg';

  return (
    <section className="viewport-section">
      <div className="video-container">
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
          
        />

        <div id="video-overlay" className={`video-overlay ${connected ? 'hidden' : ''}`}>
          <div className="no-signal-text">AWAITING FEED</div>
        </div>

        <div className="video-controls-panel">
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'gray' }}>
              HOST
            </span>
            <br />
            <input
              type="text"
              id="video-ip"
              className="mono-input hover-target"
              value={videoIp}
              onChange={(e) => setVideoIp(e.target.value)}
            />
          </div>

          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'gray' }}>
              PORT
            </span>
            <br />
            <input
              type="text"
              id="video-port"
              className="mono-input hover-target"
              value={videoPort}
              onChange={(e) => setVideoPort(e.target.value)}
            />
          </div>

          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'gray' }}>
              MODE
            </span>
            <br />
            <select
              id="video-mode"
              className="mono-select hover-target"
              value={videoMode}
              onChange={(e) => setVideoMode(e.target.value)}
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
            <span id="stream-name" className="hidden"></span>
          </div>
        </div>
      </div>
    </section>
  );
}
