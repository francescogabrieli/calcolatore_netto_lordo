# 03 — System Design

## 1. Obiettivo e vincoli

**Obiettivo**: una pagina web in cui l'utente inserisce una RAL (più alcuni parametri), preme
"Calcola" e vede netto annuo, netto mensile e **il dettaglio completo di ogni trattenuta**.

**Vincoli di progetto**
| Vincolo | Origine |
|---|---|
| Deve essere raggiungibile via link pubblico, senza allegati | Traccia |
| Deve essere evidente che le logiche sono controllate da noi | Traccia (⚠️ "non è un test su Lovable") |
| Nessun costo: niente dominio a pagamento, niente servizi a pagamento | Vincolo nostro |
| UI curata | Vincolo nostro |
| Tempo limitato | Vincolo nostro |

**Requisiti non funzionali che guidano il design**
1. **Auditabilità** — dato un output, deve essere possibile risalire alla formula e alla norma.
2. **Aggiornabilità annuale** — cambiare anno d'imposta non deve richiedere di toccare il motore.
3. **Testabilità** — il calcolo deve essere verificabile senza avviare un browser.
4. **Zero dipendenze nel dominio** — il motore non deve dipendere da React, da Next, da HTTP.

---

## 2. Architettura in una figura

```
┌─────────────────────────────────────────────────────────────────┐
│  apps/web  —  Next.js (App Router) + Tailwind v4 + shadcn/ui    │
│                                                                 │
│   InputForm ──► useCalculation() ──► CalculationClient (port)   │
│                        │                      │                 │
│   ResultsPanel ◄───────┘                      │                 │
│   BreakdownWaterfall                          │                 │
│   BreakdownTable (formula + norma per riga)   │                 │
└───────────────────────────────────────────────┼─────────────────┘
                                                │
                     ┌──────────────────────────┴────────────────┐
                     │                                           │
          ┌──────────▼──────────┐                    ┌───────────▼──────────┐
          │  LocalClient        │                    │  HttpClient          │
          │  (in-process)       │                    │  POST /api/calculate │
          └──────────┬──────────┘                    └───────────┬──────────┘
                     │                                           │
                     └─────────────────┬─────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  packages/core  —  TypeScript puro, zero dipendenze runtime     │
│                                                                 │
│   calculateNet(input, params) : CalculationResult               │
│                                                                 │
│   steps/  contributions · taxableIncome · cuneoExemption        │
│           grossTax · deductions · netTax · localSurcharges      │
│           supplementaryTreatment · netSalary                    │
│                                                                 │
│   params/  2026.json   (dati, non codice)                       │
│   schema/  Zod: TaxParams, CalculationInput, CalculationResult  │
└─────────────────────────────────────────────────────────────────┘
```

### Il principio portante: **il dominio è una funzione pura**

```ts
calculateNet(input: CalculationInput, params: TaxParams): CalculationResult
```

Nessun I/O, nessuna data di sistema, nessun `Math.random`, nessuna dipendenza.
Stessi input ⇒ stesso output, sempre. Questo rende il motore:
- testabile con Vitest senza mock;
- eseguibile identicamente sul client e sul server;
- verificabile riga per riga in code review.

---

## 3. Il parametro fiscale come dato, non come codice

È la decisione architetturale più importante del progetto (D2).

```jsonc
// packages/core/params/2026.json  (estratto illustrativo)
{
  "taxYear": 2026,
  "irpef": {
    "brackets": [
      { "upTo": 28000, "rate": 0.23 },
      { "upTo": 50000, "rate": 0.33 },
      { "upTo": null,  "rate": 0.43 }
    ],
    "source": "L. 199/2025 art. 1 co. 3",
    "sourceUrl": "https://fiscomania.com/aliquote-irpef/",
    "verifiedAt": "2026-08-30"
  },
  "socialSecurity": {
    "employeeRate": 0.0919,
    "additionalRate": 0.01,
    "additionalRateThreshold": 52190,
    "contributionCap": 120607,
    "source": "L. 335/1995 art. 2 co. 18; L. 438/1992 art. 3-ter",
    "verifiedAt": "2026-08-30",
    "confidence": "medium"
  },
  "localSurcharges": {
    "regional": {
      "lombardia": {
        "mode": "progressive",          // oppure "flat_by_bracket"
        "brackets": [ /* … */ ],
        "confidence": "low"
      }
    },
    "municipal": {
      "milano": {
        "rate": 0.008,
        "exemptionThreshold": 23000,
        "exemptionType": "cliff"        // superata la soglia si paga su tutto
      }
    }
  }
}
```

