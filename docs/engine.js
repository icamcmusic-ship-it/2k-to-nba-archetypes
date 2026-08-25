// BBGM -> NBA 2K conversion + archetype matching engine.
//
// Pure logic, no DOM: loaded as a plain <script> by docs/index.html and
// require()d by tests/ under Node. Everything the UI needs hangs off the
// BBGM2K object exported at the bottom.
"use strict";
var BBGM2K = (function () {

const ARCH = typeof ARCHETYPE_DATA !== "undefined" ? ARCHETYPE_DATA : require("./archetypes.js");
const BADGE_DATA = typeof BADGES_DATA !== "undefined" ? BADGES_DATA : require("./badges.js");

// ---------- Percentile anchor tables ----------
const PCTL = [1, 10, 25, 50, 75, 90, 95, 99];

// BBGM rating at each percentile, measured on current NBA players.
const NBA_ANCHORS = {
  Hgt:[23,33,40,47,55,62,66,74], Stre:[23,39,44,49,55,63,68,78],
  Spd:[32,42,46,52,60,68,72,82], Jmp:[29,40,45,50,59,67,71,81],
  Endu:[17,32,36,41,49,59,65,82], Ins:[17.88,29,36,41,47,56,62,79.12],
  Dnk:[21,38,44,49,56,65,71,87], FT:[10.88,32,39,45,55,63,67,75.12],
  Mid:[20,33,39,46,56,67,75,89], TP:[1,20,28,41,51,64,71,86.12],
  OIQ:[28,37,40,45,52,59,65,78], DIQ:[26,36,40,45,51,57,61,72],
  Drb:[24,39,45,50,56,65,70,79], Pss:[24,37,42,46,52,63,70,81.12],
  Reb:[32,41,45,50,55,63,69,81],
};

// 2K rating at each percentile.
//
// The original table was sampled from starters/notable players, which
// compressed the middle of several distributions into a handful of points --
// "Threepoint Shot" put the 10th percentile at 70 and the 75th at 85, so 73%
// of the build database's 3PT minimums were cleared by a 29th-percentile
// shooter and 3PT stopped discriminating between players entirely. These
// anchors span the full 2K roster instead, and the top anchors reach the real
// in-game maxima so the Legend badge tier (96-99 on most badges) is reachable.
const K2_ANCHORS = {
  "Close Shot":[30,45,58,72,82,89,93,98],
  "Driving Layup":[30,45,60,73,82,89,93,98],
  "Driving Dunk":[25,40,56,72,84,91,94,98],
  "Standing Dunk":[20,33,47,64,80,89,93,98],
  "Post Control":[25,38,50,64,78,88,92,97],
  "Midrange Shot":[25,42,57,71,82,89,93,98],
  "Threepoint Shot":[25,42,58,72,82,89,93,98],
  "Free Throw":[30,48,60,72,82,89,93,99],
  "Pass Accuracy":[25,42,57,71,82,89,93,98],
  "Ball Handle":[25,42,57,72,83,90,94,98],
  "Speed With Ball":[25,41,55,68,79,87,91,97],
  "Interior Defense":[25,40,55,70,81,88,92,97],
  "Perimeter Defense":[25,41,56,71,82,89,93,98],
  "Steal":[25,38,50,64,77,86,91,97],
  "Block":[20,35,50,68,80,89,93,98],
  "Offensive Rebound":[20,35,50,67,80,89,93,98],
  "Defensive Rebound":[25,42,58,73,84,91,94,98],
  "Speed":[30,48,61,74,84,90,93,98],
  "Agility":[30,47,60,73,83,89,93,97],
  "Strength":[30,48,62,75,85,91,94,98],
  "Vertical":[30,48,62,75,84,90,93,97],
};

// 2K stat -> [[[BBGM source stat, blend share], ...], matching weight].
//
// Most 2K stats used to be a 1:1 copy of a single BBGM stat, which made whole
// groups of them perfectly collinear (Interior D / Perimeter D / Steal / Block
// were all just dIQ, so a rim protector and a perimeter stopper were literally
// indistinguishable to the matcher, and dIQ silently carried 4x its declared
// weight). Each 2K stat now blends the BBGM inputs that actually drive it --
// crucially including height, which previously only ever acted as a filter.
// Shares for a stat must sum to 1.
const K2_FROM_BBGM = {
  "Close Shot":[[["Ins",0.8],["Hgt",0.1],["Dnk",0.1]],1],
  "Driving Layup":[[["Ins",0.6],["Drb",0.2],["Spd",0.2]],1],
  "Post Control":[[["Ins",0.5],["Stre",0.3],["Hgt",0.2]],1],
  "Driving Dunk":[[["Dnk",0.6],["Jmp",0.25],["Spd",0.15]],1.25],
  "Standing Dunk":[[["Dnk",0.55],["Hgt",0.25],["Stre",0.2]],1],
  "Midrange Shot":[[["Mid",0.85],["OIQ",0.15]],1.25],
  "Threepoint Shot":[[["TP",1]],1.5],
  "Free Throw":[[["FT",0.85],["OIQ",0.15]],0.75],
  "Pass Accuracy":[[["Pss",0.7],["OIQ",0.3]],1],
  "Ball Handle":[[["Drb",0.8],["OIQ",0.2]],1.1],
  "Speed With Ball":[[["Drb",0.65],["Spd",0.35]],1],
  "Interior Defense":[[["DIQ",0.5],["Stre",0.25],["Hgt",0.25]],1],
  "Perimeter Defense":[[["DIQ",0.6],["Spd",0.4]],1],
  "Steal":[[["DIQ",0.6],["Spd",0.2],["Drb",0.2]],0.9],
  "Block":[[["DIQ",0.45],["Jmp",0.3],["Hgt",0.25]],0.9],
  "Offensive Rebound":[[["Reb",0.6],["Jmp",0.25],["Stre",0.15]],1],
  "Defensive Rebound":[[["Reb",0.7],["Hgt",0.3]],1],
  "Speed":[[["Spd",1]],1.5],
  "Agility":[[["Spd",0.7],["Jmp",0.15],["Drb",0.15]],1],
  "Strength":[[["Stre",1]],1.5],
  "Vertical":[[["Jmp",1]],1.25],
};

const BBGM_STATS = Object.keys(NBA_ANCHORS);
const STAT_NAMES = ARCH.statNames;

// ---------- Conversion ----------
function interp(x, xs, ys) {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
      return ys[i - 1] + t * (ys[i] - ys[i - 1]);
    }
  }
  return ys[ys.length - 1];
}

