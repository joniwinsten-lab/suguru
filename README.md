# Suguru

Selaimessa toimiva [Suguru](https://en.wikipedia.org/wiki/Suguru)-pulmapeli. Rakennettu Vite + React + TypeScript -pinolla.

**Lähdekoodi:** [github.com/joniwinsten-lab/suguru](https://github.com/joniwinsten-lab/suguru)

## Säännöt lyhyesti

- Jokainen **alue** (väreillä erotettu) täytetään luvuilla **1…n**, missä _n_ on alueen solujen määrä — sama luku vain kerran alueella.
- **Kaikki kahdeksan naapuria** (vaaka, pysty, vinot) eivät saa sisältää samaa lukua vierekkäisissä soluissa.
- Harmaalla / lihavoidulla näkyvät **vihjeet** eivät muutu.

## Kehitys

```bash
npm install
npm run dev
```

Testit:

```bash
npm test
```

Tuotantoversio:

```bash
npm run build
npm run preview
```

## Tasot

Tasot ovat `src/levels/*.json` (4×4 … 9×9, vaikeusotsikot valikossa). Muokkaamalla `regions`- ja `givens`-kenttiä voit lisätä omia pulmia; `parseLevel` tarkistaa perusvaliditeetin latauksessa.

Sovelluksessa voi valita **teeman** (pastelli / tumma / värikäs); valinta tallentuu `localStorage`-avaimeen `suguru-ui-theme`.

Apuna uusille asetteluille: `scripts/solve-layout.mjs` (stdin: JSON `height`, `width`, `regions`) ja `scripts/random-solvable.mjs` (esim. `node scripts/random-solvable.mjs 7 7 7`).
