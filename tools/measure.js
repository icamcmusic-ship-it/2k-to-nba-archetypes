// Diagnostic harness: measures diversity / discrimination of the matcher over a
// real BBGM roster. Not part of the app; used to calibrate constants.
const fs = require("fs");
const E = require("../docs/engine.js");

function loadRoster(path) {
  const lines = fs.readFileSync(path, "utf8").replace(/^﻿/, "").trim().split(/\r?\n/);
  const head = lines[0].split(",").map(h => h.trim().toLowerCase());
  const A = { hgt:"Hgt", str:"Stre", spd:"Spd", jmp:"Jmp", end:"Endu", ins:"Ins", dnk:"Dnk",
    ft:"FT", "2pt":"Mid", "3pt":"TP", oiq:"OIQ", diq:"DIQ", drb:"Drb", pss:"Pss", reb:"Reb" };
  const col = {}; head.forEach((h,i)=>{ if(A[h]&&col[A[h]]===undefined) col[A[h]]=i; });
  const nameCol = head.indexOf("name"), posCol = head.indexOf("pos");
  const out = [];
  for (const l of lines.slice(1)) {
    const c = l.split(",");
    const p = { name: c[nameCol], pos: c[posCol] };
    let ok = true;
    for (const s of E.BBGM_STATS) { const v = parseFloat(c[col[s]]); if (isNaN(v)) { ok=false; break; } p[s]=v; }
    if (ok) out.push(p);
  }
  return out;
}
function corr(x,y){const n=x.length,mx=x.reduce((a,b)=>a+b,0)/n,my=y.reduce((a,b)=>a+b,0)/n;
  let sx=0,sy=0,sxy=0;for(let i=0;i<n;i++){const a=x[i]-mx,b=y[i]-my;sx+=a*a;sy+=b*b;sxy+=a*b;}
  return sxy/Math.sqrt(sx*sy||1);}

const roster = loadRoster(process.argv[2] || __dirname + "/../data/PlayerRatings_sample.csv");
const opts = {};
if (process.argv.includes("--league")) opts.anchors = E.deriveAnchors(roster);
const res = roster.map(p => { const c = E.convertPlayer(p, opts); return { p, c, r: E.matchArchetypes(c, 3) }; });

const counts = {};
for (const r of res) if (r.r.matches[0]) counts[r.r.matches[0].name] = (counts[r.r.matches[0].name]||0)+1;
const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
console.log(`players=${res.length} distinct#1=${top.length} top1=${top[0][0]} ${(100*top[0][1]/res.length).toFixed(1)}% top4share=${(100*top.slice(0,4).reduce((a,b)=>a+b[1],0)/res.length).toFixed(1)}%`);

const q = {}; for (const r of res) q[r.r.quality]=(q[r.r.quality]||0)+1;
console.log("quality:", q);
const pens = res.map(r=>r.r.bestPen).sort((a,b)=>a-b);
const pct = p => pens[Math.floor(p/100*(pens.length-1))].toFixed(1);
console.log(`bestPen p10=${pct(10)} p25=${pct(25)} p50=${pct(50)} p75=${pct(75)} p90=${pct(90)} max=${pens[pens.length-1].toFixed(1)}`);
const gradeCount={}; for(const r of res) gradeCount[r.r.grade.label]=(gradeCount[r.r.grade.label]||0)+1;
console.log("grades:", gradeCount);
console.log("mean tieCount:", (res.reduce((a,r)=>a+r.r.tieCount,0)/res.length).toFixed(1));

// correlation: BBGM input vs assigned build's minimum for the driven stat
const pairs = [["TP","Threepoint Shot"],["Pss","Pass Accuracy"],["DIQ","Perimeter Defense"],["Stre","Strength"],
  ["Mid","Midrange Shot"],["Ins","Post Control"],["Dnk","Driving Dunk"],["Drb","Ball Handle"],["Spd","Speed"],["Reb","Defensive Rebound"]];
const si = Object.fromEntries(E.STAT_NAMES.map((s,i)=>[s,i]));
for (const [b,k] of pairs) {
  const xs = res.map(r=>r.p[b]);
  const ys = res.map(r=> E.ARCHETYPES[r.r.matches[0].ai].stats[si[k]][0]);
  console.log(`corr ${b} ~ ${k} min: ${corr(xs,ys).toFixed(2)}`);
}
// shooting-name assignment rate for non-shooters
const shoot = /3PT|Sniper|Shot Creator|Sharpshoot|Shooter|Marksman|Spot.?Up|3-Level/i;
for (const cut of [25,40]) {
  const sub = res.filter(r=>r.p.TP<=cut);
  console.log(`3Pt<=${cut}: n=${sub.length} shooting-build ${(100*sub.filter(r=>shoot.test(r.r.matches[0].name)).length/(sub.length||1)).toFixed(0)}%`);
}
const buckets=[[0,14],[15,29],[30,44],[45,59],[60,74],[75,100]];
for(const [a,b] of buckets){const sub=res.filter(r=>r.p.TP>=a&&r.p.TP<=b);
  if(!sub.length)continue;
  const m=sub.reduce((s,r)=>s+E.ARCHETYPES[r.r.matches[0].ai].stats[si["Threepoint Shot"]][0],0)/sub.length;
  console.log(`3Pt ${a}-${b}: n=${sub.length} mean assigned 3PT min ${m.toFixed(1)}`);}
// legend reachability
const god = Object.fromEntries(E.BBGM_STATS.map(s=>[s,100]));
const gb = E.calcBadges(E.convertPlayer(god));
console.log(`god-mode Legend badges: ${gb.filter(b=>b.tier===5).length}/${gb.length}`);
let legend=0, evals=0;
for(const r of res){ for(const b of E.calcBadges(r.c)){ evals++; if(b.tier===5) legend++; } }
console.log(`league Legend instances: ${legend}/${evals}`);
