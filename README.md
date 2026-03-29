# ROV Control Station

A web-based control station for Remotely Operated Vehicles (ROV) with BlueOS integration. Provides real-time control, live video streaming, telemetry monitoring, AI/ML object detection, frame tagging, and inspection reporting for underwater drones.

## Features

- Real-time ROV control via keyboard, gamepad, or on-screen buttons
- Live video streaming — MJPEG (RTSP proxy) and WebRTC
- Full telemetry display — attitude, depth, pressure, battery, GPS
- AI/ML bounding-box detection overlay (ONNX Runtime Web, runs in browser)
- Frame tagging — capture frames with live telemetry + detections attached (hotkey `T`)
- Frame gallery — browse, inspect, and delete tagged frames
- Inspection report — self-contained HTML report with embedded images and bbox overlays
- Video recording — downloads MP4/WebM directly from the browser
- Lights control via MAVLink relay command (gamepad d-pad left)
- BlueOS / MAVLink2REST integration

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [npm](https://www.npmjs.com/)
- [ffmpeg](https://ffmpeg.org/) on PATH (required for RTSP → MJPEG proxy)
- [Git LFS](https://git-lfs.github.com/) (required to pull ONNX model files)
- Python 3 + OpenCV (`pip install opencv-python numpy`) — only needed for mosaic feature

## Cloning (with models)

Git LFS is used for large ONNX model files. You must install Git LFS **before** cloning, or the model files will be 1 KB pointer stubs instead of the real binaries.

```bash
# 1. Install Git LFS (once per machine)
git lfs install

# 2. Clone — LFS files are downloaded automatically
git clone https://github.com/Sam27112004/underwater-drone.git
cd underwater-drone
```

If you already cloned without LFS, fetch the real files:

```bash
git lfs pull
```

## Installation

```bash
# Install all dependencies (backend + frontend)
npm run install:all

# Or manually:
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

## Running

### Development (recommended)

Runs Vite in watch mode + Express together. Rebuilds the frontend on every save.

```bash
npm run dev
```

Open `http://localhost:3000`.

### Production

```bash
cd frontend && npm run build && cd ..
npm start
```

### Frontend HMR (Vite dev server only)

```bash
cd frontend && npm run dev   # http://localhost:5173
```

> Note: WebSocket telemetry connects to `window.location.host` directly, so it won't work on the Vite dev server port. Use `npm run dev` from the root instead for full functionality.

## Configuration

Create a `.env` file in the project root to override defaults:

```env
BLUEOS_IP=192.168.2.2
BLUEOS_MAVLINK_PORT=80
BLUEOS_VIDEO_PORT=6020
BLUEOS_MJPEG_RTSP=rtsp://192.168.2.2:8554/video_stream__dev_video0
PORT=3000
```

## Project Structure

```
underwater-drone/
├── backend/                        # Express + WebSocket backend
│   ├── server.js                   # Main server — MAVLink, telemetry, video proxy, API
│   ├── scripts/
│   │   └── enhance.py              # OpenCV CLAHE underwater image enhancement
│   ├── node_modules/
│   └── package.json
├── frontend/                       # React 18 + Vite frontend
│   ├── public/
│   │   └── models/                 # ONNX model files (source of truth, tracked via LFS)
│   └── src/
│       ├── App.jsx                 # Root component — state, hooks, layout
│       ├── main.jsx                # React entry point
│       ├── components/
│       │   ├── AIPanel.jsx         # Model selector + inference controls
│       │   ├── AttitudeIndicator.jsx  # Canvas-drawn horizon (roll/pitch/yaw)
│       │   ├── CoreStatus.jsx      # ARM/DISARM, mode selector
│       │   ├── Cursor.jsx          # Custom cursor with magnetic effect
│       │   ├── DetectionOverlay.jsx   # Bounding box canvas overlay on video
│       │   ├── EnergyGrid.jsx      # Battery voltage/current/remaining
│       │   ├── Footer.jsx          # Connection details bar
│       │   ├── GalleryPanel.jsx    # Tagged frame gallery — browse + delete
│       │   ├── Header.jsx          # Logo + status indicators
│       │   ├── InspectionPanel.jsx # HTML inspection report generator
│       │   ├── Peripherals.jsx     # Keyboard buttons + gamepad status
│       │   ├── TelemetryGrid.jsx   # Roll/pitch/yaw/depth/pressure/temp display
│       │   └── VideoSection.jsx    # MJPEG / WebRTC video + connect controls
│       ├── hooks/
│       │   ├── useWebSocket.js     # WS connection, reconnect, sendCommand
│       │   ├── useTelemetry.js     # Parses raw WS messages into telemetry objects
│       │   ├── useGamepad.js       # Gamepad API polling, deadzone, axis mapping
│       │   └── useYOLO.js          # ONNX Runtime Web inference hook
│       ├── models/
│       │   └── registry.js         # Model registry — add new models here
│       └── styles/
│           └── globals.css         # Global dark-theme styles
├── public/                         # Vite build output (gitignored — regenerated on build)
├── tagged_frames/                  # Saved tagged frames + tags.json (gitignored)
├── .gitattributes                  # Git LFS rules (*.onnx, *.pt, *.pth, *.weights)
├── .env                            # Local config (gitignored)
└── package.json                    # Root orchestrator — npm run dev / npm start
```

## Adding a New Detection Model

1. Export to ONNX:
   ```bash
   yolo export model=yourmodel.pt format=onnx imgsz=640 simplify=True
   ```
2. Place the `.onnx` file in `frontend/public/models/`
3. Add an entry to `frontend/src/models/registry.js` — the dropdown updates automatically
4. Commit and push via LFS (see below)

## Git LFS — Working with Models

Model files (`*.onnx`, `*.pt`, `*.pth`, `*.weights`) are stored in Git LFS, not in the regular git object database.

### Pull latest models after a team push

```bash
git pull
git lfs pull          # fetches any new/updated LFS files
```

### Push new or updated models

```bash
# Copy model into frontend/public/models/
git add frontend/public/models/yourmodel.onnx
git commit -m "feat: add yourmodel detection model"
git push origin main  # LFS objects are uploaded automatically before the refs
```

### Check which files are tracked by LFS

```bash
git lfs ls-files
```

### Verify LFS is set up correctly

```bash
git lfs status        # shows staged LFS files
git lfs env           # shows LFS config and endpoint
```

> The `public/` directory at the repo root is **build output** (Vite copies `frontend/public/` there on every build). It is gitignored — only `frontend/public/models/` is the source and tracked in git.

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server + MAVLink status |
| GET | `/api/telemetry` | All cached telemetry |
| GET | `/api/tags` | List all tagged frames |
| POST | `/api/tags` | Save a tagged frame |
| GET | `/api/tags/:id/image` | Serve a frame JPEG |
| DELETE | `/api/tags/:id` | Delete a tagged frame |
| DELETE | `/api/tags` | Reset all tagged frames |
| GET | `/api/report` | Download HTML inspection report |
| POST | `/api/mosaic` | Generate mosaic from tagged frames |
| GET | `/video/mjpeg` | RTSP → MJPEG proxy stream |

## Troubleshooting

**Model files are 1 KB stubs after cloning**
Run `git lfs install` then `git lfs pull`.

**Port 3000 already in use**
Set `PORT=3001` in `.env`.

**Cannot connect to BlueOS**
- Verify the ROV is powered and network-connected (`ping 192.168.2.2`)
- Check `BLUEOS_IP` in `.env`

**No video stream**
- Confirm `ffmpeg` is on PATH: `ffmpeg -version`
- Check the RTSP URL in `.env`

**npm install fails**
```bash
npm cache clean --force
npm run install:all
```

## License

MIT
