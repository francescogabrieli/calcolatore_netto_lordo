import { describe, expect, it } from 'vitest';
import { getTaxParams } from '../../src/params.js';
import { calculateSupplementaryTreatment } from '../../src/steps/supplementary.js';

const params = getTaxParams(2026);

describe('trattamento integrativo', () => {
  it('spetta sotto i 15.000 quando c’è capienza', () => {
    const r = calculateSupplementaryTreatment(13_000, 3_000, 1_955, 365, params);
    expect(r.amount).toBe(1200);
    expect(r.hasCapacity).toBe(true);
  });

  it('non spetta in assenza di capienza', () => {
    const r = calculateSupplementaryTreatment(13_000, 1_000, 1_955, 365, params);
    expect(r.amount).toBe(0);
    expect(r.hasCapacity).toBe(false);
  });

  it('si ragguaglia ai giorni di lavoro', () => {
    const r = calculateSupplementaryTreatment(13_000, 3_000, 1_955, 182, params);
    expect(r.amount).toBeCloseTo(1200 * (182 / 365), 6);
  });

  it('segnala la fascia 15.000-28.000 come non determinabile', () => {
    const r = calculateSupplementaryTreatment(20_000, 5_000, 1_500, 365, params);
    expect(r.amount).toBe(0);
    expect(r.inUncertainBand).toBe(true);
  });

  it('non spetta oltre i 28.000 e non genera avviso', () => {
    const r = calculateSupplementaryTreatment(35_000, 9_000, 1_000, 365, params);
    expect(r.amount).toBe(0);
    expect(r.inUncertainBand).toBe(false);
  });
});