// BBGM rating -> percentile within `anchors`, with symmetric exponential
// stretch of both tails.
function bbgmToPercentile(stat, val, anchorSet) {
  const anchors = (anchorSet || NBA_ANCHORS)[stat];
  let p = interp(val, anchors, PCTL);
  // extrapolate beyond the 99th / below the 1st for truly extreme ratings,
  // scaled to how spread out this stat's own anchors are
  const spread = anchors[7] - anchors[0];
  if (val > anchors[7]) p = Math.min(99.9, 99 + (val - anchors[7]) * (10 / spread));
  else if (val < anchors[0]) p = Math.max(0.1, 1 - (anchors[0] - val) * (10 / spread));
  if (p > 90) p = 90 + 9 * Math.pow((p - 90) / 9, 1.5);
  else if (p < 10) p = 10 - 9 * Math.pow((10 - p) / 9, 1.5);
  return p;
}

// percentile -> 2K rating. Beyond the 99th percentile the curve is extended at
// the slope of its own top segment rather than clamped flat: clamping there put
// a hard ceiling a few points under most Legend badge thresholds, which made 37
// of 40 badges structurally unable to reach Legend for *any* input.
function percentileTo2K(stat2k, p) {
  const ys = K2_ANCHORS[stat2k];
  if (p <= PCTL[PCTL.length - 1]) return interp(p, PCTL, ys);
  const n = ys.length - 1;
  const slope = (ys[n] - ys[n - 1]) / (PCTL[n] - PCTL[n - 1]);
  return Math.min(99, ys[n] + (p - PCTL[n]) * slope);
}

// 2K rating -> percentile (inverse of percentileTo2K), used to express build
// requirements in the same units as players.
function k2ToPercentile(stat2k, v) {
  const ys = K2_ANCHORS[stat2k];
  const n = ys.length - 1;
  if (v >= ys[n]) {
    const slope = (ys[n] - ys[n - 1]) / (PCTL[n] - PCTL[n - 1]);
    return slope > 0 ? PCTL[n] + (v - ys[n]) / slope : PCTL[n];
  }
  return interp(v, ys, PCTL);
}

