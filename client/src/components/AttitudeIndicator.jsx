import { useEffect, useRef } from 'react';

/**
 * AttitudeIndicator (canvas-based)
 *
 * Props:
 *   attitude: { roll, pitch, yaw } | null
 */
export default function AttitudeIndicator({ attitude }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const roll = attitude ? attitude.roll : 0;
    const pitch = attitude ? attitude.pitch : 0;
    const yaw = attitude ? attitude.yaw : 0;
    drawAttitudeIndicatorAbyss(roll, pitch, yaw);
  }, [attitude]);

  function drawAttitudeIndicatorAbyss(roll, pitch, yaw) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((-roll * Math.PI) / 180);

    // Pitch Offset
    const pitchOffset = (pitch / 90) * (height / 2);

    // Sky (Pitch Black to Deep Blue)
    const skyGrad = ctx.createLinearGradient(0, -height, 0, 0);
    skyGrad.addColorStop(0, '#02050a');
    skyGrad.addColorStop(1, '#0a101a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-width, -height, width * 2, height + pitchOffset);

    // Ground (Dark Grid/Abyss)
    const groundGrad = ctx.createLinearGradient(0, pitchOffset, 0, height);
    groundGrad.addColorStop(0, '#110500');
    groundGrad.addColorStop(1, '#050200');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(-width, pitchOffset, width * 2, height);

    // Bright Orange Horizon Line
    ctx.strokeStyle = '#ff4500';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-width, pitchOffset);
    ctx.lineTo(width, pitchOffset);
    ctx.stroke();

    // Pitch ladder markings
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    for (let i = -60; i <= 60; i += 10) {
      if (i === 0) continue;
      const pY = pitchOffset + (i / 90) * (height / 2);
      ctx.beginPath();
      const lW = i % 20 === 0 ? 60 : 30;
      ctx.moveTo(-lW, pY);
      ctx.lineTo(lW, pY);
      ctx.stroke();

      if (i % 20 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '10px JetBrains Mono';
        ctx.fillText(Math.abs(i), lW + 5, pY + 3);
        ctx.fillText(Math.abs(i), -lW - 15, pY + 3);
      }
    }

    ctx.restore();

    // Static Aircraft symbol (White/Orange mix)
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Left wing
    ctx.moveTo(centerX - 80, centerY);
    ctx.lineTo(centerX - 25, centerY);
    ctx.lineTo(centerX - 25, centerY + 15);
    // Right wing
    ctx.moveTo(centerX + 80, centerY);
    ctx.lineTo(centerX + 25, centerY);
    ctx.lineTo(centerX + 25, centerY + 15);
    // Center dot
    ctx.stroke();

    ctx.fillStyle = '#ff4500';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
    ctx.fill();

    void yaw;
  }

  const rollText = attitude ? `${attitude.roll.toFixed(1)}°` : '--°';
  const pitchText = attitude ? `${attitude.pitch.toFixed(1)}°` : '--°';
  const yawText = attitude ? `${attitude.yaw.toFixed(0)}°` : '--°';

  return (
    <div>
      <h2 className="section-title">04 // KINEMATICS</h2>

      <div className="attitude-wrap">
        <canvas id="attitude-canvas" ref={canvasRef} width="600" height="300" />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '1rem',
          fontFamily: 'var(--font-mono)',
          fontSize: '14px',
        }}
      >
        <div>
          R: <span id="attitude-roll">{rollText}</span>
        </div>
        <div>
          P: <span id="attitude-pitch">{pitchText}</span>
        </div>
        <div>
          Y: <span id="attitude-yaw" style={{ color: 'var(--accent)' }}>{yawText}</span>
        </div>
        <div className="hidden" id="attitude-heading" />
      </div>
    </div>
  );
}
