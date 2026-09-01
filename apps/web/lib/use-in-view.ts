'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * `true` (e per sempre) dal momento in cui l'elemento e' entrato in scena.
 *
 * Non usa IntersectionObserver, e la ragione e' una sola: l'osservatore notifica
 * gli ATTRAVERSAMENTI di soglia, non lo stato. Se lo scroll salta oltre un
 * elemento in un solo frame — ancora, «fine pagina», posizione ripristinata,
 * scheda tornata in primo piano — quell'elemento passa da «sotto la finestra» a
 * «sopra la finestra» senza attraversare nulla: nessuna notifica, e cio' che
 * dipendeva dall'osservatore (opacita', larghezza di una barra) resta a zero per
 * sempre. Qui si misura lo stato a ogni frame utile e ci si stacca appena e'
 * entrato: per una manciata di elementi il costo e' irrilevante, la garanzia
 * che il contenuto si veda no.
 */
export function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;

    const stop = () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', schedule);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };

    const check = () => {
      frame = 0;
      const box = el.getBoundingClientRect();
      // Entrato nell'ultimo 10% della finestra, oppure gia' superato.
      if (box.top < window.innerHeight * 0.9 || box.bottom < 0) {
        setInView(true);
        stop();
      }
    };

    function schedule() {
      // A scheda nascosta requestAnimationFrame non scatta: si misura subito.
      if (document.hidden) {
        check();
        return;
      }
      if (!frame) frame = requestAnimationFrame(check);
    }

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', schedule);
    check();

    return stop;
  }, []);

  return { ref, inView };
}
