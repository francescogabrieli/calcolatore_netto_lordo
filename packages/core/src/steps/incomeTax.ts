import { portionInBracket } from '../money.js';
import type { BracketDetail, TaxParams } from '../schema.js';

/**
 * IRPEF lorda per scaglioni progressivi (docs/04 §4).
 * Ogni scaglione tassa SOLO la porzione di reddito che vi ricade: a 28.001 EUR
 * si pagano 28.000 al 23% e 1 euro al 33%, non tutto al 33%.
 */
export function calculateGrossTax(
  totalIncome: number,
  params: TaxParams,
): { tax: number; detail: BracketDetail[] } {
  const detail: BracketDetail[] = [];
  let tax = 0;
  let from = 0;

  for (const bracket of params.irpef.brackets) {
    const taxableInBracket = portionInBracket(totalIncome, from, bracket.upTo);
    if (taxableInBracket > 0) {
      const bracketTax = taxableInBracket * bracket.rate;
      tax += bracketTax;
      detail.push({
        from,
        to: bracket.upTo,
        rate: bracket.rate,
        taxableInBracket,
        tax: bracketTax,
      });
    }
    if (bracket.upTo === null) break;
    from = bracket.upTo;
  }

  return { tax, detail };
}
