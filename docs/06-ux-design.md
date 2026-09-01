# 06 — UX & UI Design

> Questo documento fissa **come si presenta il prodotto** e **quali librerie usiamo**, prima di
> scrivere una riga di frontend. Serve a evitare la deriva tipica dei prototipi: componenti
> aggiunti a caso, tre spaziature diverse nella stessa schermata, una dipendenza per ogni problema.

---

## 1. Principio guida

> **Il numero grande attira, il dettaglio convince.**

L'utente arriva per una domanda sola ("quanto mi resta in tasca?") e deve trovare la risposta in
meno di un secondo. Ma il valore del prodotto — e ciò che la traccia valuta — sta nel **livello
sotto**: la scomposizione voce per voce, con formula e norma.

Da qui tre regole non negoziabili:

1. **Progressive disclosure**: sintesi sempre visibile, dettaglio a un click, formule a due.
   Mai tutto in faccia insieme, mai niente nascosto per sempre.
2. **Niente numeri senza provenienza**: ogni riga del breakdown può mostrare _da dove viene_.
3. **L'incertezza si dichiara**: i parametri con `confidence: low` (vedi
   [03](03-system-design.md) §3) portano un indicatore visibile. Non fingiamo precisione che non abbiamo.

---

## 2. Architettura dell'informazione

```
┌─ HEADER ──────────────────────────────────────────────────────────┐
│  Calcolatore Netto/Lordo          Anno d'imposta 2026 ▾    ☾/☀    │
└───────────────────────────────────────────────────────────────────┘

┌─ COLONNA INPUT (sticky, 380px) ─┐  ┌─ COLONNA RISULTATI ─────────┐
│                                 │  │                             │
│  RAL                            │  │  ┌─ LIVELLO 1: SINTESI ───┐ │
│  [ 30.000 ]                 €   │  │  │  NETTO ANNUO           │ │
│  ─────────●──────────           │  │  │  22.480 €              │ │
│                                 │  │  │                        │ │
│  Mensilità                      │  │  │  Netto mensile         │ │
│  [ 12 ] [ 13 ] [ 14 ] [ 15 ]    │  │  │  1.605 € su 14 mens.   │ │
│                                 │  │  │                        │ │
│  Regione        Comune          │  │  │  Trattenute  Al. eff.  │ │
│  [Lombardia ▾] [Milano ▾]       │  │  │  7.520 €     25,1%     │ │
│                                 │  │  └────────────────────────┘ │
│  ▸ Opzioni avanzate             │  │                             │
│    · Giorni di lavoro           │  │  ┌─ LIVELLO 2: CASCATA ───┐ │
│    · Tipo contratto             │  │  │  RAL      ███████████  │ │
│    · Apprendistato              │  │  │  INPS       ▼ −2.757   │ │
│    · Familiari a carico         │  │  │  IRPEF      ▼ −4.058   │ │
│    · Welfare / fringe benefit   │  │  │  Addiz.     ▼ −705     │ │
│    · Beneficio cuneo fiscale    │  │  │  NETTO    ████████     │ │
│                                 │  │  └────────────────────────┘ │
│  ┌───────────────────────────┐  │  │                             │
│  │        CALCOLA            │  │  │  ┌─ LIVELLO 3: DETTAGLIO ┐ │
│  └───────────────────────────┘  │  │  │  [ ] Mostra formule    │ │
│                                 │  │  │  tabella espandibile   │ │
│  Reset · Copia link             │  │  │  riga per riga         │ │
└─────────────────────────────────┘  │  └────────────────────────┘ │
                                     │                             │
                                     │  ┌─ INFORMATIVE ──────────┐ │
                                     │  │  TFR maturato  2.072 € │ │
                                     │  │  Costo azienda 39.215 €│ │
                                     │  └────────────────────────┘ │
                                     │                             │
                                     │  ⓘ Assunzioni e limiti  ▸  │
                                     └─────────────────────────────┘
```

**Mobile (< 768px)**: colonna unica. Input in alto, bottone "Calcola" **sticky in fondo allo
schermo**, risultati sotto con scroll automatico alla sintesi dopo il calcolo.

---

## 3. I tre livelli, in dettaglio

### Livello 1 — Sintesi

Una `Card` con il netto annuo in tipografia molto grande (≈ 56px desktop), il netto mensile come
secondaria, e due metriche di supporto: **totale trattenute** e **aliquota effettiva**.

