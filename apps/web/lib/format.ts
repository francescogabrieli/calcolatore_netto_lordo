/*
 * `it-IT` ha minimumGroupingDigits=2: senza `useGrouping: 'always'` Intl scrive
 * "1673,25 €" ma "30.000,00 €", e in una colonna di importi incolonnati la
 * separazione delle migliaia comparirebbe a righe alterne.
 */
const currency = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: 'always',
});

const currencyCompact = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: 'always',
});

/** Il segno meno tipografico (U+2212), non il trattino. */
export const formatEuro = (value: number) => currency.format(value).replace('-', '−');
export const formatEuroCompact = (value: number) => currencyCompact.format(value).replace('-', '−');

export const formatPercent = (value: number, digits = 1) =>
  `${(value * 100).toFixed(digits).replace('.', ',')}%`;
