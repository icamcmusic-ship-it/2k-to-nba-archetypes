// Regression tests for the conversion + matching pipeline.
// Run with: node --test tests/
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const E = require("../docs/engine.js");
const loadRoster = require("../tools/measure_load.js");

const ROSTER = path.join(__dirname, "..", "data", "PlayerRatings_sample.csv");
const roster = loadRoster(ROSTER);
const AVG = Object.fromEntries(E.BBGM_STATS.map(s => [s, 50]));
const GOD = Object.fromEntries(E.BBGM_STATS.map(s => [s, 100]));
const ZERO = Object.fromEntries(E.BBGM_STATS.map(s => [s, 1]));

test("sample roster loads", () => {
  assert.ok(roster.length > 900, `expected a full roster, got ${roster.length}`);
});

test("conversion is monotonic in every input", () => {
  for (const s of E.BBGM_STATS) {
    let prev = -Infinity;
    for (let v = 0; v <= 100; v += 5) {
      const p = E.bbgmToPercentile(s, v);
      assert.ok(p >= prev, `${s} percentile went backwards at ${v}`);
      prev = p;
    }
  }
});

test("percentile <-> 2K rating round-trips", () => {
  for (const s of E.STAT_NAMES) {
    for (const p of [5, 20, 50, 80, 95, 99]) {
      const back = E.k2ToPercentile(s, E.percentileTo2K(s, p));
      assert.ok(Math.abs(back - p) < 0.5, `${s} @p${p} round-tripped to ${back.toFixed(2)}`);
    }
  }
});

test("BBGM -> percentile -> BBGM round-trips inside the anchor range", () => {
  for (const s of E.BBGM_STATS) {
    // only inside the 1st-99th anchor span: outside it the forward mapping
    // deliberately clamps, so information is lost by design
    const [lo, hi] = [E.NBA_ANCHORS[s][0], E.NBA_ANCHORS[s][7]];
    for (let t = 0.1; t <= 0.9; t += 0.2) {
      const v = lo + (hi - lo) * t;
      const back = E.percentileToBBGM(s, E.bbgmToPercentile(s, v));
      assert.ok(Math.abs(back - v) < 1.5, `${s} ${v.toFixed(1)} round-tripped to ${back.toFixed(1)}`);
    }
  }
});

test("Legend badge tier is reachable", () => {
  // The old anchor table clamped converted ratings a few points below most
  // Legend thresholds, so 37 of 40 badges could never reach Legend for ANY input.
  const badges = E.calcBadges(E.convertPlayer(GOD));
  const legend = badges.filter(b => b.tier === 5).length;
  assert.ok(legend >= 20, `a maxed-out player should reach Legend widely, got ${legend}/${badges.length}`);
  const avgBadges = E.calcBadges(E.convertPlayer(AVG));
  assert.ok(avgBadges.filter(b => b.tier === 5).length <= 2, "an average player should not be all-Legend");
});

test("converted 2K stats are not near-duplicates of each other", () => {
  // dIQ used to drive four defensive stats 1:1, making a rim protector and a
  // perimeter stopper literally indistinguishable to the matcher.
  const conv = roster.map(p => E.convertPlayer(p));
  const corr = (a, b) => {
    const x = conv.map(c => c.k2[a]), y = conv.map(c => c.k2[b]);
    const n = x.length, mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n;
    let sx = 0, sy = 0, sxy = 0;
    for (let i = 0; i < n; i++) { const u = x[i] - mx, v = y[i] - my; sx += u * u; sy += v * v; sxy += u * v; }
    return sxy / Math.sqrt(sx * sy || 1);
  };
  for (const [a, b] of [["Interior Defense", "Perimeter Defense"], ["Steal", "Block"],
                        ["Offensive Rebound", "Defensive Rebound"], ["Close Shot", "Driving Layup"]]) {
    assert.ok(corr(a, b) < 0.9, `${a} ~ ${b} is ${corr(a, b).toFixed(3)} — effectively the same stat`);
  }
});

test("fit grade is monotonic and not constant", () => {
  const labels = [0, 20, 40, 60, 100].map(p => E.fitGrade(p).pct);
  for (let i = 1; i < labels.length; i++) assert.ok(labels[i] < labels[i - 1], "grade must fall as penalty rises");
});

