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
  const out = {}, adjusted = {};
  for (const s of BBGM_STATS) {
    const vals = players.map(p => p[s]).filter(v => typeof v === "number" && !isNaN(v)).sort((a, b) => a - b);
    if (vals.length < 20) return null;   // too small a sample to be meaningful
    out[s] = PCTL.map(q => {
      const idx = (q / 100) * (vals.length - 1);
      const lo = Math.floor(idx), hi = Math.ceil(idx);
      return Math.round((vals[lo] + (vals[hi] - vals[lo]) * (idx - lo)) * 10) / 10;
    });
    // anchors must be strictly increasing for interp() to invert cleanly. This
    // fabricates spread where a league genuinely has none (lots of players
    // sharing one value), so the adjustments are counted rather than made
    // silently: a stat that needed several of them has percentiles that aren't
    // trustworthy for this league.
    let bumped = 0;
    for (let i = 1; i < out[s].length; i++) {
      if (out[s][i] <= out[s][i - 1]) { out[s][i] = out[s][i - 1] + 0.1; bumped++; }
    }
    if (bumped) adjusted[s] = bumped;
  }
  Object.defineProperty(out, ANCHOR_NOTES, { value: adjusted, enumerable: false });
  return out;
}

// Which stats deriveAnchors() had to force apart, and by how many anchors.
// >2 means that stat's league percentiles are largely invented.
const ANCHOR_NOTES = "__anchorAdjustments";
function anchorAdjustments(anchorSet) { return (anchorSet && anchorSet[ANCHOR_NOTES]) || {}; }

// How far a derived anchor set sits from the NBA one, in BBGM rating points
// averaged over every stat and percentile. Used to nudge the user towards
// league-relative grading when their roster clearly isn't NBA-shaped.
function anchorDivergence(anchorSet) {
  if (!anchorSet) return 0;
  let sum = 0, n = 0;
  for (const s of BBGM_STATS) {
    if (!anchorSet[s]) continue;
    for (let i = 0; i < PCTL.length; i++) { sum += Math.abs(anchorSet[s][i] - NBA_ANCHORS[s][i]); n++; }
  }
  return n ? sum / n : 0;
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
const KEY_PCTL = 70;        // a build's "key" attributes: the ones it demands at the 70th percentile or better
const KEY_MAX = 5;          // at most this many, taking the build's most demanding stats
const KEY_GAP = 15;         // falling this far short of a key attribute disqualifies the build outright
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
// Key attributes per build: the stats it is actually built around. Treating all
// 21 stats identically let a player be handed a build named for a skill he was a
// third of the league's distribution short of, with no warning at all -- the only
// disqualifier was HARD_GAP on the single worst deficit anywhere in the profile,
// which doesn't care whether that deficit lands on the build's defining stat or
// on one it barely uses.
const KEY = new Array(NA);
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

    const demanding = [];
    for (let i = 0; i < NS; i++) if (B_LO[ai * NS + i] >= KEY_PCTL) demanding.push(i);
    demanding.sort((x, y) => B_LO[ai * NS + y] - B_LO[ai * NS + x]);
    // every build in the database demands *something*; if one somehow doesn't,
    // fall back to its single most demanding stat so KEY is never empty
    if (!demanding.length) {
      let best = 0;
      for (let i = 1; i < NS; i++) if (B_LO[ai * NS + i] > B_LO[ai * NS + best]) best = i;
      demanding.push(best);
    }
    KEY[ai] = Int32Array.from(demanding.slice(0, KEY_MAX));
  }
})();

// The stats a build is built around, in percentile terms, for display.
function keyAttributes(ai) {
  return Array.from(KEY[ai]).map(i => ({
    stat: STAT_NAMES[i], need: B_LO[ai * NS + i], needK2: Math.round(percentileTo2K(STAT_NAMES[i], B_LO[ai * NS + i])),
  }));
}

// Calibrated against a real 966-player BBGM league: these cut points are the
// ~20th/50th/75th/90th percentiles of the #1 match's raw penalty. The number
// they replace -- a percentile rank of the build within the player's own pool
// -- was 100.0 for 97% of players by construction (the best build has zero
// builds better than it), so it carried no information at all.
const GRADE_TIERS = [
  { pct: 95, label: "Excellent fit", cls: "s-good" },
  { pct: 80, label: "Good fit", cls: "s-good" },
  { pct: 60, label: "Loose fit", cls: "s-ok" },
  { pct: 35, label: "Poor fit", cls: "s-bad" },
  { pct: 10, label: "No real build matches this player", cls: "s-bad" },
];
const LOOSE_TIER = 2;   // index of "Loose fit"

