import { describe, expect, it } from 'vitest';
import { getTaxParams } from '../../src/params.js';
import { calculateGrossTax } from '../../src/steps/incomeTax.js';

const params = getTaxParams(2026);

describe('IRPEF lorda per scaglioni', () => {
  it('tassa interamente al 23% fino a 28.000', () => {
    expect(calculateGrossTax(28_000, params).tax).toBeCloseTo(28_000 * 0.23, 6);
  });

  it('a 28.001 tassa 1 euro al 33%, non tutto il reddito', () => {
    const { tax } = calculateGrossTax(28_001, params);
    expect(tax).toBeCloseTo(28_000 * 0.23 + 1 * 0.33, 6);
    expect(tax).not.toBeCloseTo(28_001 * 0.33, 2);
  });

  it('somma correttamente i tre scaglioni', () => {
    const { tax, detail } = calculateGrossTax(60_000, params);
    const expected = 28_000 * 0.23 + 22_000 * 0.33 + 10_000 * 0.43;
    expect(tax).toBeCloseTo(expected, 6);
    expect(detail).toHaveLength(3);
    expect(detail.reduce((s, d) => s + d.tax, 0)).toBeCloseTo(tax, 6);
  });

  it('restituisce zero su reddito nullo', () => {
    expect(calculateGrossTax(0, params).tax).toBe(0);
  });
});
