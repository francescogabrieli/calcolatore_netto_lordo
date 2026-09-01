import { truncate4 } from '../money.js';
import type { CalculationInput, TaxParams } from '../schema.js';

/**
 * Detrazione per redditi da lavoro dipendente - art. 13 co. 1 e 1-bis TUIR (docs/04 §5.1).
 *
 * Tre trappole implementative, tutte coperte da test:
 *  1. TRONCAMENTO alla quarta cifra decimale (non arrotondamento);
 *  2. la maggiorazione di 65 EUR NON si ragguaglia ai giorni (Circ. AdE 4/2022);
 *  3. oltre 50.000 la detrazione e' 0 SECCO: e' una discontinuita' della norma,
 *     non un errore, e va riprodotta.
 */
export function calculateEmployeeDeduction(
  totalIncome: number,
  input: CalculationInput,
  params: TaxParams,
): number {
  const ed = params.employeeDeduction;
  const daysRatio = input.employmentDays / 365;

  const band = ed.bands.find((b) => b.upTo === null || totalIncome <= b.upTo);
  if (!band || band.type === 'none') return 0;

  let deduction: number;

  if (band.type === 'flat') {
    const proRated = (band.amount ?? 0) * daysRatio;
    const minimum = input.contractType === 'fixed_term' ? ed.minimumFixedTerm : ed.minimumPermanent;
    // il minimo garantito prevale sul ragguaglio ai giorni
    deduction = Math.max(proRated, minimum);
  } else {
    const base = band.base ?? 0;
    const extra = band.extra ?? 0;
    const ceiling = band.ceiling ?? 0;
    const span = band.span ?? 1;

    const raw = base + extra * ((ceiling - totalIncome) / span);
    deduction = truncate4(raw) * daysRatio;
  }

  // maggiorazione art. 13 co. 1-bis: NON ragguagliata al periodo di lavoro
  const s = ed.surcharge;
  if (totalIncome > s.from && totalIncome <= s.to) {
    deduction += s.proRated ? s.amount * daysRatio : s.amount;
  }

  return Math.max(0, deduction);
}

/**
 * Detrazioni per familiari a carico - art. 12 TUIR (docs/04 §5.2).
 *
 * Nota di dominio: i figli SOTTO i 21 anni non danno piu' detrazione dal marzo 2022,
 * sostituita dall'Assegno Unico Universale INPS. Per questo si considerano solo i
 * figli 21-30 anni.
 *
 * ATTENZIONE: confidence 'low' nei parametri - formule da confermare sul testo vigente.
 */
export function calculateFamilyDeductions(
  totalIncome: number,
  input: CalculationInput,
  params: TaxParams,
): { total: number; breakdown: { label: string; amount: number }[] } {
  const fd = params.familyDeductions;
  const breakdown: { label: string; amount: number }[] = [];
  const { spouse, children21to30, childrenSharePercent, otherDependents } = input.dependents;

  if (spouse) {
    const s = fd.spouse;
    let amount = 0;

    if (totalIncome <= s.band1.upTo) {
      amount = s.band1.base - s.band1.subtract * (totalIncome / s.band1.over);
    } else if (totalIncome <= s.band2.upTo) {
      amount = s.band2.amount;
      const increment = s.increments.find((i) => totalIncome > i.from && totalIncome <= i.to);
      if (increment) amount += increment.amount;
    } else if (totalIncome <= s.band3.upTo) {
      amount = (s.band3.base * (s.band3.ceiling - totalIncome)) / s.band3.span;
    }

    amount = Math.max(0, amount);
    if (amount > 0) breakdown.push({ label: 'Coniuge a carico', amount });
  }

  if (children21to30 > 0) {
    const c = fd.child21to30;
    // il tetto cresce di 15.000 per ogni figlio oltre il primo
    const ceiling = c.ceiling + c.ceilingIncrementPerExtraChild * (children21to30 - 1);
    const perChild = Math.max(0, (c.amount * (ceiling - totalIncome)) / ceiling);
    const amount = perChild * children21to30 * (childrenSharePercent / 100);
    if (amount > 0) {
      breakdown.push({
        label: `Figli a carico 21-30 anni (${children21to30}, quota ${childrenSharePercent}%)`,
        amount,
      });
    }
  }

  if (otherDependents > 0) {
    const o = fd.otherDependent;
    const amount = Math.max(
      0,
      ((o.amount * (o.ceiling - totalIncome)) / o.ceiling) * otherDependents,
    );
    if (amount > 0)
      breakdown.push({ label: `Altri familiari a carico (${otherDependents})`, amount });
  }

  return { total: breakdown.reduce((sum, b) => sum + b.amount, 0), breakdown };
}
