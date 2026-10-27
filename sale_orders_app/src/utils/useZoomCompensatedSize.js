import { useEffect, useState } from 'react';

/**
 * Full-viewport size for position:fixed overlays that portal into
 * document.body. AppContext scales the whole app with CSS `zoom` on
 * <body> (the user's Display Scale — e.g. 75%): a 100vw/100vh overlay
 * inside the zoomed body paints at that scale, anchored top-left (the
 * "squeezed into the corner" bug, fix run A2, 2026-10-28). Sizing the
 * overlay at 100/zoom vw/vh — the same compensation AppContext applies
 * to the body itself — makes it paint at exactly the viewport size, in
 * the app's own scale.
 */
export default function useZoomCompensatedSize() {
  const [size, setSize] = useState({ width: '100vw', height: '100vh' });
  useEffect(() => {
    const apply = () => {
      let z = 1;
      try {
        const cs = String(getComputedStyle(document.body).zoom || '');
        const parsed = parseFloat(cs);
        if (Number.isFinite(parsed) && parsed > 0) z = cs.includes('%') ? parsed / 100 : parsed;
      } catch (e) {}
      if (!Number.isFinite(z) || z <= 0) z = 1;
      setSize({ width: `${100 / z}vw`, height: `${100 / z}vh` });
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);
  return size;
}
