import type { SharedCalculationFields } from '@cnl/core';

export type ShareableCalculation = {
  mode: 'direct' | 'reverse';
  amount: number;
  fields: SharedCalculationFields;
};

/*
 * Serializzazione degli input in query string (docs/06 §9): rende un calcolo
 * condivisibile e riproducibile — allegare un link a un caso golden vale piu'
 * di descriverlo a parole. Nessuno stato sul server, nessun identificatore:
 * il link *e'* l'input.
 *
 * Chiavi corte ma leggibili: un URL condiviso lo si legge anche a occhio.
 */
const KEYS = {
  mode: 'm',
  amount: 'a',
  monthlyPayments: 'mens',
  employmentDays: 'gg',
  contractType: 'contratto',
  spouse: 'coniuge',
  children: 'figli',
  childrenShare: 'quota',
  others: 'altri',
  benefits: 'welfare',
  apprenticeship: 'apprendistato',
  cuneo: 'cuneo',
} as const;

export function encodeShareableCalculation({ mode, amount, fields }: ShareableCalculation): string {
  const p = new URLSearchParams();
  p.set(KEYS.mode, mode === 'reverse' ? 'n' : 'l');
  p.set(KEYS.amount, String(Math.round(amount)));
  p.set(KEYS.monthlyPayments, String(fields.monthlyPayments));

  // Solo cio' che si discosta dal caso base: un link corto si legge, uno lungo no.
  if (fields.employmentDays !== 365) p.set(KEYS.employmentDays, String(fields.employmentDays));
  if (fields.contractType !== 'permanent') p.set(KEYS.contractType, 'determinato');
  if (fields.dependents.spouse) p.set(KEYS.spouse, '1');
  if (fields.dependents.children21to30 > 0)
    p.set(KEYS.children, String(fields.dependents.children21to30));
  if (fields.dependents.childrenSharePercent !== 100)
    p.set(KEYS.childrenShare, String(fields.dependents.childrenSharePercent));
  if (fields.dependents.otherDependents > 0)
    p.set(KEYS.others, String(fields.dependents.otherDependents));
  if (fields.taxFreeBenefits > 0) p.set(KEYS.benefits, String(fields.taxFreeBenefits));
  if (fields.isApprenticeship) p.set(KEYS.apprenticeship, '1');
  if (!fields.applyCuneoBenefit) p.set(KEYS.cuneo, '0');

  return `?${p.toString()}`;
}

/** Un intero dentro i limiti, o il default: la query string e' input non fidato. */
function intOr(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * `null` se nell'URL non c'e' un calcolo: si distingue "link condiviso" da
 * "prima visita", e solo nel primo caso il risultato compare senza che
 * l'utente abbia premuto nulla.
 */
export function decodeShareableCalculation(
  search: string,
  defaults: SharedCalculationFields,
): ShareableCalculation | null {
  const p = new URLSearchParams(search);
  const rawAmount = p.get(KEYS.amount);
  if (rawAmount === null) return null;

  const amount = intOr(rawAmount, 0, 1, 10_000_000);
  if (amount <= 0) return null;

  const monthly = intOr(p.get(KEYS.monthlyPayments), defaults.monthlyPayments, 12, 15);

  return {
    mode: p.get(KEYS.mode) === 'n' ? 'reverse' : 'direct',
    amount,
    fields: {
      ...defaults,
      monthlyPayments: monthly as SharedCalculationFields['monthlyPayments'],
      employmentDays: intOr(p.get(KEYS.employmentDays), defaults.employmentDays, 1, 365),
      contractType: p.get(KEYS.contractType) === 'determinato' ? 'fixed_term' : 'permanent',
      isApprenticeship: p.get(KEYS.apprenticeship) === '1',
      applyCuneoBenefit: p.get(KEYS.cuneo) !== '0',
      taxFreeBenefits: intOr(p.get(KEYS.benefits), defaults.taxFreeBenefits, 0, 1_000_000),
      dependents: {
        spouse: p.get(KEYS.spouse) === '1',
        children21to30: intOr(p.get(KEYS.children), defaults.dependents.children21to30, 0, 15),
        // La quota ammette due soli valori (schema.ts): qualsiasi altra cosa e' 100.
        childrenSharePercent: p.get(KEYS.childrenShare) === '50' ? 50 : 100,
        otherDependents: intOr(p.get(KEYS.others), defaults.dependents.otherDependents, 0, 15),
      },
    },
  };
}
