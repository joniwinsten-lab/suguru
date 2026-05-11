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

GitHub Pages -build (polku `/suguru/`, vastaa osoitetta `https://joniwinsten-lab.github.io/suguru/`):

```bash
npm run build:gh-pages
# esikatselu: npm run preview → avaa http://localhost:4173/suguru/
```

**Julkaisu GitHub Pagesiin:** repon *Settings → Pages → Build and deployment → Source: GitHub Actions*. Push `main`-haaraan ajaa workflowin (`.github/workflows/deploy-pages.yml`), joka buildaa `VITE_BASE_PATH=/suguru/` ja julkaisee `dist`-kansion. Ensimmäisellä kerralla GitHub pyytää hyväksymään *Pages*-ympäristön käyttöön.

## Tasot

Kentät generoidaan `npm run build:pools` → `public/pools/{taso}.json`. Oletuksena **3 kenttää** kutakin vaikeustasoa kohti (`POOL_COUNT` ympäristömuuttujalla voi muuttaa). Sovellus lataa valitun tason JSONin ja `parseLevel` validoi sen.

Apuna asetteluille: `scripts/solve-layout.mjs` (stdin: JSON `height`, `width`, `regions`) ja `scripts/random-solvable.mjs` (esim. `node scripts/random-solvable.mjs 8 8`).

## Daily life (`#/vaisto`)

Hiiren väistöpeli **Daily life**: matka metreinä, vaikeus kasvaa pelin aikana. **Yksi yritys per UTC-päivä per nimi**; tulokset ja top-listat (päivä / viikko / kuukausi / kaikki) **Supabaseen**.

1. Aja SQL: [`supabase/migrations/20260311120000_dodge_game_scores.sql`](supabase/migrations/20260311120000_dodge_game_scores.sql) (SQL-editor tai Supabase CLI). Migraatio poistaa vanhan `team_game_scores`-taulun, jos se on olemassa.
2. Paikallinen kehitys: kopioi `.env.example` → `.env.local` ja täytä:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. GitHub Actions / Pages: *Secrets* `VITE_SUPABASE_URL` ja `VITE_SUPABASE_ANON_KEY` (katso [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)).

Ilman näitä muuttujia peli toimii, mutta tulosten lähetys ja top-listat eivät ole käytössä.

**Tuotanto:**

1. Varmista Supabasessa taulu `dodge_game_scores` sekä funktiot `get_dodge_leaderboard` ja `dodge_already_played`.
2. GitHub *Settings → Secrets and variables → Actions* — `VITE_SUPABASE_URL` ja `VITE_SUPABASE_ANON_KEY`, sitten push `main`-haaraan.
3. Paikallinen dev: arvot `.env.local`-tiedostoon (`*.local` ei mene gittiin).
