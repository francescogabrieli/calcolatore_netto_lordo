import type { TaxParams } from '../schema.js';

export type ContributionsResult = {
  total: number;
  baseAmount: number;
  additionalAmount: number;
  contributionBase: number;
  cappedAt: number | null;
  rate: number;
};

/**
 * Contributi previdenziali a carico del lavoratore (docs/04 §1).
 *
 * Due dettagli che i calcolatori semplificati sbagliano:
 *  - il MASSIMALE (L. 335/1995 art. 2 co. 18) congela la base contributiva;
 *  - il contributo aggiuntivo dell'1% (L. 438/1992 art. 3-ter) si applica SOLO alla
 *    quota eccedente la prima fascia di retribuzione pensionabile, non all'intera
 *    retribuzione (non e' "aliquota 10,19% su tutto").
 */
export function calculateContributions(
  grossAnnualSalary: number,
  isApprenticeship: boolean,
  params: TaxParams,
): ContributionsResult {
  const ss = params.socialSecurity;

  const isCapped = grossAnnualSalary > ss.contributionCap;
  const contributionBase = Math.min(grossAnnualSalary, ss.contributionCap);

  const rate = isApprenticeship ? ss.apprenticeshipRate : ss.employeeRate;
  const baseAmount = contributionBase * rate;

  const excess = Math.max(0, contributionBase - ss.additionalRateThreshold);
  const additionalAmount = excess * ss.additionalRate;

  return {
    total: baseAmount + additionalAmount,
    baseAmount,
    additionalAmount,
    contributionBase,
    cappedAt: isCapped ? ss.contributionCap : null,
    rate,
  };
}
