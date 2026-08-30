import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { calculateNet } from '../src/calculate.js';
import { getTaxParams } from '../src/params.js';
import { standardInput } from './helpers.js';

const params = getTaxParams(2026);
const municipalThreshold = params.localSurcharges.municipal.milano!.exemptionThreshold;

/** RAL nel range realistico, evitando l'intorno dello scalino comunale (testato a parte). */
const ral = fc
  .integer({ min: 5_000, max: 300_000 })
  .filter((v) => Math.abs(v - municipalThreshold / 0.9081) > 2_000);

const net = (v: number) => calculateNet(standardInput(v));

describe('invarianti del motore (property-based)', () => {
  it('P1 — monotonia: guadagnare di più non fa mai scendere il netto', () => {
    fc.assert(
      fc.property(ral, fc.integer({ min: 100, max: 20_000 }), (base, delta) => {
        expect(net(base + delta).totals.netAnnual).toBeGreaterThanOrEqual(
          net(base).totals.netAnnual - 0.01,
        );
      }),
      { numRuns: 150 },
    );
  });

  it('P2 — quadratura: la somma delle voci mostrate è il netto mostrato', () => {
    fc.assert(
      fc.property(ral, (value) => {
        const r = net(value);
        // gli step 'neutral' sono viste intermedie, non movimenti: si escludono
        const movements = r.steps
          .filter((s) => s.sign !== 'neutral')
          .filter((s) => s.id !== 'irpef_gross' && s.id !== 'deductions')
          .reduce((sum, s) => sum + s.amount, 0);

        expect(r.totals.gross + movements).toBeCloseTo(r.totals.netAnnual, 1);
      }),
      { numRuns: 100 },
    );
  });

  it('P3 — il netto è positivo e non supera il lordo, salvo trattamento integrativo', () => {
    fc.assert(
      fc.property(ral, (value) => {
        const r = net(value);
        const supplementary = r.steps.find((s) => s.id === 'supplementary_treatment')?.amount ?? 0;

        expect(r.totals.netAnnual).toBeGreaterThan(0);
        // il trattamento integrativo e' una somma EROGATA, non una minore trattenuta:
        // sui redditi bassi puo' legittimamente portare il netto sopra il lordo
        expect(r.totals.netAnnual).toBeLessThanOrEqual(value + supplementary + 0.01);
      }),
      { numRuns: 100 },
    );
  });

  it('P4 — l’aliquota effettiva resta in un intervallo plausibile', () => {
    fc.assert(
      fc.property(ral, (value) => {
        const r = net(value);
        const supplementary = r.steps.find((s) => s.id === 'supplementary_treatment')?.amount ?? 0;

        expect(r.totals.effectiveRate).toBeLessThan(0.6);
        if (supplementary === 0) expect(r.totals.effectiveRate).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it('sui redditi bassi il trattamento integrativo può portare il netto sopra il lordo', () => {
    // comportamento REALE del sistema: il trattamento integrativo e' erogato in busta paga,
    // non e' una minore trattenuta. Documentato invece che nascosto da un clamp.
    const r = net(9_885);
    const supplementary = r.steps.find((s) => s.id === 'supplementary_treatment')!;

    expect(supplementary.amount).toBeGreaterThan(0);
    expect(r.totals.netAnnual).toBeGreaterThan(9_885);
    expect(r.totals.effectiveRate).toBeLessThan(0);
  });

  it('P5 — l’IRPEF netta non è mai negativa', () => {
    fc.assert(
      fc.property(ral, (value) => {
        const step = net(value).steps.find((s) => s.id === 'irpef_net')!;
        expect(step.amount).toBeLessThanOrEqual(0);
      }),
      { numRuns: 100 },
    );
  });

  it('P6 — netto mensile × mensilità = netto annuo', () => {
    fc.assert(
      fc.property(ral, fc.constantFrom(12, 13, 14, 15), (value, months) => {
        const r = calculateNet(standardInput(value, { monthlyPayments: months as 12 }));
        // netMonthly e' arrotondato ai centesimi: l'errore di ricomposizione e' al piu'
        // mezzo centesimo per mensilita'
        const drift = Math.abs(r.totals.netMonthly * months - r.totals.netAnnual);
        expect(drift).toBeLessThan(months * 0.005 + 0.01);
      }),
      { numRuns: 60 },
    );
  });

  it('P7 — l’aliquota marginale supera l’effettiva (sistema progressivo)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 16_000, max: 200_000 }), (value) => {
        const { marginalRate, effectiveRate } = net(value).totals;
        expect(marginalRate).toBeGreaterThanOrEqual(effectiveRate - 0.001);
      }),
      { numRuns: 100 },
    );
  });

  it('la sola discontinuità ammessa è lo scalino dell’addizionale comunale', () => {
    // isolata invece che nascosta: e' una discontinuita' REALE della norma
    const before = calculateNet(standardInput(25_320));
    const after = calculateNet(standardInput(25_340));

    const municipalBefore = before.steps.find((s) => s.id === 'municipal_surcharge')!;
    const municipalAfter = after.steps.find((s) => s.id === 'municipal_surcharge')!;

    expect(Math.abs(municipalBefore.amount)).toBe(0);
    expect(municipalAfter.amount).toBeLessThan(-180);
    expect(after.totals.netAnnual).toBeLessThan(before.totals.netAnnual);
  });
});
