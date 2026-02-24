import http from 'http';
import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// BlueOS Configuration
const BLUEOS_CONFIG = {
  ip: process.env.BLUEOS_IP || '192.168.2.2',
  mavlinkPort: process.env.BLUEOS_MAVLINK_PORT || 80,
  videoPort: process.env.BLUEOS_VIDEO_PORT || 6020,
  mjpegRtspUrl:
    process.env.BLUEOS_MJPEG_RTSP ||
    'rtsp://192.168.2.2:8554/video_stream__dev_video0'
};

console.log('BlueOS Config:', BLUEOS_CONFIG);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Store connected clients and telemetry cache
const clients = new Set();
const telemetryCache = new Map();
let mavlinkWs = null;
let reconnectTimeout = null;
let lastHeartbeat = { armed: null, flightMode: null, systemStatus: null };
let lastHeartbeatRawLogAt = 0;
let lastCompanionHeartbeatLogAt = 0;

function toNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (value && typeof value === 'object') {
    if ('bits' in value) return toNumber(value.bits);
    if ('value' in value) return toNumber(value.value);
    if ('raw' in value) return toNumber(value.raw);
    if ('enum' in value) return toNumber(value.enum);
    if ('type' in value) return toNumber(value.type);
  }
  return undefined;
}

const MAV_STATE_MAP = {
  MAV_STATE_UNINIT: 0,
  MAV_STATE_BOOT: 1,
  MAV_STATE_CALIBRATING: 2,
  MAV_STATE_STANDBY: 3,
  MAV_STATE_ACTIVE: 4,
  MAV_STATE_CRITICAL: 5,
  MAV_STATE_EMERGENCY: 6,
  MAV_STATE_POWEROFF: 7,
  MAV_STATE_FLIGHT_TERMINATION: 8
};

// Helper to show axis values as a visual bar
function getAxisBar(value, center = 0) {
  const width = 20;
  const range = 1000;
  const relPos = center === 0 
    ? (value + range) / (range * 2) 
    : (value - (center - range)) / (range * 2);
  const pos = Math.max(0, Math.min(width, Math.round(relPos * width)));
  let bar = '[';
  for (let i = 0; i < width; i++) {
    bar += i === pos ? '●' : '─';
  }
  bar += ']';
  return bar;
}

// MAVLink Message Types we care about
const MESSAGE_TYPES = [
  'ATTITUDE',
  'SCALED_PRESSURE2',
  'BATTERY_STATUS',
  'HEARTBEAT',
  'VFR_HUD',
  'SYS_STATUS',
  'GPS_RAW_INT',
  'MANUAL_CONTROL',
  'NAMED_VALUE_FLOAT',
  'NAMED_VALUE_INT'
];

