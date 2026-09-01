# 01 — Domain Research: dal lordo al netto in Italia (anno d'imposta 2026)

> **Stato**: bozza 1 — ricerca svolta il **30/08/2026**.
> Ogni parametro riporta valore, fonte e **livello di confidenza**. I parametri marcati
> 🟡 vanno riverificati su fonte primaria prima del rilascio (vedi §7).

---

## 1. Perché non esiste un'API da integrare

La prima domanda di design è stata: _esiste un servizio esterno che, data una RAL, restituisce il netto?_

Risposta: **no, non in modo utilizzabile**.

| Opzione valutata                                               | Esito                                                                                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| API pubblica Agenzia delle Entrate / INPS per il calcolo netto | Non esiste. AdE e INPS pubblicano **normativa e tabelle**, non un servizio di calcolo busta paga                               |
| Servizi dei software payroll (Zucchetti, TeamSystem, …)        | Closed-box, commerciali, contrattualizzati: non accessibili per un prototipo                                                   |
| Scraping di calcolatori online (es. calcolastipendionetto.it)  | Fragile, legalmente opinabile e — soprattutto — **annullerebbe lo scopo dell'esercizio**: dimostrare di controllare le logiche |

**Conseguenza architetturale**: il "servizio esterno" che ci serve non è un'API, è la **normativa**.
La progettiamo come **dato versionato per anno d'imposta** (`params/2026.json`), separato dal motore di
calcolo che lo interpreta. Vedi [03-system-design.md](03-system-design.md) §3.

---

## 2. La catena di calcolo (vista d'insieme)

L'ordine dei passaggi non è arbitrario: ogni voce si calcola su una **base imponibile diversa**,
ed è qui che si concentrano la maggior parte degli errori dei calcolatori amatoriali.

```
RAL (retribuzione annua lorda)
  │
  ├─(1) meno CONTRIBUTI PREVIDENZIALI a carico del lavoratore (INPS, 9,19% + 1%)
  │
  ▼
REDDITO IMPONIBILE FISCALE
  │
  ├─(2) meno SOMMA ESENTE da riduzione del cuneo fiscale (solo redditi ≤ 20.000 €)
  │
  ▼
REDDITO COMPLESSIVO ai fini IRPEF
  │
  ├─(3) applicazione SCAGLIONI IRPEF   ──────────────► IRPEF LORDA
  │
  ├─(4) meno DETRAZIONI (lavoro dipendente art. 13, familiari a carico,
  │      detrazione cuneo per redditi 20.000–40.000 €)
  │
  ▼
IRPEF NETTA  (≥ 0: le detrazioni non sono rimborsabili)
  │
  ├─(5) più ADDIZIONALE REGIONALE (Lombardia, a scaglioni)
  ├─(6) più ADDIZIONALE COMUNALE   (Milano, 0,80%)
  ├─(7) meno TRATTAMENTO INTEGRATIVO (ex bonus Renzi, redditi ≤ 15.000 €)
  │
  ▼
NETTO ANNUO  →  ÷ n. mensilità  →  NETTO MENSILE
```

**Due punti che quasi tutti sbagliano e che dobbiamo trattare esplicitamente:**

1. **Le addizionali non si calcolano sull'IRPEF**, si calcolano sul **reddito imponibile**
   (stessa base dell'IRPEF, non l'imposta). Sono un'imposta a sé, non una maggiorazione.