test("a hopeless profile is flagged, not shown as a clean match", () => {
  const r = E.matchArchetypes(E.convertPlayer(ZERO), 3);
  assert.strictEqual(r.quality, "unbuildable");
  assert.strictEqual(r.buildable, false);
  assert.strictEqual(r.qualifying, 0);
  assert.ok(r.qualityNote.length > 0);
  assert.ok(r.grade.pct < 50, "a player no build fits must not grade well");
  assert.ok(r.matches.length > 0, "closest shapes should still be shown");
});

test("a strong all-round player gets a clean, well-graded match", () => {
  const good = Object.assign({}, AVG, { Hgt: 55, TP: 70, Mid: 68, Drb: 65, Pss: 62, DIQ: 60, Spd: 62 });
  const r = E.matchArchetypes(E.convertPlayer(good), 3);
  assert.ok(r.bestPen < 25, `expected a close fit, got ${r.bestPen}`);
  assert.ok(r.matches[0].grade.pct >= 60);
});

test("3PT actually discriminates", () => {
  // The headline complaint: non-shooters were handed shooting builds because
  // the 2K anchors compressed the whole middle of the 3PT distribution.
  const idx = E.STAT_NAMES.indexOf("Threepoint Shot");
  const meanMin = cut => {
    const sub = roster.filter(p => p.TP >= cut[0] && p.TP <= cut[1]);
    return sub.reduce((a, p) => {
      const m = E.matchArchetypes(E.convertPlayer(p), 1).matches[0];
      return a + E.ARCHETYPES[m.ai].stats[idx][0];
    }, 0) / sub.length;
  };
  const low = meanMin([0, 20]), high = meanMin([55, 100]);
  assert.ok(high - low > 10, `3PT requirement barely moves with 3Pt: ${low.toFixed(1)} -> ${high.toFixed(1)}`);
});

test("non-shooters are rarely handed shooting builds", () => {
  const shooting = /3PT|Sniper|Shot Creator|Sharpshoot|Shooter|Marksman|Spot.?Up|3-Level/i;
  const sub = roster.filter(p => p.TP <= 25);
  const hits = sub.filter(p => shooting.test(E.matchArchetypes(E.convertPlayer(p), 1).matches[0].name)).length;
  const rate = hits / sub.length;
  assert.ok(rate < 0.35, `${Math.round(rate * 100)}% of sub-25 3Pt players got a shooting build`);
});

test("archetype diversity does not regress", () => {
  // Guards the staleness problem: 42 distinct archetypes over 966 players, with
  // the top 4 covering half the league, was the original state.
  const counts = {};
  for (const p of roster) {
    const m = E.matchArchetypes(E.convertPlayer(p), 1).matches[0];
    counts[m.name] = (counts[m.name] || 0) + 1;
  }
  const sorted = Object.values(counts).sort((a, b) => b - a);
  const distinct = sorted.length;
  const top4 = sorted.slice(0, 4).reduce((a, b) => a + b, 0) / roster.length;
  assert.ok(distinct >= 60, `only ${distinct} distinct archetypes used`);
  assert.ok(top4 < 0.55, `top 4 archetypes cover ${Math.round(top4 * 100)}% of the league`);
});

test("league-relative anchors make a non-NBA league fit better", () => {
  const anchors = E.deriveAnchors(roster);
  assert.ok(anchors, "anchors should be derivable from a 900+ player roster");
  const pen = opts => roster.reduce((a, p) => a + E.matchArchetypes(E.convertPlayer(p, opts), 1).bestPen, 0) / roster.length;
  assert.ok(pen({ anchors }) < pen({}), "league-graded fits should be tighter than NBA-graded ones");
  assert.strictEqual(E.deriveAnchors(roster.slice(0, 5)), null, "a tiny sample must not produce anchors");
});

test("position bias is soft, not a hard filter", () => {
  const p = roster.find(r => r.pos === "C") || roster[0];
  const r = E.matchArchetypes(E.convertPlayer(p), 5, { pos: "PG" });
  assert.ok(r.matches.length > 0, "an off-position player still gets matches");
});

test("weight editor changes the ranking", () => {
  const p = roster[0];
  const conv = E.convertPlayer(p);
  const a = E.matchArchetypes(conv, 5).matches.map(m => m.name).join("|");
  const scale = {};
  for (const s of E.STAT_CATEGORIES.Defense) scale[s] = 4;
  const b = E.matchArchetypes(conv, 5, { weightScale: scale }).matches.map(m => m.name).join("|");
  assert.notStrictEqual(a, b, "quadrupling defense weight should change the results");
});