// Cut points are mode-specific: the same penalty means different things when a
// player is graded against the NBA and against his own (weaker) league. One
// shared table -- calibrated in NBA mode -- put three quarters of a league at
// "Good fit" or better in league mode, where the median penalty is less than
// half the NBA-mode median. Each row is the ~20th/50th/75th/90th percentile of
// the #1 match's raw penalty over the 974-player sample roster in that mode.
const GRADE_CUTS = {
  nba: [11, 33, 54, 76],
  league: [6, 14, 30, 47],
};

function gradeFrom(cuts, pen, keyGap) {
  let i = cuts.findIndex(c => pen <= c);
  if (i < 0) i = cuts.length;
  // A build the player is well short of on its *defining* stat cannot be a good
  // fit, whatever the aggregate penalty says.
  if (keyGap > KEY_GAP && i < LOOSE_TIER) i = LOOSE_TIER;
  return GRADE_TIERS[i];
}

function fitGrade(pen, keyGap) { return gradeFrom(GRADE_CUTS.nba, pen, keyGap || 0); }

// Grade against the penalty distribution of an actual batch, which beats any
// fixed table when a whole roster is available.
function makeGrader(penalties) {
  const xs = penalties.filter(v => typeof v === "number" && !isNaN(v)).sort((a, b) => a - b);
  if (xs.length < 30) return fitGrade;
  const at = q => xs[Math.min(xs.length - 1, Math.floor(q / 100 * (xs.length - 1)))];
  const cuts = [at(20), at(50), at(75), at(90)];
  for (let i = 1; i < cuts.length; i++) if (cuts[i] <= cuts[i - 1]) cuts[i] = cuts[i - 1] + 0.1;
  return (pen, keyGap) => gradeFrom(cuts, pen, keyGap || 0);
}

const QUALITY_NOTE = {
  ok: "",
  relaxed: "Nothing fit cleanly — these are the closest builds after relaxing the skill-gap limit.",
  unbuildable: "No 2K build fits this player. Every build in his height range is built around at least one skill he's well short of. The closest shapes are shown below with the specific shortfall on each — treat them as “what he'd be if he developed”, not “what he is”.",
};

