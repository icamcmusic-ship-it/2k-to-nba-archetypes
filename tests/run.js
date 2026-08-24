// Test suite: golden-case assertions plus the staleness regression guard.
// Run with `node tests/run.js` (or `make test`).
"use strict";
const { loadApp, loadRoster } = require("./harness.js");
const { report } = require("./diversity.js");

let passed = 0, failed = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { passed++; }
  else { failed++; failures.push(`${name}${detail ? " — " + detail : ""}`); }
}
function near(name, actual, expected, tol) {
  check(name, Math.abs(actual - expected) <= tol,
    `expected ~${expected} (+/-${tol}), got ${actual}`);
}

const app = loadApp();
const S = app.BBGM_STATS;
const mk = o => Object.fromEntries(S.map(s => [s, o[s] !== undefined ? o[s] : 50]));

// ---- structural invariants ----
check("database loaded", app.ARCHETYPE_DATA.archetypes.length > 1000,
  `${app.ARCHETYPE_DATA.archetypes.length} builds`);
check("anchors came from the workbook", !!app.ARCHETYPE_DATA.k2Anchors,
  "ARCHETYPE_DATA.k2Anchors missing — re-run `make regen`");
check("height map came from the workbook", Array.isArray(app.ARCHETYPE_DATA.heightMap));
check("every build carries min/max stat ranges",
  app.ARCHETYPE_DATA.archetypes.every(a => a.stats.every(s => Array.isArray(s) && s.length === 2)));
check("weight ranges extracted",
  app.ARCHETYPE_DATA.archetypes.filter(a => a.wMin !== undefined).length > 1000);
check("duplicate build names carry a disambiguating label",
  app.ARCHETYPE_DATA.archetypes.some(a => a.display && a.display !== a.name));

// ---- conversion: every BBGM input must actually matter ----
const base = mk({});
const baseConv = app.convertPlayer(base);
for (const stat of S) {
  if (stat === "Endu") continue;   // deliberately not a 2K attribute
  const bumped = app.convertPlayer(mk({ [stat]: 90 }));
  const moved = app.ARCHETYPE_DATA.statNames.some(
    s2 => Math.abs(bumped.k2[s2] - baseConv.k2[s2]) > 0.5);
  check(`input ${stat} affects the converted profile`, moved, "changing it moved nothing");
}
check("Endu is surfaced rather than silently dropped",
  app.convertPlayer(mk({ Endu: 90 })).enduPctl > app.convertPlayer(mk({ Endu: 10 })).enduPctl);

// ---- decorrelation: former lockstep clusters must diverge ----
const CLUSTERS = [
  ["Close Shot", "Post Control"],
  ["Driving Dunk", "Standing Dunk"],
  ["Ball Handle", "Speed With Ball"],
  ["Interior Defense", "Perimeter Defense"],
  ["Offensive Rebound", "Defensive Rebound"],
  ["Speed", "Agility"],
];
// a tall, strong, slow player should separate the "big" half of each pair
const bigMan = app.convertPlayer(mk({ Hgt: 90, Stre: 90, Spd: 15, Jmp: 30 }));
const guard = app.convertPlayer(mk({ Hgt: 15, Stre: 25, Spd: 92, Jmp: 85 }));
for (const [a, b] of CLUSTERS) {
  const dBig = bigMan.k2[a] - bigMan.k2[b];
  const dGuard = guard.k2[a] - guard.k2[b];
  check(`${a} / ${b} respond differently to body type`,
    Math.abs(dBig - dGuard) > 3, `big ${dBig.toFixed(1)} vs guard ${dGuard.toFixed(1)}`);
}

// ---- determinism: same input must always give the same answer ----
const twice = [app.convertPlayer(base), app.convertPlayer(base)];
check("conversion is deterministic",
  app.ARCHETYPE_DATA.statNames.every(s => twice[0].k2[s] === twice[1].k2[s]));

// ---- golden cases: known player shapes land on sane builds ----
function topFor(o, n) { return app.matchArchetypes(app.convertPlayer(mk(o)), n || 1).matches; }

const sharpshooter = topFor({ Hgt: 40, TP: 95, Mid: 90, FT: 90, Spd: 70, Drb: 70, OIQ: 75 }, 5);
check("elite shooter matches a shooting build",
  sharpshooter.some(m => /shoot|sniper|sharp|3pt|three|marksman|range/i.test(m.name)),
  sharpshooter.map(m => m.name).join(" | "));

const rimBig = topFor({ Hgt: 88, Stre: 92, Dnk: 92, Reb: 92, DIQ: 85, TP: 10, Drb: 15 }, 5);
check("rim-running big matches an interior build",
  rimBig.some(m => /rim|paint|post|board|glass|big|center|dunk|paint|paint/i.test(m.name)),
  rimBig.map(m => m.name).join(" | "));

const playmaker = topFor({ Hgt: 30, Pss: 95, OIQ: 92, Drb: 92, Spd: 85, Stre: 25 }, 5);
check("pass-first guard matches a playmaking build",
  playmaker.some(m => /playmak|dime|creator|general|orchestrat|passer|vision|handle/i.test(m.name)),
  playmaker.map(m => m.name).join(" | "));

