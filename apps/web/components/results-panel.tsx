'use client';

import type { CalculationResult } from '@cnl/core';
import { AlertTriangle, Info, TrendingDown, TrendingUp } from 'lucide-react';
import type { CalculationMode } from '@/components/calculator-form';
import { CopyLinkButton } from '@/components/copy-link';
import { CountUp } from '@/components/count-up';
import { Flow } from '@/components/flow';
import { MoneyFlow } from '@/components/money-flow';
import { Reveal } from '@/components/reveal';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { formatEuro, formatEuroCompact, formatPercent } from '@/lib/format';

export function ResultsPanel({
  result,
  mode,
}: {
  result: CalculationResult;
  mode: CalculationMode;
}) {
  const { totals, informational, warnings } = result;
  const keptPer100 = Math.round((1 - totals.marginalRate) * 100);
  const isReverse = mode === 'reverse';

  return (
    <div className="space-y-4">
      {/* Livello 1 — sintesi */}
      <Card data-summary-card>
        <CardBody className="pt-7">
          <div className="flex items-start justify-between gap-3">
            <span className="eyebrow">
              {isReverse ? 'RAL necessaria' : 'Retribuzione netta annua'}
            </span>
            <CopyLinkButton />
          </div>
          <p
            data-testid="headline-amount"
            className="tnum text-display mt-3 text-6xl"
            style={{ color: isReverse ? 'var(--accent)' : 'var(--positive)' }}
          >
            <CountUp
              value={isReverse ? totals.gross : totals.netAnnual}
              format={(n) => formatEuroCompact(n)}
            />
          </p>

          {isReverse ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Per un netto di{' '}
              <span className="tnum text-[var(--text)]">{formatEuro(totals.netAnnual)}</span> l’anno
              · <span className="tnum text-[var(--text)]">{formatEuro(totals.netMonthly)}</span> ×{' '}
              {result.input.monthlyPayments} mensilità
            </p>
          ) : (
            <>
              <p className="tnum mt-3 text-lg">
                {formatEuro(totals.netMonthly)}{' '}
                <span className="text-sm text-[var(--text-muted)]">
                  × {result.input.monthlyPayments} mensilità
                </span>
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Media annua. In busta paga il mese con la tredicesima è tipicamente più basso.
              </p>
            </>
          )}

          <dl className="mt-6 grid grid-cols-1 gap-3 border-t border-[var(--border)] pt-5 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
              <dt className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                <TrendingDown className="size-3" aria-hidden />
                Trattenute
              </dt>
              <dd className="tnum mt-1.5 text-lg text-[var(--negative)]">
                {formatEuroCompact(totals.totalContributions + totals.totalTax)}
              </dd>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
              <dt className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                Aliquota eff.
              </dt>
              <dd className="tnum mt-1.5 text-lg">{formatPercent(totals.effectiveRate)}</dd>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
              <dt className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                <TrendingUp className="size-3" aria-hidden />
                Marginale
              </dt>
              <dd className="tnum mt-1.5 text-lg">{formatPercent(totals.marginalRate)}</dd>
              <dd className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                Su 100 € in più, {keptPer100} restano
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w, i) => (
            <div
              key={`${w.code}-${i}`}
              className="animate-in flex gap-2.5 rounded-lg border border-[var(--attention)]/30 bg-[var(--attention-soft)] px-4 py-3 text-xs"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {w.severity === 'warning' ? (
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0 text-[var(--attention)]"
                  aria-hidden
                />
              ) : (
                <Info className="mt-0.5 size-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
              )}
              <p>{w.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Livello 2+3 fusi — il percorso dei soldi, dal lordo alla voce finale */}
      <Reveal>
        <Card>
          <CardHeader>
            <CardTitle>Il percorso della retribuzione</CardTitle>
          </CardHeader>
          <CardBody>
            <Flow result={result} highlightStepId={isReverse ? 'gross' : 'net'} />
          </CardBody>
        </Card>
      </Reveal>

      {/* Il percorso dice l'ordine delle operazioni; questo dice le proporzioni. */}
      <Reveal delay={40}>
        <Card>
          <CardHeader>
            <CardTitle>Dove finiscono i soldi</CardTitle>
          </CardHeader>
          <CardBody>
            <MoneyFlow result={result} />
          </CardBody>
        </Card>
      </Reveal>

      {/* Informative: separate, mai sottratte dal netto */}
      <Reveal delay={80}>
        <Card className="bg-[var(--surface-muted)]">
          <CardHeader>
            <CardTitle>Voci informative</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <dt className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  TFR maturato
                </dt>
                <dd className="tnum mt-1.5 text-lg">{formatEuro(informational.tfr)}</dd>
                <span className="mt-1 inline-block rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                  non incide sul netto
                </span>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <dt className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  Costo aziendale
                </dt>
                <dd className="tnum mt-1.5 text-lg">{formatEuro(informational.employerCost)}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </Reveal>
    </div>
  );
}
