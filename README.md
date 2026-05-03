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

Tasot ovat `src/levels/*.json` (4×4 … 8×8, mukana tasot joissa suurin numero on 6, 7 ja 8). Muokkaamalla `regions`- ja `givens`-kenttiä voit lisätä omia pulmia; `parseLevel` tarkistaa perusvaliditeetin latauksessa.

Apuna uusille asetteluille voi käyttää `scripts/solve-layout.mjs`-skriptiä (stdin: JSON `height`, `width`, `regions`).
