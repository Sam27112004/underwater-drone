import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * useWebSocket
 *
 * Manages the WebSocket connection to the Express/MAVLink backend.
 * Ported verbatim from the connect() + handleMessage() + updateMessageRate()
 * block in the original public/index.html.
 *
 * Returns:
 *   backendConnected  boolean
 *   mavlinkConnected  boolean
 *   messageRate       string   e.g. "12/s"
 *   lastMessage       object | null   raw parsed message (every type)
 *   sendCommand       (mavlinkPayload) => void
 */
export default function useWebSocket() {
  const [backendConnected, setBackendConnected] = useState(false);
  const [mavlinkConnected, setMavlinkConnected] = useState(false);
  const [messageRate, setMessageRate]           = useState('0/s');
  const [lastMessage, setLastMessage]           = useState(null);

  // Internal refs — never trigger re-renders
  const wsRef             = useRef(null);
  const reconnectTimer    = useRef(null);
  const messageCount      = useRef(0);
  const lastRateCalc      = useRef(Date.now());
  // Store connect fn in a ref so the onclose closure always calls the latest version
  const connectRef        = useRef(null);

  // ── Message rate (same logic as original updateMessageRate) ────────────────
  const updateMessageRate = useCallback(() => {
    const now     = Date.now();
    const elapsed = (now - lastRateCalc.current) / 1000;
    if (elapsed >= 1) {
      const rate = Math.round(messageCount.current / elapsed);
      setMessageRate(rate + '/s');
      messageCount.current  = 0;
      lastRateCalc.current  = now;
    }
  }, []);

  // ── handleMessage (mirrors original switch block; no telemetry parsing) ────
  const handleMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'telemetry':
        setMavlinkConnected(true);
        messageCount.current++;
        updateMessageRate();
        setLastMessage(msg);
        break;

      case 'initial':
        setLastMessage(msg);
        break;

      case 'connection':
        if (msg.source === 'mavlink') {
          setMavlinkConnected(msg.status === 'connected');
        }
        break;

      case 'command_response':
        // Forwarded to App.jsx via lastMessage so it can update armed state
        setLastMessage(msg);
        break;

      default:
        break;
    }
  }, [updateMessageRate]);

  // ── connect (exact original logic) ─────────────────────────────────────────
  const connect = useCallback(() => {
    // Clear any pending reconnect timer
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }

    // Close any existing socket cleanly
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (_) {}
      wsRef.current = null;
    }

    // Build URL exactly as original:
    // const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // const wsUrl = `${protocol}//${window.location.host}`;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl    = `${protocol}//${window.location.host}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setBackendConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch (_) {}
    };

    ws.onclose = () => {
      setBackendConnected(false);
      setMavlinkConnected(false);
      // Reconnect after 3000 ms — same as original setTimeout(connect, 3000)
      reconnectTimer.current = setTimeout(() => {
        connectRef.current?.();
      }, 3000);
    };

    // No onerror handler in original — onclose fires after error anyway
  }, [handleMessage]);

  // Keep connectRef up to date whenever connect changes identity
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // ── Initial connection on mount + cleanup on unmount ───────────────────────
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        // Null out onclose so it doesn't schedule another reconnect during unmount
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

  // ── sendCommand (exact original format) ────────────────────────────────────
  const sendCommand = useCallback((payload) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      const id = Date.now();
      ws.send(JSON.stringify({ type: 'command', id, data: payload }));
      return id;
    }
    return null;
  }, []);

  return {
    backendConnected,
    mavlinkConnected,
    messageRate,
    lastMessage,
    sendCommand,
  };
}
