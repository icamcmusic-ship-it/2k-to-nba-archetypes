# BBGM → NBA 2K Archetype Converter

Convert [Basketball GM](https://basketball-gm.com/) player ratings into their closest NBA 2K build archetypes — either one player at a time in a calculator, or a whole roster via CSV upload.

## Using it

Open **`docs/index.html`** in any browser (no server needed), or enable GitHub Pages on the `docs/` folder to host it.

- **Single player**: type the 15 BBGM ratings (Hgt → Reb), paste a whole ratings row into the quick-paste box (a raw BBGM export row with extra leading columns works too — it uses the trailing 15), or click "Load a sample player". Pick how many results to see (3/5/10/all eligible) with the results-per-player selector. You get the archetype matches with position, height range, and match %, a raw "fit gap" that's comparable across different players, the player's converted 2K ratings, and their full 2K badge sheet (Bronze/Silver/Gold/HoF/Legend for all 39 badges, gated by height eligibility). Calculating updates the page URL with the player's ratings, so you can copy/share the link (via "Copy shareable link") to reproduce the exact same result; your last-entered player and results-per-player setting are also remembered locally between visits.
- **Batch**: upload a BBGM ratings CSV, drag-and-drop one onto the drop zone, paste CSV text directly, or click "Load sample roster" (like a Player Ratings export — see `data/PlayerRatings_sample.csv`, also duplicated at `docs/PlayerRatings_sample.csv` so it's reachable from a GitHub Pages deploy of just `docs/`). Recognized headers: `Name, Pos, Hgt, Str, Spd, Jmp, End, Ins, Dnk, FT, 2Pt, 3Pt, oIQ, dIQ, Drb, Pss, Reb` (aliases like `Stre`/`Endu`/`Mid`/`TP` also work; extra columns are ignored). Large rosters are processed in chunks with a progress bar so the page doesn't lock up. Results can be searched/filtered, sorted by clicking a column header, paged through, and downloaded as CSV.

## How it works

1. **BBGM → percentile**: each rating is converted to an NBA percentile using the distribution of all current NBA players (anchors at the 1st/10th/25th/50th/75th/90th/95th/99th percentiles, linearly interpolated). Beyond the 1st/99th anchors, an extrapolation scaled to that stat's own spread handles extreme ratings, and a symmetric exponential curve stretches both the top and bottom 10% so elite ratings stay elite and poor ratings stay poor after translation. `Endu` isn't modeled by any 2K attribute, so it's surfaced separately as a conditioning note rather than silently dropped.
2. **Percentile → 2K rating**: the percentile is mapped onto NBA 2K's own rating distribution for the corresponding 2K stat. BBGM stats fan out: `Ins` → Close Shot / Driving Layup / Post Control, `Dnk` → Driving/Standing Dunk, `Drb` → Ball Handle / Speed With Ball, `dIQ` → Interior D / Perimeter D / Steal / Block, `Reb` → both rebounds, `Spd` → Speed / Agility, `Stre` → Strength, `Jmp` → Vertical; `3Pt`, `FT` map directly. `Mid`, Ball Handle, and Pass Accuracy also blend in a share of `oIQ` (offensive IQ loosely tracks shot selection, handles, and court vision). `Hgt` converts to inches (0 ≈ 5'6", 50 ≈ 6'6", 100 ≈ 7'6").
3. **Matching**: the converted 2K profile is compared against each build's actual rating *range* (not a midpoint) from the source workbook — a player sitting inside the range costs nothing; falling short of the build's minimum is penalized quadratically, exceeding its maximum only lightly. Physicals and primary scoring stats weigh more, and any stat at/above the 85th (or at/below the 15th) NBA percentile gets a 1.5× "signature skill" boost. Builds whose height range doesn't fit the player (±1") are filtered out, relaxing automatically if nothing qualifies; height itself is clamped into the archetype database's supported range before matching, since builds don't exist for extreme heights. The displayed match % is a percentile rank against the other builds reachable for that player, not an absolute 0–100 quality score — it stays meaningful for below-average and maxed-out inputs alike, where a fixed scale saturates.
4. **Badges**: the converted 2K ratings and height are also run through NBA 2K's real badge-requirement thresholds (all 39 badges across Shooting, Playmaking, Finishing, Defense, Rebounding, and General). Each badge reaches the highest tier (Bronze → Legend) where every one of its required attributes clears that tier's threshold — multi-attribute badges are capped by the weakest attribute — and badges are marked unavailable if the player's height falls outside the badge's real height range (height is likewise clamped into the badges' supported range before evaluation).

## Known limitations

- **Position isn't part of matching.** A build's `pos` is shown next to the player's BBGM `Pos` for reference, but position doesn't influence which archetype is selected — don't read a mismatch there as the tool being wrong.
- **Match % is relative, not absolute.** It ranks builds against each other for a given player; it isn't a calibrated measure of "how good is this player" across different players.

## Repo layout

- `docs/index.html` — the whole app (self-contained, no dependencies)
- `docs/archetypes.js` — generated archetype database
- `docs/PlayerRatings_sample.csv` — copy of the sample roster, served from `docs/` so the in-app "Load sample roster" button works under a GitHub Pages deploy of just that folder
- `tools/extract_archetypes.py` — regenerates `archetypes.js` from the source workbook (`pip install openpyxl`, then `python3 tools/extract_archetypes.py data/2K_to_BBGM_Archetypes.xlsx`)
- `data/` — source workbook (archetype thresholds + percentile tables, credit: FryBandit) and the source copy of the sample BBGM ratings CSV
