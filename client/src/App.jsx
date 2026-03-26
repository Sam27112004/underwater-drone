import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Cursor from './components/Cursor.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import VideoSection from './components/VideoSection.jsx';
import CoreStatus from './components/CoreStatus.jsx';
import TelemetryGrid from './components/TelemetryGrid.jsx';
import EnergyGrid from './components/EnergyGrid.jsx';
import AttitudeIndicator from './components/AttitudeIndicator.jsx';
import Peripherals from './components/Peripherals.jsx';
import useWebSocket from './hooks/useWebSocket.js';
import useTelemetry from './hooks/useTelemetry.js';
import useGamepad from './hooks/useGamepad.js';
import useYOLO from './hooks/useYOLO.js';
import { MODEL_REGISTRY } from './models/registry.js';

export default function App() {
    const { backendConnected, mavlinkConnected, messageRate, lastMessage, sendCommand } =
        useWebSocket();

    const { attitude, pressure, battery, heartbeat, flightModeText, systemStatusText } =
        useTelemetry(lastMessage);

    const [armed, setArmed] = useState(false);
    const [currentMode, setCurrentMode] = useState(9);
    const [targetSystemId, setTargetSystemId] = useState(1);
    const [targetComponentId, setTargetComponentId] = useState(1);

    const manualStateRef = useRef({ x: 0, y: 0, z: 500, r: 0, buttons: 0 });
    const lastManualSendAtRef = useRef(0);
    const pendingCommandsRef = useRef(new Map());
    const manualModeSet = useMemo(() => new Set([9, 0]), []);

    const [videoMode, setVideoMode] = useState('mjpeg');
    const [videoConnected, setVideoConnected] = useState(false);
    const videoRef = useRef(null);
    const mjpegRef = useRef(null);
    const pcRef = useRef(null);
    const videoWsRef = useRef(null);

    // ── AI / YOLO state ────────────────────────────────────────────────────────
    const [selectedModelId, setSelectedModelId] = useState('none');
    const [aiActive, setAiActive]               = useState(false);
    const [detections, setDetections]           = useState([]);
    const [inferenceFps, setInferenceFps]       = useState(0);
    const inferenceActiveRef                    = useRef(false); // prevents overlapping async calls
    const fpsCountRef                           = useRef(0);
    const fpsTimerRef                           = useRef(Date.now());

    const selectedModel = MODEL_REGISTRY.find(m => m.id === selectedModelId) ?? null;
    const { isLoading: modelLoading, error: modelError, runInference } = useYOLO(
        selectedModelId !== 'none' ? selectedModel : null
    );

    const handleModelChange = useCallback((id) => {
        setSelectedModelId(id);
        setAiActive(false);
        setDetections([]);
        setInferenceFps(0);
    }, []);

    const handleToggleAI = useCallback(() => {
        setAiActive(prev => {
            if (prev) { setDetections([]); setInferenceFps(0); }
            return !prev;
        });
    }, []);

    const batteryPct = battery?.remaining ?? null;

    const clamp = useCallback((value, min, max) => {
        return Math.min(max, Math.max(min, value));
    }, []);

    const isManualMode = useCallback(() => {
        const mode = Number.isFinite(currentMode) ? currentMode : parseInt(currentMode, 10);
        return manualModeSet.has(mode);
    }, [currentMode, manualModeSet]);

    const sendManualControlState = useCallback(
        (state, options = {}) => {
            const { bypassModeCheck = false, immediate = false } = options;
            if (!armed) return;
            if (!isManualMode() && !bypassModeCheck) return;

            const now = Date.now();
            if (!immediate && now - lastManualSendAtRef.current < 80) return;

            const command = {
                header: { system_id: 255, component_id: 190, sequence: 0 },
                message: {
                    type: 'MANUAL_CONTROL',
                    target: targetSystemId,
                    x: clamp(state.x, -1000, 1000),
                    y: clamp(state.y, -1000, 1000),
                    z: clamp(state.z, 0, 1000),
                    r: clamp(state.r, -1000, 1000),
                    buttons: state.buttons || 0,
                },
            };

            lastManualSendAtRef.current = now;
            sendCommand(command);
        },
        [armed, clamp, isManualMode, sendCommand, targetSystemId]
    );

    const sendArmCommand = useCallback(
        (arm) => {
            const command = {
                header: { system_id: 255, component_id: 190, sequence: 0 },
                message: {
                    type: 'COMMAND_LONG',
                    param1: arm,
                    param2: 0,
                    param3: 0,
                    param4: 0,
                    param5: 0,
                    param6: 0,
                    param7: 0,
                    command: { type: 'MAV_CMD_COMPONENT_ARM_DISARM' },
                    target_system: targetSystemId,
                    target_component: targetComponentId,
                    confirmation: 1,
                },
            };

            const id = sendCommand(command);
            if (id) pendingCommandsRef.current.set(id, { type: 'arm', value: arm });
        },
        [sendCommand, targetComponentId, targetSystemId]
    );

    const handleModeChange = useCallback(
        (modeInput) => {
            const mode = parseInt(modeInput, 10);
            setCurrentMode(mode);

            const command = {
                header: { system_id: 255, component_id: 190, sequence: 0 },
                message: {
                    type: 'SET_MODE',
                    target_system: targetSystemId,
                    base_mode: 1,
                    custom_mode: mode,
                },
            };

            sendCommand(command);

            if (!manualModeSet.has(mode)) {
                const neutral = { ...manualStateRef.current, x: 0, y: 0, r: 0, z: 500 };
                manualStateRef.current = neutral;
                sendManualControlState(neutral, { bypassModeCheck: true, immediate: true });
            }
        },
        [manualModeSet, sendCommand, sendManualControlState, targetSystemId]
    );

    const connectVideo = useCallback(async (mode, ip, port) => {
        if (mode === 'mjpeg') {
            if (videoRef.current) videoRef.current.srcObject = null;
            if (mjpegRef.current) {
                mjpegRef.current.src = '/video/mjpeg';
            }
            setVideoConnected(true);
            return;
        }

        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        pcRef.current = pc;

        pc.ontrack = (event) => {
            if (videoRef.current) {
                videoRef.current.srcObject = event.streams[0];
            }
        };

        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        const videoWs = new WebSocket(`ws://${ip}:${port}`);
        videoWsRef.current = videoWs;

        videoWs.onmessage = async (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === 'offer' && msg.sdp) {
                await pc.setRemoteDescription(new RTCSessionDescription(msg));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                videoWs.send(JSON.stringify({ type: 'answer', sdp: answer.sdp }));
            } else if (msg.type === 'ice' && msg.candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        setTimeout(() => {
            if (videoWs.readyState === WebSocket.OPEN && pc.localDescription) {
                videoWs.send(JSON.stringify({ type: 'offer', sdp: pc.localDescription.sdp }));
            }
        }, 500);

        setVideoConnected(true);
    }, []);

    const disconnectVideo = useCallback(() => {
        if (videoWsRef.current) {
            videoWsRef.current.close();
            videoWsRef.current = null;
        }
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        if (mjpegRef.current) {
            mjpegRef.current.src = '';
        }
        setVideoConnected(false);
    }, []);

    useEffect(() => {
        if (!heartbeat) return;
        setArmed(Boolean(heartbeat.armed));
        setCurrentMode((prev) =>
            Number.isFinite(heartbeat.flightMode) ? heartbeat.flightMode : prev
        );
        setTargetSystemId((prev) =>
            Number.isFinite(heartbeat.systemId) ? heartbeat.systemId : prev
        );
        setTargetComponentId((prev) =>
            Number.isFinite(heartbeat.componentId) ? heartbeat.componentId : prev
        );
    }, [heartbeat]);

    useEffect(() => {
        if (!lastMessage || lastMessage.type !== 'command_response') return;
        if (!pendingCommandsRef.current.has(lastMessage.id)) return;

        const entry = pendingCommandsRef.current.get(lastMessage.id);
        pendingCommandsRef.current.delete(lastMessage.id);

        if (entry.type === 'arm' && lastMessage.success) {
            setArmed(entry.value === 1);
        }
    }, [lastMessage]);

    useEffect(() => {
        if (!armed) {
            const neutral = { ...manualStateRef.current, x: 0, y: 0, r: 0, z: 500 };
            manualStateRef.current = neutral;
            sendManualControlState(neutral, { bypassModeCheck: true, immediate: true });
        }
    }, [armed, sendManualControlState]);

    useEffect(() => {
        return () => {
            disconnectVideo();
        };
    }, [disconnectVideo]);

    // ── YOLO inference loop ────────────────────────────────────────────────────
    useEffect(() => {
        if (!aiActive || !videoConnected || !runInference) return;

        let rafId;

        const loop = async () => {
            // pick the visible source element
            const source = videoMode === 'mjpeg' ? mjpegRef.current : videoRef.current;
            const ready  = source && (
                (source.tagName === 'IMG'   && source.naturalWidth  > 0) ||
                (source.tagName === 'VIDEO' && source.readyState   >= 2)
            );

            if (ready && !inferenceActiveRef.current) {
                inferenceActiveRef.current = true;
                try {
                    const dets = await runInference(source);
                    setDetections(dets);
                    fpsCountRef.current++;
                    const now = Date.now();
                    if (now - fpsTimerRef.current >= 1000) {
                        setInferenceFps(fpsCountRef.current);
                        fpsCountRef.current = 0;
                        fpsTimerRef.current = now;
                    }
                } finally {
                    inferenceActiveRef.current = false;
                }
            }

            rafId = requestAnimationFrame(loop);
        };

        rafId = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(rafId);
            inferenceActiveRef.current = false;
        };
    }, [aiActive, videoConnected, videoMode, runInference, mjpegRef, videoRef]);

    const handleGamepadManualControl = useCallback(
        ({ x, y, z, r }) => {
            manualStateRef.current = {
                ...manualStateRef.current,
                x: x * 10,
                y: y * 10,
                z: z * 10,
                r: r * 10,
            };
            sendManualControlState({ ...manualStateRef.current }, { bypassModeCheck: true });
        },
        [sendManualControlState]
    );

    const { gamepadConnected, gamepadId, gamepadValues } = useGamepad({
        onManualControl: handleGamepadManualControl,
        armed,
    });

    const onAxisPress = useCallback(
        (axis, value) => {
            manualStateRef.current = { ...manualStateRef.current, [axis]: value };
            sendManualControlState({ ...manualStateRef.current }, { bypassModeCheck: true, immediate: true });
        },
        [sendManualControlState]
    );

    const onAxisRelease = useCallback(
        (axis) => {
            const defaultValue = axis === 'z' ? 500 : 0;
            manualStateRef.current = { ...manualStateRef.current, [axis]: defaultValue };
            sendManualControlState({ ...manualStateRef.current }, { bypassModeCheck: true, immediate: true });
        },
        [sendManualControlState]
    );

    return (
        <>
            <Cursor />

            <Header
                backendConnected={backendConnected}
                mavlinkConnected={mavlinkConnected}
                messageRate={messageRate}
                batteryPct={batteryPct}
            />

            <main>
                <VideoSection
                    connectVideo={connectVideo}
                    disconnectVideo={disconnectVideo}
                    videoMode={videoMode}
                    setVideoMode={setVideoMode}
                    videoRef={videoRef}
                    mjpegRef={mjpegRef}
                    connected={videoConnected}
                    detections={detections}
                    selectedModelId={selectedModelId}
                    onModelChange={handleModelChange}
                    modelLoading={modelLoading}
                    modelError={modelError}
                    inferenceFps={inferenceFps}
                    aiActive={aiActive}
                    onToggleAI={handleToggleAI}
                />

                <section className="control-panel">
                    <CoreStatus
                        armed={armed}
                        currentMode={currentMode}
                        onArm={() => sendArmCommand(1)}
                        onDisarm={() => sendArmCommand(0)}
                        onModeChange={handleModeChange}
                    />

                    <TelemetryGrid
                        attitude={attitude}
                        pressure={pressure}
                        flightModeText={flightModeText}
                        systemStatusText={systemStatusText}
                    />

                    <EnergyGrid battery={battery} />

                    <AttitudeIndicator attitude={attitude} />

                    <Peripherals
                        gamepadConnected={gamepadConnected}
                        gamepadId={gamepadId}
                        gamepadValues={gamepadValues}
                        onAxisPress={onAxisPress}
                        onAxisRelease={onAxisRelease}
                    />
                </section>
            </main>

            <Footer
                backendConnected={backendConnected}
                mavlinkConnected={mavlinkConnected}
                messageRate={messageRate}
            />
        </>
    );
}
