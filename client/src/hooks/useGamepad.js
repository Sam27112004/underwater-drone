import { useEffect, useState, useRef } from 'react';

export default function useGamepad({ onManualControl, armed }) {
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [gamepadId, setGamepadId] = useState('SEARCHING FOR INPUT...');
  const [gamepadValues, setGamepadValues] = useState({ x: 0, y: 0, z: 0, r: 0 });

  const rafRef = useRef(null);
  const armedRef = useRef(armed);
  const callbackRef = useRef(onManualControl);
  const connectedRef = useRef(false);

  useEffect(() => {
    armedRef.current = armed;
  }, [armed]);

  useEffect(() => {
    callbackRef.current = onManualControl;
  }, [onManualControl]);

  useEffect(() => {
    function applyDeadzone(value, deadzone) {
      return Math.abs(value) < deadzone ? 0 : value;
    }

    function pollGamepad() {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = gamepads.find((g) => g !== null);

      if (gp) {
        if (!connectedRef.current) {
          connectedRef.current = true;
          setGamepadConnected(true);
          setGamepadId(gp.id.split('(')[0].trim().toUpperCase());
        }

        const deadzone = 0.08;
        const forward = applyDeadzone(-gp.axes[1], deadzone);
        const lateral = applyDeadzone(gp.axes[0], deadzone);
        const yaw = applyDeadzone(gp.axes[2], deadzone);
        const throttle = gp.axes[3];

        const x = Math.round(forward * 100);
        const y = Math.round(lateral * 100);
        const r = Math.round(yaw * 100);
        const z = Math.round(((-throttle + 1) / 2) * 100);

        const values = { x, y, z, r };
        setGamepadValues(values);

        if (armedRef.current && callbackRef.current) {
          callbackRef.current(values);
        }
      } else {
        if (connectedRef.current) {
          connectedRef.current = false;
          setGamepadConnected(false);
          setGamepadId('SEARCHING FOR INPUT...');
          setGamepadValues({ x: 0, y: 0, z: 0, r: 0 });
        }
      }

      rafRef.current = requestAnimationFrame(pollGamepad);
    }

    rafRef.current = requestAnimationFrame(pollGamepad);

    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return { gamepadConnected, gamepadId, gamepadValues };
}