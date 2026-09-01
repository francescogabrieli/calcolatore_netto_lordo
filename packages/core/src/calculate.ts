import { round2 } from './money.js';
import { getTaxParams } from './params.js';
import {
  calculationInputSchema,
  type CalculationInput,
  type CalculationInputRaw,
  type CalculationResult,
  type CalculationStep,
  type Warning,
} from './schema.js';
import { calculateContributions } from './steps/contributions.js';
import { calculateCuneoDeduction, calculateCuneoExemption } from './steps/cuneo.js';
import { calculateEmployeeDeduction, calculateFamilyDeductions } from './steps/deductions.js';
import { calculateGrossTax } from './steps/incomeTax.js';
import { calculateMunicipalSurcharge, calculateRegionalSurcharge } from './steps/surcharges.js';
import { calculateSupplementaryTreatment } from './steps/supplementary.js';

const pct = (rate: number) => `${(rate * 100).toFixed(2).replace('.', ',')}%`;
const eur = (value: number) =>
  new Intl.NumberFormat('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(
    Math.round(value),
  );

/** Distanza dalla soglia di esenzione comunale entro cui avvisare l'utente. */
const NEAR_THRESHOLD_RANGE = 500;

/**
 * Motore di calcolo: funzione PURA.
 * Nessun I/O, nessuna data di sistema, nessuna casualita'. Stessi input, stesso output.
 *
 * Restituisce non un numero ma la TRACCIA del calcolo: ogni voce con base, formula e
 * riferimento normativo. La UI disegna questo, non ricalcola nulla (docs/03 §4).
 */