function bbgmHeightToInches(hgt, scale) {
  const s = scale || HEIGHT_SCALE;
  return s.base + hgt * s.perPoint;
}
// BBGM's default height scale: 0 -> 5'6", 50 -> 6'6", 100 -> 7'6". Leagues can
// customise this, so it's a mutable setting rather than a hardcoded formula.
const HEIGHT_SCALE = { base: 66, perPoint: 0.24 };
function setHeightScale(base, perPoint) { HEIGHT_SCALE.base = base; HEIGHT_SCALE.perPoint = perPoint; }

function convertPlayer(bbgm, opts) {
  const anchorSet = (opts && opts.anchors) || NBA_ANCHORS;
  const pctl = {}, k2 = {}, blendPctl = {};
  for (const s of BBGM_STATS) pctl[s] = bbgmToPercentile(s, bbgm[s], anchorSet);
  for (const [stat2k, [srcs]] of Object.entries(K2_FROM_BBGM)) {
    const p = srcs.reduce((sum, [src, share]) => sum + share * pctl[src], 0);
    blendPctl[stat2k] = p;
    k2[stat2k] = percentileTo2K(stat2k, p);
  }
  // Endu isn't modeled by any 2K attribute -- surfaced separately as a
  // conditioning note rather than silently dropped.
  return { pctl, k2, blendPctl, heightIn: bbgmHeightToInches(bbgm.Hgt), enduPctl: pctl.Endu };
}

// Derive percentile anchors from an actual roster, so a league that isn't
// NBA-shaped (weaker, wider, historical, expansion) can be graded against
// itself instead of against the NBA.
function deriveAnchors(players) {
  const out = {};
  for (const s of BBGM_STATS) {
    const vals = players.map(p => p[s]).filter(v => typeof v === "number" && !isNaN(v)).sort((a, b) => a - b);
    if (vals.length < 20) return null;   // too small a sample to be meaningful
    out[s] = PCTL.map(q => {
      const idx = (q / 100) * (vals.length - 1);
      const lo = Math.floor(idx), hi = Math.ceil(idx);
      return Math.round((vals[lo] + (vals[hi] - vals[lo]) * (idx - lo)) * 10) / 10;
    });
    // anchors must be strictly increasing for interp() to invert cleanly
    for (let i = 1; i < out[s].length; i++) {
      if (out[s][i] <= out[s][i - 1]) out[s][i] = out[s][i - 1] + 0.1;
    }
  }
  return out;
}

// ---------- Matching ----------
// Matching happens in percentile space on BOTH sides: each build's min/max is
// converted to percentiles once at load, so "a point" means the same thing in
// every stat and the declared weights below actually control influence (in raw
// 2K space, a stat's effective weight was its declared weight times whatever
// variance it happened to have after conversion, which bore no relation to the
// number written down).
const DEFICIT_GRACE = 4;     // ignore tiny shortfalls within build-range noise
const DEFICIT_CURVE = 25;    // quadratic ramp: one 40-pt hole hurts far more than two 20-pt ones
const SURPLUS_SCALE = 1 / 3; // exceeding a build's needs hurts less than lacking them
const SHAPE_W = 18;          // weight of the profile-shape term (see below)
const HEIGHT_W = 2.5;        // penalty points per inch outside the build's height range
const GAP_MIN = 10;          // deficit size worth flagging to the user
const HARD_GAP = 40;         // any single deficit this large disqualifies the build
const HARD_GAP_RELAXED = 60; // fallback threshold if too few builds survive
const FALLBACK_POOL = 25;    // builds kept when even the relaxed gate finds nothing
const MIN_BAND = 2;          // 59% of DB entries are min==max; give them a little air
const TIE_BAND = 2;          // penalty points within which the #1 pick is a coin flip

const DB_H_MIN = Math.min(...ARCH.archetypes.map(a => a.hMin));
const DB_H_MAX = Math.max(...ARCH.archetypes.map(a => a.hMax));

