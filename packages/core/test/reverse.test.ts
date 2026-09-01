import { describe, expect, it } from 'vitest';
import { calculateGrossFromNet } from '../src/reverse.js';
import { calculateNet } from '../src/calculate.js';
import { standardInput } from './helpers.js';

const reverseInput = (targetNetAnnual: number) => ({
  targetNetAnnual,
  monthlyPayments: 14 as const,
  region: 'lombardia' as const,
  municipality: 'milano' as const,
});

describe('calculateGrossFromNet', () => {
  it.each([15000, 20000, 24999, 30000, 45000, 60000, 90000, 150000])(
    'inverte %i € di netto entro 1 € di RAL (round-trip)',
    (grossAnnualSalary) => {
      const forward = calculateNet(standardInput(grossAnnualSalary));
      const { grossAnnualSalary: recoveredGross } = calculateGrossFromNet(
        reverseInput(forward.totals.netAnnual),
      ).input;

      expect(Math.abs(recoveredGross - grossAnnualSalary)).toBeLessThan(1);
    },
  );

  it('il netto ottenuto dalla RAL trovata coincide con il target entro il centesimo', () => {
    const target = 23425.52;
    const result = calculateGrossFromNet(reverseInput(target));

    expect(Math.abs(result.totals.netAnnual - target)).toBeLessThan(0.5);
  });

  it('rifiuta un netto desiderato non positivo (stessa validazione Zod del motore diretto)', () => {
    expect(() => calculateGrossFromNet(reverseInput(0))).toThrow();
    expect(() => calculateGrossFromNet(reverseInput(-100))).toThrow();
  });
});
