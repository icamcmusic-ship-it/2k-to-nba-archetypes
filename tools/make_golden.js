// Regenerates tests/golden.json from the sample roster. Run after an
// intentional change to the conversion or matching logic, and review the diff.
const fs = require("fs");
const path = require("path");
const E = require("../docs/engine.js");
const roster = require("./measure_load.js")(path.join(__dirname, "..", "data", "PlayerRatings_sample.csv"));
const picked = [];
for (let i = 0; i < roster.length && picked.length < 20; i += Math.floor(roster.length / 20)) picked.push(roster[i]);
const out = picked.map(p => {
  const r = E.matchArchetypes(E.convertPlayer(p), 1);
  return { name: p.name, bbgm: Object.fromEntries(E.BBGM_STATS.map(s => [s, p[s]])),
    archetype: r.matches[0].name, bestPen: r.bestPen, quality: r.quality };
});
fs.writeFileSync(path.join(__dirname, "..", "tests", "golden.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${out.length} golden rows`);