function fmtH(h) { const t = Math.round(h); return `${Math.floor(t / 12)}'${t % 12}"`; }
function fmtHeight(hMin, hMax) { return fmtH(hMin) + (hMax !== hMin ? `–${fmtH(hMax)}` : ""); }

// Build matrix, precomputed once: percentile lo/hi/mid per stat as flat typed
// arrays (the inner loop runs statNames.length times per build per player).
const NS = STAT_NAMES.length;
const NA = ARCH.archetypes.length;
const B_LO = new Float32Array(NA * NS);
const B_HI = new Float32Array(NA * NS);
const B_MID = new Float32Array(NA * NS);
const B_SHAPE = new Float32Array(NA * NS);   // mean-centred, unit-norm midpoints
const B_SHAPE_OK = new Uint8Array(NA);
(function buildMatrix() {
  for (let ai = 0; ai < NA; ai++) {
    const a = ARCH.archetypes[ai];
    let mean = 0;
    for (let i = 0; i < NS; i++) {
      const [rawLo, rawHi] = a.stats[i];
      const lo = rawHi - rawLo < MIN_BAND * 2 ? (rawLo + rawHi) / 2 - MIN_BAND : rawLo;
      const hi = rawHi - rawLo < MIN_BAND * 2 ? (rawLo + rawHi) / 2 + MIN_BAND : rawHi;
      const pLo = k2ToPercentile(STAT_NAMES[i], lo);
      const pHi = k2ToPercentile(STAT_NAMES[i], hi);
      B_LO[ai * NS + i] = pLo;
      B_HI[ai * NS + i] = pHi;
      B_MID[ai * NS + i] = (pLo + pHi) / 2;
      mean += (pLo + pHi) / 2;
    }
    mean /= NS;
    let norm = 0;
    for (let i = 0; i < NS; i++) { const d = B_MID[ai * NS + i] - mean; B_SHAPE[ai * NS + i] = d; norm += d * d; }
    norm = Math.sqrt(norm);
    B_SHAPE_OK[ai] = norm > 1e-6 ? 1 : 0;
    if (norm > 1e-6) for (let i = 0; i < NS; i++) B_SHAPE[ai * NS + i] /= norm;
  }
})();

// Calibrated against a real 966-player BBGM league: these cut points are the
// ~20th/50th/75th/90th percentiles of the #1 match's raw penalty. The number
// they replace -- a percentile rank of the build within the player's own pool
// -- was 100.0 for 97% of players by construction (the best build has zero
// builds better than it), so it carried no information at all.
function fitGrade(pen) {
  if (pen <= 8) return { pct: 95, label: "Excellent fit", cls: "s-good" };
  if (pen <= 20) return { pct: 80, label: "Good fit", cls: "s-good" };
  if (pen <= 35) return { pct: 60, label: "Loose fit", cls: "s-ok" };
  if (pen <= 55) return { pct: 35, label: "Poor fit", cls: "s-bad" };
  return { pct: 10, label: "No real build matches this player", cls: "s-bad" };
}

const QUALITY_NOTE = {
  ok: "",
  relaxed: "Nothing fit cleanly — these are the closest builds after relaxing the skill-gap limit.",
  none: "No 2K build exists for this rating profile. The closest shapes are shown, but this player can't really be built in 2K.",
};

