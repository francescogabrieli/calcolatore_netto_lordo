import { calculateNet, calculationInputSchema } from '@cnl/core';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Lo stesso schema Zod valida il form nel browser e il body qui: una sola fonte
 * di verita' dei tipi, nessuna possibilita' che le due validazioni divergano.
 */
export async function POST(request: Request) {
  try {
    const input = calculationInputSchema.parse(await request.json());
    return NextResponse.json(calculateNet(input));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Input non valido', issues: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Errore durante il calcolo' }, { status: 500 });
  }
}
