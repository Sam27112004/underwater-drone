import { useEffect, useRef } from 'react';

// One distinct color per class slot (cycles if > 20 classes)
const PALETTE = [
  '#ff4500', '#00ff66', '#ffcc00', '#00aaff', '#ff00cc',
  '#00ffff', '#ff6600', '#aa00ff', '#ffff00', '#00ff99',
  '#ff0066', '#33ccff', '#ff9900', '#66ff00', '#cc00ff',
  '#0099ff', '#ff3300', '#00ffcc', '#9966ff', '#ff6699',
];

function colorFor(classId) {
  return PALETTE[classId % PALETTE.length];
}

/**
 * DetectionOverlay
 *
 * Renders bounding boxes onto a <canvas> absolutely positioned over the
 * video container.  Scales box coords (normalised 0-1) to container px.
 *
 * Props:
 *   detections   Array<{x1,y1,x2,y2,label,score,classId}>  (normalised 0-1)
 *   containerRef ref to the .video-container div
 */
export default function DetectionOverlay({ detections, containerRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef?.current;
    if (!canvas || !container) return;

    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    // Resize canvas to match container every draw (handles window resize cheaply)
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width  = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    if (!detections?.length) return;

    ctx.font = '11px "JetBrains Mono", monospace';

    for (const det of detections) {
      const x1 = det.x1 * width;
      const y1 = det.y1 * height;
      const bw  = (det.x2 - det.x1) * width;
      const bh  = (det.y2 - det.y1) * height;

      if (bw <= 0 || bh <= 0) continue;

      const color = colorFor(det.classId);

      // Box
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.5;
      ctx.strokeRect(x1, y1, bw, bh);

      // Corner accent marks (QGC-style targeting reticle)
      const cs = Math.min(bw, bh) * 0.18; // corner size
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      // top-left
      ctx.moveTo(x1, y1 + cs); ctx.lineTo(x1, y1); ctx.lineTo(x1 + cs, y1);
      // top-right
      ctx.moveTo(x1+bw-cs, y1); ctx.lineTo(x1+bw, y1); ctx.lineTo(x1+bw, y1+cs);
      // bottom-right
      ctx.moveTo(x1+bw, y1+bh-cs); ctx.lineTo(x1+bw, y1+bh); ctx.lineTo(x1+bw-cs, y1+bh);
      // bottom-left
      ctx.moveTo(x1+cs, y1+bh); ctx.lineTo(x1, y1+bh); ctx.lineTo(x1, y1+bh-cs);
      ctx.stroke();

      // Label pill
      const label   = `${det.label.toUpperCase()} ${(det.score * 100).toFixed(0)}%`;
      const tw      = ctx.measureText(label).width;
      const ph      = 15, pad = 5;
      const lx      = x1;
      const ly      = y1 > ph + 4 ? y1 - ph - 2 : y1 + 2;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect?.(lx, ly, tw + pad * 2, ph, 2) ??
        ctx.rect(lx, ly, tw + pad * 2, ph);
      ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.fillText(label, lx + pad, ly + ph - 3);
    }
  }, [detections, containerRef]);

  return (
    <canvas
      ref={canvasRef}
      className="detection-overlay"
    />
  );
}