function matchArchetypes(conv, topN, opts) {
  topN = topN || 3;
  opts = opts || {};
  const shapeW = opts.shapeW == null ? SHAPE_W : opts.shapeW;
  const posBias = opts.pos ? String(opts.pos).toUpperCase() : null;   // soft, opt-in
  const POS_PENALTY = 6;

  // signature boost: a stat at/above the 85th percentile OR at/below the 15th
  // gets 1.5x weight -- builds must feature the player's elite skills AND avoid
  // demanding the ones he clearly lacks
  const wScale = opts.weightScale || null;   // per-stat user multiplier
  const weights = STAT_NAMES.map(s => {
    const [, w] = K2_FROM_BBGM[s];
    const p = conv.blendPctl[s];
    const base = p >= 85 || p <= 15 ? w * 1.5 : w;
    return base * (wScale && wScale[s] != null ? wScale[s] : 1);
  });
  const totalW = weights.reduce((a, b) => a + b, 0);
  // player vector is already in percentile space (k2 is just a display mapping)
  const userVec = STAT_NAMES.map(s => conv.blendPctl[s]);

  // player shape: mean-centred, unit-norm -- dot with a build's shape gives the
  // correlation between the two profiles
  const uMean = userVec.reduce((a, b) => a + b, 0) / NS;
  const uShape = userVec.map(v => v - uMean);
  let uNorm = Math.sqrt(uShape.reduce((a, b) => a + b * b, 0));
  const uShapeOk = uNorm > 1e-6;
  if (uShapeOk) for (let i = 0; i < NS; i++) uShape[i] /= uNorm;

  const hInRaw = conv.heightIn;
  const hIn = Math.max(DB_H_MIN, Math.min(DB_H_MAX, hInRaw));
  const heightClamped = hIn !== hInRaw;

  function score(indices) {
    const out = [];
    for (const ai of indices) {
      const a = ARCH.archetypes[ai];
      const base = ai * NS;
      let pen = 0, maxGap = 0, shapeDot = 0;
      const gaps = [], strengths = [];
      for (let i = 0; i < NS; i++) {
        const lo = B_LO[base + i], hi = B_HI[base + i], v = userVec[i];
        const deficit = lo - v;
        if (deficit > DEFICIT_GRACE) {
          const d = deficit - DEFICIT_GRACE;
          pen += weights[i] * d * (1 + d / DEFICIT_CURVE);
          if (deficit > maxGap) maxGap = deficit;
          if (deficit >= GAP_MIN) gaps.push({ stat: STAT_NAMES[i], short: deficit });
        } else if (v > hi) {
          pen += weights[i] * (v - hi) * SURPLUS_SCALE;
        }
        // a stat where the build is demanding (top-third requirement) and the
        // player comfortably clears it is *why* this build won
        if (deficit <= 0 && lo >= 65) strengths.push({ stat: STAT_NAMES[i], need: lo, have: v });
        if (uShapeOk && B_SHAPE_OK[ai]) shapeDot += uShape[i] * B_SHAPE[base + i];
      }
      pen /= totalW;
      // shape term: does the player's strength/weakness *pattern* look like this
      // build's? Without it, only deficits bind, so the cheapest builds in the
      // database win for everyone -- 4 archetypes covered half of a real league.
      if (uShapeOk && B_SHAPE_OK[ai]) pen += shapeW * (1 - shapeDot) / 2;
      pen += HEIGHT_W * (hIn < a.hMin ? a.hMin - hIn : hIn > a.hMax ? hIn - a.hMax : 0);
      if (posBias && a.pos !== posBias) pen += POS_PENALTY;
      gaps.sort((x, y) => y.short - x.short);
      strengths.sort((x, y) => y.need - x.need);
      out.push({ ai, a, pen, maxGap, gaps: gaps.slice(0, 3), strengths: strengths.slice(0, 3) });
    }
    // deterministic tie-break: shape first, then name, so equal-penalty builds
    // don't just resolve by database order (which is why the same handful of
    // names kept recurring)
    out.sort((x, y) => (x.pen - y.pen) || (y.a.name < x.a.name ? 1 : -1));
    return out;
  }

  let poolIdx = [];
  for (let i = 0; i < NA; i++) { const a = ARCH.archetypes[i]; if (hIn >= a.hMin - 1 && hIn <= a.hMax + 1) poolIdx.push(i); }
  const minWanted = Number.isFinite(topN) ? topN : 5;
  if (poolIdx.length < minWanted) {
    poolIdx = [];
    for (let i = 0; i < NA; i++) { const a = ARCH.archetypes[i]; if (hIn >= a.hMin - 2 && hIn <= a.hMax + 2) poolIdx.push(i); }
  }
  let heightPoolRelaxed = false;
  if (poolIdx.length < minWanted) {
    // Falling back to the whole database throws the height constraint away
    // entirely; keep it as a ranking signal by taking the nearest-height builds.
    heightPoolRelaxed = true;
    poolIdx = Array.from({ length: NA }, (_, i) => i).sort((x, y) => {
      const dx = distToBand(hIn, ARCH.archetypes[x]), dy = distToBand(hIn, ARCH.archetypes[y]);
      return dx - dy;
    }).slice(0, Math.max(FALLBACK_POOL, minWanted));
  }

  const scored = score(poolIdx);
  // Never remove the sanity check silently: 20% of a real league fell through
  // to an unfiltered whole-database match and was then shown as a 100% fit.
  let final = scored.filter(x => x.maxGap <= HARD_GAP);
  let quality = "ok";
  if (final.length < minWanted) {
    final = scored.filter(x => x.maxGap <= HARD_GAP_RELAXED);
    quality = "relaxed";
  }
  if (final.length < minWanted) {
    // rank the fallback by how far off it is, not by how cheap it is -- ranking
    // by penalty here prefers builds that are cheap-but-wrong over close-but-demanding
    final = scored.slice().sort((a, b) => (a.maxGap - b.maxGap) || (a.pen - b.pen)).slice(0, Math.max(FALLBACK_POOL, minWanted));
    quality = "none";
  }

  const bestPen = final.length ? final[0].pen : (scored.length ? scored[0].pen : 0);
  // how many builds sit within a coin flip of the winner -- honest about how
  // often the top pick is arbitrary
  const tieCount = final.filter(x => x.pen <= bestPen + TIE_BAND).length;

  return {
    heightClamped, heightUsedIn: hIn, heightPoolRelaxed,
    quality, qualityNote: QUALITY_NOTE[quality],
    poolSize: scored.length,
    tieCount,
    bestPen: Math.round(bestPen * 10) / 10,
    grade: fitGrade(bestPen),
    matches: final.slice(0, topN).map(({ a, ai, pen, maxGap, gaps, strengths }, i) => ({
      name: a.name, pos: a.pos, ai,
      height: fmtHeight(a.hMin, a.hMax),
      grade: fitGrade(pen),
      rank: i + 1,
      gapPts: Math.round(pen * 10) / 10,
      maxGap: Math.round(maxGap),
      gaps: gaps.map(g => `${g.stat} −${Math.round(g.short)}`),
      strengths: strengths.map(s => `${s.stat} ${Math.round(s.have)} (needs ${Math.round(s.need)})`),
    })),
  };
}

