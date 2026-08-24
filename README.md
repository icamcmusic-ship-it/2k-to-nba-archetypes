# BBGM → NBA 2K Archetype Converter

Convert [Basketball GM](https://basketball-gm.com/) player ratings into their closest NBA 2K build archetypes — either one player at a time in a calculator, or a whole roster via CSV upload.

## Using it

Open **`docs/index.html`** in any browser (no server needed), or enable GitHub Pages on the `docs/` folder to host it.

- **Single player**: type the 15 BBGM ratings (Hgt → Reb), paste a whole ratings row into the quick-paste box (a raw BBGM export row with extra leading columns works too — it uses the trailing 15), or click "Load a sample player". Pick how many results to see (3/5/10/all eligible) with the results-per-player selector. You get the archetype matches with position, height range, and match %, a raw "fit gap" that's comparable across different players, the player's converted 2K ratings, and their full 2K badge sheet (Bronze/Silver/Gold/HoF/Legend for all 39 badges, gated by height eligibility). Calculating updates the page URL with the player's ratings, so you can copy/share the link (via "Copy shareable link") to reproduce the exact same result; your last-entered player and results-per-player setting are also remembered locally between visits.
- **Batch**: upload a BBGM ratings CSV, drag-and-drop one onto the drop zone, paste CSV text directly, or click "Load sample roster" (see `data/PlayerRatings_sample.csv`, also duplicated at `docs/PlayerRatings_sample.csv` so it's reachable from a GitHub Pages deploy of just `docs/`). A **BBGM league JSON export** works too — that's the format most people actually have, and it carries real heights and positions. Recognized CSV headers: `Name, Pos, Hgt, Str, Spd, Jmp, End, Ins, Dnk, FT, 2Pt, 3Pt, oIQ, dIQ, Drb, Pss, Reb` (aliases like `Stre`/`Endu`/`Mid`/`TP` also work; extra columns ignored). Comma, semicolon, tab and pipe delimiters are auto-detected, and duplicate recognised headers are reported rather than silently dropped. Large rosters process in chunks with a progress bar. Results can be searched, sorted, paged, and exported to CSV — the export now carries converted 2K ratings, badge totals and fit quality, not just three names. A **league overview** below the table shows archetype distribution, positional balance, roster-construction gaps and a badge-strength breakdown.
- **Roster variety**: batch matching can apply a soft penalty to builds already assigned many times. Off gives pure best-fit; higher settings spread a league across the catalogue (see [Diversity](#diversity)).

## How it works

1. **BBGM → percentile**: each rating is converted to an NBA percentile using the distribution of all current NBA players (anchors at the 1st/10th/25th/50th/75th/90th/95th/99th percentiles, linearly interpolated). Beyond the 1st/99th anchors, an extrapolation scaled to that stat's own spread handles extreme ratings, and a symmetric exponential curve stretches both the top and bottom 10% so elite ratings stay elite and poor ratings stay poor after translation. `Endu` isn't modeled by any 2K attribute, so it's surfaced separately as a conditioning note rather than silently dropped.
2. **Percentile → 2K rating**: the percentile is mapped onto NBA 2K's own rating distribution (anchors extracted from the workbook's `Translation_Matrix` sheet). Every 2K stat blends **several** BBGM inputs, which is what keeps the output from collapsing: reading `Ins` alone for Close Shot, Driving Layup *and* Post Control makes all three monotone transforms of one number, so they move in perfect lockstep and the tool can't represent a slasher who can't post up or a perimeter stopper who can't protect the rim. Each stat keeps a dominant primary plus the inputs that separate it — notably the opposed pairs `Driving Dunk = Dnk + Spd/Jmp` vs `Standing Dunk = Dnk + Hgt/Stre`, and `Perimeter D = dIQ + Spd` vs `Interior D = dIQ + Hgt/Stre`; `Steal = dIQ + oIQ + Spd`, `Block = dIQ + Jmp + Hgt`. A small deterministic per-player offset (seeded from the player's own ratings, so results stay exactly reproducible) breaks residual colinearity; it can be switched off. `Hgt` converts to inches via the workbook's own reference table, and a plausible playing weight is derived from height + strength.
3. **Matching**: the converted 2K profile is compared against each build's actual rating *range* (not a midpoint) — a player inside the range costs nothing; falling short of the minimum is penalized quadratically, exceeding the maximum only lightly. Physicals and primary scoring weigh more, and any stat at/above the 85th (or at/below the 15th) NBA percentile gets a 1.5× "signature skill" boost. Each build is also charged for its own **looseness**, so a catch-all build whose ranges fit everybody doesn't beat a specific build the player genuinely fills. Height (±1", relaxing to ±2") and weight act as soft filters, with height clamped into the database's supported band. The displayed match % is a percentile rank among the builds reachable for that player, not an absolute quality score; the separate "fit gap" *is* comparable across players.
4. **Badges**: the converted 2K ratings and height are run through NBA 2K's badge-requirement thresholds (42 badges across Shooting, Playmaking, Finishing, Defense, Rebounding, and General). Each badge reaches the highest tier (Bronze → Legend) where its required attributes clear the threshold — multi-attribute badges capped by the weakest, either/or badges taking the best. Each badge shows what it does, its league-wide earn rate, and how far a near-miss is from the next tier, and the sheet totals to a **rarity-weighted badge-points** score.

## Known limitations

- **Position isn't part of matching.** A build's `pos` is shown next to the player's BBGM `Pos` for reference, but position doesn't influence which archetype is selected — don't read a mismatch there as the tool being wrong.
- **Match % is relative, not absolute.** It ranks builds against each other for a given player; the "fit gap" column is the cross-player-comparable number.
- **The conversion is unvalidated.** The workbook's `2K_Ratings`, `Players` and `Weighted_Vectors` sheets are empty templates — headers only, zero data rows — so there is no ground-truth set of hand-mapped real players to measure the conversion's accuracy against. Every anchor value is therefore unfalsifiable from this repo alone. Supplying real player data in `2K_Ratings` would make a per-stat error report (and a "nearest real NBA player" feature) possible.
- **The badge catalogue is hand-authored.** The workbook carries no badge data, so the 42-badge list and its thresholds can't be regenerated or verified from source.
- **Common badges are inherent, not a bug.** 2K's scale is compressed at the top (NBA median Close Shot is 80), so most real players clear the low Bronze bars. Rarity weighting, not harsher thresholds, is what makes the badge sheet informative.
- **The build catalogue skews big.** Guards hold ~25% of the 1,256 builds against ~40% of a typical roster, 803 builds are single-height, and nothing exists below 5'9" or above 7'4".
- **Age and development aren't modelled.** A 19- and a 34-year-old with identical ratings get identical output.

## Diversity

Output staleness was the most serious problem in this tool: a whole league used to land on a handful of builds. Measured over the bundled 974-player roster:

| Metric | Before | Best-fit | Roster variety on |
| --- | --- | --- | --- |
| Perfectly rank-correlated stat pairs | 12 | 0 | 0 |
| Distinct top-1 archetypes | 45 | 173 | 312 |
| Most common archetype's share | 20.4% | 8.5% | 3.7% |
| Top 10 archetypes' combined share | 79.0% | 43.3% | — |

`tests/run.js` asserts these as a regression guard, so diversity can't silently degrade.

## Repo layout

- `docs/index.html` — the whole app (self-contained, no dependencies)
- `docs/archetypes.js` — generated database: build stat ranges, weight ranges, season index, the 2K anchor curves and the height reference table
- `docs/PlayerRatings_sample.csv` — copy of the sample roster, served from `docs/` so the in-app "Load sample roster" button works under a GitHub Pages deploy of just that folder
- `tools/extract_archetypes.py` — regenerates `archetypes.js` from the source workbook
- `tests/` — `run.js` (golden cases + staleness regression guard), `diversity.js` (diversity report), `harness.js` (loads the app's real code in Node)
- `data/` — source workbook (archetype thresholds + percentile tables, credit: FryBandit) and the source copy of the sample BBGM ratings CSV

## Development

```sh
make deps    # pip install -r requirements.txt
make regen   # rebuild docs/archetypes.js from the workbook
make test    # golden cases + diversity regression guard
make serve   # serve docs/ at http://localhost:8000
```

`make test` requires no dependencies beyond Node. Run it before pushing — it fails the build if the matcher collapses back onto a few archetypes.
