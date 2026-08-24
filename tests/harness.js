// Shared test harness: loads docs/index.html's inline script in a headless
// (DOM-stubbed) context so the real conversion/matching/badge code can be
// exercised from Node without a browser.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DOCS = path.join(__dirname, "..", "docs");

function stubEl() {
  const el = {
    addEventListener() {}, appendChild() {}, removeEventListener() {},
    style: {}, value: "", innerHTML: "", textContent: "", dataset: {},
    classList: { add() {}, remove() {}, contains: () => false },
    dispatchEvent() {}, querySelectorAll: () => [], closest: () => stubEl(),
    remove() {}, click() {}, focus() {}, files: [],
  };
  return el;
}

function loadApp() {
  const html = fs.readFileSync(path.join(DOCS, "index.html"), "utf8");
  const m = html.match(/<script>\n"use strict";([\s\S]*?)<\/script>/);
  if (!m) throw new Error("could not locate the inline app script in docs/index.html");
  const archetypes = fs.readFileSync(path.join(DOCS, "archetypes.js"), "utf8");

  const sandbox = {
    console,
    document: {
      getElementById: stubEl, querySelector: stubEl, createElement: stubEl,
      querySelectorAll: () => [], body: stubEl(), addEventListener() {},
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { search: "", pathname: "/index.html", href: "http://localhost/" },
    history: { replaceState() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    URLSearchParams, URL: { createObjectURL: () => "blob:", revokeObjectURL() {} },
    Blob: function () {}, fetch: async () => { throw new Error("no fetch in tests"); },
    setTimeout, clearTimeout, Event: function () {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  // Top-level `const`/`let` in a vm context don't become sandbox properties,
  // so re-export the symbols the tests need onto an explicit object.
  const EXPORTS = [
    "ARCHETYPE_DATA", "BBGM_STATS", "HEADER_ALIASES", "BADGES", "TIERS",
    "convertPlayer", "matchArchetypes", "calcBadges", "bbgmToPercentile",
    "percentileTo2K", "bbgmHeightToInches", "K2_FROM_BBGM", "K2_ANCHORS",
    "BBGM_ANCHORS", "parseCSV", "buildDisplayName", "badgePoints",
    "assignWithVariety", "statContributions",
  ];
  const exportSrc = "\n;globalThis.__app = {};\n" + EXPORTS
    .map(n => `try { globalThis.__app.${n} = ${n}; } catch (e) {}`).join("\n");
  vm.runInContext(archetypes + "\n" + m[1] + exportSrc, sandbox, { filename: "app.js" });
  return sandbox.__app;
}

// Parse the sample roster CSV into BBGM stat objects.
function loadRoster(app) {
  const csvPath = path.join(__dirname, "..", "data", "PlayerRatings_sample.csv");
  const text = fs.readFileSync(csvPath, "utf8").replace(/^﻿/, "");
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map(h => h.trim().toLowerCase());
  const idx = {};
  const aliases = app.HEADER_ALIASES;
  header.forEach((h, i) => {
    if (aliases[h] && idx[aliases[h]] === undefined) idx[aliases[h]] = i;
  });
  const nameCol = header.indexOf("name"), posCol = header.indexOf("pos");
  const out = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = lines[r].split(",");
    const bbgm = {};
    let ok = true;
    for (const s of app.BBGM_STATS) {
      const v = parseFloat(cells[idx[s]]);
      if (isNaN(v) || v < 0 || v > 100) { ok = false; break; }
      bbgm[s] = v;
    }
    if (ok) out.push({ name: cells[nameCol], pos: cells[posCol], bbgm });
  }
  return out;
}

module.exports = { loadApp, loadRoster };
