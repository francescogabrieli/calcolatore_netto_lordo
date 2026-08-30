# 04 — Calculation Spec

> Specifica eseguibile del motore. È il contratto che i test di [05-test-plan.md](05-test-plan.md)
> verificano. Ogni sezione corrisponde a un file in `packages/core/src/steps/`.
>
> Notazione: `RAL` = retribuzione annua lorda in input. Tutti gli importi in euro.

---

## 0. Input e output

```ts
type CalculationInput = {
  // --- essenziali (sempre visibili in UI) ---
  grossAnnualSalary: number;        // RAL, > 0
  monthlyPayments: 12 | 13 | 14 | 15;
  region: RegionCode;               // default 'lombardia'
  municipality: MunicipalityCode;   // default 'milano'

  // --- avanzati (sezione espandibile, tutti con default) ---
  employmentDays: number;           // default 365
  contractType: 'permanent' | 'fixed_term';   // default 'permanent'
  isApprenticeship: boolean;        // default false
  dependents: {
    spouse: boolean;                // default false
    children21to30: number;         // default 0
    childrenSharePercent: 100 | 50; // default 100
    otherDependents: number;        // default 0
  };
  taxFreeBenefits: number;          // welfare/fringe benefit, default 0
  applyCuneoBenefit: boolean;       // default true
};
```

Output: `CalculationResult` come definito in [03-system-design.md](03-system-design.md) §4.

---

## 1. Contributi previdenziali a carico del lavoratore

```
base_contributiva = min(RAL, massimale_contributivo)          // ≈ 120.607 €

aliquota_base = isApprenticeship ? 0,0584 : 0,0919

contributi_base = base_contributiva × aliquota_base

quota_eccedente = max(0, base_contributiva − soglia_1a_fascia)   // soglia ≈ 52.190 €
contributo_aggiuntivo = quota_eccedente × 0,01

CONTRIBUTI = contributi_base + contributo_aggiuntivo
```

**Riferimenti**: L. 335/1995 art. 2 co. 18 (massimale); L. 438/1992 art. 3-ter (1% aggiuntivo).

**Nota**: l'1% aggiuntivo si applica **solo alla quota eccedente**, non all'intera retribuzione.
È un errore frequente applicare il 10,19% su tutto.

---

## 2. Reddito imponibile fiscale

```
IMPONIBILE_LORDO = RAL − CONTRIBUTI
```

I contributi previdenziali obbligatori sono **oneri deducibili** (art. 10 TUIR): riducono
la base imponibile IRPEF.

---

## 3. Somma esente da riduzione del cuneo fiscale

Si applica **solo se** `IMPONIBILE_LORDO ≤ 20.000` e `applyCuneoBenefit`.

```
se IMPONIBILE_LORDO ≤ 8.500   →  perc = 0,071
se 8.500 < I ≤ 15.000         →  perc = 0,053
se 15.000 < I ≤ 20.000        →  perc = 0,048

SOMMA_ESENTE = IMPONIBILE_LORDO × perc

REDDITO_COMPLESSIVO = IMPONIBILE_LORDO − SOMMA_ESENTE
```

Sopra i 20.000 €: `SOMMA_ESENTE = 0` e `REDDITO_COMPLESSIVO = IMPONIBILE_LORDO`
(il beneficio arriva invece come detrazione, §5.3).

⚠️ **Attenzione al riferimento**: la percentuale si applica al reddito **da lavoro dipendente**.
Nel nostro profilo semplificato coincide con l'imponibile fiscale (assunzione A12).
La scelta è documentata e centralizzata in un'unica funzione, così è facile cambiarla.

---

## 4. IRPEF lorda

Progressione **per scaglioni** (non aliquota unica sul totale):

```
IRPEF_LORDA = Σ_scaglioni  ( porzione_di_reddito_nello_scaglione × aliquota )
```

| Scaglione | Aliquota |
|---|---|
| 0 – 28.000 | 23% |
| 28.001 – 50.000 | 33% |
| oltre 50.000 | 43% |

