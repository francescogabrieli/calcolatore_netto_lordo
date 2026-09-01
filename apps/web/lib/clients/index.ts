import {
  calculateGrossFromNet,
  calculateNet,
  type CalculationInputRaw,
  type CalculationResult,
  type ReverseCalculationInputRaw,
} from '@cnl/core';

/**
 * Port: la UI non sa dove avviene il calcolo (docs/03 §5).
 * E' cio' che rende reversibile la scelta di hosting: su Vercel usiamo l'API route,
 * su un hosting statico lo stesso motore gira nel browser, senza toccare la UI.
 */
export type CalculationClient = {
  calculate(input: CalculationInputRaw): Promise<CalculationResult>;
  calculateFromNet(input: ReverseCalculationInputRaw): Promise<CalculationResult>;
};

/** Adapter in-process: il motore gira dove gira la UI. */
export const localClient: CalculationClient = {
  async calculate(input) {
    return calculateNet(input);
  },
  async calculateFromNet(input) {
    return calculateGrossFromNet(input);
  },
};

/** Adapter HTTP: il motore gira sul server, dietro /api/calculate*. */
async function post(path: string, body: unknown): Promise<CalculationResult> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const problem = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(problem?.error ?? 'Errore durante il calcolo');
  }
  return (await res.json()) as CalculationResult;
}

export const httpClient: CalculationClient = {
  calculate: (input) => post('/api/calculate', input),
  calculateFromNet: (input) => post('/api/calculate-reverse', input),
};

export const calculationClient: CalculationClient = httpClient;