**Conseguenze pratiche:**
- aggiornare al 2027 = aggiungere `2027.json`, non toccare il motore;
- ogni numero porta con sé `source`, `verifiedAt` e `confidence`;
- il campo `confidence` viene **mostrato in UI**: se un parametro è dichiarato incerto,
  il prodotto lo dice invece di fingere precisione;
- il file è validato con **Zod** all'avvio: un parametro malformato fallisce subito e rumorosamente.

---

## 4. Il risultato è una traccia di esecuzione, non un numero

L'output non è `{ net: 22480 }`. È la **cronaca del calcolo**:

```ts
type CalculationStep = {
  id: 'inps_contributions' | 'irpef_gross' | 'employee_deduction' | /* … */;
  label: string;          // "Contributi INPS a carico del lavoratore"
  amount: number;         // -2757.00
  sign: 'positive' | 'negative' | 'neutral';
  base: number;           // su cosa è stato calcolato
  formula: string;        // "30.000 × 9,19%"
  legalRef: string;       // "L. 335/1995; circ. INPS aliquote 2026"
  note?: string;          // avvisi ("stima: dipende dal CCNL")
  detail?: BracketDetail[]; // per l'IRPEF: quanto per ciascuno scaglione
};

type CalculationResult = {
  input: CalculationInput;
  taxYear: number;
  steps: CalculationStep[];
  totals: {
    gross: number; totalContributions: number; totalTax: number;
    netAnnual: number; netMonthly: number;
    effectiveRate: number;   // pressione fiscale reale
    marginalRate: number;    // aliquota sull'euro successivo
  };
  informational: { tfr: number; employerCost: number };
  warnings: Warning[];
};
```

Ogni step porta la propria formula e la propria norma. **La UI non ricalcola nulla**: si limita a
disegnare ciò che il motore ha dichiarato. Questo garantisce che ciò che l'utente legge sia
letteralmente il calcolo eseguito, e non una spiegazione scritta a parte che può divergere.

---

## 5. Deployment: Vercel (deciso)

**GitHub Pages serve solo file statici**: non esegue Node, quindi **una API route Next.js non
funziona**. Le opzioni reali sono:

| Opzione | URL | API route | Note |
|---|---|---|---|
| **A. GitHub Pages** + Next.js `output: 'export'` | `username.github.io/calcolatore-netto-lordo` | ❌ non disponibile | Il motore gira nel browser (`LocalClient`). Perfettamente adeguato: il calcolo è deterministico e non serve un server |
| **B. Vercel free tier** | `nome-progetto.vercel.app` | ✅ funzionante | Anch'esso **gratuito e senza dominio da comprare**. Deploy automatico da GitHub |
| **C. Entrambi** | Pages come mirror statico, Vercel come deploy principale | ✅ | Costo marginale ~zero grazie al pattern port/adapter |

**Il design regge in tutti e tre i casi** grazie al `CalculationClient`: il motore è lo stesso,
cambia solo l'adapter (`LocalClient` in-process vs `HttpClient` verso `/api/calculate`).
Non è astrazione gratuita — è esattamente ciò che rende la scelta di hosting reversibile.

> ✅ **Decisione: opzione B — Vercel free tier.** Gratuito quanto GitHub Pages, nessun dominio da
> acquistare, API route funzionante e preview deploy per ogni commit.
> GitHub Pages resta un ripiego a costo zero: basterebbe compilare con `output: 'export'` e usare
> solo `LocalClient`, senza toccare il dominio. È esattamente ciò che il pattern port/adapter compra.

---

## 6. Struttura del repository