test("height formatting never produces 5'12\"", () => {
  for (let h = 60; h < 90; h += 0.1) {
    const s = E.fmtH(h);
    const inches = Number(s.split("'")[1].replace('"', ""));
    assert.ok(inches >= 0 && inches <= 11, `fmtH(${h}) = ${s}`);
  }
});

test("a build fed its own profile matches itself (round trip)", () => {
  // The real self-consistency check: build -> BBGM player -> match must come
  // back to the build. The weaker percentileToBBGM round trip above passed while
  // this one failed for 56% of builds.
  let top1 = 0, top3 = 0, top5 = 0, tried = 0;
  for (let i = 0; i < E.ARCHETYPES.length; i += 13) {
    const m = E.matchArchetypes(E.convertPlayer(E.archetypeToBBGM(i)), 5).matches;
    tried++;
    if (m[0].ai === i) top1++;
    if (m.slice(0, 3).some(x => x.ai === i)) top3++;
    if (m.some(x => x.ai === i)) top5++;
  }
  assert.ok(top1 / tried > 0.28, `only ${top1}/${tried} builds matched themselves first`);
  assert.ok(top3 / tried > 0.40, `only ${top3}/${tried} builds round-tripped into their own top 3`);
  assert.ok(top5 / tried > 0.45, `only ${top5}/${tried} builds round-tripped into their own top 5`);
});

test("the round trip is close to the ceiling the ratings model allows", () => {
  // 21 2K stats are built from 15 BBGM ones, so builds pulling shared inputs in
  // opposite directions are not representable at all. The matcher's job is to
  // lose nothing *beyond* that: compare it with an oracle that simply picks the
  // build whose midpoint profile is nearest the recovered player.
  const mids = E.ARCHETYPES.map((_, i) => {
    const d = E.matchDetail({ blendPctl: Object.fromEntries(E.STAT_NAMES.map(s => [s, 0])), k2: {} }, i);
    return d.map(r => (r.lo + r.hi) / 2);
  });
  let matcher = 0, oracle = 0, tried = 0;
  for (let i = 0; i < E.ARCHETYPES.length; i += 29) {
    const conv = E.convertPlayer(E.archetypeToBBGM(i));
    const v = E.STAT_NAMES.map(s => conv.blendPctl[s]);
    const near = E.ARCHETYPES
      .map((a, j) => ({ j, d: conv.heightIn >= a.hMin - 1 && conv.heightIn <= a.hMax + 1
        ? mids[j].reduce((sum, m, k) => sum + (m - v[k]) ** 2, 0) : Infinity }))
      .sort((a, b) => a.d - b.d);
    tried++;
    if (near.slice(0, 3).some(x => x.j === i)) oracle++;
    if (E.matchArchetypes(conv, 3).matches.some(m => m.ai === i)) matcher++;
  }
  assert.ok(matcher >= oracle * 0.7,
    `matcher recovers ${matcher}/${tried} where a nearest-profile oracle recovers ${oracle}/${tried}`);
});

test("key attributes exist for every build and are what it is built around", () => {
  for (let i = 0; i < E.ARCHETYPES.length; i++) {
    const key = E.keyAttributes(i);
    assert.ok(key.length >= 1 && key.length <= E.CONSTANTS.KEY_MAX, `build ${i} has ${key.length} key attributes`);
    for (let k = 1; k < key.length; k++) assert.ok(key[k].need <= key[k - 1].need, "key attributes must be ordered by demand");
  }
  const mean = E.ARCHETYPES.reduce((a, _, i) => a + E.keyAttributes(i).length, 0) / E.ARCHETYPES.length;
  assert.ok(mean > 2, `builds average only ${mean.toFixed(1)} key attributes`);
});

test("the key-attribute veto holds at every level, fallback included", () => {
  // The veto is worthless if the fallback under it hands back the same build.
  for (const p of roster.slice(0, 300)) {
    const r = E.matchArchetypes(E.convertPlayer(p), 3);
    if (r.quality === "unbuildable") {
      assert.strictEqual(r.qualifying, 0, "unbuildable means nothing qualified");
      continue;
    }
    assert.ok(r.matches[0].keyGap <= E.CONSTANTS.KEY_GAP,
      `${p.name} was given ${r.matches[0].name} while ${r.matches[0].keyGap} short of a key attribute`);
  }
});

test("a build's grade is capped when a key attribute is missed", () => {
  const capped = E.fitGrade(0, E.CONSTANTS.KEY_GAP + 10);
  assert.strictEqual(capped.label, "Loose fit", "a defining-skill miss cannot be an Excellent fit");
  assert.ok(E.fitGrade(0, 0).pct > capped.pct);
});

