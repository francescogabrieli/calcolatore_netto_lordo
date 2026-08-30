import type { TaxParams } from '../schema.js';

/**
 * Trattamento integrativo - D.L. 3/2020 (docs/04 §8).
 *
 * Nella fascia 15.000-28.000 la spettanza dipende da detrazioni che un calcolatore
 * NON puo' conoscere (spese mediche, mutui, bonus edilizi): per prudenza lo
 * escludiamo e lo dichiariamo (assunzione A5), invece di promettere soldi incerti.
 */
export function calculateSupplementaryTreatment(
  totalIncome: number,
  grossTax: number,
  employeeDeduction: number,
  employmentDays: number,
  params: TaxParams,
): { amount: number; inUncertainBand: boolean; hasCapacity: boolean } {
  const st = params.supplementaryTreatment;

  if (totalIncome <= st.incomeLimit) {
    const hasCapacity = grossTax > employeeDeduction;
    return {
      amount: hasCapacity ? st.amount * (employmentDays / 365) : 0,
      inUncertainBand: false,
      hasCapacity,
    };
  }

  return {
    amount: 0,
    inUncertainBand: totalIncome <= st.uncertainBandTo,
    hasCapacity: false,
  };
}
