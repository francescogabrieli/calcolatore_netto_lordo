import { describe, expect, it } from 'vitest';
import { getTaxParams } from '../../src/params.js';
import {
  calculateMunicipalSurcharge,
  calculateRegionalSurcharge,
} from '../../src/steps/surcharges.js';

const params = getTaxParams(2026);

describe('addizionali locali', () => {
  it('calcola la regionale progressiva per scaglioni', () => {
    const r = calculateRegionalSurcharge(30_000, 'lombardia', params);
    const expected = 15_000 * 0.0123 + 13_000 * 0.0158 + 2_000 * 0.0172;
    expect(r.amount).toBeCloseTo(expected, 6);
  });

  it('applica la modalità flat_by_bracket all’intero imponibile quando configurata', () => {
    const flat = structuredClone(params);
    flat.localSurcharges.regional.lombardia!.mode = 'flat_by_bracket';

    const r = calculateRegionalSurcharge(30_000, 'lombardia', flat);
    expect(r.amount).toBeCloseTo(30_000 * 0.0172, 6);
  });

  it('esenta la comunale sotto la soglia di Milano', () => {
    const r = calculateMunicipalSurcharge(22_999, 'milano', params);
    expect(r.exempt).toBe(true);
    expect(r.amount).toBe(0);
  });

  it('riproduce lo SCALINO: superata la soglia si paga sull’intero imponibile', () => {
    const below = calculateMunicipalSurcharge(22_999, 'milano', params);
    const above = calculateMunicipalSurcharge(23_001, 'milano', params);

    expect(below.amount).toBe(0);
    expect(above.amount).toBeCloseTo(23_001 * 0.008, 6); // ~184 EUR
    // NON e' l'eccedenza (2 × 0,8% = 0,016)
    expect(above.amount).toBeGreaterThan(180);
  });
});