// ---- height handling ----
const tall = app.matchArchetypes(app.convertPlayer(mk({ Hgt: 100 })), 3);
check("out-of-range height is clamped, not silently unfiltered", tall.heightClamped);
check("clamped height still returns matches", tall.matches.length === 3);
const badgesTall = app.calcBadges(app.convertPlayer(mk({ Hgt: 100, Dnk: 95, Reb: 95, Stre: 95 })));
check("a maxed-height player still earns badges",
  badgesTall.filter(b => b.tier > 0).length > 0,
  "every badge came back N/A (height)");

// ---- badges ----
check("badge catalogue includes Agent 3", app.BADGES.some(b => b.name === "Agent 3"));
check("badge catalogue includes Killer Combos", app.BADGES.some(b => b.name === "Killer Combos"));
const allB = app.calcBadges(app.convertPlayer(mk({})));
check("every badge has a description", allB.every(b => b.desc && b.desc.length > 10),
  allB.filter(b => !b.desc).map(b => b.name).join(", "));
check("near-miss info is reported", allB.some(b => b.near && b.near.need > 0));
const elite = app.calcBadges(app.convertPlayer(mk({ TP: 99, Mid: 99, FT: 99 })));
const weak = app.calcBadges(app.convertPlayer(mk({ TP: 5, Mid: 5, FT: 5 })));
check("badge points reward the better shooter",
  app.badgePoints(elite, null).points > app.badgePoints(weak, null).points);
check("rarity weighting discounts common badges",
  app.badgePoints(elite, { Deadeye: 0.95 }).weighted < app.badgePoints(elite, { Deadeye: 0.05 }).weighted);

// ---- matching output shape ----
const m1 = topFor({}, 3);
check("matches expose an actionable gap target",
  m1.every(m => m.gaps.every(g => /needs/.test(g))), JSON.stringify(m1[0].gaps));
check("matches expose a penalty contribution breakdown",
  m1.some(m => m.contrib && m.contrib.length > 0));
check("matches expose a disambiguated display name", m1.every(m => !!m.display));

// ---- CSV robustness ----
check("comma CSV parses", app.parseCSV("a,b\n1,2\n").length === 2);
const semi = app.parseCSV("a;b\n1;2\n");
check("semicolon CSV parses", semi.length === 2 && semi[0].length === 2, JSON.stringify(semi));
const tabs = app.parseCSV("a\tb\n1\t2\n");
check("tab CSV parses", tabs.length === 2 && tabs[0].length === 2, JSON.stringify(tabs));
check("quoted fields with the delimiter survive",
  app.parseCSV('a,b\n"x,y",2\n')[1][0] === "x,y");

// ---- variety assignment ----
const ranked = [
  [{ name: "A", gapPts: 1 }, { name: "B", gapPts: 2 }],
  [{ name: "A", gapPts: 1 }, { name: "B", gapPts: 2 }],
];
check("variety off reproduces pure best fit",
  app.assignWithVariety(ranked, 0).every(m => m.name === "A"));
const varied = app.assignWithVariety(ranked, 5);
check("variety on spreads repeated assignments",
  varied[0].name === "A" && varied[1].name === "B",
  varied.map(m => m.name).join(","));

// ---- staleness regression guard ----
const d = report();
check("no dimensional collapse remains", d.perfectlyCorrelatedPairs === 0,
  `${d.perfectlyCorrelatedPairs} perfectly rank-correlated stat pairs`);
check("distinct top-1 archetypes >= 150", d.distinctTop1 >= 150, `got ${d.distinctTop1}`);
check("no single archetype exceeds 12% of the league (best-fit mode)",
  d.topShare <= 0.12, `${d.topName} at ${(100 * d.topShare).toFixed(1)}%`);
check("top 10 archetypes cover under 55% of the league",
  d.top10Share <= 0.55, `${(100 * d.top10Share).toFixed(1)}%`);

// variety mode must hit the stricter target
const roster = loadRoster(app);
const rankedAll = roster.map(p => app.matchArchetypes(app.convertPlayer(p.bbgm), 30).matches);
const picked = app.assignWithVariety(rankedAll, 2).filter(Boolean);
const vc = new Map();
picked.forEach(m => vc.set(m.name, (vc.get(m.name) || 0) + 1));
const vTop = Math.max(...vc.values()) / picked.length;
check("with roster variety on, no archetype exceeds 4% of the league",
  vTop <= 0.04, `${(100 * vTop).toFixed(1)}%`);
check("with roster variety on, distinct archetypes >= 280",
  vc.size >= 280, `got ${vc.size}`);

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach(f => console.log("  ✗ " + f));
}
console.log(`\nDiversity: distinctTop1=${d.distinctTop1} topShare=${(100 * d.topShare).toFixed(1)}% ` +
  `top10=${(100 * d.top10Share).toFixed(1)}% lockstepPairs=${d.perfectlyCorrelatedPairs}`);
console.log(`With variety:  distinct=${vc.size} topShare=${(100 * vTop).toFixed(1)}%`);
process.exit(failed ? 1 : 0);
