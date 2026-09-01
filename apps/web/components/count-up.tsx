'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Anima il valore da quello precedente al nuovo con easing, rispettando
 * prefers-reduced-motion.
 *
 * requestAnimationFrame non scatta a scheda nascosta: senza la guardia su
 * `document.hidden` il numero piu' importante della pagina resterebbe congelato
 * sul valore precedente per chi lancia il calcolo e cambia scheda. Qui, se la
 * scena non e' visibile, si salta l'animazione e si scrive subito il valore finale.
 */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);
  const first = useRef(true);

  useEffect(() => {
    const from = first.current ? 0 : previous.current;
    const to = value;
    previous.current = value;
    first.current = false;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || document.hidden) {
      setDisplay(to);
      return;
    }

    const duration = 700;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    // Scheda nascosta a meta' corsa: si chiude subito sul valore finale.
    const settleIfHidden = () => {
      if (!document.hidden) return;
      cancelAnimationFrame(raf);
      setDisplay(to);
    };
    document.addEventListener('visibilitychange', settleIfHidden);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', settleIfHidden);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{format(display)}</>;
}
