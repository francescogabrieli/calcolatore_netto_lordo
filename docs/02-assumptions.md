# 02 — Assunzioni e semplificazioni

> La traccia dice esplicitamente che le semplificazioni sono ammesse e che verranno discusse
> in sede di colloquio. Questo documento esiste perché **una semplificazione dichiarata è una
> scelta di design; una semplificazione taciuta è un bug**.
>
> Ogni voce riporta: cosa assumiamo, perché, e **cosa succederebbe se togliessimo l'assunzione**.

---

## Profilo di riferimento

| Dimensione                        | Valore assunto                                                               |
| --------------------------------- | ---------------------------------------------------------------------------- |
| Qualifica                         | Impiegato                                                                    |
| Contratto                         | Tempo indeterminato, full time                                               |
| Residenza fiscale                 | Milano (Lombardia)                                                           |
| Settore                           | Privato, non agricolo, azienda con oltre 15 dipendenti                       |
| Anzianità contributiva            | Iscritto INPS **dopo** il 31/12/1995                                         |
| Periodo di lavoro                 | Anno intero (365 giorni)                                                     |
| Agevolazioni                      | Nessuna (no impatriati, no rientro cervelli, no ZES, no decontribuzione Sud) |
| Altri redditi                     | Nessuno                                                                      |
| Oneri deducibili/detraibili extra | Nessuno (no spese mediche, no mutuo, no bonus edilizi)                       |

---

## Assunzioni con impatto sul calcolo

### A1 — La RAL in input è la retribuzione lorda **totale annua**

Include tredicesima ed eventuale quattordicesima. Il numero di mensilità serve **solo a dividere**
il netto annuo, non a moltiplicare la RAL.

_Perché_: è la convenzione usata in tutte le offerte di lavoro italiane e nei calcolatori di
riferimento. Chiedere "lordo mensile × mensilità" sarebbe ambiguo.

_Se la togliessimo_: dovremmo modellare la busta paga mese per mese, con ratei di 13ª/14ª e
conguaglio di fine anno.

### A2 — Il netto mensile è il netto annuo diviso per il numero di mensilità

_Perché_: è una **media**, non la cifra effettiva di un cedolino.

_Cosa perdiamo_: nella realtà i mesi con 13ª/14ª hanno una tassazione diversa (le mensilità
aggiuntive non danno diritto a detrazioni rapportate al periodo), quindi il netto della 13ª è
tipicamente **più basso** di una mensilità ordinaria. Il nostro numero è la media corretta,
non il cedolino di dicembre. **Da dichiarare in UI**, non solo qui.

### A3 — Contributi INPS al 9,19% sull'intera RAL

Più l'1% aggiuntivo sulla quota eccedente la prima fascia di retribuzione pensionabile.

_Cosa ignoriamo_: contributi di categoria previsti da singoli CCNL (fondi sanitari integrativi,
enti bilaterali, previdenza complementare), che valgono tipicamente 0,3–1,5% aggiuntivi.

_Impatto_: il nostro netto è leggermente **ottimistico** per i CCNL con contribuzione aggiuntiva.

### A4 — Massimale contributivo sempre applicato

Il massimale (L. 335/1995) vale solo per chi non ha anzianità contributiva ante 1996.
Lo applichiamo sempre, coerentemente con il profilo assunto.

_Impatto_: rilevante solo sopra i ~120.000 € di RAL. Nel range tipico è ininfluente.

### A5 — Trattamento integrativo: fascia 15.000–28.000 € trattata come **non spettante**

In quella fascia spetta solo se le detrazioni complessive (incluse spese mediche, mutui, bonus
edilizi) superano l'IRPEF lorda — informazione **strutturalmente non conoscibile** da un calcolatore
che riceve solo una RAL.

_Perché così_: è la scelta più prudente (non promettiamo soldi che potrebbero non arrivare).
Lo stesso calcolastipendionetto.it segnala il problema in nota.

_In UI_: mostriamo un avviso esplicito quando il reddito cade in quella fascia.

### A6 — Nessun conguaglio, nessun acconto: calcolo per **competenza**

Calcoliamo l'imposta dovuta _per l'anno 2026_, non le trattenute _effettuate nel 2026_.

_Cosa ignoriamo_: le addizionali regionali/comunali maturate nel 2026 sono materialmente
trattenute in 11 rate nel 2027, più un acconto del 30% del comunale nel 2026 stesso.
Un cedolino reale mostra quindi addizionali dell'anno precedente.