// Process MAVLink message and extract telemetry
function processMAVLinkMessage(message, header) {
  const msgType = message.messageType || message.type;
  if (!msgType) return null;

  const result = { timestamp: Date.now() };

  switch (msgType) {
    case 'ATTITUDE':
      result.type = 'attitude';
      result.roll = (message.roll * 180) / Math.PI;
      result.pitch = (message.pitch * 180) / Math.PI;
      result.yaw = ((message.yaw * 180) / Math.PI + 360) % 360;
      result.rollspeed = message.rollspeed;
      result.pitchspeed = message.pitchspeed;
      result.yawspeed = message.yawspeed;
      break;

    case 'SCALED_PRESSURE2':
    case 'SCALED_PRESSURE':
      result.type = 'pressure';
      result.pressure = message.press_abs;
      result.depth = Math.max(0, (message.press_abs - 1013.25) / 100);
      result.temperature = message.temperature / 100;
      break;

    case 'BATTERY_STATUS':
      result.type = 'battery';
      result.voltage = message.voltages?.[0] ? message.voltages[0] / 1000 : 0;
      result.current = message.current_battery ? message.current_battery / 100 : 0;
      result.remaining = message.capacity_remaining || 0;
      result.temperature = message.temperature ? message.temperature / 100 : 0;
      break;

    case 'HEARTBEAT':
      result.type = 'heartbeat';
      result.systemId = toNumber(header?.system_id ?? header?.systemId ?? header?.systemid);
      result.componentId = toNumber(header?.component_id ?? header?.componentId ?? header?.componentid);

      const autopilotType = message.autopilot?.type ?? message.autopilot;
      const mavType = message.mavtype?.type ?? message.mavtype;
      const isCompanion =
        autopilotType === 'MAV_AUTOPILOT_INVALID' ||
        mavType === 'MAV_TYPE_ONBOARD_CONTROLLER';
      if (isCompanion) {
        const now = Date.now();
        if (now - lastCompanionHeartbeatLogAt > 3000) {
          // console.warn('Ignoring companion heartbeat:', {
          //   autopilot: autopilotType,
          //   mavtype: mavType,
          //   header
          // });
          lastCompanionHeartbeatLogAt = now;
        }
        return null;
      }

      const baseMode = toNumber(message.base_mode ?? message.baseMode);
      const customModeRaw =
        message.custom_mode ??
        message.customMode ??
        message.custommode ??
        message.flight_mode ??
        message.flightMode;
      const customMode = toNumber(customModeRaw);
      const systemStatusRaw = message.system_status ?? message.systemStatus;
      const systemStatus =
        typeof systemStatusRaw === 'object' && systemStatusRaw?.type
          ? MAV_STATE_MAP[systemStatusRaw.type] ?? toNumber(systemStatusRaw)
          : toNumber(systemStatusRaw);
      result.armed = (baseMode ?? 0) & 128 ? true : false;
      result.flightMode = Number.isFinite(customMode) ? customMode : 99;
      result.systemStatus = Number.isFinite(systemStatus) ? systemStatus : 0;
      result.autopilot = Number(toNumber(message.autopilot ?? message.autopilot_type ?? 0)) || 0;

      if (baseMode === undefined || customMode === undefined || systemStatus === undefined) {
        const now = Date.now();
        if (now - lastHeartbeatRawLogAt > 3000) {
          console.warn('Heartbeat raw fields missing/unknown:', {
            base_mode: message.base_mode,
            custom_mode: message.custom_mode,
            system_status: message.system_status,
            raw: message
          });
          lastHeartbeatRawLogAt = now;
        }
      }

      if (
        lastHeartbeat.armed !== result.armed ||
        lastHeartbeat.flightMode !== result.flightMode ||
        lastHeartbeat.systemStatus !== result.systemStatus
      ) {
        console.log('Heartbeat:', {
          armed: result.armed,
          flightMode: result.flightMode,
          systemStatus: result.systemStatus,
          baseMode,
          customMode: customModeRaw
        });
        lastHeartbeat = {
          armed: result.armed,
          flightMode: result.flightMode,
          systemStatus: result.systemStatus
        };
      }
      break;

    case 'VFR_HUD':
      result.type = 'vfr_hud';
      result.heading = message.heading;
      result.groundspeed = message.groundspeed;
      result.airspeed = message.airspeed;
      result.throttle = message.throttle;
      result.alt = message.alt;
      result.climb = message.climb;
      break;

    case 'SYS_STATUS':
      result.type = 'sys_status';
      result.voltage = message.voltage_battery ? message.voltage_battery / 1000 : 0;
      result.current = message.current_battery ? message.current_battery / 100 : 0;
      result.batteryRemaining = message.battery_remaining || 0;
      result.load = message.load || 0;
      result.dropRate = message.drop_rate_comm || 0;
      break;

    case 'GPS_RAW_INT':
      result.type = 'gps';
      result.lat = message.lat ? message.lat / 1e7 : 0;
      result.lon = message.lon ? message.lon / 1e7 : 0;
      result.alt = message.alt ? message.alt / 1000 : 0;
      result.fixType = message.fix_type;
      result.satellites = message.satellites_visible;
      result.eph = message.eph;
      result.epv = message.epv;
      break;

    case 'NAMED_VALUE_FLOAT':
      result.type = 'named_value';
      result.name = message.name;
      result.value = message.value;
      break;

    default:
      return null;
  }

  return result;
}

// Connect to BlueOS MAVLink2REST WebSocket
function connectToMAVLink() {
  if (mavlinkWs) {
    try {
      mavlinkWs.close();
    } catch (e) {}
  }

  const wsUrl = `ws://${BLUEOS_CONFIG.ip}:${BLUEOS_CONFIG.mavlinkPort}/mavlink2rest/ws/mavlink?filter=.*`;
  console.log('Connecting to BlueOS MAVLink:', wsUrl);

  try {
    mavlinkWs = new WebSocket(wsUrl);

    mavlinkWs.on('open', () => {
      console.log('✅ Connected to BlueOS MAVLink2REST');
      broadcast({ type: 'connection', status: 'connected', source: 'mavlink' });
    });

    mavlinkWs.on('message', (data) => {
      try {
        const parsed = JSON.parse(data);
        const message = parsed.message;
        
        if (!message) return;

        const processed = processMAVLinkMessage(message, parsed.header);
        if (processed) {
          // Cache the telemetry
          telemetryCache.set(processed.type, processed);
          
          // Broadcast to all connected clients
          broadcast({
            type: 'telemetry',
            data: processed
          });
        }
      } catch (err) {
        console.error('Error processing MAVLink message:', err);
      }
    });

    mavlinkWs.on('close', () => {
      console.log('❌ BlueOS MAVLink disconnected');
      broadcast({ type: 'connection', status: 'disconnected', source: 'mavlink' });
      scheduleReconnect();
    });

    mavlinkWs.on('error', (err) => {
      console.error('MAVLink WebSocket error:', err.message);
      broadcast({ type: 'connection', status: 'error', source: 'mavlink', error: err.message });
    });

  } catch (err) {
    console.error('Failed to create MAVLink connection:', err);
    scheduleReconnect();
  }
}

