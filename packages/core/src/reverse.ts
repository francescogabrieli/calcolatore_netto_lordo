import { calculateNet } from './calculate.js';
import {
  reverseCalculationInputSchema,
  type CalculationInputRaw,
  type CalculationResult,
  type ReverseCalculationInputRaw,
} from './schema.js';

const MAX_GROSS = 2_000_000;
const TOLERANCE_EUR = 0.5;
const MAX_ITERATIONS = 60;

/**
 * Calcolo inverso: trova la RAL che produce il netto annuo desiderato.
 *
 * Il motore diretto (calculateNet) non si inverte in forma chiusa — scaglioni IRPEF,
 * detrazioni a decalage e soglie di esenzione lo rendono un'unica funzione a tratti.
 * Ma è monotona crescente in gross (più lordo → mai meno netto), quindi la bisezione
 * sul motore stesso converge senza bisogno di derivarla: stessa fonte di verità,
 * nessuna formula duplicata da tenere sincronizzata.
 */
export function calculateGrossFromNet(
  rawInput: ReverseCalculationInputRaw,
  taxYear = 2026,
): CalculationResult {
  const { targetNetAnnual, ...rest } = reverseCalculationInputSchema.parse(rawInput);

  let low = 0;
  let high = MAX_GROSS;
  let mid = high / 2;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    mid = (low + high) / 2;
    const probe = calculateNet(
      { ...rest, grossAnnualSalary: mid } as CalculationInputRaw,
      taxYear,
      { computeMarginalRate: false },
    );

    const diff = probe.totals.netAnnual - targetNetAnnual;
    if (Math.abs(diff) < TOLERANCE_EUR) break;

    if (diff < 0) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return calculateNet({ ...rest, grossAnnualSalary: mid } as CalculationInputRaw, taxYear);
}
