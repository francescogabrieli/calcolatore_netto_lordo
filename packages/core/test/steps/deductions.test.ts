import { describe, expect, it } from 'vitest';
import { truncate4 } from '../../src/money.js';
import { getTaxParams } from '../../src/params.js';
import { calculationInputSchema } from '../../src/schema.js';
import { calculateEmployeeDeduction } from '../../src/steps/deductions.js';
import { standardInput } from '../helpers.js';

const params = getTaxParams(2026);
const input = (overrides = {}) => calculationInputSchema.parse(standardInput(30_000, overrides));

describe('detrazione da lavoro dipendente (art. 13 TUIR)', () => {
  it('vale 1.955 nella prima fascia', () => {
    expect(calculateEmployeeDeduction(14_000, input(), params)).toBeCloseTo(1955, 6);
  });

  it('attraversa la soglia dei 15.000 senza salti anomali', () => {
    const below = calculateEmployeeDeduction(14_999, input(), params);
    const above = calculateEmployeeDeduction(15_001, input(), params);
    expect(below).toBeCloseTo(1955, 6);
    expect(above).toBeCloseTo(1910 + 1190 * ((28_000 - 15_001) / 13_000), 3);
  });

  it('aggiunge i 65 euro solo sopra 25.000', () => {
    const at = calculateEmployeeDeduction(25_000, input(), params);
    const above = calculateEmployeeDeduction(25_001, input(), params);
    expect(above - at).toBeGreaterThan(60);
  });

  it('toglie i 65 euro sopra 35.000', () => {
    const at = calculateEmployeeDeduction(35_000, input(), params);
    const above = calculateEmployeeDeduction(35_001, input(), params);
    expect(at - above).toBeGreaterThan(60);
  });

  it('azzera la detrazione SECCO oltre 50.000 (discontinuità della norma)', () => {
    expect(calculateEmployeeDeduction(50_000, input(), params)).toBeCloseTo(0, 6);
    expect(calculateEmployeeDeduction(50_000.01, input(), params)).toBe(0);
    expect(calculateEmployeeDeduction(50_001, input(), params)).toBe(0);
  });

  it('ragguaglia ai giorni ma NON la maggiorazione di 65 euro', () => {
    const full = calculateEmployeeDeduction(30_000, input({ employmentDays: 365 }), params);
    const half = calculateEmployeeDeduction(30_000, input({ employmentDays: 182 }), params);

    const baseFull = full - 65;
    const baseHalf = half - 65;
    expect(baseHalf).toBeCloseTo(baseFull * (182 / 365), 4);
    // se i 65 fossero ragguagliati, half sarebbe (full) × 182/365
    expect(half).not.toBeCloseTo(full * (182 / 365), 2);
  });

  it('applica il minimo garantito quando il ragguaglio lo porterebbe sotto', () => {
    const d = calculateEmployeeDeduction(10_000, input({ employmentDays: 60 }), params);
    expect(d).toBe(690); // 1955 × 60/365 = 321 < 690
  });

  it('usa il minimo maggiorato per il tempo determinato', () => {
    const d = calculateEmployeeDeduction(
      10_000,
      input({ employmentDays: 60, contractType: 'fixed_term' }),
      params,
    );
    expect(d).toBe(1380);
  });

  it('TRONCA alla quarta cifra decimale, non arrotonda', () => {
    // reddito scelto perche' la formula produce molte cifre decimali
    const income = 20_001;
    const raw = 1910 + 1190 * ((28_000 - income) / 13_000);
    const truncated = truncate4(raw);
    const rounded = Math.round(raw * 10_000) / 10_000;

    expect(truncated).not.toBe(rounded); // il caso e' effettivamente discriminante
    expect(calculateEmployeeDeduction(income, input(), params)).toBeCloseTo(truncated, 10);
  });
});
