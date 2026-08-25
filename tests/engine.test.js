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
  const labels = [0, 15, 25, 40, 100].map(p => E.fitGrade(p).pct);
  for (let i = 1; i < labels.length; i++) assert.ok(labels[i] < labels[i - 1], "grade must fall as penalty rises");
});

test("a hopeless profile is flagged, not shown as a clean match", () => {
  const r = E.matchArchetypes(E.convertPlayer(ZERO), 3);
  assert.strictEqual(r.quality, "none");
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
  assert.ok(high - low > 12, `3PT requirement barely moves with 3Pt: ${low.toFixed(1)} -> ${high.toFixed(1)}`);
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

test("reverse mapping lands the build back near the top of its own match list", () => {
  // Designing a build and converting it back to BBGM must produce a player the
  // matcher recognises -- a permanent check that the two directions agree.
  let hits = 0, tried = 0;
  for (let i = 0; i < E.ARCHETYPES.length; i += 97) {
    const bbgm = E.archetypeToBBGM(i);
    const r = E.matchArchetypes(E.convertPlayer(bbgm), 25);
    tried++;
    if (r.matches.some(m => m.ai === i)) hits++;
  }
  assert.ok(hits / tried > 0.5, `only ${hits}/${tried} builds round-tripped into their own top 25`);
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
