#!/usr/bin/env python3
"""Extract the NBA 2K archetype database from the 2K_to_BBGM_Archetypes.xlsx
workbook into a JS data file consumed by the web app (docs/archetypes.js).

Besides the per-build stat ranges this also carries across the reference
tables the app used to hardcode (the 2K rating anchors from
``Translation_Matrix`` and the inches<->BBGM height map from ``Percentiles``),
so the workbook stays the single source of truth and the two can't drift.

Usage: python3 tools/extract_archetypes.py path/to/2K_to_BBGM_Archetypes.xlsx
"""
import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

import openpyxl

# 2K stat columns used for matching (order matches Archetype_DB sheet)
STAT_COLS = {
    "Close Shot": 4,
    "Driving Layup": 5,
    "Driving Dunk": 6,
    "Standing Dunk": 7,
    "Post Control": 8,
    "Midrange Shot": 9,
    "Threepoint Shot": 10,
    "Free Throw": 11,
    "Pass Accuracy": 12,
    "Ball Handle": 13,
    "Speed With Ball": 14,
    "Interior Defense": 15,
    "Perimeter Defense": 16,
    "Steal": 17,
    "Block": 18,
    "Offensive Rebound": 19,
    "Defensive Rebound": 20,
    "Speed": 21,
    "Agility": 22,
    "Strength": 23,
    "Vertical": 24,
}

WEIGHT_COL = 3
SEASON_COL = 25

POS_ABBR = {
    "Point Guard": "PG",
    "Shooting Guard": "SG",
    "Small Forward": "SF",
    "Power Forward": "PF",
    "Center": "C",
}

# Anchor percentiles the Translation_Matrix columns correspond to.
PCTL = [1, 10, 25, 50, 75, 90, 95, 99]

# Four Translation_Matrix rows are flat between the 90th and 95th percentile,
# which makes every player in that band land on an identical 2K value and
# destroys differentiation exactly where builds separate. We keep the
# workbook as the source of truth and record the de-tie here explicitly, so
# the nudge is visible and auditable rather than silently edited into the JS.
P95_DETIE = {
    "Standing Dunk": 92.0,
    "Threepoint Shot": 92.0,
    "Ball Handle": 88.0,
    "Block": 94.5,
}

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = REPO_ROOT / "docs" / "archetypes.js"