Il motore restituisce anche il dettaglio per scaglione (`BracketDetail[]`), così la UI può
mostrare *quanto* è stato pagato in ciascuna fascia — informazione che nessun calcolatore
concorrente espone e che rende intuitiva la progressività.

**Riferimento**: art. 11 TUIR, come modificato da L. 199/2025 art. 1 co. 3.

---

## 5. Detrazioni

### 5.1 Detrazione per lavoro dipendente (art. 13 co. 1 TUIR)

Sia `R = REDDITO_COMPLESSIVO`, `g = employmentDays`:

```
se R ≤ 15.000:
    D = 1.955
    minimo = (contractType == 'fixed_term') ? 1.380 : 690
    D_ragguagliata = max( D × g/365 , minimo )

se 15.000 < R ≤ 28.000:
    D = 1.910 + 1.190 × (28.000 − R) / 13.000
    D = tronca_a_4_decimali(D)
    D_ragguagliata = D × g/365

se 28.000 < R ≤ 50.000:
    D = 1.910 × (50.000 − R) / 22.000
    D = tronca_a_4_decimali(D)
    D_ragguagliata = D × g/365

se R > 50.000:
    D_ragguagliata = 0

// maggiorazione art. 13 co. 1-bis — NON ragguagliata ai giorni
se 25.000 < R ≤ 35.000:
    D_ragguagliata += 65

DETRAZIONE_LAVORO = D_ragguagliata
```

**Riferimenti**: art. 13 co. 1 e 1-bis TUIR; D.Lgs. 216/2023; Circ. AdE 4/2022 (non-ragguaglio dei 65 €).

> **Tre trappole implementative**, tutte da testare esplicitamente:
> 1. **troncamento**, non arrotondamento, alla quarta cifra decimale;
> 2. i 65 € **non** si rapportano ai giorni;
> 3. a R = 50.000,01 la detrazione è **0 secco**: la discontinuità è nella norma e va riprodotta.

### 5.2 Detrazioni per familiari a carico (art. 12 TUIR)

Struttura teorica (importo base decrescente con il reddito):

```
CONIUGE:        formula a tre fasce su R, con correttivi a scaglioni
FIGLI 21–30:    950 € teorici × [(95.000 − R) / 95.000], per figlio,
                × childrenSharePercent
ALTRI FAMILIARI: 750 € × [(80.000 − R) / 80.000]
```

**Nota di dominio**: per i figli **sotto i 21 anni** dal marzo 2022 non spetta la detrazione ma
l'**Assegno Unico Universale INPS** (prestazione su domanda, fuori busta paga). Per questo l'input
chiede esplicitamente "figli 21–30 anni": è una distinzione che dimostra di aver capito la riforma.

🟡 Le formule esatte art. 12 vanno confermate sul testo vigente prima dell'implementazione
(→ 01 §7, da aggiungere come item 7).

### 5.3 Detrazione da riduzione del cuneo fiscale

Si applica **solo se** `REDDITO_COMPLESSIVO > 20.000` e `applyCuneoBenefit`:

```
se 20.000 < R ≤ 32.000:
    DETRAZIONE_CUNEO = 1.000

se 32.000 < R ≤ 40.000:
    DETRAZIONE_CUNEO = 1.000 × (40.000 − R) / 8.000

se R > 40.000:
    DETRAZIONE_CUNEO = 0
```

### 5.4 Totale

```
DETRAZIONI = DETRAZIONE_LAVORO + DETRAZIONI_FAMILIARI + DETRAZIONE_CUNEO
```

---

## 6. IRPEF netta

```
IRPEF_NETTA = max(0, IRPEF_LORDA − DETRAZIONI)
```