// Schedule reconnection
function scheduleReconnect() {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  reconnectTimeout = setTimeout(() => {
    console.log('Attempting to reconnect to BlueOS...');
    connectToMAVLink();
  }, 3000);
}

// Broadcast message to all connected clients
function broadcast(message) {
  const messageStr = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(messageStr);
    }
  });
}

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('Client connected:', req.socket.remoteAddress);
  clients.add(ws);

  // Send current telemetry cache to new client
  const cachedData = {};
  telemetryCache.forEach((value, key) => {
    cachedData[key] = value;
  });
  ws.send(JSON.stringify({
    type: 'initial',
    data: cachedData
  }));

  ws.send(JSON.stringify({
  type: 'connection',
  status: mavlinkWs?.readyState === 1 ? 'connected' : 'disconnected',
  source: 'mavlink'
}));

  // Handle client messages
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'command') {
        // Forward command to BlueOS
        const success = await sendMAVLinkCommand(message.data);
        ws.send(JSON.stringify({
          type: 'command_response',
          id: message.id,
          success
        }));
      }
    } catch (err) {
      console.error('Error handling client message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('Client WebSocket error:', err);
    clients.delete(ws);
  });
});

// Send MAVLink command to BlueOS
async function sendMAVLinkCommand(command) {
  if (command.message.type === 'MANUAL_CONTROL') {
    const msg = command.message;
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\n[${timestamp}] 🎮 CONTROLLER INPUT`);
    console.log(`  ├─ Forward/Back (X):  ${msg.x.toString().padStart(5)} ${getAxisBar(msg.x)}`);
    console.log(`  ├─ Left/Right (Y):    ${msg.y.toString().padStart(5)} ${getAxisBar(msg.y)}`);
    console.log(`  ├─ Depth (Z):         ${msg.z.toString().padStart(5)} ${getAxisBar(msg.z, 500)}`);
    console.log(`  └─ Yaw (R):           ${msg.r.toString().padStart(5)} ${getAxisBar(msg.r)}`);
  } else {
    console.log(`[${new Date().toLocaleTimeString()}] 📡 ${command.message.type}`);
  }
  try {
    const url = `http://${BLUEOS_CONFIG.ip}:${BLUEOS_CONFIG.mavlinkPort}/mavlink2rest/mavlink`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command)
    });
    if (!response.ok) {
      const body = await response.text();
      if (command.message.type === 'MANUAL_CONTROL') {
        console.error('❌ MANUAL_CONTROL failed:', response.status, response.statusText, body);
      } else {
        console.error('❌ BlueOS MAVLink command failed:', response.status, response.statusText, body);
      }
    }
    return response.ok;
  } catch (err) {
    console.error('❌ Failed to send MAVLink command:', err);
    return false;
  }
  
}

// REST API Routes

