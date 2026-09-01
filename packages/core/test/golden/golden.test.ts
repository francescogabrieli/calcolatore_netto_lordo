import { describe, expect, it } from 'vitest';
import { calculateNet } from '../../src/calculate.js';
import { getTaxParams } from '../../src/params.js';
import { standardInput } from '../helpers.js';
import reference from './reference-calcolastipendionetto.json';

/**
 * Validazione esterna (docs/05 §4).
 *
 * Il riferimento NON e' la fonte di verita': la fonte e' la normativa. Dove divergiamo,
 * la divergenza e' spiegata in README.md di questa cartella (D1..D5).
 *
 * Confrontiamo la serie "noBonus" perche' quella di default include un bonus di 1.200 EUR
 * che il riferimento concede anche dove la norma non lo prevede (D4).
 */
const params = getTaxParams(2026);
const { additionalRateThreshold, contributionCap } = params.socialSecurity;
const cases = reference.cases;

describe('golden — validazione esterna', () => {
  describe('contributi previdenziali: coincidenza esatta sotto la prima fascia', () => {
    for (const c of cases.filter((x) => x.ral <= additionalRateThreshold)) {
      it(`RAL ${c.ral}`, () => {
        const ours = calculateNet(standardInput(c.ral)).totals.totalContributions;
        expect(Math.round(ours)).toBe(c.noBonus.inps);
      });
    }
  });

  describe('reddito imponibile: coincidenza esatta sotto la prima fascia', () => {
    for (const c of cases.filter((x) => x.ral <= additionalRateThreshold)) {
      it(`RAL ${c.ral}`, () => {
        const step = calculateNet(standardInput(c.ral)).steps.find(
          (s) => s.id === 'taxable_income',
        )!;
        expect(Math.round(step.amount)).toBe(c.noBonus.imponibile);
      });
    }
  });

  /**
   * Il test piu' significativo della suite: l'art. 13 TUIR piu' la detrazione da cuneo
   * fiscale, confrontati con un'implementazione indipendente. Copre il decalage su due
   * fasce, la maggiorazione di 65 EUR e l'azzeramento a 50.000.
   * Vale solo sopra i 20.000: sotto quella soglia il riferimento modella la somma esente
   * come detrazione anziche' come riduzione della base imponibile (D5).
   */
  describe('detrazioni: coincidenza all’euro con un’implementazione indipendente', () => {
    for (const c of cases.filter((x) => x.ral > 20_000 && x.ral <= additionalRateThreshold)) {
      it(`RAL ${c.ral}`, () => {
        const step = calculateNet(standardInput(c.ral)).steps.find((s) => s.id === 'deductions')!;
        expect(Math.round(step.amount)).toBe(c.noBonus.detrazioni);
      });
    }
  });

  describe('netto annuo: scostamento entro la tolleranza motivata', () => {
    for (const c of cases) {
      it(`RAL ${c.ral.toLocaleString('it-IT')} €`, () => {
        const r = calculateNet(standardInput(c.ral));
        const ours = r.totals.netAnnual;

        // divergenze strutturali attese, quantificate a partire dalle norme (README §D1-D5)
        let expected = c.noBonus.netto;

        // D1 — il riferimento ignora contributo aggiuntivo 1% e massimale
        if (c.ral > additionalRateThreshold) {
          const base = Math.min(c.ral, contributionCap);
          expected -= (base - additionalRateThreshold) * 0.01;
          if (c.ral > contributionCap) expected += (c.ral - contributionCap) * 0.0919;
        }

        // D2 — il riferimento non applica il trattamento integrativo
        const supplementary = r.steps.find((s) => s.id === 'supplementary_treatment');
        if (supplementary && supplementary.amount > 0) expected += supplementary.amount;

        // D5 — nella fascia della somma esente il riferimento tratta il beneficio come
        // DETRAZIONE (sconto pieno sull'imposta) anziche' come riduzione della base
        // imponibile (sconto pari all'aliquota marginale). La norma parla di "somma che
        // non concorre alla formazione del reddito": la nostra lettura e' quella corretta,
        // quindi qui accettiamo uno scostamento piu' ampio invece di inseguirli.
        const hasExemption = r.steps.some((s) => s.id === 'cuneo_exemption');
        const tolerance = hasExemption ? 0.06 : 0.03;

        const deviation = Math.abs(ours - expected) / expected;
        expect(
          deviation,
          `nostro ${ours.toFixed(2)} vs riferimento rettificato ${expected.toFixed(2)}`,
        ).toBeLessThan(tolerance);
      });
    }
  });

  it('la nostra convenzione sul netto mensile coincide con quella del riferimento', () => {
    const c = cases.find((x) => x.ral === 30_000)!;
    const r = calculateNet(standardInput(c.ral));
    expect(r.totals.netMonthly).toBeCloseTo(r.totals.netAnnual / 14, 1);
  });
});
