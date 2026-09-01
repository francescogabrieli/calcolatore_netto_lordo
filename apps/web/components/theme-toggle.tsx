'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';

  /*
   * L'etichetta passa da `mounted`, non solo da `isDark`. next-themes risolve il
   * tema gia' alla prima render del client: se leggessimo solo `isDark`, il valore
   * coinciderebbe con quello dell'idratazione e React non riscriverebbe mai
   * l'attributo servito dal server — i mismatch di attributo, a differenza del
   * testo, l'idratazione li segnala ma non li ripara. Il bottone resterebbe cosi'
   * ad annunciare "Passa al tema scuro" con il tema scuro gia' attivo.
   */
  const label = !mounted ? 'Cambia tema' : isDark ? 'Passa al tema chiaro' : 'Passa al tema scuro';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={label}
      className="pill relative size-9 overflow-hidden"
    >
      <Sun
        aria-hidden
        className="theme-icon absolute size-4"
        style={{
          opacity: mounted && !isDark ? 1 : 0,
          transform: mounted && !isDark ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0.5)',
        }}
      />
      <Moon
        aria-hidden
        className="theme-icon absolute size-4"
        style={{
          opacity: mounted && isDark ? 1 : 0,
          transform: mounted && isDark ? 'rotate(0deg) scale(1)' : 'rotate(90deg) scale(0.5)',
        }}
      />
    </button>
  );
}