// MJPEG proxy (RTSP -> multipart MJPEG)
app.get('/video/mjpeg', (req, res) => {
  const rtspUrl = req.query?.url || BLUEOS_CONFIG.mjpegRtspUrl;
  if (!rtspUrl) {
    res.status(400).json({ error: 'Missing RTSP URL' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=ffmpeg',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0'
  });

  const ffmpeg = spawn('ffmpeg', [
    '-rtsp_transport', 'tcp',
    '-i', rtspUrl,
    '-an',
    '-vf', 'scale=1280:-2',
    '-r', '30',
    '-q:v', '5',
    '-f', 'mpjpeg',
    'pipe:1'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  ffmpeg.stdout.pipe(res);

  ffmpeg.stderr.on('data', (data) => {
    const text = data.toString();
    if (text.includes('error') || text.includes('Error')) {
      console.error('ffmpeg:', text.trim());
    }
  });

  ffmpeg.on('error', (err) => {
    console.error('ffmpeg spawn error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to start ffmpeg' });
    } else {
      res.end();
    }
  });

  req.on('close', () => {
    ffmpeg.kill('SIGKILL');
  });
});

// Get all cached telemetry
app.get('/api/telemetry', (req, res) => {
  const data = {};
  telemetryCache.forEach((value, key) => {
    data[key] = value;
  });
  res.json(data);
});

// Get specific telemetry type
app.get('/api/telemetry/:type', (req, res) => {
  const data = telemetryCache.get(req.params.type);
  if (data) {
    res.json(data);
  } else {
    res.status(404).json({ error: 'Telemetry type not found' });
  }
});

// Send command to vehicle
app.post('/api/command', async (req, res) => {
  const success = await sendMAVLinkCommand(req.body);
  res.json({ success });
});

// Arm vehicle
app.post('/api/arm', async (req, res) => {
  const command = {
    header: { system_id: 255, component_id: 190, sequence: 0 },
    message: {
      type: 'COMMAND_LONG',
      param1: 1.0,
      param2: 0, param3: 0, param4: 0, param5: 0, param6: 0, param7: 0,
      command: { type: 'MAV_CMD_COMPONENT_ARM_DISARM' },
      target_system: 1,
      target_component: 1,
      confirmation: 1
    }
  };
  const success = await sendMAVLinkCommand(command);
  res.json({ success, action: 'arm' });
});

// Disarm vehicle
app.post('/api/disarm', async (req, res) => {
  const command = {
    header: { system_id: 255, component_id: 190, sequence: 0 },
    message: {
      type: 'COMMAND_LONG',
      param1: 0.0,
      param2: 0, param3: 0, param4: 0, param5: 0, param6: 0, param7: 0,
      command: { type: 'MAV_CMD_COMPONENT_ARM_DISARM' },
      target_system: 1,
      target_component: 1,
      confirmation: 1
    }
  };
  const success = await sendMAVLinkCommand(command);
  res.json({ success, action: 'disarm' });
});

// Set flight mode
app.post('/api/mode/:mode', async (req, res) => {
  const mode = parseInt(req.params.mode, 10);
  const command = {
    header: { system_id: 255, component_id: 190, sequence: 0 },
    message: {
      type: 'SET_MODE',
      target_system: 1,
      base_mode: 1,
      custom_mode: mode
    }
  };
  const success = await sendMAVLinkCommand(command);
  res.json({ success, mode });
});

// Send manual control
app.post('/api/manual-control', async (req, res) => {
  const { x, y, z, r, buttons = 0 } = req.body;
  
  const command = {
    header: { system_id: 255, component_id: 190, sequence: 0 },
    message: {
      type: 'MANUAL_CONTROL',
      target: 1,
      x: Math.max(-1000, Math.min(1000, x)),
      y: Math.max(-1000, Math.min(1000, y)),
      z: Math.max(0, Math.min(1000, z)),
      r: Math.max(-1000, Math.min(1000, r)),
      buttons
    }
  };
  
  const success = await sendMAVLinkCommand(command);
  res.json({ success });
});

// Get video streams from MAVLink Camera Manager
app.get('/api/video/streams', async (req, res) => {
  try {
    const response = await fetch(
      `http://${BLUEOS_CONFIG.ip}:${BLUEOS_CONFIG.videoPort}/api/v1/status`
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get video streams', message: err.message });
  }
});

// Get BlueOS system info
app.get('/api/system/blueos', async (req, res) => {
  try {
    const response = await fetch(
      `http://${BLUEOS_CONFIG.ip}:${BLUEOS_CONFIG.mavlinkPort}/system-information`
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get BlueOS info', message: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mavlinkConnected: mavlinkWs?.readyState === 1,
    blueosIp: BLUEOS_CONFIG.ip,
    clientsConnected: clients.size,
    telemetryTypes: Array.from(telemetryCache.keys())
  });
});

// Serve frontend for all other routes
app.get((req, res) => {
  res.sendFile(join(__dirname, 'public/index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           ROV Control Server                               ║
╠════════════════════════════════════════════════════════════╣
║  HTTP API:  http://localhost:${PORT}                       ║
║  WebSocket: ws://localhost:${PORT}                         ║
║  BlueOS IP: ${BLUEOS_CONFIG.ip}                            ║
╚════════════════════════════════════════════════════════════╝
  `);
  
  // Connect to BlueOS
  connectToMAVLink();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  if (mavlinkWs) mavlinkWs.close();
  server.close(() => {
    process.exit(0);
  });
});