function distToBand(h, a) { return h < a.hMin ? a.hMin - h : h > a.hMax ? h - a.hMax : 0; }

// Per-stat player-vs-build comparison rows for the UI's fit chart.
function matchDetail(conv, ai) {
  const base = ai * NS;
  return STAT_NAMES.map((s, i) => {
    const v = conv.blendPctl[s];
    const lo = B_LO[base + i], hi = B_HI[base + i];
    return {
      stat: s,
      value: v, k2: conv.k2[s],
      lo, hi,
      needK2: Math.round(percentileTo2K(s, lo)),
      maxK2: Math.round(percentileTo2K(s, hi)),
      deficit: Math.max(0, lo - v),
      surplus: Math.max(0, v - hi),
    };
  });
}

// ---------- Reverse: 2K build -> BBGM ratings ----------
// Inverting the pipeline (2K rating -> percentile -> BBGM rating) gives the
// BBGM player a build is asking for, and doubles as a permanent regression
// test: round-tripping a player through both directions has to come back close.
function percentileToBBGM(stat, p, anchorSet) {
  const anchors = (anchorSet || NBA_ANCHORS)[stat];
  // undo the tail stretch applied by bbgmToPercentile
  let q = p;
  if (q > 90) q = 90 + 9 * Math.pow((q - 90) / 9, 1 / 1.5);
  else if (q < 10) q = 10 - 9 * Math.pow((10 - q) / 9, 1 / 1.5);
  if (q >= PCTL[PCTL.length - 1]) {
    const spread = anchors[7] - anchors[0];
    return Math.min(100, anchors[7] + (q - 99) * (spread / 10));
  }
  if (q <= PCTL[0]) {
    const spread = anchors[7] - anchors[0];
    return Math.max(0, anchors[0] - (1 - q) * (spread / 10));
  }
  return interp(q, PCTL, anchors);
}

