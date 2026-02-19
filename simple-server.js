const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// BlueOS Configuration
const BLUEOS_IP = process.env.BLUEOS_IP || '192.168.2.2';
const BLUEOS_MAVLINK_PORT = process.env.BLUEOS_MAVLINK_PORT || 80;
const BLUEOS_VIDEO_PORT = process.env.BLUEOS_VIDEO_PORT || 6020;

console.log('BlueOS Config:', { ip: BLUEOS_IP, mavlinkPort: BLUEOS_MAVLINK_PORT, videoPort: BLUEOS_VIDEO_PORT });

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

// Create HTTP server
const server = http.createServer((req, res) => {
  // API routes
  if (req.url.startsWith('/api/')) {
    handleAPI(req, res);
    return;
  }

  // Static files
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, 'public', filePath);

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // Serve index.html for SPA routes
        fs.readFile(path.join(__dirname, 'public', 'index.html'), (err, content) => {
          if (err) {
            res.writeHead(500);
            res.end('Server Error');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients and telemetry cache
const clients = new Set();
const telemetryCache = new Map();
let mavlinkWs = null;
let reconnectTimeout = null;

// Process MAVLink message
function processMAVLinkMessage(message) {
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
      result.armed = (message.base_mode & 128) !== 0;
      result.flightMode = message.custom_mode;
      result.systemStatus = message.system_status;
      result.autopilot = message.autopilot;
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

    default:
      return null;
  }

  return result;
}

// Connect to BlueOS MAVLink2REST
function connectToMAVLink() {
  if (mavlinkWs) {
    try {
      mavlinkWs.close();
    } catch (e) {}
  }

  const wsUrl = `ws://${BLUEOS_IP}:${BLUEOS_MAVLINK_PORT}/mavlink2rest/ws/mavlink?filter=.*`;
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

        const processed = processMAVLinkMessage(message);
        if (processed) {
          telemetryCache.set(processed.type, processed);
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

// Broadcast message to all clients
function broadcast(message) {
  const messageStr = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

// Handle API requests
async function handleAPI(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = req.url;

  // Health check
  if (url === '/api/health') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'ok',
      mavlinkConnected: mavlinkWs?.readyState === 1,
      blueosIp: BLUEOS_IP,
      clientsConnected: clients.size,
      telemetryTypes: Array.from(telemetryCache.keys())
    }));
    return;
  }

  // Get telemetry
  if (url === '/api/telemetry') {
    const data = {};
    telemetryCache.forEach((value, key) => {
      data[key] = value;
    });
    res.writeHead(200);
    res.end(JSON.stringify(data));
    return;
  }

  // Send command
  if (url === '/api/command' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const command = JSON.parse(body);
        const success = await sendMAVLinkCommand(command);
        res.writeHead(200);
        res.end(JSON.stringify({ success }));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Arm/Disarm
  if (url === '/api/arm' && req.method === 'POST') {
    const success = await sendMAVLinkCommand({
      header: { system_id: 255, component_id: 240, sequence: 0 },
      message: {
        type: 'COMMAND_LONG',
        param1: 1.0,
        param2: 0, param3: 0, param4: 0, param5: 0, param6: 0, param7: 0,
        command: { type: 'MAV_CMD_COMPONENT_ARM_DISARM' },
        target_system: 1,
        target_component: 1,
        confirmation: 1
      }
    });
    res.writeHead(200);
    res.end(JSON.stringify({ success, action: 'arm' }));
    return;
  }

  if (url === '/api/disarm' && req.method === 'POST') {
    const success = await sendMAVLinkCommand({
      header: { system_id: 255, component_id: 240, sequence: 0 },
      message: {
        type: 'COMMAND_LONG',
        param1: 0.0,
        param2: 0, param3: 0, param4: 0, param5: 0, param6: 0, param7: 0,
        command: { type: 'MAV_CMD_COMPONENT_ARM_DISARM' },
        target_system: 1,
        target_component: 1,
        confirmation: 1
      }
    });
    res.writeHead(200);
    res.end(JSON.stringify({ success, action: 'disarm' }));
    return;
  }

  // Set flight mode
  const modeMatch = url.match(/^\/api\/mode\/(\d+)$/);
  if (modeMatch && req.method === 'POST') {
    const mode = parseInt(modeMatch[1], 10);
    const success = await sendMAVLinkCommand({
      header: { system_id: 255, component_id: 240, sequence: 0 },
      message: {
        type: 'COMMAND_LONG',
        param1: 1.0,
        param2: mode,
        param3: 0, param4: 0, param5: 0, param6: 0, param7: 0,
        command: { type: 'MAV_CMD_DO_SET_MODE' },
        target_system: 1,
        target_component: 1,
        confirmation: 1
      }
    });
    res.writeHead(200);
    res.end(JSON.stringify({ success, mode }));
    return;
  }

  // Manual control
  if (url === '/api/manual-control' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { x, y, z, r, buttons = 0 } = JSON.parse(body);
        const success = await sendMAVLinkCommand({
          header: { system_id: 255, component_id: 240, sequence: 0 },
          message: {
            type: 'MANUAL_CONTROL',
            target: 1,
            x: Math.max(-1000, Math.min(1000, x)),
            y: Math.max(-1000, Math.min(1000, y)),
            z: Math.max(0, Math.min(1000, z)),
            r: Math.max(-1000, Math.min(1000, r)),
            buttons
          }
        });
        res.writeHead(200);
        res.end(JSON.stringify({ success }));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Video streams
  if (url === '/api/video/streams') {
    try {
      const response = await fetchFromBlueOS(`http://${BLUEOS_IP}:${BLUEOS_VIDEO_PORT}/api/v1/status`);
      res.writeHead(200);
      res.end(response);
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to get video streams', message: err.message }));
    }
    return;
  }

  // Not found
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
}

// Send MAVLink command to BlueOS
async function sendMAVLinkCommand(command) {
  return new Promise((resolve) => {
    const options = {
      hostname: BLUEOS_IP,
      port: BLUEOS_MAVLINK_PORT,
      path: '/mavlink2rest/mavlink',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = require('http').request(options, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', (err) => {
      console.error('Failed to send MAVLink command:', err);
      resolve(false);
    });

    req.write(JSON.stringify(command));
    req.end();
  });
}

// Fetch from BlueOS
async function fetchFromBlueOS(url) {
  return new Promise((resolve, reject) => {
    const req = require('http').get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
  });
}

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('Client connected:', req.socket.remoteAddress);
  clients.add(ws);

  // Send current telemetry cache
  const cachedData = {};
  telemetryCache.forEach((value, key) => {
    cachedData[key] = value;
  });
  
  ws.send(JSON.stringify({
    type: 'initial',
    data: cachedData
  }));

  // Handle client messages
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'command') {
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

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           ROV Control Server                               ║
╠════════════════════════════════════════════════════════════╣
║  HTTP API:  http://localhost:${PORT}                        ║
║  WebSocket: ws://localhost:${PORT}                          ║
║  BlueOS IP: ${BLUEOS_IP}                                   ║
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
