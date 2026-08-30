import type { TaxParams } from '../schema.js';

/**
 * Riduzione del cuneo fiscale (docs/04 §3 e §5.3).
 *
 * Due misure alternative e mutuamente esclusive:
 *  (a) SOMMA ESENTE, fino a 20.000: riduce la BASE IMPONIBILE (non l'imposta);
 *  (b) DETRAZIONE, da 20.000 a 40.000: riduce l'IMPOSTA.
 *
 * Confonderle cambia il risultato: la (a) vale l'aliquota marginale dell'importo,
 * la (b) vale l'importo pieno.
 */
export function calculateCuneoExemption(
  taxableIncome: number,
  applyBenefit: boolean,
  params: TaxParams,
): { amount: number; rate: number } {
  const { exemption } = params.cuneo;
  if (!applyBenefit || taxableIncome > exemption.maxIncome) return { amount: 0, rate: 0 };

  const band = exemption.bands.find((b) => taxableIncome <= b.upTo) ?? exemption.bands.at(-1);
  const rate = band?.rate ?? 0;
  return { amount: taxableIncome * rate, rate };
}

export function calculateCuneoDeduction(
  totalIncome: number,
  applyBenefit: boolean,
  params: TaxParams,
): number {
  const d = params.cuneo.deduction;
  if (!applyBenefit || totalIncome <= d.from || totalIncome > d.zeroAt) return 0;
  if (totalIncome <= d.flatUpTo) return d.amount;

  // decalage lineare fino ad azzerarsi a `zeroAt`
  return (d.amount * (d.zeroAt - totalIncome)) / (d.zeroAt - d.flatUpTo);
}
