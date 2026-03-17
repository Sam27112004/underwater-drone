import { useState, useEffect } from 'react';

// ── Lookup tables (ported verbatim from index.html) ───────────────────────────

export const flightModeNames = {
  0: 'STABILIZE',
  1: 'ACRO',
  2: 'DEPTH HOLD',
  3: 'AUTO',
  4: 'GUIDED',
  5: 'CIRCLE',
  6: 'SURFACE',
  7: 'POSHOLD',
  9: 'MANUAL',
  99: 'UNKNOWN',
};

export const systemStatusNames = {
  0: 'UNINIT',
  1: 'BOOT',
  2: 'CALIBRATING',
  3: 'STANDBY',
  4: 'ACTIVE',
  5: 'CRITICAL',
  6: 'EMERGENCY',
  7: 'POWEROFF',
  8: 'TERMINATION',
};

export const modeDescriptions = {
  9: 'Direct manual input stream',
  0: 'Auto-leveling enabled',
  2: 'Z-Axis depth locked',
  7: 'GPS positional lock active',
  6: 'Emergency surface sequence',
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useTelemetry
 *
 * Consumes `lastMessage` from useWebSocket and maintains per-type telemetry
 * state. No WebSocket logic lives here — parse only.
 *
 * The server already converts raw MAVLink units before broadcasting:
 *   attitude  → roll/pitch in degrees, yaw normalised 0–360
 *   pressure  → depth in metres, temperature in °C, pressure in hPa
 *   battery   → voltage in V, current in A, remaining in %
 *   heartbeat → armed bool, flightMode int, systemStatus int
 *
 * This hook stores those payloads and derives human-readable label strings.
 *
 * Returns:
 *   attitude         { roll, pitch, yaw, rollspeed, pitchspeed, yawspeed } | null
 *   pressure         { depth, pressure, temperature } | null
 *   battery          { voltage, current, remaining, temperature } | null
 *   heartbeat        { armed, flightMode, systemStatus, systemId, componentId } | null
 *   flightModeText   string   e.g. "MANUAL"
 *   systemStatusText string   e.g. "STANDBY"
 *   batteryColor     string   CSS var — mirrors original battery fill colour logic
 */
export default function useTelemetry(lastMessage) {
  const [attitude,  setAttitude]  = useState(null);
  const [pressure,  setPressure]  = useState(null);
  const [battery,   setBattery]   = useState(null);
  const [heartbeat, setHeartbeat] = useState(null);

  // Derived text labels — updated whenever heartbeat changes
  const [flightModeText,   setFlightModeText]   = useState('--');
  const [systemStatusText, setSystemStatusText] = useState('--');

  // Battery fill colour (mirrors original inline style logic)
  const [batteryColor, setBatteryColor] = useState('var(--success)');

  useEffect(() => {
    if (!lastMessage) return;

    // ── 'telemetry': single update keyed by data.type ─────────────────────────
    if (lastMessage.type === 'telemetry') {
      const data = lastMessage.data;
      applyTelemetryEntry(data);
    }

    // ── 'initial': full cache snapshot — replace every known type ────────────
    if (lastMessage.type === 'initial') {
      const snapshot = lastMessage.data; // keyed by type string
      Object.values(snapshot).forEach((entry) => {
        if (entry && entry.type) applyTelemetryEntry(entry);
      });
    }

    // 'command_response' — ignored here, handled in App.jsx
  }, [lastMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dispatch a single telemetry entry by its `.type` field ───────────────
  function applyTelemetryEntry(data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'attitude':
        // Server already sends roll/pitch in degrees, yaw normalised 0-360.
        // Nothing to convert — store as-is for canvas + readout display.
        setAttitude({
          roll:       data.roll,
          pitch:      data.pitch,
          yaw:        data.yaw,
          rollspeed:  data.rollspeed,
          pitchspeed: data.pitchspeed,
          yawspeed:   data.yawspeed,
          timestamp:  data.timestamp,
        });
        break;

      case 'pressure':
        // Server: depth = Math.max(0, (press_abs - 1013.25) / 100)
        //         temperature = message.temperature / 100
        // Already done server-side — store directly.
        setPressure({
          depth:       data.depth,
          pressure:    data.pressure,
          temperature: data.temperature,
          timestamp:   data.timestamp,
        });
        break;

      case 'battery':
        // Server: voltage = voltages[0] / 1000
        //         current = current_battery / 100
        //         remaining = capacity_remaining
        // Already done server-side — store and derive colour.
        setBattery({
          voltage:     data.voltage,
          current:     data.current,
          remaining:   data.remaining,
          temperature: data.temperature,
          timestamp:   data.timestamp,
        });
        // Mirror original battery fill colour logic exactly:
        // bat.remaining > 50 ? 'var(--success)' : bat.remaining > 20 ? 'var(--warning)' : 'var(--danger)'
        setBatteryColor(
          data.remaining > 50
            ? 'var(--success)'
            : data.remaining > 20
            ? 'var(--warning)'
            : 'var(--danger)'
        );
        break;

      case 'heartbeat':
        setHeartbeat({
          armed:        data.armed,
          flightMode:   data.flightMode,
          systemStatus: data.systemStatus,
          systemId:     data.systemId,
          componentId:  data.componentId,
          timestamp:    data.timestamp,
        });
        setFlightModeText(flightModeNames[data.flightMode]   ?? 'UNKNOWN');
        setSystemStatusText(systemStatusNames[data.systemStatus] ?? 'UNKNOWN');
        break;

      // Other types (vfr_hud, gps, sys_status, named_value) are passed
      // through as-is for future use — no state slot needed in Phase 2.
      default:
        break;
    }
  }

  return {
    attitude,
    pressure,
    battery,
    heartbeat,
    flightModeText,
    systemStatusText,
    batteryColor,
  };
}