Aggiungiamo un dato che i concorrenti non danno: **aliquota marginale** con microcopy
_"su 100 € lordi in più ne ricevi 51"_. È l'informazione che serve davvero a chi valuta un aumento
o un'offerta, ed è calcolata per differenze finite ([04](04-calculation-spec.md) §9).

### Livello 2 — Cascata (waterfall)

Barra orizzontale che parte dalla RAL e si accorcia a ogni trattenuta, in **SVG scritto a mano**
(vedi §5: nessuna libreria di grafici).

- verde = ciò che resta, rosso/ambra = ciò che se ne va, grigio = informativo;
- ogni segmento è largo **in proporzione reale** all'importo — nessuna scala "aggiustata";
- hover/tap → tooltip con importo, percentuale sulla RAL e base di calcolo;
- il segmento del trattamento integrativo è l'unico **positivo**: cresce invece di ridurre.

### Livello 3 — Dettaglio

Tabella con una riga per `CalculationStep`. Colonne: **Voce · Base di calcolo · Importo**.
Ogni riga è espandibile e rivela:

```
IRPEF lorda                          su 27.243 €          −4.058,00 €
  ▾
    Formula   Σ per scaglione
    Scaglioni 27.243 × 23%  =  6.265,89 €
    Detrazioni  lavoro dipendente art. 13   −1.831,44 €
                cuneo fiscale (20–32k)      −1.000,00 €
    Norma     art. 11 TUIR · L. 199/2025 art. 1 co. 3
```

Un toggle **"Mostra formule"** apre tutte le righe insieme, per chi vuole leggere il calcolo per
intero. È anche la modalità giusta da mostrare in un colloquio.

### Blocco informative

TFR e costo azienda, **visivamente separati** (sfondo diverso, etichetta "Non incide sul netto").
Il TFR sopra tutto: mostrarlo dentro le trattenute sarebbe un errore concettuale ([02](02-assumptions.md) A10).

### Assunzioni e limiti

`Accordion` chiuso in fondo, che espone in linguaggio semplice le assunzioni di
[02](02-assumptions.md). **Non è un disclaimer legale nascosto**: è parte del prodotto.
Un calcolatore che dichiara i propri limiti è più credibile di uno che promette esattezza.

---

## 4. Stati dell'interfaccia

| Stato                     | Comportamento                                                                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vuoto** (primo accesso) | Colonna risultati con placeholder e microcopy _"Inserisci una RAL e premi Calcola"_. Nessun risultato finto o precompilato                                                 |
| **Invalido**              | Errore inline sotto il campo, bordo rosso, "Calcola" disabilitato. Messaggi in italiano e concreti: _"La RAL deve essere maggiore di zero"_                                |
| **Calcolato**             | Numeri con transizione breve (150ms). Scroll automatico alla sintesi su mobile                                                                                             |
| **Warning**               | `Alert` ambra sopra il breakdown per: fascia 15–28k del trattamento integrativo (A5); reddito entro ±500 € dalla soglia di esenzione comunale; incapienza delle detrazioni |
| **Confidenza bassa**      | `Badge` "stima" accanto alla riga il cui parametro ha `confidence: low`, con tooltip che spiega perché                                                                     |

Nessuno stato di loading: il calcolo è sincrono e istantaneo. Uno spinner finto sarebbe teatro.

---

## 5. Librerie — decisioni definitive

### Adottate

