# BBGM → NBA 2K Archetype Converter

Convert [Basketball GM](https://basketball-gm.com/) player ratings into their closest NBA 2K build archetypes — either one player at a time in a calculator, or a whole roster via CSV upload.

## Using it

Open **`docs/index.html`** in any browser (no server needed), or enable GitHub Pages on the `docs/` folder to host it.

- **Single player**: type the 15 BBGM ratings (Hgt → Reb), or paste a whole ratings row into the quick-paste box. You get the top 3 archetype matches with position, height range, and match %, plus the player's converted 2K ratings.
- **Batch**: upload a BBGM ratings CSV (like a Player Ratings export — see `data/PlayerRatings_sample.csv`). Recognized headers: `Name, Pos, Hgt, Str, Spd, Jmp, End, Ins, Dnk, FT, 2Pt, 3Pt, oIQ, dIQ, Drb, Pss, Reb` (aliases like `Stre`/`Endu`/`Mid`/`TP` also work; extra columns are ignored). Results show top 3 matches per player and can be downloaded as CSV.

## How it works

1. **BBGM → percentile**: each rating is converted to an NBA percentile using the distribution of all current NBA players (anchors at the 1st/10th/25th/50th/75th/90th/95th/99th percentiles, linearly interpolated). An exponential curve stretches the top 10% so elite ratings stay elite after translation.
2. **Percentile → 2K rating**: the percentile is mapped onto NBA 2K's own rating distribution for the corresponding 2K stat. BBGM stats fan out: `Ins` → Close Shot / Driving Layup / Post Control, `Dnk` → Driving/Standing Dunk, `Drb` → Ball Handle / Speed With Ball, `dIQ` → Interior D / Perimeter D / Steal / Block, `Reb` → both rebounds, `Spd` → Speed / Agility, `Stre` → Strength, `Jmp` → Vertical; `2Pt`(Mid), `3Pt`, `FT`, `Pss` map directly. `Hgt` converts to inches (0 ≈ 5'6", 50 ≈ 6'6", 100 ≈ 7'6").
3. **Matching**: the converted 2K profile is compared against 1,256 2K build archetypes (range midpoints from the source workbook) using weighted cosine similarity. Physicals and primary scoring stats weigh more, and any stat at/above the 85th NBA percentile gets a 1.5× "signature skill" boost. Builds whose height range doesn't fit the player (±1") are filtered out, relaxing automatically if nothing qualifies.

## Repo layout

- `docs/index.html` — the whole app (self-contained, no dependencies)
- `docs/archetypes.js` — generated archetype database
- `tools/extract_archetypes.py` — regenerates `archetypes.js` from the source workbook (`pip install openpyxl`, then `python3 tools/extract_archetypes.py data/2K_to_BBGM_Archetypes.xlsx`)
- `data/` — source workbook (archetype thresholds + percentile tables, credit: FryBandit) and a sample BBGM ratings CSV
