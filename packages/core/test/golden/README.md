# Golden test — validazione esterna

## Metodo

I file di questa cartella contengono i risultati di **calcolatori terzi** sugli stessi input, usati
come **controllo incrociato** del nostro motore. Non sono la fonte di verità: la fonte è la
normativa ([docs/01](../../../../docs/01-domain-research.md)). Se il nostro risultato differisce ma
è giustificato da una norma e da un'assunzione dichiarata, **vince il nostro** — a patto che la
divergenza sia spiegata qui sotto.

Criteri di accettazione ([docs/05](../../../../docs/05-test-plan.md) §4): < 1% verde, 1–3% da
motivare, > 3% bug nostro salvo prova contraria.

## Fonte 1 — calcolastipendionetto.it

Raccolti il **30/08/2026** interrogando l'endpoint `POST /calcola` (che il sito usa internamente),
con profilo: Lombardia, 14 mensilità, 365 giorni, tempo indeterminato, nessun familiare a carico,
beneficio cuneo attivo, welfare 0.

### Divergenze attese e già identificate

Analizzando i valori restituiti abbiamo ricostruito tre semplificazioni del calcolatore di
riferimento. Sono **divergenze previste**: i test golden le tengono in conto invece di inseguire i
loro numeri.

**D1 — Nessun massimale contributivo, nessun contributo aggiuntivo dell'1%**

I loro contributi sono esattamente `RAL × 9,19%` a qualsiasi livello di reddito:

| RAL | loro INPS | RAL × 9,19% | massimale/1% applicati? |
|---|---|---|---|
| 55.000 | 5.055 | 5.054,50 | no (mancano ~28 € di contributo aggiuntivo) |
| 130.000 | 11.947 | 11.947,00 | no (il massimale ≈ 120.607 € è ignorato) |

→ Sopra la prima fascia di retribuzione pensionabile il **nostro** netto sarà leggermente più
basso (trattenuta aggiuntiva dell'1%); sopra il massimale sarà più alto. Riteniamo il nostro
comportamento più aderente alla norma (L. 335/1995; L. 438/1992).

**D2 — Trattamento integrativo assente**

A RAL 15.000: `13.621,50 = 15.000 − 1.379`, senza alcuna componente positiva. Con reddito
complessivo ≈ 13.622 € e IRPEF lorda (3.328) superiore alla detrazione da lavoro dipendente, il
trattamento integrativo di 1.200 € **spetterebbe** (D.L. 3/2020).

→ Sotto i 15.000 € il nostro netto sarà **~1.200 € più alto**. Divergenza attesa e voluta.

**D3 — Nessun input di comune**

Il loro form chiede solo la regione: l'addizionale comunale non può essere quella di Milano
(aliquota 0,80% con soglia di esenzione a scalino), ma una stima regionale.

→ Scostamenti dell'ordine di 100–250 €/anno, con effetto più marcato intorno alla soglia di
esenzione dei 23.000 € di imponibile, dove noi riproduciamo uno scalino che loro non hanno.

### Nota sui campi restituiti

- `irpef` **aggrega IRPEF netta e addizionali locali**: non confrontabile riga a riga con la nostra
  IRPEF netta. Il confronto significativo è su `stipendio_netto`.
- `detrazioni` risulta limitato alla capienza dell'IRPEF lorda (a RAL 15.000 vale 3.328, cioè
  esattamente l'IRPEF lorda), il che conferma che anche loro applicano il floor a zero.
- `stipendio_netto_mensile = stipendio_netto / mensilità`: stessa convenzione della nostra
  assunzione [A2](../../../../docs/02-assumptions.md).

**D4 — Il riferimento concede 1.200 € anche dove la norma non lo prevede**

Il loro form ha un toggle *"Includi bonus 100€"*, attivo di default. Confrontando le due serie
(`withBonus` / `noBonus`) il bonus vale esattamente 1.200 € e viene concesso fino a ~28.000 € di
reddito complessivo, **senza verificare la condizione di capienza** prevista dal D.L. 3/2020.

Verifica su RAL 30.000 (reddito complessivo 27.243):

| | detrazioni art. 13 | IRPEF lorda | trattamento integrativo dovuto? |
|---|---|---|---|
| norma | 2.044 | 6.266 | **no**: le detrazioni non superano l'IRPEF lorda |
| riferimento (default) | — | — | sì, 1.200 € |

→ Confrontiamo la serie **`noBonus`**, che isola questa divergenza. Su quella serie le nostre
**detrazioni coincidono all'euro** con le loro a 30.000, 35.000, 40.000 e 50.000 €: è la
validazione incrociata più forte della suite, perché copre il décalage su due fasce, la
maggiorazione di 65 € e l'azzeramento a 50.000.

**D5 — Modellazione opposta della somma esente da cuneo fiscale**

Sotto i 20.000 € il riferimento tratta il beneficio come **detrazione** (sconto pieno
sull'imposta); noi lo trattiamo come **riduzione della base imponibile** (sconto pari
all'aliquota marginale). A RAL 15.000 le loro `detrazioni` valgono 2.677 = 1.955 (art. 13) +
722, dove 722 = 13.622 × 5,3%: la percentuale del cuneo, applicata all'imposta anziché al reddito.

La norma parla di *somma che non concorre alla formazione del reddito*: la nostra lettura è
quella corretta. La differenza vale ~500 € di netto in quella fascia, a loro favore.

→ Per i casi in cui la somma esente si attiva il golden test usa una tolleranza del 6% anziché
del 3%, motivata qui. **Non inseguiamo i loro numeri.**

## Sintesi: dove i numeri coincidono

| Grandezza | Esito |
|---|---|
| Contributi INPS (sotto la 1ª fascia) | ✅ coincidenza esatta |
| Reddito imponibile | ✅ coincidenza esatta |
| Detrazioni (RAL 30k–50k, serie noBonus) | ✅ coincidenza all'euro |
| Netto annuo | entro il 3% (6% nella fascia della somma esente), con le cause identificate una per una |

## Fonte 2 — da raccogliere

Il [test plan](../../../../docs/05-test-plan.md) prevede **almeno due** fonti indipendenti.
La seconda va aggiunta prima di considerare la validazione completa.
