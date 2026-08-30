# Calcolatore Netto/Lordo — Jet HR

Prototipo che, data una **retribuzione annua lorda (RAL)**, calcola il **netto annuo e mensile**
e mostra **ogni voce trattenuta**, con la formula applicata e il riferimento normativo.

**Anno d'imposta: 2026** — Milano / Lombardia, impiegato a tempo indeterminato.

> 🚧 In costruzione.
> ✅ Ricerca di dominio e documentazione · ✅ Motore di calcolo (`packages/core`) con 73 test verdi
> · ⏳ Interfaccia web · ⏳ Deploy

---

## Documentazione

| Documento | Contenuto |
|---|---|
| [01 — Domain Research](docs/01-domain-research.md) | La catena di calcolo, i parametri fiscali 2026 con fonte e livello di confidenza, i punti aperti da verificare |
| [02 — Assunzioni](docs/02-assumptions.md) | Ogni semplificazione, il suo perché e il suo impatto |
| [03 — System Design](docs/03-system-design.md) | Architettura, modello dati, stack, deployment |
| [04 — Calculation Spec](docs/04-calculation-spec.md) | Formule e ordine di calcolo, passo per passo |
| [05 — Test & Validation Plan](docs/05-test-plan.md) | Strategia di test e casi di validazione esterna |
| [06 — UX & UI Design](docs/06-ux-design.md) | Gerarchia informativa, wireframe, design system, librerie |

**Il punto di partenza consigliato per la lettura è [01](docs/01-domain-research.md).**

Le divergenze rispetto ai calcolatori pubblici sono analizzate una per una in
[packages/core/test/golden/README.md](packages/core/test/golden/README.md).

```bash
npm install && npm test
```

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

TypeScript (strict) · Next.js (App Router) · React · Tailwind CSS v4 · shadcn/ui + Radix ·
react-hook-form · Zod · lucide-react · next-themes · Vitest + fast-check · Playwright · GitHub Actions

Grafici scritti a mano in SVG: nessuna libreria di charting. Le motivazioni di ogni scelta — e di
ogni libreria **scartata** — sono in [06](docs/06-ux-design.md) §5.

**Deploy**: Vercel (free tier, URL `*.vercel.app`, nessun dominio da acquistare).
