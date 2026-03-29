import { useState, useRef, useEffect } from 'react';

const PALETTE = [
  '#ff4500','#00ff66','#ffcc00','#00aaff','#ff00cc',
  '#00ffff','#ff6600','#aa00ff','#ffff00','#00ff99',
  '#ff0066','#33ccff','#ff9900','#66ff00','#cc00ff',
  '#0099ff','#ff3300','#00ffcc','#9966ff','#ff6699',
];
const colorFor = id => PALETTE[(id ?? 0) % PALETTE.length];

const MODE_NAMES = {
  9: 'MANUAL', 0: 'STABILIZE', 2: 'DEPTH_LOCK',
  7: 'POS_HOLD', 6: 'SURFACE', 19: 'MANUAL',
};

function DetailView({ tag, onBack, onDelete }) {
  const canvasRef = useRef(null);
  const t = tag.telemetry ?? {};

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new window.Image();
    img.src = `/api/tags/${tag.id}/image`;
    img.onload = () => {
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      ctx.font = '11px "JetBrains Mono", monospace';
      for (const det of (tag.detections ?? [])) {
        const x1 = det.x1 * img.naturalWidth;
        const y1 = det.y1 * img.naturalHeight;
        const bw  = (det.x2 - det.x1) * img.naturalWidth;
        const bh  = (det.y2 - det.y1) * img.naturalHeight;
        if (bw <= 0 || bh <= 0) continue;

        const color = colorFor(det.classId);
        ctx.strokeStyle = color;
        ctx.lineWidth   = 2;
        ctx.strokeRect(x1, y1, bw, bh);

        // Corner marks
        const cs = Math.min(bw, bh) * 0.18;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x1, y1 + cs);        ctx.lineTo(x1, y1);        ctx.lineTo(x1 + cs, y1);
        ctx.moveTo(x1+bw-cs, y1);       ctx.lineTo(x1+bw, y1);     ctx.lineTo(x1+bw, y1+cs);
        ctx.moveTo(x1+bw, y1+bh-cs);    ctx.lineTo(x1+bw, y1+bh);  ctx.lineTo(x1+bw-cs, y1+bh);
        ctx.moveTo(x1+cs, y1+bh);       ctx.lineTo(x1, y1+bh);     ctx.lineTo(x1, y1+bh-cs);
        ctx.stroke();

        // Label
        const label = `${(det.label ?? '').toUpperCase()} ${(det.score * 100).toFixed(0)}%`;
        const tw    = ctx.measureText(label).width;
        const ph = 15, pad = 4;
        const lx = x1;
        const ly = y1 > ph + 4 ? y1 - ph - 2 : y1 + 2;
        ctx.fillStyle = color;
        ctx.fillRect(lx, ly, tw + pad * 2, ph);
        ctx.fillStyle = '#000';
        ctx.fillText(label, lx + pad, ly + ph - 3);
      }
    };
  }, [tag]);

  return (
    <div className="gallery-detail">
      <div className="gallery-detail-header">
        <button className="btn video-hud-btn hover-target" onClick={onBack}>
          ← BACK
        </button>
        <span className="gallery-detail-ts">
          {new Date(tag.timestamp).toLocaleString()}
        </span>
        <button
          className="btn video-hud-btn hover-target"
          style={{ color: 'var(--danger)' }}
          onClick={() => { onDelete(tag.id); onBack(); }}
        >
          [ DELETE ]
        </button>
      </div>

      <div className="gallery-detail-body">
        <div className="gallery-canvas-wrap">
          <canvas ref={canvasRef} className="gallery-canvas" />
        </div>

        <div className="gallery-detail-meta">
          <div className="gallery-meta-section">TELEMETRY</div>
          {[
            ['ROLL',    `${(t.roll  ?? 0).toFixed(1)}°`],
            ['PITCH',   `${(t.pitch ?? 0).toFixed(1)}°`],
            ['YAW',     `${(t.yaw   ?? 0).toFixed(1)}°`],
            ['DEPTH',   `${(t.depth ?? 0).toFixed(2)} m`],
            ['BATTERY', `${t.batteryPct ?? '—'}%`],
            ['MODE',    MODE_NAMES[t.currentMode] ?? t.currentMode ?? '—'],
          ].map(([k, v]) => (
            <div key={k} className="gallery-meta-row">
              <span>{k}</span><span>{v}</span>
            </div>
          ))}
          <div className="gallery-meta-row">
            <span>ARMED</span>
            <span style={{ color: t.armed ? 'var(--danger)' : 'var(--success)' }}>
              {t.armed ? 'YES' : 'NO'}
            </span>
          </div>

          {(tag.detections ?? []).length > 0 && (
            <>
              <div className="gallery-meta-section" style={{ marginTop: '1rem' }}>
                DETECTIONS ({tag.detections.length})
              </div>
              {tag.detections.map((d, i) => (
                <div key={i} className="gallery-meta-row">
                  <span style={{ color: colorFor(d.classId) }}>
                    {(d.label ?? '').toUpperCase()}
                  </span>
                  <span>{(d.score * 100).toFixed(0)}%</span>
                </div>
              ))}
            </>
          )}

          {!(tag.detections ?? []).length && (
            <div className="gallery-meta-row" style={{ color: '#444', marginTop: '0.5rem' }}>
              <span>NO DETECTIONS</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * GalleryPanel
 *
 * Props:
 *   tags       Array of tag objects (id, filename, timestamp, telemetry, detections)
 *   onDelete   (id) => void
 */
export default function GalleryPanel({ tags, onDelete }) {
  const [selected, setSelected] = useState(null);

  // If selected tag was deleted, clear selection
  useEffect(() => {
    if (selected && !tags.find(t => t.id === selected.id)) {
      setSelected(null);
    }
  }, [tags, selected]);

  if (selected) {
    return (
      <DetailView
        tag={selected}
        onBack={() => setSelected(null)}
        onDelete={onDelete}
      />
    );
  }

  return (
    <div className="gallery-grid-wrap">
      {tags.length === 0 ? (
        <div className="no-signal-text">NO TAGGED FRAMES — PRESS T OR [ TAG ]</div>
      ) : (
        <>
          <div className="gallery-header-bar">
            <span className="gallery-header-count">
              {tags.length} frame{tags.length !== 1 ? 's' : ''}
            </span>
            <span className="gallery-header-hint">click to inspect</span>
          </div>
          <div className="gallery-grid">
            {[...tags].reverse().map(tag => (
              <div
                key={tag.id}
                className="gallery-thumb hover-target"
                onClick={() => setSelected(tag)}
              >
                <img
                  src={`/api/tags/${tag.id}/image`}
                  alt=""
                  className="gallery-thumb-img"
                  loading="lazy"
                />
                {(tag.detections?.length ?? 0) > 0 && (
                  <span className="gallery-det-badge">{tag.detections.length}</span>
                )}
                <div className="gallery-thumb-time">
                  {new Date(tag.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
