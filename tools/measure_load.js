// Shared roster loader for the diagnostic/measurement scripts.
const fs = require("fs");
const STATS = { hgt:"Hgt", str:"Stre", stre:"Stre", spd:"Spd", jmp:"Jmp", end:"Endu", endu:"Endu",
  ins:"Ins", dnk:"Dnk", ft:"FT", "2pt":"Mid", mid:"Mid", "3pt":"TP", tp:"TP",
  oiq:"OIQ", diq:"DIQ", drb:"Drb", pss:"Pss", reb:"Reb" };
const NEEDED = ["Hgt","Stre","Spd","Jmp","Endu","Ins","Dnk","FT","Mid","TP","OIQ","DIQ","Drb","Pss","Reb"];
module.exports = function loadRoster(path) {
  const lines = fs.readFileSync(path, "utf8").replace(/^﻿/, "").trim().split(/\r?\n/);
  const head = lines[0].split(",").map(h => h.trim().toLowerCase());
  const col = {};
  head.forEach((h, i) => { if (STATS[h] && col[STATS[h]] === undefined) col[STATS[h]] = i; });
  const nameCol = head.indexOf("name"), posCol = head.indexOf("pos");
  const out = [];
  for (const line of lines.slice(1)) {
    const c = line.split(",");
    const p = { name: c[nameCol], pos: c[posCol] };
    let ok = true;
    for (const s of NEEDED) { const v = parseFloat(c[col[s]]); if (isNaN(v)) { ok = false; break; } p[s] = v; }
    if (ok) out.push(p);
  }
  return out;
};