function matchArchetypes(conv, topN, opts) {
  topN = topN || 3;
  opts = opts || {};
  const shapeW = opts.shapeW == null ? SHAPE_W : opts.shapeW;
  const posBias = opts.pos ? String(opts.pos).toUpperCase() : null;   // soft, opt-in
  const grade = typeof opts.grader === "function" ? opts.grader
    : opts.calib === "league" ? (pen, kg) => gradeFrom(GRADE_CUTS.league, pen, kg || 0)
    : fitGrade;

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
      const gaps = [], strengths = [], keyShort = [];
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
        if (uShapeOk && B_SHAPE_OK[ai]) shapeDot += uShape[i] * B_SHAPE[base + i];
      }
      // Key attributes: the stats this build is built around. Falling short on
      // one of them is disqualifying (see the filter cascade below) and is
      // reported explicitly, rather than being averaged away by 20 stats the
      // build doesn't care about.
      let keyGap = 0;
      for (const i of KEY[ai]) {
        const lo = B_LO[base + i], v = userVec[i], d = lo - v;
        if (d > keyGap) keyGap = d;
        if (d > 0) keyShort.push({ stat: STAT_NAMES[i], need: lo, have: v, short: d });
        // "Chosen for" names the build's own identity: a key attribute the
        // player clears, not any stat over the 65th percentile (which is a
        // below-average 2K requirement and made the explanation feel padded).
        else strengths.push({ stat: STAT_NAMES[i], need: lo, have: v });
      }
      pen /= totalW;
      // shape term: does the player's strength/weakness *pattern* look like this
      // build's? Without it, only deficits bind, so the cheapest builds in the
      // database win for everyone -- 4 archetypes covered half of a real league.
      if (uShapeOk && B_SHAPE_OK[ai]) pen += shapeW * (1 - shapeDot) / 2;
      pen += HEIGHT_W * (hIn < a.hMin ? a.hMin - hIn : hIn > a.hMax ? hIn - a.hMax : 0);
      gaps.sort((x, y) => y.short - x.short);
      strengths.sort((x, y) => y.need - x.need);
      keyShort.sort((x, y) => y.short - x.short);
      out.push({ ai, a, pen, maxGap, keyGap, keyShort: keyShort.slice(0, 3), gaps: gaps.slice(0, 3), strengths: strengths.slice(0, 3) });
    }
    // Off-position nudge, scaled to this pool's own penalty spread. A flat 6
    // points was decisive against penalties near zero and pure noise against
    // penalties near 120.
    if (posBias) {
      const sorted = out.map(x => x.pen).sort((a, b) => a - b);
      const at = q => sorted[Math.min(sorted.length - 1, Math.floor(q / 100 * (sorted.length - 1)))];
      const posPen = Math.max(2, Math.min(15, (at(90) - at(10)) * 0.15));
      for (const x of out) if (x.a.pos !== posBias) x.pen += posPen;
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
  // The key-attribute veto applies at EVERY level, fallback included. Dropping it
  // in the fallback is what defeated it: the veto correctly refused the build,
  // and the cascade underneath then handed the player the same build anyway.
  //
  // One qualifying build is enough to be buildable -- the gate is on whether a
  // legitimate match exists, not on whether there are topN of them.
  const clean = scored.filter(x => x.keyGap <= KEY_GAP && x.maxGap <= HARD_GAP);
  let final, quality;
  if (clean.length) { final = clean; quality = "ok"; }
  else {
    const relaxed = scored.filter(x => x.keyGap <= KEY_GAP && x.maxGap <= HARD_GAP_RELAXED);
    if (relaxed.length) { final = relaxed; quality = "relaxed"; }
    else {
      // Nothing qualifies. Say so, and rank the closest shapes by how far short
      // of a defining skill they leave the player -- not by how cheap they are.
      final = scored.slice().sort((a, b) => (a.keyGap - b.keyGap) || (a.pen - b.pen)).slice(0, Math.max(FALLBACK_POOL, minWanted));
      quality = "unbuildable";
    }
  }
  if (quality !== "unbuildable" && final.length < minWanted) {
    // Pad the list with the nearest refused builds so there are still
    // alternatives to look at. They keep their keyGap, so the UI shows exactly
    // what each one is short of and their grade is capped accordingly.
    const seen = new Set(final.map(x => x.ai));
    const extra = scored.filter(x => !seen.has(x.ai)).sort((a, b) => (a.keyGap - b.keyGap) || (a.pen - b.pen));
    final = final.concat(extra.slice(0, minWanted - final.length));
  }

  const bestPen = final.length ? final[0].pen : (scored.length ? scored[0].pen : 0);
  // how many builds sit within a coin flip of the winner -- honest about how
  // often the top pick is arbitrary
  const tieCount = final.filter(x => x.pen <= bestPen + TIE_BAND).length;

  const bestKeyGap = final.length ? final[0].keyGap : 0;

  return {
    heightClamped, heightUsedIn: hIn, heightPoolRelaxed,
    quality, qualityNote: QUALITY_NOTE[quality],
    poolSize: scored.length,
    buildable: quality !== "unbuildable",
    qualifying: scored.filter(x => x.keyGap <= KEY_GAP && x.maxGap <= HARD_GAP).length,
    tieCount,
    bestPen: Math.round(bestPen * 10) / 10,
    bestKeyGap: Math.round(bestKeyGap * 10) / 10,
    grade: grade(bestPen, bestKeyGap),
    matches: final.slice(0, topN).map(({ a, ai, pen, maxGap, keyGap, keyShort, gaps, strengths }, i) => ({
      name: a.name, pos: a.pos, ai,
      height: fmtHeight(a.hMin, a.hMax),
      grade: grade(pen, keyGap),
      rank: i + 1,
      gapPts: Math.round(pen * 10) / 10,
      maxGap: Math.round(maxGap),
      keyGap: Math.round(keyGap),
      keyOk: keyGap <= KEY_GAP,
      // the mirror of "chosen for": what this build is built around that the
      // player does not have
      keyShort: keyShort.map(k => `${k.stat} (needs ${Math.round(k.need)}th pctile, ${Math.round(k.short)} short)`),
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

// The BBGM ratings a build's midpoint profile corresponds to.
//
// This is a least-squares inverse of the forward blend, not a per-stat average.
// The old version recovered each BBGM stat as a share^2-weighted mean of the 2K
// stats it drives, which is not an inverse of the forward direction: re-blending
// the result gave a profile up to 40 percentile points off the build on stats
// several 2K attributes share (Post Control / Standing Dunk / Block / Interior
// Defense all draw on the same two or three BBGM inputs), and 56% of builds then
// failed to match themselves. Solving min ||W(Ax - target)||^2 instead makes the
// forward re-blend as close to the build as the projection allows.
//
// Note the ceiling: 21 2K stats are built from 15 BBGM ones, so builds that pull
// shared inputs in opposite directions (high Block, low Interior Defense) are not
// representable at all. Even a perfect nearest-profile oracle only recovers ~60%
// of builds into the top 3 -- that residual is information loss in the ratings
// model, not a matcher bug.
const NB = BBGM_STATS.length;
const BBGM_IDX = Object.fromEntries(BBGM_STATS.map((s, i) => [s, i]));
// A[k][j] = share of BBGM stat j in 2K stat k
const BLEND_A = STAT_NAMES.map(s => {
  const row = new Array(NB).fill(0);
  for (const [src, share] of K2_FROM_BBGM[s][0]) row[BBGM_IDX[src]] = share;
  return row;
});
const INVERSE_RIDGE = 0.05;   // pulls unconstrained directions towards the 50th percentile
const INVERSE_DEMAND_W = 0.5; // weight the fit towards the stats the build actually demands

function solveBlend(target) {
  const M = [], b = [];
  for (let i = 0; i < NB; i++) {
    const row = new Array(NB).fill(0);
    let bi = 0;
    for (let k = 0; k < NS; k++) {
      const w = K2_FROM_BBGM[STAT_NAMES[k]][1] * (1 + Math.max(0, target[k] - 50) / 25 * INVERSE_DEMAND_W);
      const aik = BLEND_A[k][i];
      if (aik) {
        for (let j = 0; j < NB; j++) row[j] += w * aik * BLEND_A[k][j];
        bi += w * aik * target[k];
      }
    }
    row[i] += INVERSE_RIDGE;
    bi += INVERSE_RIDGE * 50;
    M.push(row); b.push(bi);
  }
  // Gauss-Jordan with partial pivoting; NB is 15, so this is trivial work
  for (let c = 0; c < NB; c++) {
    let piv = c;
    for (let r = c + 1; r < NB; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]]; [b[c], b[piv]] = [b[piv], b[c]];
    if (Math.abs(M[c][c]) < 1e-9) continue;
    for (let r = 0; r < NB; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      if (!f) continue;
      for (let j = c; j < NB; j++) M[r][j] -= f * M[c][j];
      b[r] -= f * b[c];
    }
  }
  return b.map((v, i) => (Math.abs(M[i][i]) < 1e-9 ? 50 : v / M[i][i]));
}

function archetypeToBBGM(ai, anchorSet) {
  const base = ai * NS;
  const target = [];
  for (let i = 0; i < NS; i++) target.push(B_MID[base + i]);
  const p = solveBlend(target);
  const out = {};
  BBGM_STATS.forEach((s, j) => {
    const v = percentileToBBGM(s, Math.max(0.5, Math.min(99.9, p[j])), anchorSet);
    out[s] = Math.round(Math.max(0, Math.min(100, v)));
  });
  const a = ARCH.archetypes[ai];
  // height comes straight from the build's own range, not from any stat
  const mid = (a.hMin + a.hMax) / 2;
  out.Hgt = Math.round(Math.max(0, Math.min(100, (mid - HEIGHT_SCALE.base) / HEIGHT_SCALE.perPoint)));
  // No 2K attribute feeds endurance, so there is nothing to recover: state the
  // league-average placeholder rather than leaving a hole in the output.
  out.Endu = 50;
  return out;
}

// Which keys of archetypeToBBGM() are recovered from the build and which are
// filled in because nothing in 2K describes them.
const REVERSE_PLACEHOLDERS = { Endu: "no 2K attribute models endurance; set to league average" };

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
  anchorAdjustments, anchorDivergence, keyAttributes, makeGrader, gradeFrom, GRADE_CUTS,
  REVERSE_PLACEHOLDERS, QUALITY_NOTE,
  fitGrade, fmtH, fmtHeight,
  CONSTANTS: { DEFICIT_GRACE, DEFICIT_CURVE, SURPLUS_SCALE, SHAPE_W, HEIGHT_W, HARD_GAP, HARD_GAP_RELAXED, TIE_BAND, KEY_PCTL, KEY_MAX, KEY_GAP },
};
})();
if (typeof module !== "undefined" && module.exports) module.exports = BBGM2K;