2. **Le addizionali sono a conguaglio sfalsato**: quelle maturate nell'anno _n_ sono trattenute
   in 11 rate nell'anno _n+1_, più l'acconto (30%) del comunale dell'anno _n_.
   Per un prototipo **semplifichiamo a competenza** (le imputiamo all'anno in cui maturano) e
   lo dichiariamo — vedi [02-assumptions.md](02-assumptions.md) §A7.

---

## 3. Parametri fiscali 2026 — IRPEF

### 3.1 Scaglioni e aliquote

| Scaglione (reddito complessivo) | Aliquota |
| ------------------------------- | -------- |
| fino a 28.000 €                 | **23%**  |
| da 28.001 € a 50.000 €          | **33%**  |
| oltre 50.000 €                  | **43%**  |

🟢 **Confidenza alta.** La Legge di Bilancio 2026 (**L. 199/2025, art. 1 co. 3**) ha ridotto di due
punti la seconda aliquota, dal 35% al 33%, con effetto dal 1° gennaio 2026. Beneficio massimo ≈ 440 €/anno.

> **Clausola di salvaguardia**: per redditi > 200.000 € il beneficio è sterilizzato tramite
> una riduzione forfettaria di 440 € delle detrazioni al 19% (art. 16-ter co. 5-bis TUIR).
> **Fuori scope** per il prototipo (§A9 delle assunzioni), ma da citare: dimostra che sappiamo che esiste.

### 3.2 Detrazione per redditi da lavoro dipendente (art. 13 co. 1 TUIR)

| Reddito complessivo | Formula                                                            |
| ------------------- | ------------------------------------------------------------------ |
| fino a 15.000 €     | **1.955 €** (minimo garantito 690 €; 1.380 € se tempo determinato) |
| 15.001 – 28.000 €   | **1.910 + 1.190 × [(28.000 − reddito) / 13.000]**                  |
| 28.001 – 50.000 €   | **1.910 × [(50.000 − reddito) / 22.000]**                          |
| oltre 50.000 €      | **0**                                                              |

Maggiorazione **+65 €** per redditi da 25.001 a 35.000 € (art. 13 co. 1-bis).

🟢 **Confidenza alta.** Fonti: art. 13 TUIR (DPR 917/1986), D.Lgs. 216/2023 (importo 1.955 € dal 2024),
L. 207/2024 (conferma strutturale), Circ. AdE 4/2022 (il bonus di 65 € **non** si ragguaglia ai giorni).

**Dettagli implementativi che vanno rispettati alla lettera:**

- il risultato della formula si **tronca alla quarta cifra decimale** (non si arrotonda);
- la detrazione si **ragguaglia ai giorni di lavoro dipendente** nell'anno (× giorni/365);
- la maggiorazione di 65 € **non** si ragguaglia;
- l'azzeramento oltre 50.000 € è **netto**: a 50.001 € la detrazione è 0, non "quasi 0".
  È una discontinuità reale della norma e il nostro motore deve riprodurla.

⚠️ **Punto aperto**: alcune fonti secondarie indicano 8.500 € (anziché 15.000 €) come soglia della prima
fascia, confondendola con la _no-tax area_ introdotta dalla riduzione del cuneo. Da dirimere sul testo
vigente dell'art. 13 → vedi §7, item 1.

### 3.3 Riduzione del cuneo fiscale 2026

Due misure alternative e mutuamente esclusive, entrambe commisurate al **reddito da lavoro dipendente**:

**(a) Somma esente** — redditi fino a 20.000 €. Non concorre alla formazione del reddito:

| Reddito da lavoro dipendente     | %    |
| -------------------------------- | ---- |
| fino a 8.500 €                   | 7,1% |
| da 8.500 a 15.000 €              | 5,3% |
| oltre 15.000 € (fino a 20.000 €) | 4,8% |

**(b) Detrazione aggiuntiva** — redditi da 20.000 € a 40.000 €:

| Reddito           | Detrazione                                                      |
| ----------------- | --------------------------------------------------------------- |
| 20.000 – 32.000 € | **1.000 €** (fissa)                                             |
| 32.000 – 40.000 € | **1.000 × [(40.000 − reddito) / 8.000]** (decrescente fino a 0) |
| oltre 40.000 €    | 0                                                               |

🟡 **Confidenza media.** La struttura è confermata da più fonti; nel 2026 la soglia superiore è stata
innalzata a 40.000 € (≈1,3 mln di lavoratori in più rispetto al 2025). La formula di décalage
32.000→40.000 va confermata sul testo di legge. → §7, item 2.

> Nota di modellazione: la somma esente (a) **non** è "un bonus in busta paga", è una **riduzione della
> base imponibile**. Va applicata prima degli scaglioni, non sottratta all'imposta. Distinzione che
> cambia il risultato e che vogliamo mostrare esplicitamente in UI.

### 3.4 Trattamento integrativo (ex "bonus Renzi", D.L. 3/2020)

| Reddito complessivo | Spettanza                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| fino a 15.000 €     | **1.200 €/anno** (100 €/mese), a condizione di **capienza**: IRPEF lorda > detrazione lavoro dipendente       |
| 15.001 – 28.000 €   | spetta **solo se** la somma di determinate detrazioni supera l'IRPEF lorda; importo = differenza, max 1.200 € |
| oltre 28.000 €      | non spetta                                                                                                    |

🟢 **Confidenza alta** sulla struttura. La fascia 15.000–28.000 dipende però da detrazioni
(spese mediche, mutui, bonus edilizi) **non conoscibili da un calcolatore** — lo stesso
calcolastipendionetto.it lo ammette in nota. → semplificazione §A5.

---

## 4. Parametri contributivi 2026 — INPS

| Voce                                                                                                              | Valore                                                    | Confidenza                   |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------- |
| Aliquota IVS a carico **lavoratore** (settore privato, non agricolo)                                              | **9,19%**                                                 | 🟢 alta                      |
| Aliquota a carico **datore di lavoro**                                                                            | ≈ 23,81% (varia per settore/dimensione)                   | 🟡 informativa               |
| Contributo **aggiuntivo 1%** (art. 3-ter L. 438/1992) sulla quota oltre la 1ª fascia di retribuzione pensionabile | 1ª fascia **≈ 52.190 €** → aliquota 10,19% sull'eccedenza | 🟡 **media — da verificare** |
| **Massimale contributivo** annuo (art. 2 co. 18 L. 335/1995)                                                      | **≈ 120.607 €**                                           | 🟡 **media — da verificare** |
| Aliquota agevolata **apprendistato** a carico lavoratore                                                          | **5,84%**                                                 | 🟡 media                     |

⚠️ Il valore della prima fascia (52.190 €) è **sospetto**: risulta inferiore al valore 2025, mentre
questi importi sono rivalutati annualmente al rialzo. Da verificare sulla **circolare INPS annuale**
di aggiornamento (tipicamente pubblicata a gennaio/febbraio). → §7, item 3.

> Il massimale (art. 2 co. 18 L. 335/1995) si applica **solo ai lavoratori privi di anzianità
> contributiva al 31/12/1995** (i cosiddetti "nuovi iscritti"). È una condizione soggettiva che il
> calcolatore non può conoscere. Semplificazione §A4.

---

## 5. Addizionali locali (Lombardia / Milano)

### 5.1 Addizionale regionale — Lombardia

Struttura **a scaglioni** (4 scaglioni), aliquote da **1,23%** a **1,73%**.
Riferimento indicativo: per un imponibile di ~34.500 € si applica lo scaglione 28.000–50.000 con aliquota **1,72%**.

🔴 **Confidenza bassa sulle soglie esatte.** Le aliquote regionali sono fissate con **legge regionale**
e possono non coincidere con gli scaglioni IRPEF nazionali. **Da estrarre dalla delibera/legge regionale
Lombardia vigente per il 2026** (portale Regione Lombardia — Tributi regionali). → §7, item 4.

> Nota tecnica importante: in molte regioni l'addizionale è **"a scaglioni con aliquota unica sul
> superamento"** (aliquota applicata all'_intero_ imponibile in base allo scaglione di appartenenza),
> non progressiva per scaglioni come l'IRPEF. La differenza è sostanziale. Il modello dati deve
> supportare **entrambe** le modalità (`"progressive" | "flat_by_bracket"`). → [04-calculation-spec.md](04-calculation-spec.md) §5.

### 5.2 Addizionale comunale — Milano

| Voce                | Valore                         | Confidenza |
| ------------------- | ------------------------------ | ---------- |
| Aliquota            | **0,80%** (aliquota unica)     | 🟢 alta    |
| Soglia di esenzione | imponibile fino a **23.000 €** | 🟡 media   |

🟡 La soglia di esenzione milanese è stata oggetto di dibattito nel 2026 (possibile innalzamento
insieme all'aliquota massima). Da confermare sulla delibera comunale vigente — il sito del Comune di
Milano ha risposto 403 alla verifica automatica, va aperto a mano. → §7, item 5.

> **Attenzione al meccanismo di esenzione**: dove prevista, è una **soglia a scalino** — superata la
> soglia, l'addizionale si paga sull'**intero** imponibile, non solo sull'eccedenza. Da modellare come
> `exemption_type: "cliff"`.

---

## 6. Altre voci trattenute o rilevanti

| Voce                                                                   | Trattamento nel prototipo                                                                                                                          |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TFR** (≈ 6,91% della retribuzione, quota annua)                      | **Non** è una trattenuta al netto: è retribuzione differita, accantonata. Lo mostriamo come **voce informativa** separata, mai sottratta dal netto |
| **Fringe benefit / welfare aziendale**                                 | Non imponibili entro soglia (1.000 €, 2.000 € con figli a carico, 2024–2027). Input opzionale, si sommano al netto senza tassazione                |
| **Buoni pasto**                                                        | Esenti fino a 8 €/gg (elettronici), 4 €/gg (cartacei). Fuori scope v1                                                                              |
| **Contributi CCNL di categoria** (es. fondi sanitari, enti bilaterali) | Variano per CCNL. Fuori scope, dichiarato                                                                                                          |
| **Detrazioni per familiari a carico** (art. 12 TUIR)                   | In scope (coniuge, figli 21–30 anni, altri familiari). Nota: per figli < 21 anni dal 2022 c'è l'**Assegno Unico INPS**, non la detrazione          |
| **Assegno Unico Universale**                                           | Fuori scope: è una prestazione INPS su domanda, non una voce di busta paga                                                                         |

---

## 7. Punti aperti da verificare prima del rilascio

| #   | Da verificare                                                                   | Fonte primaria da consultare    | Impatto                    |
| --- | ------------------------------------------------------------------------------- | ------------------------------- | -------------------------- |
| 1   | Soglia prima fascia detrazione art. 13: 15.000 € o 8.500 €                      | Testo vigente art. 13 TUIR      | **Alto** (redditi bassi)   |
| 2   | Formula di décalage detrazione cuneo 32.000 → 40.000 €                          | L. 199/2025 / testo istitutivo  | **Alto** (redditi medi)    |
| 3   | 1ª fascia retribuzione pensionabile e massimale INPS 2026                       | Circolare INPS annuale aliquote | **Medio** (redditi alti)   |
| 4   | Scaglioni e modalità (progressiva vs flat) addizionale regionale Lombardia 2026 | Legge regionale Lombardia       | **Medio**                  |
| 5   | Aliquota e soglia esenzione addizionale comunale Milano 2026                    | Delibera Comune di Milano       | **Medio**                  |
| 6   | Aliquota apprendistato a carico lavoratore (5,84%)                              | Circolare INPS                  | **Basso** (fuori scope v1) |

**Metodo**: ogni parametro confermato viene scritto in `params/2026.json` con i campi
`value`, `source`, `source_url`, `verified_at`. Un parametro senza fonte non entra nel file.

---

## 8. Fonti consultate

**Normativa e prassi citate**

- DPR 917/1986 (TUIR), artt. 11, 12, 13, 16-ter
- L. 199/2025 (Legge di Bilancio 2026), art. 1 co. 3 — riduzione seconda aliquota al 33%
- D.Lgs. 216/2023 — detrazione lavoro dipendente a 1.955 €
- L. 207/2024 (Legge di Bilancio 2025) — riduzione cuneo fiscale
- D.L. 3/2020 — trattamento integrativo
- L. 335/1995, art. 2 co. 18 — massimale contributivo
- L. 438/1992, art. 3-ter — contributo aggiuntivo 1%
- Circ. Agenzia delle Entrate n. 4/2022

**Fonti web**

- [Fiscomania — Aliquote IRPEF 2026](https://fiscomania.com/aliquote-irpef/)
- [Fiscomania — Detrazioni redditi da lavoro dipendente](https://fiscomania.com/detrazioni-per-redditi-da-lavoro-dipendente/)
- [Fiscomania — Calcolo contributi INPS 2026](https://fiscomania.com/calcolo-contributi-versati/)
- [CGIL Roma e Lazio — Novità IRPEF 2026](https://lazio.cgil.it/2026/01/novita-irpef-2026-aliquote-scaglioni-detrazioni/)
- [FISCOeTASSE — Taglio del cuneo fiscale](https://www.fiscoetasse.com/new-rassegna-stampa/1178-taglio-cuneo-fiscale-ecco-le-novita-2025.html)
- [PMI.it — Busta paga 2026 e Manovra](https://www.pmi.it/economia/lavoro/484539/manovra-2026-lavoratori-bonus-novita-fisco.html)
- [Regione Lombardia — Addizionale regionale IRPEF](https://www.regione.lombardia.it/bollo-auto-e-tributi-regionali/red-addizionale-regionale-irpef)
- [Comune di Milano — Addizionale comunale IRPEF](https://www.comune.milano.it/en/argomenti/tributi/addizionale-comunale-irpef)
- [TuttoCalcolo — Addizionale IRPEF Lombardia](https://tuttocalcolo.it/addizionale-irpef/lombardia)
- [calcolastipendionetto.it](https://www.calcolastipendionetto.it/) — analizzato come benchmark funzionale
