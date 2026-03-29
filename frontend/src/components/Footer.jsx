/**
 * Footer — fixed bottom-right status bar.
 * Mirrors the original footer spans (footer-backend, footer-mavlink, footer-rate).
 *
 * Props:
 *   backendConnected  boolean
 *   mavlinkConnected  boolean
 *   messageRate       string  e.g. "12/s"
 */
export default function Footer({ backendConnected, mavlinkConnected, messageRate }) {
  return (
    <footer>
      <span>BACKEND: {backendConnected ? 'ONLINE' : 'OFFLINE'}</span>
      <span>MAVLINK: {mavlinkConnected ? 'ACTIVE' : 'OFFLINE'}</span>
      <span>RATE: {messageRate}</span>
    </footer>
  );
}
