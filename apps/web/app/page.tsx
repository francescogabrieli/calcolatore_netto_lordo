'use client';

import type { CalculationResult, SharedCalculationFields } from '@cnl/core';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { CalculatorForm, type CalculationMode } from '@/components/calculator-form';
import { Reveal } from '@/components/reveal';
import { ResultsPanel } from '@/components/results-panel';
import { ThemeToggle } from '@/components/theme-toggle';
import { Card, CardBody } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { calculationClient } from '@/lib/clients';
import { formatEuro, formatEuroCompact } from '@/lib/format';
import { decodeShareableCalculation, encodeShareableCalculation } from '@/lib/share';

const DEFAULT_SHARED: SharedCalculationFields = {
  monthlyPayments: 14,
  region: 'lombardia',
  municipality: 'milano',
  employmentDays: 365,
  contractType: 'permanent',
  isApprenticeship: false,
  dependents: { spouse: false, children21to30: 0, childrenSharePercent: 100, otherDependents: 0 },
  taxFreeBenefits: 0,
  applyCuneoBenefit: true,
};

const DEFAULT_AMOUNT = 30000;

/** Altezza della barra fissa in cima: sotto questa quota la sintesi e' coperta. */
const HEADER_HEIGHT = 69;

export default function Home() {
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [mode, setMode] = useState<CalculationMode>('direct');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [initial, setInitial] = useState({
    mode: 'direct' as CalculationMode,
    amount: DEFAULT_AMOUNT,
    fields: DEFAULT_SHARED,
  });
  const [formKey, setFormKey] = useState('default');
  const [summaryOffScreen, setSummaryOffScreen] = useState(false);

  const handleCalculate = useCallback(
    (calcMode: CalculationMode, amount: number, shared: SharedCalculationFields) => {
      setError(null);
      startTransition(async () => {
        try {
          const next =
            calcMode === 'direct'
              ? await calculationClient.calculate({ ...shared, grossAnnualSalary: amount })
              : await calculationClient.calculateFromNet({ ...shared, targetNetAnnual: amount });
          setMode(calcMode);
          setResult(next);
          // L'URL segue sempre l'ultimo calcolo: "Copia link" copia la barra
          // degli indirizzi, senza un secondo stato da tenere allineato.
          window.history.replaceState(
            null,
            '',
            encodeShareableCalculation({ mode: calcMode, amount, fields: shared }),
          );
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Errore durante il calcolo');
        }
      });
    },
    [],
  );

  /*
   * Un link condiviso arriva gia' con il calcolo dentro: si legge dall'URL invece
   * che da useSearchParams, cosi' la pagina resta prerenderizzabile e non serve
   * un confine di Suspense per un dato che interessa solo dopo l'idratazione.
   */
  useEffect(() => {
    const shared = decodeShareableCalculation(window.location.search, DEFAULT_SHARED);
    if (!shared) return;
    setInitial(shared);
    setFormKey('shared');
    handleCalculate(shared.mode, shared.amount, shared.fields);
  }, [handleCalculate]);

  /*
   * Quando la sintesi esce di scena sotto l'header, il numero che conta risale
   * nella barra: scorrendo la traccia di calcolo si continua a vedere il totale
   * a cui tutte quelle righe portano. Serve uno stato che va e viene, non un
   * evento una tantum, quindi si misura la posizione invece di osservare soglie.
   */
  useEffect(() => {
    if (!result) {
      setSummaryOffScreen(false);
      return;
    }

    let frame = 0;
    const check = () => {
      frame = 0;
      // La sintesi vive dentro ResultsPanel: la si trova dov'e', invece di far
      // passare una ref attraverso un componente che non ha motivo di riceverla.
      const card = document.querySelector('[data-summary-card]');
      setSummaryOffScreen(!!card && card.getBoundingClientRect().bottom < HEADER_HEIGHT);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    check();

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [result]);

  const headline = result
    ? mode === 'reverse'
      ? { label: 'RAL necessaria', value: result.totals.gross, tone: 'var(--accent)' }
      : { label: 'Netto annuo', value: result.totals.netAnnual, tone: 'var(--positive)' }
    : null;

  return (
    <div className="relative isolate min-h-screen">
      {/* L'alone vive sulla radice, non nella sezione: dentro un contenitore a
          larghezza limitata i suoi bordi sarebbero un rettangolo visibile. */}
      <span aria-hidden className="hero-glow" />
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2.5">
            <span className="pill size-8 font-mono text-xs">€</span>
            <span className="eyebrow">Netto/Lordo</span>
          </span>

          <div className="flex items-center gap-4">
            {headline && (
              <span
                aria-hidden
                data-testid="header-summary"
                className={cn(
                  'header-summary hidden items-baseline gap-2 sm:flex',
                  summaryOffScreen && 'header-summary-visible',
                )}
              >
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  {headline.label}
                </span>
                <span className="tnum text-display text-lg" style={{ color: headline.tone }}>
                  {formatEuroCompact(headline.value)}
                </span>
              </span>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-10 pt-16 sm:pb-16 sm:pt-24">
        <Reveal>
          <span className="eyebrow">
            Calcolo stipendio · Anno d’imposta 2026 · Milano, Lombardia
          </span>
        </Reveal>
        <Reveal delay={90}>
          <h1 className="text-display mt-5 text-6xl sm:text-7xl">
            Dal lordo al netto,
            <br />
            <span style={{ color: 'var(--accent)' }}>e ritorno.</span>
          </h1>
        </Reveal>
        <Reveal delay={180}>
          <p className="mt-6 max-w-2xl text-lg text-[var(--text-body)] sm:text-xl">
            Parti dalla RAL e scopri il netto, o parti dal netto che vuoi portare a casa e scopriamo
            insieme la RAL da chiedere — stesso motore, stessa traccia di calcolo, voce per voce.
          </p>
        </Reveal>
      </section>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <Reveal delay={60}>
          <CalculatorForm
            key={formKey}
            onCalculate={handleCalculate}
            isPending={isPending}
            defaultMode={initial.mode}
            defaultValues={initial.fields}
            defaultAmount={initial.amount}
          />
        </Reveal>

        {/*
          Regione live sempre montata: un aria-live aggiunto al DOM insieme al suo
          contenuto non verrebbe annunciato. Cosi' chi usa uno screen reader sente
          l'esito senza doverlo andare a cercare piu' in basso nella pagina.
        */}
        <p role="status" aria-live="polite" className="sr-only">
          {isPending
            ? 'Calcolo in corso'
            : error
              ? `Errore: ${error}`
              : result
                ? mode === 'reverse'
                  ? `RAL necessaria: ${formatEuro(result.totals.gross)} lordi l’anno.`
                  : `Retribuzione netta annua: ${formatEuro(result.totals.netAnnual)}, pari a ${formatEuro(result.totals.netMonthly)} per ${result.input.monthlyPayments} mensilità.`
                : ''}
        </p>

        <div className="mt-6 space-y-4">
          {error && (
            <Card className="animate-in border-[var(--negative)]/40">
              <CardBody className="pt-6 text-sm text-[var(--negative)]">{error}</CardBody>
            </Card>
          )}

          {!result && !error && (
            <Card>
              <CardBody className="flex min-h-[180px] flex-col items-center justify-center gap-2 pt-6 text-center">
                <p className="eyebrow">Nessun calcolo ancora eseguito</p>
                <p className="max-w-sm text-xs text-[var(--text-muted)]">
                  Inserisci un importo e premi il pulsante. Vedrai il risultato e ogni voce
                  trattenuta con la formula applicata e il riferimento normativo.
                </p>
              </CardBody>
            </Card>
          )}

          {result && (
            <div className="animate-in">
              <ResultsPanel result={result} mode={mode} />
            </div>
          )}
        </div>

        <footer className="mt-14 border-t border-[var(--border)] pt-6 text-xs text-[var(--text-muted)]">
          <p>
            Prototipo a scopo dimostrativo. Il calcolo assume un impiegato a tempo indeterminato,
            residente a Milano, senza agevolazioni e senza altri redditi. Le semplificazioni
            adottate sono documentate nel repository.
          </p>
        </footer>
      </main>
    </div>
  );
}
