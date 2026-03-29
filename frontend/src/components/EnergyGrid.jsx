/**
 * EnergyGrid (UI-only)
 *
 * Props:
 *   battery: { voltage, current, remaining } | null
 */
export default function EnergyGrid({ battery }) {
  const voltageText = battery ? battery.voltage.toFixed(1) : '--';
  const currentText = battery ? battery.current.toFixed(1) : '--';
  const batteryPctText = battery ? `${battery.remaining}%` : '--%';
  const batteryWidth = battery ? `${battery.remaining}%` : '0%';
  const batteryColor = battery
    ? battery.remaining > 50
      ? 'var(--success)'
      : battery.remaining > 20
      ? 'var(--warning)'
      : 'var(--danger)'
    : 'var(--success)';

  return (
    <div>
      <h2 className="section-title">03 // ENERGY GRID</h2>

      <div className="data-grid">
        <div className="data-item tilt-card">
          <span className="data-label">Voltage Source</span>
          <div className="data-value">
            <span id="tm-voltage">{voltageText}</span>
            <span className="unit">V</span>
          </div>
        </div>

        <div className="data-item tilt-card">
          <span className="data-label">Current Draw</span>
          <div className="data-value">
            <span id="tm-current">{currentText}</span>
            <span className="unit">A</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>RESERVE CAPACITY</span>
          <span id="tm-battery-pct">{batteryPctText}</span>
        </span>

        <div className="battery-visual">
          <div
            id="battery-fill"
            className="battery-fill"
            style={{ width: batteryWidth, background: batteryColor }}
          />
        </div>
      </div>
    </div>
  );
}
