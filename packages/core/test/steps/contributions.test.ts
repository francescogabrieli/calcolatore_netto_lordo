import { describe, expect, it } from 'vitest';
import { getTaxParams } from '../../src/params.js';
import { calculateContributions } from '../../src/steps/contributions.js';

const params = getTaxParams(2026);
const { additionalRateThreshold, contributionCap, employeeRate } = params.socialSecurity;

describe('contributi previdenziali', () => {
  it('applica il 9,19% sotto la prima fascia, senza contributo aggiuntivo', () => {
    const r = calculateContributions(30_000, false, params);
    expect(r.total).toBeCloseTo(30_000 * employeeRate, 6);
    expect(r.additionalAmount).toBe(0);
  });

  it('non applica il contributo aggiuntivo esattamente SULLA soglia', () => {
    const r = calculateContributions(additionalRateThreshold, false, params);
    expect(r.additionalAmount).toBe(0);
  });

  it('applica l’1% SOLO alla quota eccedente, non a tutta la retribuzione', () => {
    const gross = additionalRateThreshold + 1000;
    const r = calculateContributions(gross, false, params);

    expect(r.additionalAmount).toBeCloseTo(10, 6); // 1000 × 1%
    // l'errore classico sarebbe gross × 10,19%
    expect(r.total).not.toBeCloseTo(gross * (employeeRate + 0.01), 2);
    expect(r.total).toBeCloseTo(gross * employeeRate + 10, 6);
  });

  it('congela la base contributiva al massimale', () => {
    const r = calculateContributions(contributionCap + 50_000, false, params);
    expect(r.contributionBase).toBe(contributionCap);
    expect(r.cappedAt).toBe(contributionCap);

    const atCap = calculateContributions(contributionCap, false, params);
    expect(r.total).toBeCloseTo(atCap.total, 6);
  });

  it('usa l’aliquota agevolata per l’apprendistato', () => {
    const r = calculateContributions(25_000, true, params);
    expect(r.rate).toBe(params.socialSecurity.apprenticeshipRate);
    expect(r.total).toBeCloseTo(25_000 * 0.0584, 6);
  });
});
