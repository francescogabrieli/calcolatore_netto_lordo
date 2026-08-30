import { portionInBracket } from '../money.js';
import type { TaxParams } from '../schema.js';

/**
 * Addizionali locali (docs/04 §7).
 *
 * Base di calcolo: il REDDITO IMPONIBILE, non l'IRPEF. E' l'errore piu' comune:
 * l'addizionale e' un'imposta a se', non una maggiorazione dell'IRPEF.
 */
export function calculateRegionalSurcharge(
  totalIncome: number,
  region: string,
  params: TaxParams,
): { amount: number; rateApplied: number; mode: string } {
  const cfg = params.localSurcharges.regional[region];
  if (!cfg) throw new Error(`Addizionale regionale non configurata per: ${region}`);

  if (cfg.mode === 'flat_by_bracket') {
    // aliquota dello scaglione di appartenenza applicata all'INTERO imponibile
    const bracket = cfg.brackets.find((b) => b.upTo === null || totalIncome <= b.upTo);
    const rate = bracket?.rate ?? 0;
    return { amount: totalIncome * rate, rateApplied: rate, mode: cfg.mode };
  }

  let amount = 0;
  let from = 0;
  let lastRate = 0;
  for (const bracket of cfg.brackets) {
    const portion = portionInBracket(totalIncome, from, bracket.upTo);
    if (portion > 0) {
      amount += portion * bracket.rate;
      lastRate = bracket.rate;
    }
    if (bracket.upTo === null) break;
    from = bracket.upTo;
  }

  return { amount, rateApplied: lastRate, mode: cfg.mode };
}

/**
 * Addizionale comunale con esenzione "a scalino" (cliff): superata la soglia si paga
 * sull'INTERO imponibile, non sull'eccedenza. Genera una discontinuita' reale che il
 * motore riproduce e la UI segnala.
 */
export function calculateMunicipalSurcharge(
  totalIncome: number,
  municipality: string,
  params: TaxParams,
): { amount: number; exempt: boolean; threshold: number; rate: number } {
  const cfg = params.localSurcharges.municipal[municipality];
  if (!cfg) throw new Error(`Addizionale comunale non configurata per: ${municipality}`);

  const exempt = cfg.exemptionType === 'cliff' && totalIncome <= cfg.exemptionThreshold;

  return {
    amount: exempt ? 0 : totalIncome * cfg.rate,
    exempt,
    threshold: cfg.exemptionThreshold,
    rate: cfg.rate,
  };
}
