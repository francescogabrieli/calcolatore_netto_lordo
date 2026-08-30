/**
 * Regole di arrotondamento (docs/04 §11).
 *
 * Principio: arrotondare UNA VOLTA SOLA, alla fine. Gli arrotondamenti intermedi
 * propagano errore e impediscono di far quadrare i totali con la somma delle righe.
 */

/** Arrotondamento a 2 decimali, half-up, stabile rispetto agli errori binari. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Troncamento alla quarta cifra decimale.
 * Prescritto dalla norma per le formule dell'art. 13 TUIR: e' un TRONCAMENTO,
 * non un arrotondamento, e la differenza e' osservabile.
 */
export function truncate4(value: number): number {
  return Math.trunc(value * 10_000) / 10_000;
}

/** Quota di `value` compresa nell'intervallo (from, to]. */
export function portionInBracket(value: number, from: number, to: number | null): number {
  const upper = to === null ? value : Math.min(value, to);
  return Math.max(0, upper - from);
}
