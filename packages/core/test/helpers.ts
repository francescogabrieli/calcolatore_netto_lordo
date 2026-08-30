import type { CalculationInputRaw } from '../src/schema.js';

/** Profilo standard: impiegato a Milano, tempo indeterminato, anno intero. */
export function standardInput(
  grossAnnualSalary: number,
  overrides: Partial<CalculationInputRaw> = {},
): CalculationInputRaw {
  return {
    grossAnnualSalary,
    monthlyPayments: 14,
    region: 'lombardia',
    municipality: 'milano',
    ...overrides,
  };
}