| Libreria                                      | Uso         | Perché questa                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Next.js** (App Router)                      | Framework   | Deploy su Vercel senza configurazione, React Server Components dove utile, API route per `/api/calculate`                                                                                                                                                                                                       |
| **React**                                     | UI          | —                                                                                                                                                                                                                                                                                                               |
| **TypeScript** (strict)                       | Linguaggio  | Branded types per `Euro` e `Rate`: il compilatore impedisce di sommare una percentuale a un importo                                                                                                                                                                                                             |
| **Tailwind CSS v4**                           | Styling     | Coerenza di spaziature e scala tipografica per costruzione                                                                                                                                                                                                                                                      |
| **shadcn/ui**                                 | Componenti  | I componenti vengono **copiati nel repo**, non installati: sono nostro codice, leggibile e modificabile. Costruito su Radix ⇒ accessibilità (focus trap, ARIA, tastiera) già risolta. Preferito a daisyUI perché qui serve controllo fine sul markup di una tabella densa, non un set di classi preconfezionate |
| **Radix UI**                                  | Primitive   | Arriva con shadcn/ui                                                                                                                                                                                                                                                                                            |
| **lucide-react**                              | Icone       | Coerente con shadcn, tree-shakeable                                                                                                                                                                                                                                                                             |
| **react-hook-form** + **@hookform/resolvers** | Form        | Validazione performante, integrazione diretta con Zod: **stesso schema per form, API e motore**                                                                                                                                                                                                                 |
| **Zod**                                       | Validazione | Un'unica fonte di verità per i tipi, condivisa fra `core` e `web`                                                                                                                                                                                                                                               |
| **next-themes**                               | Dark mode   | Gestisce SSR e flash iniziale, che a mano è fastidioso da risolvere                                                                                                                                                                                                                                             |
| **Vitest** · **fast-check** · **Playwright**  | Test        | Per i tre livelli del [test plan](05-test-plan.md)                                                                                                                                                                                                                                                              |
| **ESLint** + **Prettier**                     | Qualità     | Diff puliti                                                                                                                                                                                                                                                                                                     |

### Scartate deliberatamente

| Libreria                             | Perché no                                                                                                                                                                                                                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Recharts / Chart.js / D3**         | Il waterfall sono ~10 rettangoli SVG con etichette. Una libreria di grafici porterebbe 50–150 KB, un tema da domare e tipografia non controllabile, per risolvere un problema che non abbiamo. **Lo scriviamo a mano in SVG**: ~80 righe, pieno controllo, e sappiamo esattamente cosa disegna |
| **framer-motion**                    | Le uniche animazioni sono transizioni di opacità e altezza: CSS basta                                                                                                                                                                                                                          |
| **Redux / Zustand / Jotai**          | Lo stato è un form e un risultato. `useState` in un componente                                                                                                                                                                                                                                 |
| **date-fns / dayjs**                 | Non trattiamo date, trattiamo un anno d'imposta                                                                                                                                                                                                                                                |
| **Librerie di formattazione valuta** | `Intl.NumberFormat('it-IT')` è nello standard                                                                                                                                                                                                                                                  |
| **daisyUI**                          | Alternativa valida, ma sovrapposta a shadcn/ui: sceglierne una sola. Vedi motivazione sopra                                                                                                                                                                                                    |

> Criterio adottato: **una dipendenza entra solo se risolve un problema che avremmo scritto peggio
> da soli**. Su un progetto valutato per il controllo delle logiche, ogni libreria in meno è una
> parte in più di codice che sappiamo spiegare.

---

## 6. Design system

### Colore

Palette neutra + un accento, con **colore semantico** riservato ai numeri (mai decorativo):

```
neutrali        slate 50 → 950   (superfici, testo, bordi)
accento         indigo 600       (azioni, focus ring, link)
positivo        emerald 600      (netto, trattamento integrativo)
negativo        rose 600         (contributi, imposte)
attenzione      amber 500        (warning, badge "stima")
informativo     slate 500        (TFR, costo azienda)
```

Regola: **verde e rosso non compaiono mai come decorazione**. Se un elemento è verde, è denaro che
resta; se è rosso, è denaro che se ne va. Così il colore diventa leggibile senza legenda.

Dark mode completa via `next-themes` + variabili CSS: entrambi i temi progettati, non uno derivato
per inversione.

### Tipografia

- **Inter** (via `next/font`, self-hosted — nessuna richiesta a Google in produzione)
- **`font-variant-numeric: tabular-nums` su ogni cifra.** Non è un dettaglio estetico: senza
  cifre a larghezza fissa una colonna di importi non si allinea e diventa difficile da confrontare
- Scala: 56 / 32 / 20 / 16 / 14 / 12 px
- Importi negativi con il segno **−** (U+2212), non il trattino

### Spaziatura e forma

Scala Tailwind (4px), radius `lg` (8px) per le card, ombre minime. Densità: comoda sulla sintesi,
compatta sulla tabella.

### Formattazione dei numeri

```ts
new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(value); // → "22.480,00 €"
```

Nella sintesi (numero grande) i decimali si omettono: `22.480 €`. Nel breakdown mai — devono
sommare a vista.

---

## 7. Accessibilità

Requisiti trattati come vincoli, non come extra:

- contrasto **AA** su tutti i testi, verificato anche sui colori semantici;
- navigazione **completa da tastiera**: form, accordion, tabella, tooltip (Radix la fornisce);
- il waterfall SVG ha `role="img"` e un `aria-label` che descrive la scomposizione a parole;
- la tabella è una `<table>` semantica con `<th scope>` — non `<div>` travestiti;
- ogni informazione veicolata dal colore ha un **secondo canale**: segno, etichetta o icona
  (i daltonici sono ~8% degli uomini, e qui distinguiamo entrate da uscite);
- `prefers-reduced-motion` rispettato;
- `<html lang="it">`.

---

## 8. Microcopy

Il tono è **chiaro e non paternalistico**. Il dominio è ostico: le etichette usano il termine
tecnico corretto, e la spiegazione arriva accanto.

| Contesto           | Testo                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Label RAL          | `Retribuzione annua lorda (RAL)` — helper: _"Il totale lordo annuo, tredicesima e quattordicesima incluse"_                                        |
| Netto mensile      | `1.605 € × 14 mensilità` — helper: _"Media annua. In busta paga il mese con la tredicesima è tipicamente più basso"_                               |
| Aliquota marginale | _"Su 100 € lordi in più ne ricevi 51"_                                                                                                             |
| Warning A5         | _"In questa fascia di reddito il trattamento integrativo dipende da detrazioni che un calcolatore non può conoscere. Lo escludiamo per prudenza."_ |
| Riga TFR           | `TFR maturato nell'anno` — badge: _"Non incide sul netto"_                                                                                         |

Niente esclamativi, niente emoji nel prodotto, niente _"Ecco il tuo stipendio! 🎉"_.

---

## 9. Cosa NON facciamo

| Fuori scope                                         | Motivo                                                 |
| --------------------------------------------------- | ------------------------------------------------------ |
| Confronto fianco a fianco di due RAL                | Utile, ma non richiesto: prima il caso base fatto bene |
| Export PDF                                          | Stampa CSS, semmai, e solo se avanza tempo             |
| Grafico di andamento del netto al variare della RAL | Bello ma accessorio                                    |
| Onboarding, tour, animazioni d'ingresso             | Rumore                                                 |
| Salvataggio dei calcoli                             | Servirebbe un backend con stato: fuori scope           |

Un'eccezione a costo quasi nullo e valore alto: **"Copia link"**, che serializza gli input in query
string. Rende un calcolo condivisibile e riproducibile — utile anche a noi per allegare i casi
golden alla documentazione. **Implementato**: `apps/web/lib/share.ts`, con l'URL che segue l'ultimo
calcolo (`history.replaceState`) e un link condiviso che riproduce il risultato all'apertura. La
query string e' input non fidato: viene normalizzata sui limiti dello schema prima di toccare il motore.

---

## 10. Dove l'implementazione si e' discostata da questo documento

Un design doc scritto prima del codice e' un'ipotesi. Due punti non hanno retto alla prova, e vale
piu' spiegarli che riscrivere il documento facendo finta che l'ipotesi fosse giusta.

| Previsto (§4, §5)                                        | Realizzato                                                                                                                         | Perche'                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Waterfall **SVG** sopra una tabella delle voci           | Un **percorso verticale in HTML/CSS** (`components/flow.tsx`) piu' un **diagramma di Sankey in SVG** (`components/money-flow.tsx`) | Grafico e tabella dicevano la stessa cosa due volte, e il lettore doveva far combaciare a mente una barra con una riga. Fondendoli, la barra proporzionale **e'** la riga. Il waterfall previsto rispondeva pero' a una domanda diversa — non «in che ordine si calcola» ma «dove finiscono i soldi» — e quella domanda ha avuto il suo disegno: un Sankey in cui la somma dei nastri in uscita e' esattamente la RAL, invariante verificata da uno smoke test |
| **shadcn/ui + Radix** per accordion, tooltip, componenti | Componenti scritti a mano, nessuna libreria di UI                                                                                  | Dei componenti previsti ne servivano due, entrambi banali: l'accordion e' una transizione su `grid-template-rows`, le "pillole" sono bottoni. Le primitive Radix restavano installate e mai importate — dipendenze dichiarate e non usate, quindi rimosse                                                                                                                                                                                                      |

Cio' che il design doc chiedeva a quelle librerie — accessibilita' da tastiera, stato annunciato,
focus visibile — resta un requisito: e' garantito dal markup (`aria-expanded`, `role="radiogroup"`,
regione live sull'esito, `<dl>` per le coppie voce/valore) e verificato dagli smoke test.