```
calcolatore-netto-lordo/
├── docs/
│   ├── 01-domain-research.md      # normativa, parametri, fonti
│   ├── 02-assumptions.md          # semplificazioni dichiarate
│   ├── 03-system-design.md        # questo documento
│   ├── 04-calculation-spec.md     # formule e ordine di calcolo
│   └── 05-test-plan.md            # strategia e casi di validazione
├── packages/core/
│   ├── src/
│   │   ├── calculate.ts           # orchestratore
│   │   ├── steps/                 # una funzione pura per voce
│   │   ├── schema.ts              # tipi + validazione Zod
│   │   └── params/2026.json
│   └── test/
│       ├── steps/                 # unit test per singola voce
│       ├── golden/                # casi di validazione end-to-end
│       └── properties.test.ts     # invarianti (monotonia, ecc.)
├── apps/web/
│   ├── app/
│   │   ├── page.tsx
│   │   └── api/calculate/route.ts # usato quando c'è un runtime Node
│   ├── components/
│   └── lib/clients/               # LocalClient | HttpClient
└── README.md
```

**Perché un monorepo con due pacchetti e non una cartella sola**: rende il confine fra dominio e
UI un fatto strutturale, non una convenzione. `packages/core` non ha React nel `package.json`:
è impossibile violare il confine per distrazione.

---

## 7. Stack tecnologico e motivazioni

| Livello | Scelta | Perché |
|---|---|---|
| Linguaggio | **TypeScript** (strict) | Il dominio è pieno di unità omogenee (euro, percentuali, soglie): i tipi prevengono errori reali. Branded types per `Euro` e `Rate` |
| Dominio | TS puro, zero dipendenze | Portabile, testabile, longevo |
| Validazione | **Zod** | Valida sia gli input utente sia il file parametri, con un'unica fonte di verità dei tipi |
| Frontend | **Next.js (App Router) + React** | Static export per Pages *o* runtime per Vercel, senza cambiare codice |
| Styling | **Tailwind CSS** | Velocità e coerenza |
| Componenti | **shadcn/ui** | Componenti copiati nel repo (non una dipendenza opaca), accessibili, personalizzabili. Preferito a daisyUI perché il controllo del markup conta quando bisogna rendere leggibile una tabella densa |
| Grafici | **SVG scritto a mano** (nessuna libreria) | Il waterfall sono ~10 rettangoli: una libreria di charting costerebbe peso e controllo senza risolvere nulla. Vedi [06](06-ux-design.md) §5 |
| Form | **react-hook-form** + resolver Zod | Stesso schema per form, API e motore |
| Tema | **next-themes** | Dark mode senza flash in SSR |
| Test | **Vitest** + **fast-check** + **Playwright** | Unit, property-based e smoke UI |
| CI | **GitHub Actions** | Type-check + test + build a ogni push. Un badge verde nel README è una dichiarazione di serietà |

---

## 8. Flusso applicativo

```
Utente compila il form
        │
        ▼
Validazione client (Zod)          ── errori inline, "Calcola" disabilitato se invalido
        │
        ▼
CalculationClient.calculate(input)
        │
        ▼
core.calculateNet(input, params2026)
   1. contributi previdenziali
   2. imponibile fiscale
   3. somma esente cuneo (se ≤ 20.000)
   4. IRPEF lorda per scaglioni
   5. detrazioni (art. 13 + art. 12 + cuneo)
   6. IRPEF netta (floor a 0)
   7. addizionali regionale + comunale
   8. trattamento integrativo
   9. netto annuo e mensile, aliquote effettiva e marginale
        │
        ▼
CalculationResult (steps + totals + warnings)
        │
        ▼
UI: sintesi ► waterfall ► tabella espandibile con formula e norma per ogni riga
```

---

## 9. Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Parametro fiscale sbagliato → tutto sbagliato | `confidence` + `source` per parametro; test golden contro calcolatori di riferimento; punti aperti tracciati in 01 §7 |
| Il progetto "sembra" generato da un tool | Documenti che precedono il codice, test che dimostrano comprensione, commenti che citano le norme, discontinuità normative implementate correttamente |
| Over-engineering per un prototipo | Il confine è: astrazioni che servono a **testare** o a **rendere reversibile una scelta** (port/adapter, params come dato) restano; tutto il resto no. Niente database, niente auth, niente state management globale |
| Errori di arrotondamento | Regola unica e documentata: calcoli in centesimi interi dove possibile, troncamento alla 4ª cifra per le formule art. 13 come prescritto, arrotondamento solo in presentazione |
