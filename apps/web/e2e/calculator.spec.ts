import { expect, test, type Page } from '@playwright/test';

/** "23.426 €" / "−2.757,00 €" → numero. Il meno e' U+2212, non il trattino ASCII. */
function parseEuro(text: string): number {
  const cleaned = text
    .replace(/[^\d.,−-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace('−', '-');
  const value = Number(cleaned);
  expect(Number.isFinite(value), `importo non interpretabile: ${JSON.stringify(text)}`).toBe(true);
  return value;
}

/** Il valore in evidenza e' animato: si attende che si fermi, non un singolo frame. */
async function headlineAmount(page: Page): Promise<number> {
  const headline = page.getByTestId('headline-amount');
  await expect(headline).toBeVisible();

  let last = Number.NaN;
  await expect
    .poll(
      async () => {
        const current = parseEuro(await headline.innerText());
        const settled = current > 0 && current === last;
        last = current;
        return settled;
      },
      { timeout: 10_000, intervals: [150, 150, 200, 300, 300, 500] },
    )
    .toBe(true);

  return last;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('dal lordo al netto: il netto e la traccia di calcolo che lo produce', async ({ page }) => {
  await page.getByLabel('Retribuzione annua lorda (RAL)').fill('30000');
  await page.getByRole('button', { name: 'Calcola' }).click();

  const net = await headlineAmount(page);
  // Non un valore fisso: la banda in cui deve cadere un netto plausibile per 30.000 €
  // di RAL. Cattura sia un motore fermo (0) sia un motore che non trattiene nulla.
  expect(net).toBeGreaterThan(19_000);
  expect(net).toBeLessThan(27_000);

  // La prima tappa del percorso e' la RAL inserita, con le migliaia separate.
  const grossStep = page.getByRole('button', { name: /Retribuzione annua lorda/ });
  await expect(grossStep).toContainText(/30\.000,00\s€/);

  // Le trattenute compaiono col segno meno tipografico e sommano alla differenza.
  await expect(page.getByRole('button', { name: /Contributi previdenziali INPS/ })).toContainText(
    '−',
  );
});

test('ogni tappa apre formula e riferimento normativo', async ({ page }) => {
  await page.getByRole('button', { name: 'Calcola' }).click();
  await headlineAmount(page);

  const step = page.getByRole('button', { name: /IRPEF lorda/ });
  await expect(step).toHaveAttribute('aria-expanded', 'false');

  await step.click();
  await expect(step).toHaveAttribute('aria-expanded', 'true');

  const detailId = await step.getAttribute('aria-controls');
  const detail = page.locator(`#${detailId}`);
  await expect(detail).toContainText('Formula');
  await expect(detail).toContainText('Norma');
  await expect(detail).toContainText('TUIR');
});

test('gli importi sotto le diecimila mostrano il separatore delle migliaia', async ({ page }) => {
  await page.getByLabel('Retribuzione annua lorda (RAL)').fill('30000');
  await page.getByRole('button', { name: 'Calcola' }).click();
  await headlineAmount(page);

  // it-IT ha minimumGroupingDigits=2: senza useGrouping:'always' questa riga
  // sarebbe "2757,00 €" mentre la RAL sopra resterebbe "30.000,00 €".
  const inps = page.getByRole('button', { name: /Contributi previdenziali INPS/ });
  await expect(inps).toContainText(/−\d{1,3}\.\d{3},\d{2}\s€/);
});

test('dal netto al lordo: la RAL trovata e coerente con il netto richiesto', async ({ page }) => {
  await page.getByRole('radio', { name: 'Netto → lordo' }).click();
  await page.getByLabel('Netto annuo desiderato').fill('30000');
  await page.getByRole('button', { name: 'Trova la RAL' }).click();

  const gross = await headlineAmount(page);
  expect(gross).toBeGreaterThan(30_000);
  expect(gross).toBeLessThan(60_000);

  // Il netto ricostruito deve tornare sul valore chiesto, a meno dell'arrotondamento.
  await expect(page.getByText(/Per un netto di/)).toContainText(/30\.000,\d{2}\s€/);
});

test('il pulsante del tema annuncia lo stato reale, non quello servito dal server', async ({
  page,
}) => {
  // Tema di default: scuro. Il pulsante deve proporre il passaggio al chiaro.
  await expect(page.locator('html')).toHaveClass(/dark/);
  const toggle = page.getByRole('button', { name: 'Passa al tema chiaro' });
  await expect(toggle).toBeVisible();

  await toggle.click();
  await expect(page.locator('html')).toHaveClass(/light/);
  await expect(page.getByRole('button', { name: 'Passa al tema scuro' })).toBeVisible();
});

test('un importo non valido non produce un calcolo', async ({ page }) => {
  await page.getByLabel('Retribuzione annua lorda (RAL)').fill('0');
  await page.getByRole('button', { name: 'Calcola' }).click();

  // Next monta un proprio role="alert" (il route announcer): si filtra sul messaggio.
  await expect(page.getByRole('alert').filter({ hasText: 'maggiore di zero' })).toHaveCount(1);
  await expect(page.getByTestId('headline-amount')).toHaveCount(0);
});

test('la pagina non scrolla in orizzontale', async ({ page }) => {
  await page.getByRole('button', { name: 'Calcola' }).click();
  await headlineAmount(page);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("l'API rifiuta un input non valido invece di calcolare", async ({ request }) => {
  const res = await request.post('/api/calculate', { data: { grossAnnualSalary: -1 } });
  expect(res.status()).toBe(400);
  expect(await res.json()).toMatchObject({ error: 'Input non valido' });
});

test("l'URL segue il calcolo e un link condiviso lo riproduce", async ({ page }) => {
  await page.getByRole('radio', { name: '13' }).click();
  await page.getByLabel('Retribuzione annua lorda (RAL)').fill('45000');
  await page.getByRole('button', { name: 'Calcola' }).click();

  const expected = await headlineAmount(page);
  await expect(page).toHaveURL(/a=45000/);
  await expect(page).toHaveURL(/mens=13/);

  // Stesso link, sessione pulita: il risultato deve comparire senza premere nulla.
  const shared = page.url();
  await page.goto('/');
  await expect(page.getByTestId('headline-amount')).toHaveCount(0);

  await page.goto(shared);
  expect(await headlineAmount(page)).toBe(expected);
  await expect(page.getByRole('radio', { name: '13' })).toHaveAttribute('aria-checked', 'true');
});

test('un link condiviso conserva la direzione e le opzioni avanzate', async ({ page }) => {
  await page.goto('/?m=n&a=28000&mens=12&coniuge=1&cuneo=0');

  await expect(page.getByRole('radio', { name: 'Netto → lordo' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  const gross = await headlineAmount(page);
  expect(gross).toBeGreaterThan(28_000);

  await page.getByRole('button', { name: 'Opzioni avanzate' }).click();
  await expect(page.getByLabel('Coniuge a carico')).toBeChecked();
  await expect(page.getByLabel('Applica la riduzione del cuneo fiscale')).not.toBeChecked();
});

test('una query string arbitraria non produce un calcolo ne un errore', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?a=abc&mens=999&figli=-4');

  await expect(page.getByText('Nessun calcolo ancora eseguito')).toBeVisible();
  await expect(page.getByTestId('headline-amount')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('nessuna sezione resta invisibile dopo lo scorrimento', async ({ page }) => {
  await page.goto('/?a=30000&mens=14');
  await headlineAmount(page);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByText('Voci informative')).toBeInViewport();

  // L'ingresso in scena e' un effetto: se fallisce, il contenuto deve restare leggibile.
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          [...document.querySelectorAll('.reveal, .animate-in')].filter(
            (el) => Number(getComputedStyle(el).opacity) < 0.99,
          ).length,
      ),
    )
    .toBe(0);
});

test('«Copia link» mette negli appunti il link del calcolo corrente', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/?a=41000&mens=12');
  await headlineAmount(page);

  await page.getByRole('button', { name: 'Copia link' }).click();
  await expect(page.getByRole('button', { name: 'Copiato' })).toBeVisible();

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain('a=41000');
  expect(clipboard).toContain('mens=12');
});

test('il diagramma di flusso ripartisce la RAL senza perderne un euro', async ({ page }) => {
  await page.goto('/?a=52000&mens=13');
  await headlineAmount(page);

  const legend = page.getByTestId('money-flow-legend');
  await expect(legend).toBeVisible();

  const rows = await legend.getByRole('button').allInnerTexts();
  expect(rows.length).toBeGreaterThanOrEqual(3);

  // L'invariante del diagramma: le destinazioni sommano alla RAL. Si legge dal
  // testo a schermo, non dal modello, perche' e' quello che l'utente confronta.
  const total = rows
    .map((row) => row.match(/(−?[\d.]+,\d{2})\s€/)?.[1])
    .map((amount) => {
      expect(amount, `riga senza importo: ${JSON.stringify(rows)}`).toBeTruthy();
      return parseEuro(amount!);
    })
    .reduce((sum, value) => sum + value, 0);

  expect(Math.abs(total - 52_000)).toBeLessThan(0.05);

  await expect(legend).toContainText('Netto in tasca');
  await expect(legend).toContainText('Contributi INPS');
});

test('il riepilogo risale nellheader quando la sintesi esce di scena', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?a=52000&mens=13');
  await headlineAmount(page);

  const summary = page.getByTestId('header-summary');
  await expect(summary).toHaveCSS('opacity', '0');

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(summary).toHaveCSS('opacity', '1');
  await expect(summary).toContainText('Netto annuo');

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(summary).toHaveCSS('opacity', '0');
});
