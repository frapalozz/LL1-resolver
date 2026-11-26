# LL1 Resolver

Dato un linguaggio, trova una grammatica LL(1) e verifica che lo sia davvero. Mostra ogni passaggio: normalizzazione, ricorsione sinistra, left factoring, sostituzioni, FIRST, FOLLOW e tabella di parsing.

Pensato per chi studia **Linguaggi e Compilatori**.

**Demo:** https://ll1-resolver.palozz.com

## Cosa fa

- Parte da un **linguaggio** descritto con esponenti (`a^n b^m c^n`, con `n>=1, m>=0`) oppure da una **grammatica** già scritta.
- Applica l'algoritmo una fase alla volta e mostra la grammatica dopo ogni trasformazione.
- Calcola annullabili, FIRST, FOLLOW e la tabella di parsing M, con i conflitti evidenziati.
- Dà un verdetto: **È LL(1)**, **Non è LL(1)** (con il tipo di conflitto) oppure **Va in loop**.
- Se la grammatica è LL(1), analizza una stringa e mostra pila, input e azione a ogni passo.

## Uso

Apri `index.html` nel browser. Non servono installazioni né server.

### Sintassi del linguaggio

| Scrivi | Significa |
|---|---|
| `a^n` | a ripetuto n volte |
| `a^{2n}` | a ripetuto 2n volte |
| `a^{n+1}` | a ripetuto n+1 volte |
| `(ab)^n` | ab ripetuto n volte |
| `c` oppure `c^2` | terminale fisso |
| `L1 \| L2` | unione |

Vincoli: `n>=1, m>0`. Le variabili senza vincolo valgono da 0.

### Sintassi della grammatica

Una regola per riga; il primo non terminale è l'assioma.

```
E -> E + T | T
T -> T * F | F
F -> ( E ) | id
```

- Simboli separati da spazi, oppure tutto attaccato con i non terminali maiuscoli: `S -> aSb | ε`.
- Per ε scrivi `ε`, `eps` o lascia l'alternativa vuota.
- Sono accettate anche le frecce `→` e `::=`.

## L'algoritmo

0. **Normalizza il linguaggio** in modo che ogni esponente parta da 0:
   - `aⁿ, n ≥ k` diventa `aᵏ · aⁿ, n ≥ 0`;
   - `a²ⁿ` diventa `(aa)ⁿ`;
   - `aⁿ⁺ᵏ` diventa `aᵏ · aⁿ`.
1. **Costruisci la grammatica iniziale:**
   - blocco indipendente `αⁿ`: `X → α X | ε`;
   - blocchi legati `αⁿ γ βⁿ`: `X → α X β | γ`;
   - unione: `S → S₁ | S₂`.
2. **Trasforma**, ripetendo finché non cambia più nulla:
   - elimina la ricorsione sinistra (diretta e indiretta);
   - fai il left factoring;
   - sostituisci un non terminale a inizio produzione quando il suo FIRST si sovrappone a un'altra alternativa.

   Se un nuovo non terminale ripete la forma di uno precedente con più simboli in coda, il procedimento **va in loop**: il linguaggio molto probabilmente non è LL(1).
3. **Semplifica:** unisci i non terminali con produzioni identiche ed elimina quelli irraggiungibili.
4. **Verifica:** per ogni `A → α | β`:
   - `FIRST(α) ∩ FIRST(β) = ∅`;
   - se α è annullabile, `FIRST(β) ∩ FOLLOW(A) = ∅`.
5. **Concludi:**
   - nessun conflitto: la grammatica è LL(1), quindi anche il linguaggio;
   - un conflitto dimostra che **quella grammatica** non è LL(1), non per forza il linguaggio.

## Limiti

- Stabilire se un linguaggio context-free ammette una grammatica LL(1) è in generale **indecidibile**. Il riconoscimento del loop è un'euristica.
- Non sono supportati vincoli tra variabili (come `n ≥ m`) né esponenti con il segno meno (come `aⁿ⁻¹`).
- La ricorsione sinistra nascosta dietro un non terminale annullabile viene segnalata ma non eliminata.
- Linguaggi come `aⁿbⁿcⁿ` (stessa variabile tre volte) ed esponenti incrociati come `aⁿbᵐcⁿdᵐ` vengono rifiutati perché non sono context-free.

## Sviluppo

```
index.html         pagina
src/ll1.js         motore: parsing, trasformazioni, FIRST/FOLLOW, tabella, parser
src/app.js         interfaccia
src/style.css      stile
test/ll1.test.js   test
```

Il motore (`src/ll1.js`) non usa il DOM e funziona anche in Node:

```js
const LL1 = require('./src/ll1.js');
const r = LL1.solve('lang', 'a^n b^m c^n', 'n>=1, m>=0');
console.log(r.ll1);          // true
console.log(LL1.text(r.g));  // S → a A c ...
```

Per eseguire i test serve Node 18 o successivo:

```
npm test
```

### Pubblicare su GitHub Pages

Settings → Pages → Source: *Deploy from a branch*, branch `main`, cartella `/ (root)`.

## Contribuire

Leggi [CONTRIBUTING.md](CONTRIBUTING.md). Issue e pull request sono benvenute.

## Licenza

[MIT](LICENSE)