test("a non-shooter is not handed a build he misses the 3PT requirement on", () => {
  for (const p of roster.filter(x => x.TP <= 30).slice(0, 200)) {
    const r = E.matchArchetypes(E.convertPlayer(p), 1);
    if (!r.buildable) continue;   // flagged honestly, closest shapes only
    const m = r.matches[0];
    const key = E.keyAttributes(m.ai).find(k => k.stat === "Threepoint Shot");
    if (!key) continue;   // the build isn't built around shooting
    const need = key.need;
    const have = E.bbgmToPercentile("TP", p.TP);
    assert.ok(need - have <= E.CONSTANTS.KEY_GAP,
      `${p.name} (3Pt ${p.TP}) got ${m.name}, which is built around a ${Math.round(need)}th-pctile shot`);
  }
});

test("fit grade cut points are mode-specific", () => {
  assert.notDeepStrictEqual(E.GRADE_CUTS.nba, E.GRADE_CUTS.league);
  // league mode penalties are roughly half NBA-mode ones, so its cuts must be lower
  for (let i = 0; i < E.GRADE_CUTS.nba.length; i++) {
    assert.ok(E.GRADE_CUTS.league[i] < E.GRADE_CUTS.nba[i], "league cut points must be tighter");
  }
  const anchors = E.deriveAnchors(roster);
  const share = (opts, calib) => {
    const good = roster.filter(p => E.matchArchetypes(E.convertPlayer(p, opts), 1, { calib }).grade.pct >= 80).length;
    return good / roster.length;
  };
  // the bug: NBA cut points applied in league mode graded three quarters of the
  // league "Good fit" or better
  assert.ok(share({ anchors }, "league") < 0.5, "league mode must not grade half the roster as a good fit");
});

test("grading against a loaded batch tracks that batch's distribution", () => {
  const pens = roster.map(p => E.matchArchetypes(E.convertPlayer(p), 1).bestPen);
  const grader = E.makeGrader(pens);
  const graded = pens.map(pen => grader(pen, 0).pct);
  const excellent = graded.filter(v => v === 95).length / graded.length;
  assert.ok(excellent > 0.1 && excellent < 0.32, `top grade covers ${(excellent * 100).toFixed(0)}% of the batch`);
  assert.strictEqual(E.makeGrader([1, 2, 3]), E.fitGrade, "too small a batch falls back to the fixed table");
});

test("deriveAnchors reports the monotonicity fixes it had to make", () => {
  const flat = Array.from({ length: 40 }, () => Object.fromEntries(E.BBGM_STATS.map(s => [s, 50])));
  const anchors = E.deriveAnchors(flat);
  const adj = E.anchorAdjustments(anchors);
  assert.ok(Object.keys(adj).length === E.BBGM_STATS.length, "a wholly flat league must flag every stat");
  assert.ok(adj.Hgt >= 7, "each forced anchor should be counted");
  assert.deepStrictEqual(E.anchorAdjustments(E.deriveAnchors(roster)), {}, "a real roster needs no fixes");
  assert.ok(E.anchorDivergence(E.deriveAnchors(roster)) > 0, "a non-NBA league should measure some divergence");
  assert.strictEqual(E.anchorDivergence(E.NBA_ANCHORS), 0);
});

test("reverse mapping fills in what 2K cannot describe", () => {
  const bbgm = E.archetypeToBBGM(0);
  for (const s of E.BBGM_STATS) assert.ok(typeof bbgm[s] === "number", `${s} missing from reverse output`);
  assert.strictEqual(bbgm.Endu, 50, "endurance has no 2K source and must be an explicit placeholder");
  assert.ok(E.REVERSE_PLACEHOLDERS.Endu, "placeholders must be labelled");
});

test("golden file: a fixed set of players keeps producing the same match", () => {
  const golden = require("./golden.json");
  for (const g of golden) {
    const r = E.matchArchetypes(E.convertPlayer(g.bbgm), 1);
    assert.strictEqual(r.matches[0].name, g.archetype, `${g.name} changed archetype`);
    assert.ok(Math.abs(r.bestPen - g.bestPen) < 0.05, `${g.name} penalty drifted: ${r.bestPen} vs ${g.bestPen}`);
    assert.strictEqual(r.quality, g.quality, `${g.name} fit quality changed`);
  }
});

test("badge data carries a game version", () => {
  assert.match(E.BADGE_VERSION, /2K/);
  assert.strictEqual(E.BADGES.length, 40);
});
