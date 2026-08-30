# 05 — Test & Validation Plan

> Il test plan è parte della risposta alla domanda "hai capito le logiche o le hai generate?".
> Un motore fiscale senza test è un'opinione ben formattata.

---

## 1. Strategia a quattro livelli

| Livello | Cosa verifica | Strumento |
|---|---|---|
| **1. Unit** | Ogni step del calcolo isolatamente, inclusi i casi limite normativi | Vitest |
| **2. Property-based** | Invarianti che devono valere per *qualsiasi* input | Vitest + fast-check |
| **3. Golden / validazione esterna** | Il risultato end-to-end confrontato con calcolatori di riferimento | Vitest + tabella di casi |
| **4. Smoke UI** | Il form calcola, mostra il breakdown e non esplode | Playwright (1–2 test) |

---

## 2. Livello 1 — Unit test per step

### 2.1 Contributi INPS
| Caso | Atteso |
|---|---|
| RAL 30.000 | 30.000 × 9,19%, nessun contributo aggiuntivo |
| RAL esattamente pari alla soglia 1ª fascia | contributo aggiuntivo = 0 (non si applica *sulla* soglia) |
| RAL soglia + 1.000 | aggiuntivo = 1.000 × 1%, **non** l'1% su tutto |
| RAL sopra il massimale | contributi congelati al massimale |
| Apprendistato | 5,84% |

### 2.2 IRPEF lorda
| Caso | Atteso |
|---|---|
| Reddito 28.000 | interamente al 23% |
| Reddito 28.001 | 28.000 al 23% + 1 € al 33% (**non** tutto al 33%) |
| Reddito 60.000 | tre scaglioni, somma dei dettagli = totale |
| Reddito 0 | 0 |

### 2.3 Detrazione art. 13 — la sezione più delicata
| Caso | Atteso |
|---|---|
| R = 14.999 vs 15.001 | attraversamento pulito della prima soglia |
| R = 25.000 vs 25.001 | +65 € compaiono solo sopra 25.000 |
| R = 35.000 vs 35.001 | i 65 € spariscono |
| **R = 50.000 vs 50.000,01** | **1.910×0 = 0 vs 0**: verifica esplicita della discontinuità |
| giorni = 182 | detrazione dimezzata, **ma i 65 € restano interi** |
| giorni = 182, R = 10.000 | il minimo garantito (690) prevale sul ragguaglio |
| tempo determinato | minimo garantito 1.380 |
| troncamento | un input scelto perché arrotondamento e troncamento divergano alla 4ª cifra |

### 2.4 Cuneo fiscale
| Caso | Atteso |
|---|---|
| R = 19.999 vs 20.001 | passaggio da somma esente a detrazione: **nessun buco né doppio beneficio** |
| R = 32.000 vs 36.000 | détrazione fissa vs decrescente |
| R = 40.000 | detrazione = 0 esatto |

### 2.5 Addizionali
| Caso | Atteso |
|---|---|
| Imponibile 22.999 vs 23.001 (Milano) | 0 € vs ~184 €: lo **scalino** di esenzione |
| Modalità `flat_by_bracket` | aliquota sull'intero imponibile, non progressiva |
| Base di calcolo | l'addizionale è calcolata sul reddito, **mai** sull'IRPEF |

### 2.6 Trattamento integrativo
| Caso | Atteso |
|---|---|
| R = 10.000 con capienza | 1.200 € |
| R = 10.000 senza capienza (IRPEF lorda ≤ detrazione) | 0 € + warning |
| R = 20.000 | 0 € + warning "fascia non determinabile" |

---

## 3. Livello 2 — Invarianti (property-based)

Verificate su RAL casuali nel range 5.000–300.000 €:

| # | Invariante | Perché conta |
|---|---|---|
| P1 | **Monotonia**: `RAL₁ > RAL₂ ⟹ netto(RAL₁) ≥ netto(RAL₂)` | Guadagnare di più non deve mai far scendere il netto. *Eccezione ammessa e testata a parte*: lo scalino dell'addizionale comunale è una discontinuità **reale** della norma. Il test la isola invece di nasconderla |
| P2 | **Quadratura**: `RAL − Σ(step negativi) + Σ(step positivi) = netto annuo` | I numeri mostrati devono sommare a quello mostrato. Nessuna riga fantasma |
| P3 | `netto > 0`, e `netto ≤ RAL + trattamento integrativo` | Sanità di base. Il margine per il trattamento integrativo non è una scappatoia: è una somma **erogata**, che sui redditi bassi porta legittimamente il netto sopra il lordo (assunzione A8-bis) |
| P4 | `aliquota_effettiva < 0,60`, e `> 0` in assenza di trattamento integrativo | Nessuna aliquota assurda, senza negare l'aliquota negativa reale dei redditi bassi |
| P5 | `IRPEF_netta ≥ 0` sempre | Le detrazioni non generano credito |
| P6 | `netto_mensile × mensilità = netto_annuo` (entro l'errore di arrotondamento) | Coerenza della divisione |
| P7 | `aliquota_marginale ≥ aliquota_effettiva` per RAL > 15.000 | Proprietà di un sistema progressivo |

P1 e P2 sono i test che valgono di più: catturano intere classi di bug che i casi singoli mancano.

---

## 4. Livello 3 — Validazione esterna (golden test)

### Metodo
Per un insieme di RAL rappresentative, con profilo standard (Milano, 14 mensilità, nessun carico
familiare, 365 giorni), confrontiamo il nostro netto annuo con **almeno due** calcolatori pubblici
indipendenti, tra cui [calcolastipendionetto.it](https://www.calcolastipendionetto.it/).

| RAL | Perché questo caso |
|---|---|
| 15.000 | fascia trattamento integrativo + somma esente cuneo |
| 20.000 | punto di commutazione somma esente → detrazione |
| 23.500 | appena sopra la soglia di esenzione comunale Milano |
| 28.000 | confine primo/secondo scaglione IRPEF |
| 30.000 | caso "impiegato standard", il più rappresentativo |
| 35.000 | fine maggiorazione 65 € |
| 40.000 | azzeramento detrazione cuneo |
| 50.000 | azzeramento detrazione lavoro dipendente |
| 55.000 | oltre la 1ª fascia contributiva (1% aggiuntivo) |
| 80.000 | terzo scaglione pieno |
| 130.000 | oltre il massimale contributivo |

### Criterio di accettazione
- **scostamento < 1%** → verde, si accetta;
- **1–3%** → giallo, si indaga e si **documenta la causa** (tipicamente: assunzione diversa sulle
  addizionali, o conguaglio);
- **> 3%** → rosso, è un bug nostro finché non si dimostra il contrario.

**Regola importante**: le differenze **non si nascondono aggiustando i parametri finché i numeri
tornano**. Ogni scostamento residuo va spiegato in una riga del file `test/golden/README.md` con
l'assunzione che lo causa. Un calcolatore che sa *perché* differisce da un altro è più affidabile
di uno che ci coincide per caso.

### Nota metodologica
Il confronto con calcolatori terzi è **validazione**, non fonte di verità: la fonte è la norma.
Se il nostro risultato differisce ma è giustificato dalla norma e da un'assunzione dichiarata,
vince il nostro.

---

## 5. Livello 4 — Smoke test UI (Playwright)

1. Apro la pagina → inserisco 30.000 → clicco "Calcola" → compaiono netto annuo, netto mensile,
   e la tabella di dettaglio con almeno 6 righe.
2. Input invalido (0, negativo, testo) → messaggio di errore, nessun crash, bottone disabilitato.
3. La somma delle righe visualizzate coincide con il totale visualizzato (P2, ma verificata sul DOM:
   protegge dagli errori di *formattazione*, non solo di calcolo).

---

## 6. Integrazione continua

GitHub Actions a ogni push su `main` e su ogni PR:

```
type-check  →  lint  →  test (unit + property + golden)  →  build
```

Badge di stato nel README. La pipeline è rossa se un solo test fallisce: nessuna eccezione.

---

## 7. Cosa NON testiamo (e perché)

| Non testato | Motivo |
|---|---|
| Rendering visivo pixel-perfect | Costo alto, valore basso per un prototipo |
| Casi fuori dalle assunzioni dichiarate (agevolazioni, redditi multipli, part-time con giorni parziali complessi) | Fuori scope dichiarato in 02 |
| Il file parametri come "verità fiscale" | Non è testabile con codice: è verificato **umanamente** contro le fonti e tracciato con `verifiedAt` e `confidence` |
