# BBGM → NBA 2K Archetype Converter

Convert [Basketball GM](https://basketball-gm.com/) player ratings into their closest NBA 2K build archetypes — either one player at a time in a calculator, or a whole roster via CSV upload.

## Using it

Open **`docs/index.html`** in any browser, or enable GitHub Pages on the `docs/` folder to host it. (The "Load sample roster" button needs a real HTTP origin — browsers block `fetch` from `file://` — so serve the folder with `python3 -m http.server` if you're running it locally; everything else works straight from disk.)

- **Single player**: type the 15 BBGM ratings (Hgt → Reb), paste a whole ratings row into the quick-paste box (a raw BBGM export row with extra leading columns works too — it uses the trailing 15), or click "Load a sample player". You get the archetype matches with a **calibrated fit grade**, the raw fit gap, the build's rank within the eligible pool, the stats the build was *chosen for* and the stats the player is *weak at*, a per-stat chart of the player's value against the build's required range, the converted 2K ratings, and the full 2K badge sheet with a badge-point total. Calculating updates the page URL so you can share the exact result.
- **Batch**: upload a BBGM ratings CSV (comma, semicolon or tab delimited — the delimiter is detected), drag-and-drop it, paste CSV text, or click "Load sample roster". Results can be filtered by name, position and fit quality, sorted, paged, switched between **Players / Teams / Archetype-usage** views, and downloaded as a CSV that includes converted 2K ratings, gaps, grades, badge points and the peak projection. Click any row for the full single-player breakdown in a drawer. The whole run is persisted, so a refresh doesn't lose a 900-row batch.
- **Settings**: grade ratings against the NBA or against **the uploaded league itself**; make position a soft preference; adjust BBGM's height scale; and weight the stat groups you care about.
- **Archetype browser**: search the 1,256 builds directly ("everything under 6'6" that doesn't require 3PT ≥ 80"), each with the equivalent BBGM player its requirements describe.

## How it works

1. **BBGM → percentile**: each rating becomes a percentile in a reference distribution — the modern NBA by default, or the uploaded roster itself in "this league" mode. A symmetric exponential curve stretches both the top and bottom 10% so elite (and poor) ratings stay that way after translation. `Endu` isn't modeled by any 2K attribute, so it's surfaced as a conditioning note rather than silently dropped.
2. **Percentile → 2K rating**: the percentile maps onto 2K's rating distribution for that stat. Each 2K stat *blends* the BBGM inputs that actually drive it rather than copying one — Interior Defense is dIQ + Strength + height, Block is dIQ + Jmp + height, Driving Dunk is Dnk + Jmp + Spd, Defensive Rebound is Reb + height, Speed With Ball is Drb + Spd, and so on. Height feeds ratings here, not just the build filter.
3. **Matching**: player and build are both expressed in **percentile space**, so a point means the same thing in every stat and the declared weights control influence as written. A player inside a build's range costs nothing; falling short of a minimum is penalized quadratically; exceeding a maximum costs a third as much. A **shape term** penalizes builds whose strength/weakness pattern doesn't resemble the player's. Builds demanding a skill 40+ percentile points beyond the player are disqualified; if nothing survives, results are still shown but flagged, never presented as a clean match. Height filters the pool (±1"), relaxing to nearest-height builds rather than the whole database.
4. **Fit grade**: a calibrated grade (Excellent / Good / Loose / Poor / No real build) derived from the raw penalty, anchored on the penalty distribution of a real 966-player league.
5. **Badges**: converted ratings and height run through 2K's real badge thresholds (`docs/badges.js`, versioned), Bronze → Legend, gated by each badge's height range. All 40 badges.

## Known limitations

- **The build database is shooting-first.** 73% of the 1,256 builds require 3PT ≥ 80, so shooting archetypes stay common even with a well-calibrated matcher. The archetype browser's "max 3PT requirement" filter surfaces the rest.
- **59% of the database's stat entries have min = max.** Those are widened by ±2 before matching so they aren't dramatically harsher than genuinely banded stats.
- **Free Throw drives no 2K badge**, so its conversion only affects archetype matching.
- **Wingspan and weight/body type aren't modeled** — BBGM has no equivalent input.
- **Badge thresholds are per game version** and 2K changes them yearly; the version in use is shown in the UI.
- **Position is a soft preference, off by default.** The build database is skewed (PG 135, SG 181, SF 243, PF 360, C 337), so guards compete over a much thinner pool.

## Development

```sh
npm test                                                    # engine + regression tests
node tools/make_golden.js                                   # regenerate tests/golden.json after an intended change
node tools/measure.js [roster.csv] [--league]               # diversity / discrimination diagnostics
python3 tools/extract_archetypes.py data/2K_to_BBGM_Archetypes.xlsx   # regenerate docs/archetypes.js
```

The test suite covers conversion monotonicity, percentile round-trips (both directions), Legend-tier reachability, stat collinearity, 3PT discrimination, fit-quality flagging, and an **archetype-diversity regression guard** — CI fails if a change collapses the matcher back onto a handful of builds. CI also fails if `docs/archetypes.js` drifts from the workbook or the two copies of the sample roster diverge.

## Repo layout

- `docs/index.html` — the UI
- `docs/engine.js` — conversion + matching + badge engine (shared by the browser and the tests)
- `docs/archetypes.js` — generated archetype database
- `docs/badges.js` — badge thresholds, with the game version they came from
- `docs/PlayerRatings_sample.csv` — copy of the sample roster, served from `docs/` for GitHub Pages
- `tests/` — Node test suite and golden file
- `tools/` — workbook extractor, golden-file generator, measurement harness
- `data/` — source workbook (credit: FryBandit) and the source sample roster
