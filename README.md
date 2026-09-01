# Calcolatore Netto/Lordo — Jet HR

Prototipo che, data una **retribuzione annua lorda (RAL)**, calcola il **netto annuo e mensile**
e mostra **ogni voce trattenuta**, con la formula applicata e il riferimento normativo.

**Anno d'imposta: 2026** — Milano / Lombardia, impiegato a tempo indeterminato.

> ✅ Ricerca di dominio e documentazione · ✅ Motore di calcolo (84 test verdi)
> · ✅ Interfaccia web · ✅ Smoke test Playwright (30, desktop e mobile) · ✅ Pronto al deploy su Vercel

---

## Documentazione

| Documento                                            | Contenuto                                                                                                      |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [01 — Domain Research](docs/01-domain-research.md)   | La catena di calcolo, i parametri fiscali 2026 con fonte e livello di confidenza, i punti aperti da verificare |
| [02 — Assunzioni](docs/02-assumptions.md)            | Ogni semplificazione, il suo perché e il suo impatto                                                           |
| [03 — System Design](docs/03-system-design.md)       | Architettura, modello dati, stack, deployment                                                                  |
| [04 — Calculation Spec](docs/04-calculation-spec.md) | Formule e ordine di calcolo, passo per passo                                                                   |
| [05 — Test & Validation Plan](docs/05-test-plan.md)  | Strategia di test e casi di validazione esterna                                                                |
| [06 — UX & UI Design](docs/06-ux-design.md)          | Gerarchia informativa, wireframe, design system, librerie                                                      |

**Il punto di partenza consigliato per la lettura è [01](docs/01-domain-research.md).**

Le divergenze rispetto ai calcolatori pubblici sono analizzate una per una in
[packages/core/test/golden/README.md](packages/core/test/golden/README.md).

```bash
npm install
npm test                          # 84 test: unit, property-based, golden, round-trip inverso
npm run test:e2e                  # 30 smoke test end-to-end sulla build di produzione
npm run dev --workspace=@cnl/web  # http://localhost:3210
```

## Struttura

| Percorso                                                           | Contenuto                                                                                                  |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| [`packages/core`](packages/core)                                   | Motore di calcolo: funzione pura, zero dipendenze a parte Zod                                              |
| [`packages/core/params/2026.json`](packages/core/params/2026.json) | Parametri fiscali 2026, ognuno con fonte, data di verifica e livello di confidenza                         |
| [`apps/web`](apps/web)                                             | Interfaccia Next.js: form, percorso della retribuzione, diagramma di flusso, formule e norme voce per voce |

---

## L'idea in tre righe

1. Non esiste un'API per il calcolo netto italiano: la fonte è la **normativa**, e la trattiamo
   come **dato versionato per anno d'imposta**, separato dal motore che lo interpreta.
2. Il motore è una **funzione pura** in TypeScript, senza dipendenze, che restituisce non un
   numero ma la **traccia completa del calcolo**: ogni voce con base, formula e norma.
3. La UI non ricalcola nulla: **disegna** ciò che il motore ha dichiarato. Ciò che si legge
   a schermo è letteralmente il calcolo eseguito.

---

## Stack

TypeScript (strict) · Next.js (App Router) · React · Tailwind CSS v4 · react-hook-form · Zod ·
lucide-react · next-themes · Vitest + fast-check · Playwright · GitHub Actions

Nessuna libreria di charting e nessuna libreria di componenti: il percorso della retribuzione, il
diagramma di Sankey «dove finiscono i soldi» e i pochi elementi di interfaccia sono scritti a mano. Le motivazioni di ogni scelta — e di ogni
libreria **scartata** — sono in [06](docs/06-ux-design.md) §5; le due scelte che in fase di
implementazione si sono discostate dal design iniziale sono spiegate in [06 §10](docs/06-ux-design.md).

---

## Verifica

| Livello                     | Dove                                                                             | Cosa dimostra                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Unit                        | [`packages/core/test/steps`](packages/core/test/steps)                           | Ogni passo del calcolo in isolamento, sui casi limite di ogni scaglione                                        |
| Property-based (fast-check) | [`packages/core/test/properties.test.ts`](packages/core/test/properties.test.ts) | Invarianti che devono valere per **ogni** RAL: monotonia, netto ≤ lordo, marginale ∈ [0, 1]                    |
| Golden                      | [`packages/core/test/golden`](packages/core/test/golden)                         | Confronto con calcolatori pubblici, con ogni divergenza spiegata una per una                                   |
| Round-trip                  | [`packages/core/test/reverse.test.ts`](packages/core/test/reverse.test.ts)       | `netto(lordo(n)) = n`: il calcolo inverso non e' un secondo motore, e' lo stesso per bisezione                 |
| End-to-end                  | [`apps/web/e2e`](apps/web/e2e)                                                   | La build di produzione, su desktop e mobile: calcolo, traccia, ripartizione, link condivisi, tema, errori, API |

Gli smoke test girano contro `next build` + `next start`, non contro il dev server:
cio' che la CI verifica e' esattamente l'artefatto che va in produzione.

---

## Deploy

Vercel, free tier, URL `*.vercel.app` — nessun dominio da acquistare.
[`vercel.json`](vercel.json) descrive il monorepo (npm workspaces), quindi il progetto
va importato con **root directory alla radice del repository**, senza altra configurazione:

```bash
npx vercel --prod
```

Per far comparire l'URL di produzione nei metadati Open Graph basta l'ambiente di Vercel
(`VERCEL_PROJECT_PRODUCTION_URL`, letto in [`apps/web/app/layout.tsx`](apps/web/app/layout.tsx));
in alternativa si imposta `NEXT_PUBLIC_SITE_URL`.
