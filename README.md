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

## Tiimin päiväpeli (`#/tiimi`)

Lyhyt selainpohjainen minipeli (reaktio + tarkkuus), sama päivän haaste kaikille **UTC-päivämäärän** perusteella. Tulokset ja top-listat (päivä / viikko / kuukausi / all-time) tallennetaan **Supabaseen**.

1. Luo Supabase-projekti ja aja SQL: [`supabase/migrations/20260206120000_team_game_scores.sql`](supabase/migrations/20260206120000_team_game_scores.sql) (SQL-editor tai Supabase CLI).
2. Paikallinen kehitys: kopioi `.env.example` → `.env.local` ja täytä:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. GitHub Actions / Pages: lisää repoon *Secrets* `VITE_SUPABASE_URL` ja `VITE_SUPABASE_ANON_KEY`, jotta build upottaa ne tuotantoon (katso [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)).

Ilman näitä muuttujia peli toimii, mutta tulosten lähetys ja top-listat eivät ole käytössä.

**Seuraavat askeleet (tuotanto):**

1. Varmista Supabase-projektissa, että migraatio on ajettu (taulu `team_game_scores` + funktio `get_team_leaderboard`). SQL-tiedosto: [`supabase/migrations/20260206120000_team_game_scores.sql`](supabase/migrations/20260206120000_team_game_scores.sql).
2. GitHub: *Settings → Secrets and variables → Actions → New repository secret* — lisää **`VITE_SUPABASE_URL`** ja **`VITE_SUPABASE_ANON_KEY`** (Project URL + `anon` `public` -avain Supabasesta). Sitten uusi push `main`-haaraan, jotta Pages-build saa avaimet mukaan.
3. Paikallinen dev: kopioi arvot `.env.local`-tiedostoon (katso `.env.example`; `*.local` ei mene gittiin).
