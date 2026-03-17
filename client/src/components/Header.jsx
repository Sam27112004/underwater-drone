/**
 * Header — logo + top status bar.
 *
 * Props:
 *   backendConnected  boolean
 *   mavlinkConnected  boolean
 *   messageRate       string  e.g. "12/s"
 *   batteryPct        number | null
 */
export default function Header({ backendConnected, mavlinkConnected, messageRate, batteryPct }) {
  return (
    <header>
      <div className="logo">
        <div className="logo-mark" />
        ABYSS COMMAND
      </div>

      <div className="top-status">
        <div>
          Backend:{' '}
          <span className={`status-badge ${backendConnected ? 'online' : 'offline'}`}>
            {backendConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
        <div>
          MAVLink:{' '}
          <span className={`status-badge ${mavlinkConnected ? 'online' : 'offline'}`}>
            {mavlinkConnected ? 'ACTV' : 'OFFLINE'}
          </span>
        </div>
        <div>
          Rate: <span>{messageRate}</span>
        </div>
        <div>
          Bat:{' '}
          <span className="status-badge">
            {batteryPct !== null ? `${batteryPct}%` : '--%'}
          </span>
        </div>
      </div>
    </header>
  );
}
