import { describe, expect, it } from 'vitest';
import { getTaxParams } from '../../src/params.js';
import { calculateCuneoDeduction, calculateCuneoExemption } from '../../src/steps/cuneo.js';

const params = getTaxParams(2026);

describe('riduzione del cuneo fiscale', () => {
  it('applica la percentuale corretta per fascia (somma esente)', () => {
    expect(calculateCuneoExemption(8_000, true, params).rate).toBe(0.071);
    expect(calculateCuneoExemption(12_000, true, params).rate).toBe(0.053);
    expect(calculateCuneoExemption(18_000, true, params).rate).toBe(0.048);
  });

  it('non lascia né un buco né un doppio beneficio a cavallo dei 20.000', () => {
    const exemptionBelow = calculateCuneoExemption(19_999, true, params).amount;
    const deductionBelow = calculateCuneoDeduction(19_999, true, params);
    const exemptionAbove = calculateCuneoExemption(20_001, true, params).amount;
    const deductionAbove = calculateCuneoDeduction(20_001, true, params);

    expect(exemptionBelow).toBeGreaterThan(0);
    expect(deductionBelow).toBe(0); // sotto soglia: solo somma esente
    expect(exemptionAbove).toBe(0);
    expect(deductionAbove).toBe(1000); // sopra soglia: solo detrazione
  });

  it('mantiene la detrazione fissa fino a 32.000 e poi la fa decrescere', () => {
    expect(calculateCuneoDeduction(32_000, true, params)).toBe(1000);
    expect(calculateCuneoDeduction(36_000, true, params)).toBeCloseTo(500, 6);
    expect(calculateCuneoDeduction(40_000, true, params)).toBeCloseTo(0, 6);
    expect(calculateCuneoDeduction(40_001, true, params)).toBe(0);
  });

  it('si disattiva quando il beneficio non è richiesto', () => {
    expect(calculateCuneoExemption(15_000, false, params).amount).toBe(0);
    expect(calculateCuneoDeduction(25_000, false, params)).toBe(0);
  });
});