def parse_range(v):
    """Return (min, max) of a '70-85' range, or (v, v) for a bare number."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return (float(v), float(v))
    s = str(v).strip()
    m = re.match(r"^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$", s)
    if m:
        lo, hi = float(m.group(1)), float(m.group(2))
        return (lo, hi) if lo <= hi else (hi, lo)
    try:
        n = float(s)
        return (n, n)
    except ValueError:
        return None


def parse_height(v):
    """Parse '6\'4" to 6\'6"' or '6\'6"' into (min_inches, max_inches)."""
    if v is None:
        return None, None
    feet_in = re.findall(r"(\d+)'\s*(\d+)?\"?", str(v))
    if not feet_in:
        return None, None
    inches = [int(f) * 12 + int(i or 0) for f, i in feet_in]
    return min(inches), max(inches)


def fmt_height(inches):
    return f"{inches // 12}'{inches % 12}\""


def extract_k2_anchors(wb):
    """Pull the 2K rating anchor curves out of the Translation_Matrix sheet.

    The sheet alternates a BBGM stat row (identity percentiles) with one row
    per 2K stat it feeds; we only want the 2K rows, which are exactly the
    ones named in STAT_COLS.
    """
    ws = wb["Translation_Matrix"]
    anchors, detied = {}, []
    for row in ws.iter_rows(min_row=2, values_only=True):
        name = row[0]
        if name not in STAT_COLS:
            continue
        vals = [row[i] for i in range(1, 9)]
        if any(v is None for v in vals):
            continue
        vals = [float(v) for v in vals]
        if name in P95_DETIE and vals[5] == vals[6]:
            vals[6] = P95_DETIE[name]
            detied.append(name)
        anchors[name] = vals
    missing = [s for s in STAT_COLS if s not in anchors]
    if missing:
        raise SystemExit(f"Translation_Matrix is missing 2K anchor rows for: {missing}")
    return anchors, detied


def extract_height_map(wb):
    """Pull the inches <-> BBGM Hgt reference points from the Percentiles sheet."""
    ws = wb["Percentiles"]
    pts = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if len(row) < 13:
            continue
        inches, hgt = row[11], row[12]
        if isinstance(inches, (int, float)) and isinstance(hgt, (int, float)):
            pts.append([float(hgt), float(inches)])
    pts.sort()
    if len(pts) < 2:
        raise SystemExit("Percentiles sheet did not yield an inches/BBGM height table")
    return pts


def main():
    parser = argparse.ArgumentParser(
        description="Extract the NBA 2K archetype database into docs/archetypes.js")
    parser.add_argument("workbook", help="path to 2K_to_BBGM_Archetypes.xlsx")
    parser.add_argument("-o", "--output", default=str(DEFAULT_OUTPUT),
                        help=f"output JS path (default: {DEFAULT_OUTPUT})")
    args = parser.parse_args()

    wb = openpyxl.load_workbook(args.workbook, data_only=True)
    ws = wb["Archetype_DB"]

    k2_anchors, detied = extract_k2_anchors(wb)
    height_map = extract_height_map(wb)

    archetypes = []
    skipped = 0
    for row_num, row in enumerate(ws.iter_rows(min_row=3, values_only=True), start=3):
        name = row[0]
        if not name:
            continue
        hmin, hmax = parse_height(row[2])
        stats = {}
        ok = True
        bad_stat = None
        for stat, col in STAT_COLS.items():
            val = parse_range(row[col])
            if val is None:
                ok = False
                bad_stat = stat
                break
            stats[stat] = (round(val[0], 2), round(val[1], 2))
        if not ok or hmin is None:
            skipped += 1
            reason = f"unparseable '{bad_stat}'" if not ok else "unparseable height"
            print(f"  skipping row {row_num} ({name!r}): {reason}", file=sys.stderr)
            continue

        weight = parse_range(row[WEIGHT_COL]) if len(row) > WEIGHT_COL else None
        season = row[SEASON_COL] if len(row) > SEASON_COL else None
        entry = {
            "name": name,
            "pos": POS_ABBR.get(row[1], row[1]),
            "hMin": hmin,
            "hMax": hmax,
            # each stat is [min, max] of the build's legal range
            "stats": [list(stats[s]) for s in STAT_COLS],
        }
        if weight is not None:
            entry["wMin"], entry["wMax"] = round(weight[0]), round(weight[1])
        if isinstance(season, (int, float)):
            entry["season"] = float(season)
        archetypes.append(entry)

    # 280+ build names repeat across different height bands and stat spreads.
    # Give every duplicated name a height-qualified display label so the UI can
    # tell two "2-Way 3-Level Scorer" builds apart instead of showing the same
    # string with different numbers behind it.
    name_counts = Counter(a["name"] for a in archetypes)
    dup_names = 0
    for a in archetypes:
        if name_counts[a["name"]] > 1:
            span = fmt_height(a["hMin"])
            if a["hMax"] != a["hMin"]:
                span += f"-{fmt_height(a['hMax'])}"
            a["display"] = f"{a['name']} ({span})"
            dup_names += 1

    out = {
        "statNames": list(STAT_COLS),
        "k2Anchors": k2_anchors,
        "pctl": PCTL,
        "heightMap": height_map,
        "archetypes": archetypes,
    }
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w") as f:
        f.write("// Generated by tools/extract_archetypes.py — do not edit by hand\n")
        f.write("const ARCHETYPE_DATA = ")
        json.dump(out, f, separators=(",", ":"))
        f.write(";\n")

    seasons = {a.get("season") for a in archetypes if "season" in a}
    print(f"Wrote {len(archetypes)} archetypes to {output_path}"
          + (f" ({skipped} row(s) skipped, see above)" if skipped else ""))
    print(f"  weight ranges: {sum('wMin' in a for a in archetypes)}"
          f" | season indices: {sorted(seasons) if seasons else 'none'}")
    print(f"  duplicate-name builds given a height-qualified label: {dup_names}")
    print(f"  de-tied flat p90/p95 anchors: {', '.join(detied) if detied else 'none'}")


if __name__ == "__main__":
    main()