// The BBGM ratings a build's midpoint profile corresponds to. A BBGM stat can
// feed several 2K stats, so each source is recovered as the weighted average of
// the percentiles of the 2K stats it drives (weighted by its share of each).
function archetypeToBBGM(ai, anchorSet) {
  const base = ai * NS;
  const num = {}, den = {};
  STAT_NAMES.forEach((s, i) => {
    const [srcs] = K2_FROM_BBGM[s];
    const p = B_MID[base + i];
    for (const [src, share] of srcs) {
      num[src] = (num[src] || 0) + share * share * p;   // weight by share^2: a
      den[src] = (den[src] || 0) + share * share;       // 0.1-share stat says little
    }
  });
  const out = {};
  for (const s of BBGM_STATS) {
    if (!den[s]) continue;
    out[s] = Math.round(percentileToBBGM(s, num[s] / den[s], anchorSet));
  }
  const a = ARCH.archetypes[ai];
  // height comes straight from the build's own range, not from any stat
  const mid = (a.hMin + a.hMax) / 2;
  out.Hgt = Math.round(Math.max(0, Math.min(100, (mid - HEIGHT_SCALE.base) / HEIGHT_SCALE.perPoint)));
  return out;
}

// Grouping used by the UI's weight editor and badge/stat tables.
const STAT_CATEGORIES = {
  Shooting: ["Midrange Shot", "Threepoint Shot", "Free Throw"],
  Finishing: ["Close Shot", "Driving Layup", "Driving Dunk", "Standing Dunk", "Post Control"],
  Playmaking: ["Pass Accuracy", "Ball Handle", "Speed With Ball"],
  Defense: ["Interior Defense", "Perimeter Defense", "Steal", "Block"],
  Rebounding: ["Offensive Rebound", "Defensive Rebound"],
  Physicals: ["Speed", "Agility", "Strength", "Vertical"],
};

// ---------- 2K Badges ----------
const TIERS = ["None", "Bronze", "Silver", "Gold", "HoF", "Legend"];
const BADGES = BADGE_DATA.badges;
const BADGE_VERSION = BADGE_DATA.gameVersion;

function attrTier(value, t) {
  for (let i = 4; i >= 0; i--) if (t[i] != null && value >= t[i]) return i + 1;
  return 0;
}

const BADGE_H_MIN = Math.min(...BADGES.map(b => b.h[0]));
const BADGE_H_MAX = Math.max(...BADGES.map(b => b.h[1]));
// 2K's badge economy is a points budget, not a free-for-all: tiers cost
// progressively more, so the total is a far better "how loaded is this build"
// summary than a raw earned-badge count.
const BADGE_POINTS = [0, 2, 4, 7, 11, 16];

function calcBadges(conv) {
  const hIn = Math.max(BADGE_H_MIN, Math.min(BADGE_H_MAX, conv.heightIn));
  return BADGES.map(b => {
    const eligible = hIn >= b.h[0] - 1 && hIn <= b.h[1] + 1;
    let tier = b.any ? 0 : 5;
    for (const a of b.attrs) {
      const t = attrTier(conv.k2[a.stat], a.t);
      tier = b.any ? Math.max(tier, t) : Math.min(tier, t);
    }
    if (!eligible) tier = 0;
    return {
      name: b.name, cat: b.cat, tier, tierName: TIERS[tier], eligible,
      points: eligible ? BADGE_POINTS[tier] : 0,
      detail: b.attrs.map(a => `${a.stat} ${Math.round(conv.k2[a.stat])}`).join(", "),
    };
  });
}

return {
  PCTL, NBA_ANCHORS, K2_ANCHORS, K2_FROM_BBGM, BBGM_STATS, STAT_NAMES,
  ARCHETYPES: ARCH.archetypes, DB_H_MIN, DB_H_MAX,
  BADGES, BADGE_VERSION, BADGE_POINTS, TIERS,
  interp, bbgmToPercentile, percentileTo2K, k2ToPercentile,
  bbgmHeightToInches, setHeightScale, HEIGHT_SCALE,
  convertPlayer, deriveAnchors, matchArchetypes, matchDetail, calcBadges,
  percentileToBBGM, archetypeToBBGM, STAT_CATEGORIES,
  fitGrade, fmtH, fmtHeight,
  CONSTANTS: { DEFICIT_GRACE, DEFICIT_CURVE, SURPLUS_SCALE, SHAPE_W, HEIGHT_W, HARD_GAP, HARD_GAP_RELAXED, TIE_BAND },
};
})();
if (typeof module !== "undefined" && module.exports) module.exports = BBGM2K;