Il `max(0, …)` non è difensivo: è la norma. Le detrazioni non generano credito d'imposta (A8).
Quando `DETRAZIONI > IRPEF_LORDA` il motore emette un `warning` — è la condizione (l'incapienza)
che rende rilevante il trattamento integrativo.

---

## 7. Addizionali locali

Base di calcolo: `REDDITO_COMPLESSIVO` (**non** l'IRPEF — vedi 01 §2).

### 7.1 Regionale (Lombardia)

Il modello dati supporta due modalità, perché le regioni usano entrambe:

```
mode = "progressive":     come l'IRPEF, aliquota per porzione di reddito
mode = "flat_by_bracket": si individua lo scaglione di appartenenza e si applica
                          quell'unica aliquota all'INTERO imponibile
```

🔴 Modalità e soglie per la Lombardia 2026 **da confermare** su legge regionale (01 §7 item 4).
Aliquote note: da 1,23% a 1,73%, 4 scaglioni.

### 7.2 Comunale (Milano)

```
se REDDITO_COMPLESSIVO ≤ soglia_esenzione (≈ 23.000):
    ADDIZIONALE_COMUNALE = 0
altrimenti:
    ADDIZIONALE_COMUNALE = REDDITO_COMPLESSIVO × 0,008
```

**Esenzione a scalino** (`cliff`): superata la soglia si paga sull'**intero** imponibile, non
sull'eccedenza. Genera una discontinuità reale di ~184 € intorno ai 23.000 €.
Il motore la riproduce; la UI la segnala con un avviso quando il reddito è entro ±500 € dalla soglia.

---

## 8. Trattamento integrativo

```
se REDDITO_COMPLESSIVO ≤ 15.000:
    // condizione di capienza
    se IRPEF_LORDA > DETRAZIONE_LAVORO:
        TRATTAMENTO_INTEGRATIVO = 1.200 × employmentDays/365
    altrimenti:
        TRATTAMENTO_INTEGRATIVO = 0

se 15.000 < REDDITO_COMPLESSIVO ≤ 28.000:
    TRATTAMENTO_INTEGRATIVO = 0    // per assunzione A5, con warning in UI

se REDDITO_COMPLESSIVO > 28.000:
    TRATTAMENTO_INTEGRATIVO = 0
```

**Riferimento**: D.L. 3/2020, art. 1.

---

## 9. Netto

```
TOTALE_IMPOSTE = IRPEF_NETTA + ADDIZIONALE_REGIONALE + ADDIZIONALE_COMUNALE

NETTO_ANNUO = RAL
              − CONTRIBUTI
              − TOTALE_IMPOSTE
              + TRATTAMENTO_INTEGRATIVO
              + taxFreeBenefits

NETTO_MENSILE = NETTO_ANNUO / monthlyPayments
```

### Indicatori derivati

```
ALIQUOTA_EFFETTIVA = (CONTRIBUTI + TOTALE_IMPOSTE − TRATTAMENTO_INTEGRATIVO) / RAL

ALIQUOTA_MARGINALE = 1 − ( netto(RAL + 100) − netto(RAL) ) / 100
```

L'aliquota marginale calcolata **per differenze finite** (e non leggendo lo scaglione) è
volutamente più onesta: cattura anche gli effetti di décalage delle detrazioni e i salti delle
soglie, che possono portare la marginale reale ben sopra l'aliquota nominale dello scaglione.
È il tipo di informazione che serve davvero a chi valuta un aumento di stipendio.

---

## 10. Voci informative (mostrate, mai sottratte dal netto)

```
TFR_annuo   = RAL / 13,5  −  (RAL × 0,005)      // quota annua meno contributo FdG 0,50%
COSTO_AZIENDA ≈ RAL × (1 + 0,2381) + TFR_annuo   // stima, varia per settore
```

Entrambe etichettate come **stime** e chiaramente separate dal calcolo del netto.

---

## 11. Regole di arrotondamento

| Momento | Regola |
|---|---|
| Formule art. 13 | **troncamento** alla 4ª cifra decimale (prescritto dalla norma) |
| Calcoli intermedi | full precision, nessun arrotondamento anticipato |
| Confronti con soglie | sul valore non arrotondato |
| Presentazione | arrotondamento a 2 decimali, formato `it-IT` con `Intl.NumberFormat` |

Regola generale: **arrotondare una volta sola, alla fine**. Arrotondamenti intermedi propagano
errori e rendono impossibile riconciliare i totali con la somma delle righe.
