import { z } from 'zod';

/**
 * Schemi Zod = unica fonte di verita dei tipi.
 * Sono usati da: form (react-hook-form), API route, e validazione del file parametri.
 */

// ---------------------------------------------------------------- input

export const regionCodeSchema = z.enum(['lombardia']);
export const municipalityCodeSchema = z.enum(['milano']);

export const calculationInputSchema = z.object({
  // --- essenziali ---
  grossAnnualSalary: z
    .number({ invalid_type_error: 'Inserisci un importo valido' })
    .positive('La RAL deve essere maggiore di zero')
    .max(10_000_000, 'Importo troppo elevato'),
  monthlyPayments: z.union([z.literal(12), z.literal(13), z.literal(14), z.literal(15)]),
  region: regionCodeSchema,
  municipality: municipalityCodeSchema,

  // --- avanzati (tutti con default) ---
  employmentDays: z.number().int().min(1).max(365).default(365),
  contractType: z.enum(['permanent', 'fixed_term']).default('permanent'),
  isApprenticeship: z.boolean().default(false),
  dependents: z
    .object({
      spouse: z.boolean().default(false),
      children21to30: z.number().int().min(0).max(15).default(0),
      childrenSharePercent: z.union([z.literal(100), z.literal(50)]).default(100),
      otherDependents: z.number().int().min(0).max(15).default(0),
    })
    .default({}),
  taxFreeBenefits: z.number().min(0).default(0),
  applyCuneoBenefit: z.boolean().default(true),
});

export type CalculationInput = z.infer<typeof calculationInputSchema>;
export type CalculationInputRaw = z.input<typeof calculationInputSchema>;

// ---------------------------------------------------------------- parametri

const confidenceSchema = z.enum(['high', 'medium', 'low']);
export type Confidence = z.infer<typeof confidenceSchema>;

/** Metadati di provenienza: nessun parametro entra senza fonte. */
const sourced = {
  source: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  verifiedAt: z.string(),
  confidence: confidenceSchema,
  note: z.string().optional(),
};

const bracketSchema = z.object({ upTo: z.number().nullable(), rate: z.number() });

export const taxParamsSchema = z.object({
  taxYear: z.number().int(),

  irpef: z.object({ brackets: z.array(bracketSchema).min(1), ...sourced }),

  socialSecurity: z.object({
    employeeRate: z.number(),
    apprenticeshipRate: z.number(),
    additionalRate: z.number(),
    additionalRateThreshold: z.number(),
    contributionCap: z.number(),
    employerRate: z.number(),
    ...sourced,
  }),

  employeeDeduction: z.object({
    bands: z.array(
      z.object({
        upTo: z.number().nullable(),
        type: z.enum(['flat', 'decreasing', 'none']),
        amount: z.number().optional(),
        base: z.number().optional(),
        extra: z.number().optional(),
        ceiling: z.number().optional(),
        span: z.number().optional(),
      }),
    ),
    minimumPermanent: z.number(),
    minimumFixedTerm: z.number(),
    surcharge: z.object({
      amount: z.number(),
      from: z.number(),
      to: z.number(),
      proRated: z.boolean(),
    }),
    ...sourced,
  }),

  cuneo: z.object({
    exemption: z.object({
      maxIncome: z.number(),
      bands: z.array(z.object({ upTo: z.number(), rate: z.number() })),
    }),
    deduction: z.object({
      from: z.number(),
      flatUpTo: z.number(),
      amount: z.number(),
      zeroAt: z.number(),
    }),
    ...sourced,
  }),

  supplementaryTreatment: z.object({
    amount: z.number(),
    incomeLimit: z.number(),
    uncertainBandTo: z.number(),
    ...sourced,
  }),

  familyDeductions: z.object({
    spouse: z.object({
      band1: z.object({ upTo: z.number(), base: z.number(), subtract: z.number(), over: z.number() }),
      band2: z.object({ upTo: z.number(), amount: z.number() }),
      band3: z.object({ upTo: z.number(), base: z.number(), ceiling: z.number(), span: z.number() }),
      increments: z.array(z.object({ from: z.number(), to: z.number(), amount: z.number() })),
    }),
    child21to30: z.object({
      amount: z.number(),
      ceiling: z.number(),
      ceilingIncrementPerExtraChild: z.number(),
    }),
    otherDependent: z.object({ amount: z.number(), ceiling: z.number() }),
    ...sourced,
  }),

  localSurcharges: z.object({
    regional: z.record(
      z.object({
        label: z.string(),
        mode: z.enum(['progressive', 'flat_by_bracket']),
        brackets: z.array(bracketSchema),
        ...sourced,
      }),
    ),
    municipal: z.record(
      z.object({
        label: z.string(),
        rate: z.number(),
        exemptionThreshold: z.number(),
        exemptionType: z.enum(['cliff', 'none']),
        ...sourced,
      }),
    ),
  }),

  informational: z.object({
    tfrDivisor: z.number(),
    tfrGuaranteeFundRate: z.number(),
    ...sourced,
  }),
});

export type TaxParams = z.infer<typeof taxParamsSchema>;

// ---------------------------------------------------------------- output

export type StepId =
  | 'gross'
  | 'social_security'
  | 'taxable_income'
  | 'cuneo_exemption'
  | 'irpef_gross'
  | 'deductions'
  | 'irpef_net'
  | 'regional_surcharge'
  | 'municipal_surcharge'
  | 'supplementary_treatment'
  | 'tax_free_benefits'
  | 'net';

export type BracketDetail = {
  from: number;
  to: number | null;
  rate: number;
  taxableInBracket: number;
  tax: number;
};

export type CalculationStep = {
  id: StepId;
  label: string;
  amount: number;
  sign: 'positive' | 'negative' | 'neutral';
  base: number;
  formula: string;
  legalRef: string;
  confidence?: Confidence;
  note?: string;
  detail?: BracketDetail[];
  breakdown?: { label: string; amount: number; formula?: string }[];
};

export type Warning = {
  code:
    | 'supplementary_treatment_uncertain_band'
    | 'near_municipal_exemption_threshold'
    | 'deductions_exceed_gross_tax'
    | 'low_confidence_parameter'
    | 'above_contribution_cap';
  message: string;
  severity: 'info' | 'warning';
};

export type CalculationResult = {
  input: CalculationInput;
  taxYear: number;
  steps: CalculationStep[];
  totals: {
    gross: number;
    totalContributions: number;
    totalTax: number;
    netAnnual: number;
    netMonthly: number;
    effectiveRate: number;
    marginalRate: number;
  };
  informational: { tfr: number; employerCost: number };
  warnings: Warning[];
};
