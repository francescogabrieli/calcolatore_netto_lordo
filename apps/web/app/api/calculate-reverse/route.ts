import { calculateGrossFromNet, reverseCalculationInputSchema } from '@cnl/core';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/** Stesso pattern di /api/calculate: un unico schema Zod valida form e body. */
export async function POST(request: Request) {
  try {
    const input = reverseCalculationInputSchema.parse(await request.json());
    return NextResponse.json(calculateGrossFromNet(input));
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
