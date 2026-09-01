'use client';

import type { CalculationResult, CalculationStep } from '@cnl/core';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { formatEuro, formatEuroCompact, formatPercent } from '@/lib/format';
import { useInView } from '@/lib/use-in-view';

/**
 * Il percorso dei soldi: unica narrazione verticale che sostituisce cascata + tabella.
 * Non e' un grafico decorativo sopra un elenco — e' l'elenco stesso, disegnato come
 * un percorso che si attraversa dall'alto (RAL) in basso (netto), voce per voce.
 * Le larghezze restano in proporzione REALE alla RAL (docs/06 §5): nessuna scala
 * "aggiustata" per bilanciare la scena.
 */
export function Flow({
  result,
  highlightStepId,
}: {
  result: CalculationResult;
  highlightStepId: 'net' | 'gross';
}) {
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  // Le barre proporzionali si disegnano all'ingresso in scena; se restassero a
  // zero per una notifica mancata, la lettura visiva del peso di ogni voce
  // sparirebbe del tutto (vedi lib/use-in-view.ts).
  const { ref: containerRef, inView: drawn } = useInView<HTMLDivElement>();

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const gross = result.totals.gross;

  return (
    <div>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[var(--text-muted)]">
          Ogni tappa è cliccabile: formula e riferimento normativo alla fonte
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium sm:shrink-0">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="size-3.5 accent-[var(--accent)]"
          />
          Mostra formule
        </label>
      </div>

      <div ref={containerRef} className="relative">
        {/* Guida statica: il percorso completo, sempre visibile. */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--border)]" aria-hidden />
        {/* Traccia animata: si disegna dall'alto quando la scena entra in vista. */}
        <div
          className="absolute left-[7px] top-2 w-px bg-[var(--accent)]"
          style={{
            height: drawn ? 'calc(100% - 1rem)' : 0,
            opacity: 0.5,
            transition: 'height 1100ms cubic-bezier(0.16,1,0.3,1)',
          }}
          aria-hidden
        />

        <ol className="relative space-y-1">
          {result.steps.map((step, index) => {
            const isOpen = showAll || open.has(step.id);
            const isHighlight = step.id === highlightStepId;
            const barPercent = gross > 0 ? Math.min(100, (Math.abs(step.amount) / gross) * 100) : 0;
            const dotColor =
              step.sign === 'negative'
                ? 'var(--negative)'
                : step.sign === 'positive'
                  ? 'var(--positive)'
                  : isHighlight
                    ? 'var(--accent)'
                    : 'var(--text-muted)';

            return (
              <FlowStep
                key={step.id}
                step={step}
                isOpen={isOpen}
                isHighlight={isHighlight}
                dotColor={dotColor}
                barPercent={drawn ? barPercent : 0}
                delayMs={index * 70}
                onToggle={() => toggle(step.id)}
              />
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function FlowStep({
  step,
  isOpen,
  isHighlight,
  dotColor,
  barPercent,
  delayMs,
  onToggle,
}: {
  step: CalculationStep;
  isOpen: boolean;
  isHighlight: boolean;
  dotColor: string;
  barPercent: number;
  delayMs: number;
  onToggle: () => void;
}) {
  const detailId = `flow-detail-${step.id}`;

  return (
    <li className="relative pl-7">
      <span
        className="absolute left-0 top-2.5 size-[15px] rounded-full border-2"
        style={{ borderColor: dotColor, background: 'var(--bg)' }}
        aria-hidden
      />

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={detailId}
        className={cn(
          'w-full rounded-lg py-2 text-left transition-colors hover:bg-[var(--surface-muted)]',
          isHighlight && 'px-2',
        )}
      >
        <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <span
            className={cn(
              'flex items-center gap-1.5 text-sm',
              isHighlight ? 'font-mono uppercase tracking-wide text-[var(--text-muted)]' : '',
            )}
          >
            <ChevronRight
              aria-hidden
              className={cn(
                'size-3.5 shrink-0 text-[var(--text-muted)] transition-transform duration-300',
                isOpen && 'rotate-90',
              )}
            />
            {isHighlight ? step.label.toUpperCase() : step.label}
            {step.confidence === 'low' && (
              <span className="rounded-full border border-[var(--attention)]/40 px-2 py-0.5 font-mono text-[10px] tracking-wide text-[var(--attention)]">
                stima
              </span>
            )}
          </span>
          <span
            className={cn(
              'tnum shrink-0',
              isHighlight ? 'text-2xl text-display' : 'text-sm',
              step.sign === 'negative' && 'text-[var(--negative)]',
              step.sign === 'positive' && 'text-[var(--positive)]',
              isHighlight && step.sign === 'neutral' && 'text-[var(--accent)]',
            )}
          >
            {isHighlight ? formatEuroCompact(step.amount) : formatEuro(step.amount)}
          </span>
        </span>

        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[var(--surface-muted)]">
          <span
            className="block h-full rounded-full"
            style={{
              width: `${barPercent}%`,
              background: dotColor,
              opacity: 0.7,
              transition: `width 700ms cubic-bezier(0.16,1,0.3,1) ${delayMs}ms`,
            }}
          />
        </span>
      </button>

      {isOpen && (
        <dl
          id={detailId}
          className="animate-in ml-1 mt-1 space-y-2 rounded-lg bg-[var(--surface-muted)] px-4 py-3 text-xs"
        >
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-[var(--text-muted)]">Base</dt>
            <dd className="tnum">{formatEuroCompact(step.base)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-[var(--text-muted)]">Formula</dt>
            <dd className="tnum">{step.formula}</dd>
          </div>

          {step.detail && (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-[var(--text-muted)]">Scaglioni</dt>
              <dd className="space-y-0.5">
                {step.detail.map((d) => (
                  <div key={`${d.from}-${d.rate}`} className="tnum">
                    {formatEuroCompact(d.from)} – {d.to ? formatEuroCompact(d.to) : 'oltre'} ·{' '}
                    {formatEuroCompact(d.taxableInBracket)} × {formatPercent(d.rate, 0)} ={' '}
                    <strong>{formatEuro(d.tax)}</strong>
                  </div>
                ))}
              </dd>
            </div>
          )}

          {step.breakdown && step.breakdown.length > 0 && (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-[var(--text-muted)]">Dettaglio</dt>
              <dd className="space-y-0.5">
                {step.breakdown.map((b) => (
                  <div key={b.label} className="tnum">
                    {b.label}: <strong>{formatEuro(b.amount)}</strong>
                    {b.formula && <span className="text-[var(--text-muted)]"> — {b.formula}</span>}
                  </div>
                ))}
              </dd>
            </div>
          )}

          {step.note && (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-[var(--text-muted)]">Nota</dt>
              <dd>{step.note}</dd>
            </div>
          )}

          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-[var(--text-muted)]">Norma</dt>
            <dd className="text-[var(--text-muted)]">{step.legalRef}</dd>
          </div>
        </dl>
      )}
    </li>
  );
}
