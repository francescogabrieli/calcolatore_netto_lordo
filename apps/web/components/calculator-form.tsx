'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { sharedCalculationFieldsSchema, type SharedCalculationFields } from '@cnl/core';
import { ArrowLeftRight, ArrowRight, ChevronDown, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardBody } from '@/components/ui/card';
import { Field, inputClass } from '@/components/ui/field';
import { cn } from '@/lib/cn';

export type CalculationMode = 'direct' | 'reverse';

export type CalculatorFormProps = {
  onCalculate: (mode: CalculationMode, amount: number, shared: SharedCalculationFields) => void;
  isPending: boolean;
  defaultMode?: CalculationMode;
  defaultValues: SharedCalculationFields;
  defaultAmount: number;
};

const MONTHLY_OPTIONS = [12, 13, 14, 15] as const;
const MAX_AMOUNT: Record<CalculationMode, number> = { direct: 10_000_000, reverse: 5_000_000 };

export function CalculatorForm({
  onCalculate,
  isPending,
  defaultMode = 'direct',
  defaultValues,
  defaultAmount,
}: CalculatorFormProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [mode, setMode] = useState<CalculationMode>(defaultMode);
  const [amount, setAmount] = useState(defaultAmount);
  const [amountError, setAmountError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SharedCalculationFields>({
    resolver: zodResolver(sharedCalculationFieldsSchema),
    defaultValues,
    mode: 'onSubmit',
  });

  const monthlyPayments = watch('monthlyPayments');

  const submit = handleSubmit((shared) => {
    if (!Number.isFinite(amount) || amount <= 0) {
      setAmountError(
        mode === 'direct'
          ? 'La RAL deve essere maggiore di zero'
          : 'Il netto desiderato deve essere maggiore di zero',
      );
      return;
    }
    if (amount > MAX_AMOUNT[mode]) {
      setAmountError('Importo troppo elevato');
      return;
    }
    setAmountError(null);
    onCalculate(mode, amount, shared);
  });

  return (
    <Card>
      <CardBody className="pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="eyebrow">Il calcolatore</span>
          <div
            role="radiogroup"
            aria-label="Direzione del calcolo"
            className="flex gap-1.5 sm:shrink-0"
          >
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'direct'}
              onClick={() => setMode('direct')}
              className={cn(
                'pill h-7 px-3 text-[11px] font-mono uppercase tracking-wide',
                mode === 'direct' && 'pill-active',
              )}
            >
              Lordo → netto
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'reverse'}
              onClick={() => setMode('reverse')}
              className={cn(
                'pill h-7 px-3 text-[11px] font-mono uppercase tracking-wide',
                mode === 'reverse' && 'pill-active',
              )}
            >
              Netto → lordo
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-6" noValidate>
          <Field
            label={mode === 'direct' ? 'Retribuzione annua lorda (RAL)' : 'Netto annuo desiderato'}
            hint={
              mode === 'direct'
                ? 'Il totale lordo annuo, tredicesima e quattordicesima incluse'
                : 'Troviamo la RAL che produce esattamente questo netto, per bisezione sullo stesso motore'
            }
            error={amountError ?? undefined}
            htmlFor="amount"
          >
            <div className="relative">
              <input
                id="amount"
                type="number"
                inputMode="numeric"
                step="100"
                value={Number.isFinite(amount) ? amount : ''}
                onChange={(e) => setAmount(e.target.valueAsNumber)}
                className={cn(inputClass(!!amountError), 'h-14 pr-10 text-2xl tnum text-display')}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg text-[var(--text-muted)]"
              >
                €
              </span>
            </div>
          </Field>

          <Field label="Numero di mensilità">
            <div
              role="radiogroup"
              aria-label="Numero di mensilità"
              className="flex flex-wrap gap-2"
            >
              {MONTHLY_OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={monthlyPayments === value}
                  onClick={() => setValue('monthlyPayments', value)}
                  className={cn(
                    'pill h-9 flex-1 text-sm tnum',
                    monthlyPayments === value && 'pill-active',
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Regione" htmlFor="region">
              <select id="region" className={inputClass()} {...register('region')}>
                <option value="lombardia">Lombardia</option>
              </select>
            </Field>
            <Field label="Comune" htmlFor="municipality">
              <select id="municipality" className={inputClass()} {...register('municipality')}>
                <option value="milano">Milano</option>
              </select>
            </Field>
          </div>

          <div className="border-t border-[var(--border)] pt-5">
            <button
              type="button"
              onClick={() => setAdvancedOpen((open) => !open)}
              aria-expanded={advancedOpen}
              className="flex w-full items-center justify-between text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            >
              Opzioni avanzate
              <ChevronDown
                className={cn(
                  'size-4 transition-transform duration-300',
                  advancedOpen && 'rotate-180',
                )}
                aria-hidden
              />
            </button>

            <div className={cn('accordion', advancedOpen && 'accordion-open')}>
              <div>
                <div className="mt-4 space-y-4">
                  <Field
                    label="Giorni di lavoro dipendente"
                    hint="Le detrazioni si ragguagliano ai giorni dell’anno"
                    htmlFor="days"
                    error={errors.employmentDays?.message}
                  >
                    <input
                      id="days"
                      type="number"
                      min={1}
                      max={365}
                      className={inputClass(!!errors.employmentDays)}
                      {...register('employmentDays', { valueAsNumber: true })}
                    />
                  </Field>

                  <Field label="Tipo di contratto" htmlFor="contract">
                    <select id="contract" className={inputClass()} {...register('contractType')}>
                      <option value="permanent">Tempo indeterminato</option>
                      <option value="fixed_term">Tempo determinato</option>
                    </select>
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Figli a carico 21–30 anni"
                      hint="Sotto i 21 anni: Assegno Unico INPS"
                      htmlFor="children"
                    >
                      <input
                        id="children"
                        type="number"
                        min={0}
                        max={15}
                        className={inputClass()}
                        {...register('dependents.children21to30', { valueAsNumber: true })}
                      />
                    </Field>
                    <Field label="Altri familiari a carico" htmlFor="others">
                      <input
                        id="others"
                        type="number"
                        min={0}
                        max={15}
                        className={inputClass()}
                        {...register('dependents.otherDependents', { valueAsNumber: true })}
                      />
                    </Field>
                  </div>

                  <Field
                    label="Welfare / fringe benefit annui"
                    hint="Importi non imponibili entro le soglie di legge"
                    htmlFor="benefits"
                  >
                    <input
                      id="benefits"
                      type="number"
                      min={0}
                      step="100"
                      className={inputClass()}
                      {...register('taxFreeBenefits', { valueAsNumber: true })}
                    />
                  </Field>

                  <label className="flex items-center gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--accent)]"
                      {...register('dependents.spouse')}
                    />
                    Coniuge a carico
                  </label>

                  <label className="flex items-center gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--accent)]"
                      {...register('isApprenticeship')}
                    />
                    Contratto di apprendistato
                  </label>

                  <label className="flex items-center gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--accent)]"
                      {...register('applyCuneoBenefit')}
                    />
                    Applica la riduzione del cuneo fiscale
                  </label>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className={cn(
              'pill pill-primary group h-12 w-full text-sm font-medium',
              'disabled:opacity-60',
            )}
          >
            {mode === 'direct' ? 'Calcola' : 'Trova la RAL'}
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : mode === 'direct' ? (
              <ArrowRight
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden
              />
            ) : (
              <ArrowLeftRight
                className="size-4 transition-transform duration-200 group-hover:scale-110"
                aria-hidden
              />
            )}
          </button>
        </form>
      </CardBody>
    </Card>
  );
}
