'use client';

import { Check, Link2 } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * L'URL contiene gia' l'intero input del calcolo (lib/share.ts): qui si copia
 * la barra degli indirizzi, non uno stato ricostruito a parte.
 */
/** Fallback storico: selezione + execCommand, per quando la Clipboard API e' negata. */
function copyWithSelection(text: string): boolean {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
  document.body.appendChild(field);
  try {
    field.select();
    field.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

export function CopyLinkButton() {
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), 2400);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    const link = window.location.href;
    try {
      // Fuori da un contesto sicuro l'API non esiste: e' un caso da gestire, non da assumere.
      await navigator.clipboard.writeText(link);
      setState('done');
    } catch {
      // Permesso negato o contesto non sicuro (iframe, http, WebView): resta la
      // via legacy, deprecata ma ancora l'unica che funziona in quei casi.
      setState(copyWithSelection(link) ? 'done' : 'error');
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="pill h-7 shrink-0 px-3 font-mono text-[11px] uppercase tracking-wide"
    >
      {state === 'done' ? (
        <Check className="size-3.5 text-[var(--positive)]" aria-hidden />
      ) : (
        <Link2 className="size-3.5" aria-hidden />
      )}
      {state === 'done' ? 'Copiato' : state === 'error' ? 'Copia non riuscita' : 'Copia link'}
    </button>
  );
}
