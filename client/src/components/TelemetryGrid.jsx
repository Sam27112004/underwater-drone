export default function TelemetryGrid({
  pressure,
  flightModeText,
  systemStatusText,
}) {
  const depthText = pressure ? pressure.depth.toFixed(1) : '--';
  const pressureText = pressure ? pressure.pressure.toFixed(0) : '--';
  const tempText = pressure ? pressure.temperature.toFixed(1) : '--';

  return (
    <div>
      <h2 className="section-title">
        02 // SENSOR ARRAY
        <span className="telemetry-status">LIVE</span>
      </h2>

      <div className="data-grid">
        <div className="data-item tilt-card">
          <span className="data-label">Sys Mode</span>
          <div className="data-value accent">
            {flightModeText || '--'}
          </div>
          <div className="system-status-text">
            {systemStatusText || '--'}
          </div>
        </div>

        <div className="data-item tilt-card">
          <span className="data-label">Depth Rating</span>
          <div className="data-value">
            <span>{depthText}</span>
            <span className="unit">M</span>
          </div>
        </div>

        <div className="data-item tilt-card">
          <span className="data-label">Atm. Pressure</span>
          <div className="data-value">
            <span>{pressureText}</span>
            <span className="unit">hPa</span>
          </div>
        </div>

        <div className="data-item tilt-card">
          <span className="data-label">Core Temp</span>
          <div className="data-value">
            <span>{tempText}</span>
            <span className="unit">°C</span>
          </div>
        </div>
      </div>
    </div>
  );
}