/**
 * Peripherals (UI-only)
 *
 * Props:
 *   gamepadConnected: boolean
 *   gamepadId: string
 *   gamepadValues: { x, y, z, r }
 *   onAxisPress: (axis, value) => void
 *   onAxisRelease: (axis) => void
 */
export default function Peripherals({
  gamepadConnected,
  gamepadId,
  gamepadValues,
  onAxisPress,
  onAxisRelease,
}) {
  return (
    <div style={{ marginBottom: '5rem' }}>
      <h2 className="section-title">05 // PERIPHERALS</h2>

      <div id="gamepad-status" className={`gamepad-box ${gamepadConnected ? 'connected' : ''}`}>
        <p>GAMEPAD LINK</p>
        <div id="gamepad-text" className="gamepad-text">
          {gamepadConnected ? gamepadId : 'SEARCHING FOR INPUT...'}
        </div>
        <div
          id="gamepad-values"
          className={gamepadConnected ? '' : 'hidden'}
          style={{ marginTop: '10px', display: 'flex', gap: '10px', fontSize: '10px' }}
        >
          <span>X:{gamepadValues?.x ?? 0}</span>
          <span>Y:{gamepadValues?.y ?? 0}</span>
          <span>R:{gamepadValues?.r ?? 0}</span>
          <span>Z:{gamepadValues?.z ?? 0}</span>
        </div>
      </div>

      <div id="manual-controls" style={{ marginTop: '2rem' }}>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'gray',
            marginBottom: '0.5rem',
          }}
        >
          KEYBOARD OVERRIDE
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          <button
            className="btn hover-target"
            data-axis="x"
            data-value="500"
            onMouseDown={() => onAxisPress('x', 500)}
            onMouseUp={() => onAxisRelease('x')}
            onMouseLeave={() => onAxisRelease('x')}
          >
            FWD
          </button>
          <button
            className="btn hover-target"
            data-axis="x"
            data-value="-500"
            onMouseDown={() => onAxisPress('x', -500)}
            onMouseUp={() => onAxisRelease('x')}
            onMouseLeave={() => onAxisRelease('x')}
          >
            BCK
          </button>
          <button
            className="btn hover-target"
            data-axis="y"
            data-value="-500"
            onMouseDown={() => onAxisPress('y', -500)}
            onMouseUp={() => onAxisRelease('y')}
            onMouseLeave={() => onAxisRelease('y')}
          >
            LFT
          </button>
          <button
            className="btn hover-target"
            data-axis="y"
            data-value="500"
            onMouseDown={() => onAxisPress('y', 500)}
            onMouseUp={() => onAxisRelease('y')}
            onMouseLeave={() => onAxisRelease('y')}
          >
            RGT
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '10px' }}>
          <button
            className="btn hover-target"
            data-axis="z"
            data-value="800"
            onMouseDown={() => onAxisPress('z', 800)}
            onMouseUp={() => onAxisRelease('z')}
            onMouseLeave={() => onAxisRelease('z')}
          >
            ASCEND
          </button>
          <button
            className="btn hover-target"
            data-axis="z"
            data-value="200"
            onMouseDown={() => onAxisPress('z', 200)}
            onMouseUp={() => onAxisRelease('z')}
            onMouseLeave={() => onAxisRelease('z')}
          >
            DESCEND
          </button>
        </div>
      </div>

      <div id="emergency-section" style={{ marginTop: '3rem' }}>
        <button
          id="btn-emergency"
          className="btn btn-super danger hover-target"
          style={{ background: '#ff3333', color: '#000' }}
        >
          !! EMERGENCY KILL !!
        </button>
      </div>
    </div>
  );
}