_Impatto_: il netto annuo "di competenza" è quello corretto concettualmente e stabile;
il netto "di cassa" oscillerebbe tra anni.

### A7 — Addizionali calcolate sul reddito imponibile IRPEF

Non sull'IRPEF netta, non sulla RAL. Base = reddito complessivo al netto dei contributi
(e al netto della somma esente da cuneo, dove spettante).

### A8 — Le detrazioni non generano credito

Se le detrazioni superano l'IRPEF lorda, l'IRPEF netta è **0**, non negativa. L'eccedenza è persa
(salvo il meccanismo del trattamento integrativo, che è un istituto separato).

### A8-bis — Il netto può superare il lordo sui redditi bassi

Il trattamento integrativo è una **somma erogata** in busta paga, non una minore trattenuta.
Sotto i ~10.000 € di RAL può eccedere contributi e imposte, portando il netto annuo **sopra** la
RAL e l'aliquota effettiva **sotto zero**.

_Scelta_: lo lasciamo emergere invece di nasconderlo con un clamp. È il comportamento reale del
sistema, ed è coperto da un test dedicato.

### A9 — Redditi oltre 200.000 €: nessuna clausola di salvaguardia

Non applichiamo la riduzione forfettaria di 440 € delle detrazioni al 19% (art. 16-ter co. 5-bis).

_Perché_: opera su oneri detraibili al 19% che per assunzione non abbiamo (A: nessun onere extra).

### A10 — TFR escluso dal netto, mostrato come voce informativa

Il TFR (~6,91% della retribuzione utile) è **retribuzione differita accantonata**, non una
trattenuta. Sottrarlo dal netto sarebbe un errore concettuale; ometterlo del tutto nasconderebbe
una parte del costo del lavoro. Lo mostriamo separato e chiaramente etichettato.

### A11 — Giorni di detrazione: 365 di default

Le detrazioni art. 13 si ragguagliano ai giorni di lavoro dipendente nell'anno. Assumiamo l'anno
intero, con la possibilità di modificarlo negli input avanzati.

### A12 — Nessuna gestione di redditi diversi da lavoro dipendente

Il "reddito complessivo" ai fini IRPEF coincide con il reddito da lavoro dipendente.

_Impatto_: chi ha altri redditi (affitti, partita IVA, altri rapporti) avrà un'aliquota marginale
più alta di quella calcolata.

---

## Cosa NON semplifichiamo (scelte deliberate di completezza)

Queste le implementiamo per intero, perché sono il cuore della catena di calcolo e ometterle
renderebbe il risultato **sbagliato**, non "semplificato":

- progressività reale degli scaglioni IRPEF (non aliquota media);
- formule esatte art. 13 con **troncamento alla quarta cifra decimale** e ragguaglio ai giorni;
- discontinuità normative reali (azzeramento detrazione a 50.000 €, soglia di esenzione
  comunale "a scalino");
- distinzione fra **somma esente** (riduce l'imponibile) e **detrazione** (riduce l'imposta) nel
  cuneo fiscale — sono due meccanismi diversi con effetti diversi;
- contributo aggiuntivo INPS dell'1% e massimale;
- detrazioni per familiari a carico (art. 12).

---

## Registro delle decisioni di prodotto

| #   | Decisione                                                                         | Alternativa scartata               | Motivo                                                                                                          |
| --- | --------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| D1  | Motore di calcolo proprietario                                                    | Integrazione API esterna           | Nessuna API pubblica esiste; e la traccia chiede controllo delle logiche                                        |
| D2  | Parametri fiscali come **dato versionato per anno**, non come costanti nel codice | Costanti hardcoded                 | L'aggiornamento annuale diventa un cambio di file dati, non di codice. Rende testabile e auditabile ogni numero |
| D3  | Output a **cascata** con ogni voce, formula e riferimento normativo               | Output "netto: X €"                | È il differenziale del prodotto e ciò che la traccia valuta                                                     |
| D4  | Input a due livelli: essenziali sempre visibili, avanzati in sezione espandibile  | Solo RAL / tutti gli input insieme | Completezza senza sacrificare la semplicità del caso standard                                                   |
| D5  | TFR mostrato ma non sottratto                                                     | Sottrarlo / ometterlo              | Correttezza concettuale + trasparenza                                                                           |
| D6  | Ogni parametro senza fonte verificata **non entra** nel file dati                 | Riempire con valori "circa"        | Un numero senza fonte è un'opinione                                                                             |
