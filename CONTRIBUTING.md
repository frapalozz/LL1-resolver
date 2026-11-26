# Contribuire

Grazie per voler migliorare LL1 Resolver.

## Segnalare un problema

Apri una issue con:
- l'input usato (linguaggio e vincoli, oppure la grammatica);
- il risultato che ti aspettavi;
- il risultato che hai ottenuto.

Se il sito dà un verdetto sbagliato, includi anche la grammatica corretta se la conosci.

## Proporre una modifica

1. Fai un fork e crea un branch dal `main`.
2. Fai la modifica. La logica sta in `src/ll1.js`, l'interfaccia in `src/app.js` e `src/style.css`.
3. Aggiungi un test in `test/ll1.test.js` per ogni comportamento nuovo o bug corretto.
4. Esegui `npm test` e controlla che passi.
5. Apri una pull request che spieghi cosa cambia e perché.

## Linee guida

- Niente dipendenze: il progetto deve restare un sito statico che si apre con un doppio clic su `index.html`.
- `src/ll1.js` non deve toccare il DOM, così resta testabile con Node.
- Testi dell'interfaccia in italiano.
