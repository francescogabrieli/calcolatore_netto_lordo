import params2026 from '../params/2026.json' with { type: 'json' };
import { taxParamsSchema, type TaxParams } from './schema.js';

/**
 * I parametri fiscali sono DATO, non codice (docs/03 §3).
 * Vengono validati all'import: un file malformato fallisce subito e rumorosamente,
 * invece di produrre silenziosamente numeri sbagliati.
 */
const registry: Record<number, TaxParams> = {
  2026: taxParamsSchema.parse(params2026),
};

export const AVAILABLE_TAX_YEARS = Object.keys(registry).map(Number);

export function getTaxParams(year: number): TaxParams {
  const params = registry[year];
  if (!params) {
    throw new Error(
      `Parametri fiscali non disponibili per l'anno ${year}. Anni disponibili: ${AVAILABLE_TAX_YEARS.join(', ')}`,
    );
  }
  return params;
}
