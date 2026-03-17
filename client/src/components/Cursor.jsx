import { useEffect, useRef } from 'react';

/**
 * Cursor — custom dot + slow-follow ring.
 * Mirrors the original index.html cursor JS exactly:
 *   - dot snaps instantly to mouse position
 *   - ring follows with 0.2 lerp factor via requestAnimationFrame
 */
export default function Cursor() {
  const dotRef  = useRef(null);
  const ringRef = useRef(null);
  const mouse   = useRef({ x: 0, y: 0 });
  const ring    = useRef({ x: 0, y: 0 });
  const rafId   = useRef(null);

  useEffect(() => {
    const dot    = dotRef.current;
    const ringEl = ringRef.current;

    const onMouseMove = (e) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
      dot.style.left = e.clientX + 'px';
      dot.style.top  = e.clientY + 'px';
    };

    const animate = () => {
      const dx = mouse.current.x - ring.current.x;
      const dy = mouse.current.y - ring.current.y;
      ring.current.x += dx * 0.2;
      ring.current.y += dy * 0.2;
      ringEl.style.left = ring.current.x + 'px';
      ringEl.style.top  = ring.current.y + 'px';
      rafId.current = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', onMouseMove);
    rafId.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <>
      <div id="cursor-dot"  ref={dotRef}  />
      <div id="cursor-ring" ref={ringRef} />
    </>
  );
}
