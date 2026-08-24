// Diversity / staleness report over the sample roster. Doubles as the
// regression test asserting the matcher hasn't collapsed onto a few builds.
"use strict";
const { loadApp, loadRoster } = require("./harness.js");

function report() {
  const app = loadApp();
  const roster = loadRoster(app);
  const top1 = new Map(), anywhere = new Set();
  const spreads = [];
  const convAll = [];
  for (const p of roster) {
    const conv = app.convertPlayer(p.bbgm);
    convAll.push(conv);
    const res = app.matchArchetypes(conv, 3);
    const ms = res.matches;
    if (!ms.length) continue;
    const key = ms[0].name;
    top1.set(key, (top1.get(key) || 0) + 1);
    ms.forEach(m => anywhere.add(m.name));
    if (ms.length >= 3) spreads.push(Math.abs(ms[0].score - ms[2].score));
  }
  const sorted = [...top1.entries()].sort((a, b) => b[1] - a[1]);
  const n = roster.length;
  spreads.sort((a, b) => a - b);

  // pairwise correlation of converted 2K stats across the roster
  const stats = app.ARCHETYPE_DATA.statNames;
  const cols = stats.map(s => convAll.map(c => c.k2[s]));
  // Spearman (rank) correlation: the clusters are monotone transforms of a
  // single input, so they rank-correlate at exactly 1.0 even where Pearson
  // dips slightly from the differing anchor curves.
  function ranks(v) {
    const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(v.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  }
  function corr(a0, b0) {
    const a = ranks(a0), b = ranks(b0);
    const ma = a.reduce((x, y) => x + y, 0) / a.length;
    const mb = b.reduce((x, y) => x + y, 0) / b.length;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < a.length; i++) {
      const x = a[i] - ma, y = b[i] - mb;
      num += x * y; da += x * x; db += y * y;
    }
    return da && db ? num / Math.sqrt(da * db) : 0;
  }
  let perfect = 0; const pairs = [];
  for (let i = 0; i < stats.length; i++)
    for (let j = i + 1; j < stats.length; j++) {
      const c = corr(cols[i], cols[j]);
      pairs.push([stats[i], stats[j], c]);
      if (c > 0.9999) perfect++;
    }
  return {
    players: n,
    distinctTop1: top1.size,
    distinctAnywhere: anywhere.size,
    topShare: sorted.length ? sorted[0][1] / n : 0,
    topName: sorted.length ? sorted[0][0] : "",
    top10Share: sorted.slice(0, 10).reduce((a, b) => a + b[1], 0) / n,
    medianSpread: spreads.length ? spreads[Math.floor(spreads.length / 2)] : 0,
    perfectlyCorrelatedPairs: perfect,
    leaders: sorted.slice(0, 8).map(([k, v]) => `${k}: ${(100 * v / n).toFixed(1)}%`),
  };
}

module.exports = { report };
if (require.main === module) {
  const r = report();
  console.log(JSON.stringify(r, null, 2));
}
