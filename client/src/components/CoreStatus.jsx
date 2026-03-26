import { modeDescriptions } from '../hooks/useTelemetry.js';

export default function CoreStatus({ armed, currentMode, onArm, onDisarm, onModeChange, lightsOn, onToggleLights }) {
  const modeValue = Number.isFinite(currentMode) ? currentMode : 9;
  const description = modeDescriptions[modeValue] ?? modeDescriptions[9];

  return (
    <div>
      <h2 className="section-title">01 // CORE STATUS</h2>

      <button
        className={`btn btn-super success hover-target ${armed ? 'hidden' : ''}`}
        onClick={onArm}
      >
        INITIALIZE THRUSTERS
      </button>

      <button
        className={`btn btn-super danger hover-target ${armed ? '' : 'hidden'}`}
        onClick={onDisarm}
      >
        SUSPEND OPERATIONS
      </button>

      <div className={`core-warning ${armed ? '' : 'hidden'}`}>
        {'>> CAUTION: VEHICLE IS ARMED AND ACTIVE'}
      </div>

      <div className="core-mode-block">
        <p className="mono-label">FLIGHT MODE DIRECTIVE</p>

        <select
          className="custom-select hover-target"
          value={String(modeValue)}
          onChange={(e) => onModeChange(parseInt(e.target.value, 10))}
        >
          <option value="9">MANUAL_OVERRIDE</option>
          <option value="0">STABILIZE_CORE</option>
          <option value="2">DEPTH_LOCK</option>
          <option value="7">POSITION_HOLD</option>
          <option value="6">SURFACE_RETURN</option>
        </select>

        <p className="mode-description">{description}</p>
      </div>

      {/* ── Lights ── */}
      <div className="lights-block">
        <p className="mono-label">ILLUMINATION</p>
        <button
          className={`btn btn-super hover-target lights-btn ${lightsOn ? 'lights-on' : ''}`}
          onClick={onToggleLights}
        >
          {lightsOn ? 'LIGHTS OFF' : 'LIGHTS ON'}
        </button>
        <p className="mono-label" style={{ marginTop: '0.5rem', fontSize: '0.6rem' }}>
          RELAY 1 (PIN 55) + RELAY 2 (PIN 54)
        </p>
      </div>
    </div>
  );
}