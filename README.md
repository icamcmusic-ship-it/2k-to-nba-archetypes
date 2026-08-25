# BBGM → NBA 2K Archetype Converter

Convert [Basketball GM](https://basketball-gm.com/) player ratings into their closest NBA 2K build archetypes — either one player at a time in a calculator, or a whole roster via CSV upload.

## Using it

Open **`docs/index.html`** in any browser, or enable GitHub Pages on the `docs/` folder to host it. (The "Load sample roster" button needs a real HTTP origin — browsers block `fetch` from `file://` — so serve the folder with `python3 -m http.server` if you're running it locally; everything else works straight from disk.)

- **Single player**: type the 15 BBGM ratings (Hgt → Reb), paste a whole ratings row into the quick-paste box (a raw BBGM export row with extra leading columns works too — it uses the trailing 15), or click "Load a sample player". You get the archetype matches with a **calibrated fit grade**, the raw fit gap, the build's rank within the eligible pool, the stats the build was *chosen for*, what it's *built around* and how far short the player is on each, and the stats the player is *weak at*, a per-stat chart of the player's value against the build's required range, the converted 2K ratings, and the full 2K badge sheet with a badge-point total. Calculating updates the page URL so you can share the exact result.
- **Batch**: upload a BBGM ratings CSV (comma, semicolon or tab delimited — the delimiter is detected), drag-and-drop it, paste CSV text, or click "Load sample roster". Results can be filtered by name, position and buildability, sorted, paged, switched between **Players / Teams / Archetype-usage** views, and downloaded as a CSV that includes converted 2K ratings, gaps, grades, badge points and the peak projection. Click any row for the full single-player breakdown in a drawer. The whole run is persisted, so a refresh doesn't lose a 900-row batch.
- **Settings**: grade ratings against the NBA or against **the uploaded league itself**; make position a soft preference; adjust BBGM's height scale; and weight the stat groups you care about.
- **Archetype browser**: search the 1,256 builds directly ("everything under 6'6" that doesn't require 3PT ≥ 80"), each with its key attributes and the equivalent BBGM player its requirements describe.

## How it works

1. **BBGM → percentile**: each rating becomes a percentile in a reference distribution — the modern NBA by default, or the uploaded roster itself in "this league" mode. A symmetric exponential curve stretches both the top and bottom 10% so elite (and poor) ratings stay that way after translation. `Endu` isn't modeled by any 2K attribute, so it's surfaced as a conditioning note rather than silently dropped.
2. **Percentile → 2K rating**: the percentile maps onto 2K's rating distribution for that stat. Each 2K stat *blends* the BBGM inputs that actually drive it rather than copying one — Interior Defense is dIQ + Strength + height, Block is dIQ + Jmp + height, Driving Dunk is Dnk + Jmp + Spd, Defensive Rebound is Reb + height, Speed With Ball is Drb + Spd, and so on. Height feeds ratings here, not just the build filter.
3. **Matching**: player and build are both expressed in **percentile space**, so a point means the same thing in every stat and the declared weights control influence as written. A player inside a build's range costs nothing; falling short of a minimum is penalized quadratically; exceeding a maximum costs a third as much. A **shape term** penalizes builds whose strength/weakness pattern doesn't resemble the player's. Builds demanding a skill 40+ percentile points beyond the player are disqualified. Height filters the pool (±1"), relaxing to nearest-height builds rather than the whole database.
4. **Key attributes**: every build has *key attributes* — the stats it demands at the 70th percentile or better, capped at its five most demanding. Those are what the build is actually built around, and falling more than **15 percentile points** short of any of them disqualifies the build **at every level of the cascade, fallback included**. That last part is the whole point: applied only at the top, the veto refused a build and the fallback underneath handed the player the same build anyway. Each match shows both directions — what it was *chosen for* and what it's *built around that the player hasn't got* — and a build with a missed key attribute can never grade above "Loose fit".
5. **"No build qualifies" is a real answer**: when nothing clears the veto, the player is reported as **unbuildable** rather than quietly given the least-bad shape. The closest builds are still listed, with the specific shortfall on each, as *what he'd be if he developed* — not what he is. On the sample roster that's ~48% of players in league mode and ~62% in NBA mode. That isn't a matcher failure: 2K's database describes MyPlayer creations with elite attributes, and a BBGM rotation player isn't one. The batch table has a **Buildable** column and the summary line reports the share for the whole roster.
6. **Fit grade**: a calibrated grade (Excellent / Good / Loose / Poor / No real build) derived from the raw penalty. Cut points are **per mode** — the ~20th/50th/75th/90th percentiles of the #1 match's penalty measured separately for NBA and league grading, because one shared table put three quarters of a league at "Good fit" or better in league mode — and when a whole roster is loaded, the grade is a percentile against *that roster's* penalty distribution instead.
7. **Badges**: converted ratings and height run through 2K's real badge thresholds (`docs/badges.js`, versioned), Bronze → Legend, gated by each badge's height range. All 40 badges.

## Known limitations

- **The build database is shooting-first.** 73% of the 1,256 builds require 3PT ≥ 80, so shooting archetypes stay common even with a well-calibrated matcher. The archetype browser's "max 3PT requirement" filter surfaces the rest.
- **59% of the database's stat entries have min = max.** Those are widened by ±2 before matching so they aren't dramatically harsher than genuinely banded stats.
- **Free Throw drives no 2K badge**, so its conversion only affects archetype matching — and its matching weight is the lowest in the table, so it's close to inert either way.
- **Badge earn rates are uneven across categories.** Shooting is the cheapest (Set Shot Specialist is earned by ~65% of a league, Rise Up and Bail Out by under 10%), and 14 of the 40 badges still can't reach Legend, because their Legend thresholds sit above the top of their stat's anchor curve. Whether those 14 thresholds are right for the game version in `docs/badges.js` is the thing worth checking, rather than pushing the anchors higher.
- **Reverse mode is a least-squares inverse, and it has a ceiling.** 21 2K stats are built from 15 BBGM ones, so a build pulling shared inputs in opposite directions (high Block, low Interior Defense) isn't representable at all. Feeding a build's own profile back through the matcher recovers it into the top 3 about half the time; a perfect nearest-profile oracle manages ~60%, so most of the remaining gap is information loss in the ratings model, not a matching error. `Endu` has no 2K source and is filled in at league average rather than left out.
- **League-derived percentiles can be partly invented.** `deriveAnchors` forces tied anchors apart to stay invertible; the count is reported per stat and surfaced in the batch warnings, and a stat needing more than one bump has percentiles you shouldn't trust for that league.
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

The test suite covers conversion monotonicity, percentile round-trips (both directions), Legend-tier reachability, stat collinearity, 3PT discrimination, fit-quality flagging, the **key-attribute veto** (including that no buildable player is ever handed a build he misses a key attribute on, and that the veto survives the fallback), a **build → BBGM → build round-trip** measured against the nearest-profile oracle that bounds it, mode-specific grade calibration, and an **archetype-diversity regression guard** — CI fails if a change collapses the matcher back onto a handful of builds. CI also fails if `docs/archetypes.js` drifts from the workbook or the two copies of the sample roster diverge.

## Repo layout

- `docs/index.html` — the UI
- `docs/engine.js` — conversion + matching + badge engine (shared by the browser and the tests)
- `docs/archetypes.js` — generated archetype database
- `docs/badges.js` — badge thresholds, with the game version they came from
- `docs/PlayerRatings_sample.csv` — copy of the sample roster, served from `docs/` for GitHub Pages
- `tests/` — Node test suite and golden file
- `tools/` — workbook extractor, golden-file generator, measurement harness
- `data/` — source workbook (credit: FryBandit) and the source sample roster