export function calculateNet(
  rawInput: CalculationInputRaw,
  taxYear = 2026,
  options: { computeMarginalRate?: boolean } = {},
): CalculationResult {
  // La marginale si calcola richiamando il motore su RAL + 100: la ricorsione va
  // fermata al primo livello, altrimenti non termina.
  const { computeMarginalRate = true } = options;
  const input = calculationInputSchema.parse(rawInput);
  const params = getTaxParams(taxYear);

  const steps: CalculationStep[] = [];
  const warnings: Warning[] = [];

  const gross = input.grossAnnualSalary;

  steps.push({
    id: 'gross',
    label: 'Retribuzione annua lorda (RAL)',
    amount: gross,
    sign: 'neutral',
    base: gross,
    formula: 'Importo inserito, tredicesima e quattordicesima incluse',
    legalRef: '—',
  });

  // --- 1. contributi previdenziali -----------------------------------------
  const contributions = calculateContributions(gross, input.isApprenticeship, params);

  steps.push({
    id: 'social_security',
    label: 'Contributi previdenziali INPS a carico del lavoratore',
    amount: -contributions.total,
    sign: 'negative',
    base: contributions.contributionBase,
    formula:
      contributions.additionalAmount > 0
        ? `${eur(contributions.contributionBase)} × ${pct(contributions.rate)} + ${eur(
            contributions.contributionBase - params.socialSecurity.additionalRateThreshold,
          )} × ${pct(params.socialSecurity.additionalRate)} (quota oltre la 1ª fascia)`
        : `${eur(contributions.contributionBase)} × ${pct(contributions.rate)}`,
    legalRef: params.socialSecurity.source,
    confidence: params.socialSecurity.confidence,
    ...(contributions.cappedAt !== null
      ? { note: `Base contributiva limitata al massimale di ${eur(contributions.cappedAt)} €` }
      : {}),
    breakdown: [
      { label: 'Contributo IVS', amount: -contributions.baseAmount },
      ...(contributions.additionalAmount > 0
        ? [{ label: 'Contributo aggiuntivo 1%', amount: -contributions.additionalAmount }]
        : []),
    ],
  });

  if (contributions.cappedAt !== null) {
    warnings.push({
      code: 'above_contribution_cap',
      severity: 'info',
      message: `La retribuzione supera il massimale contributivo (${eur(
        contributions.cappedAt,
      )} €): sulla quota eccedente non si versano contributi IVS.`,
    });
  }

  // --- 2. imponibile fiscale -----------------------------------------------
  const taxableIncome = gross - contributions.total;

  steps.push({
    id: 'taxable_income',
    label: 'Reddito imponibile fiscale',
    amount: taxableIncome,
    sign: 'neutral',
    base: gross,
    formula: `${eur(gross)} − ${eur(contributions.total)} (i contributi obbligatori sono oneri deducibili)`,
    legalRef: 'art. 10 TUIR',
  });

  // --- 3. somma esente da cuneo fiscale ------------------------------------
  const cuneoExemption = calculateCuneoExemption(taxableIncome, input.applyCuneoBenefit, params);
  const totalIncome = taxableIncome - cuneoExemption.amount;

  if (cuneoExemption.amount > 0) {
    steps.push({
      id: 'cuneo_exemption',
      label: 'Somma esente da riduzione del cuneo fiscale',
      amount: -cuneoExemption.amount,
      sign: 'neutral',
      base: taxableIncome,
      formula: `${eur(taxableIncome)} × ${pct(cuneoExemption.rate)} — riduce la base imponibile, non l'imposta`,
      legalRef: params.cuneo.source,
      confidence: params.cuneo.confidence,
    });
  }

  // --- 4. IRPEF lorda -------------------------------------------------------
  const { tax: grossTax, detail } = calculateGrossTax(totalIncome, params);

  steps.push({
    id: 'irpef_gross',
    label: 'IRPEF lorda',
    amount: -grossTax,
    sign: 'negative',
    base: totalIncome,
    formula: 'Somma delle porzioni di reddito per aliquota di scaglione',
    legalRef: params.irpef.source,
    confidence: params.irpef.confidence,
    detail,
  });

  // --- 5. detrazioni --------------------------------------------------------
  const employeeDeduction = calculateEmployeeDeduction(totalIncome, input, params);
  const family = calculateFamilyDeductions(totalIncome, input, params);
  const cuneoDeduction = calculateCuneoDeduction(totalIncome, input.applyCuneoBenefit, params);
  const totalDeductions = employeeDeduction + family.total + cuneoDeduction;

  steps.push({
    id: 'deductions',
    label: 'Detrazioni d’imposta',
    amount: totalDeductions,
    sign: 'positive',
    base: totalIncome,
    formula: 'Riducono l’imposta, non il reddito',
    legalRef: 'artt. 12 e 13 TUIR; riduzione cuneo fiscale',
    ...(family.total > 0 ? { confidence: params.familyDeductions.confidence } : {}),
    breakdown: [
      {
        label: 'Detrazione da lavoro dipendente',
        amount: employeeDeduction,
        formula: `art. 13 TUIR, ragguagliata a ${input.employmentDays} giorni`,
      },
      ...family.breakdown.map((b) => ({
        label: b.label,
        amount: b.amount,
        formula: 'art. 12 TUIR',
      })),
      ...(cuneoDeduction > 0
        ? [
            {
              label: 'Detrazione da riduzione del cuneo fiscale',
              amount: cuneoDeduction,
              formula:
                totalIncome <= params.cuneo.deduction.flatUpTo
                  ? 'importo fisso'
                  : `décalage lineare fino a ${eur(params.cuneo.deduction.zeroAt)} €`,
            },
          ]
        : []),
    ],
  });

  // --- 6. IRPEF netta -------------------------------------------------------
  // Il floor a zero non e' difensivo: e' la norma. Le detrazioni non generano credito.
  const netTax = Math.max(0, grossTax - totalDeductions);

  if (totalDeductions > grossTax) {
    warnings.push({
      code: 'deductions_exceed_gross_tax',
      severity: 'info',
      message:
        'Le detrazioni superano l’IRPEF lorda: l’imposta si azzera e l’eccedenza non genera credito (incapienza).',
    });
  }

  steps.push({
    id: 'irpef_net',
    label: 'IRPEF netta',
    amount: -netTax,
    sign: 'negative',
    base: totalIncome,
    formula: `max(0; ${eur(grossTax)} − ${eur(totalDeductions)})`,
    legalRef: 'art. 11 TUIR',
  });

  // --- 7. addizionali locali ------------------------------------------------
  const regional = calculateRegionalSurcharge(totalIncome, input.region, params);
  const regionalCfg = params.localSurcharges.regional[input.region]!;

  steps.push({
    id: 'regional_surcharge',
    label: `Addizionale regionale IRPEF (${regionalCfg.label})`,
    amount: -regional.amount,
    sign: 'negative',
    base: totalIncome,
    formula:
      regional.mode === 'progressive'
        ? 'Progressiva per scaglioni sul reddito imponibile'
        : `${eur(totalIncome)} × ${pct(regional.rateApplied)} sull’intero imponibile`,
    legalRef: regionalCfg.source,
    confidence: regionalCfg.confidence,
    note: 'Calcolata sul reddito imponibile, non sull’IRPEF',
  });

  const municipal = calculateMunicipalSurcharge(totalIncome, input.municipality, params);
  const municipalCfg = params.localSurcharges.municipal[input.municipality]!;

  steps.push({
    id: 'municipal_surcharge',
    label: `Addizionale comunale IRPEF (${municipalCfg.label})`,
    amount: -municipal.amount,
    sign: 'negative',
    base: totalIncome,
    formula: municipal.exempt
      ? `Esente: imponibile ≤ ${eur(municipal.threshold)} €`
      : `${eur(totalIncome)} × ${pct(municipal.rate)}`,
    legalRef: municipalCfg.source,
    confidence: municipalCfg.confidence,
  });

  if (Math.abs(totalIncome - municipal.threshold) <= NEAR_THRESHOLD_RANGE) {
    warnings.push({
      code: 'near_municipal_exemption_threshold',
      severity: 'warning',
      message: `Il reddito imponibile è vicino alla soglia di esenzione dell’addizionale comunale (${eur(
        municipal.threshold,
      )} €). Superata la soglia, l’addizionale si paga sull’intero imponibile: pochi euro di lordo in più possono costarne circa ${eur(
        municipal.threshold * municipal.rate,
      )}.`,
    });
  }

  // --- 8. trattamento integrativo -------------------------------------------
  const supplementary = calculateSupplementaryTreatment(
    totalIncome,
    grossTax,
    employeeDeduction,
    input.employmentDays,
    params,
  );

  if (supplementary.amount > 0 || supplementary.inUncertainBand) {
    steps.push({
      id: 'supplementary_treatment',
      label: 'Trattamento integrativo',
      amount: supplementary.amount,
      sign: 'positive',
      base: totalIncome,
      formula:
        supplementary.amount > 0
          ? `${eur(params.supplementaryTreatment.amount)} € annui`
          : 'Non applicato',
      legalRef: params.supplementaryTreatment.source,
    });
  }

  if (supplementary.inUncertainBand) {
    warnings.push({
      code: 'supplementary_treatment_uncertain_band',
      severity: 'warning',
      message:
        'In questa fascia di reddito il trattamento integrativo dipende da detrazioni che un calcolatore non può conoscere (spese mediche, mutui, bonus edilizi). Lo escludiamo per prudenza.',
    });
  }

  // --- 9. benefit non tassabili ---------------------------------------------
  if (input.taxFreeBenefits > 0) {
    steps.push({
      id: 'tax_free_benefits',
      label: 'Welfare / fringe benefit non imponibili',
      amount: input.taxFreeBenefits,
      sign: 'positive',
      base: input.taxFreeBenefits,
      formula: 'Non concorrono alla formazione del reddito entro le soglie di legge',
      legalRef: 'art. 51 TUIR',
    });
  }

  // --- 10. netto -------------------------------------------------------------
  const totalTax = netTax + regional.amount + municipal.amount;
  const netAnnual =
    gross - contributions.total - totalTax + supplementary.amount + input.taxFreeBenefits;
  const netMonthly = netAnnual / input.monthlyPayments;

  steps.push({
    id: 'net',
    label: 'Retribuzione netta annua',
    amount: netAnnual,
    sign: 'neutral',
    base: gross,
    formula: 'RAL − contributi − imposte + trattamento integrativo + benefit',
    legalRef: '—',
  });

  for (const step of steps) {
    if (step.confidence === 'low') {
      warnings.push({
        code: 'low_confidence_parameter',
        severity: 'info',
        message: `«${step.label}» usa un parametro non ancora verificato su fonte primaria: trattalo come stima.`,
      });
    }
  }

  const tfr =
    gross / params.informational.tfrDivisor - gross * params.informational.tfrGuaranteeFundRate;
  const employerCost = gross * (1 + params.socialSecurity.employerRate) + tfr;

  return {
    input,
    taxYear: params.taxYear,
    steps: steps.map((s) => ({ ...s, amount: round2(s.amount), base: round2(s.base) })),
    totals: {
      gross: round2(gross),
      totalContributions: round2(contributions.total),
      totalTax: round2(totalTax),
      netAnnual: round2(netAnnual),
      netMonthly: round2(netMonthly),
      effectiveRate: (contributions.total + totalTax - supplementary.amount) / gross,
      marginalRate: computeMarginalRate ? calculateMarginalRate(input, taxYear, netAnnual) : 0,
    },
    informational: { tfr: round2(tfr), employerCost: round2(employerCost) },
    warnings,
  };
}

const MARGINAL_STEP = 100;

/**
 * Aliquota marginale per DIFFERENZE FINITE, non leggendo lo scaglione.
 * E' volutamente piu' onesta: cattura anche il decalage delle detrazioni e i salti
 * di soglia, che possono portare la marginale reale ben sopra l'aliquota nominale.
 */
function calculateMarginalRate(
  input: CalculationInput,
  taxYear: number,
  netAtCurrent: number,
): number {
  const bumped = calculateNet(
    { ...input, grossAnnualSalary: input.grossAnnualSalary + MARGINAL_STEP },
    taxYear,
    { computeMarginalRate: false },
  );
  return 1 - (bumped.totals.netAnnual - netAtCurrent) / MARGINAL_STEP;
}
