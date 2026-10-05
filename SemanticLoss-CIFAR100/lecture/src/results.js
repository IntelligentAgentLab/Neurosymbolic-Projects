// Reads experiment JSONs and returns aggregated numbers for the deck.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..", "results");
const SETTINGS = ["full", "semi", "weak"];
const METHODS = ["ce_fine", "ce_both", "ce_both_eo", "ce_both_sl"];

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const std = (a) => (a.length < 2 ? 0 : Math.sqrt(a.reduce((s, v) => s + (v - mean(a)) ** 2, 0) / (a.length - 1)));

function load() {
  const best = readJson(path.join(ROOT, "best_lambda.json"));
  const bestEoPath = path.join(ROOT, "best_lambda_eo.json");
  const bestEo = fs.existsSync(bestEoPath) ? readJson(bestEoPath) : {};
  const runs = fs.readdirSync(ROOT).filter((f) => /_seed\d\.json$/.test(f)).map((f) => readJson(path.join(ROOT, f)));
  const agg = {};
  for (const s of SETTINGS) {
    agg[s] = {};
    for (const m of METHODS) {
      const lam = m === "ce_both_sl" ? best[s] : m === "ce_both_eo" ? bestEo[s] : 0;
      const rs = runs.filter((r) => r.setting === s && r.method === m && (lam === undefined ? false : m.startsWith("ce_both_") ? r.lam === lam : true));
      if (!rs.length) { agg[s][m] = null; continue; }
      const keys = Object.keys(rs[0].test);
      agg[s][m] = { n: rs.length, lam };
      for (const k of keys) {
        const v = rs.map((r) => r.test[k]);
        agg[s][m][k] = { mean: mean(v), std: std(v), all: v };
      }
    }
  }
  const tune = fs.readdirSync(path.join(ROOT, "tune")).map((f) => readJson(path.join(ROOT, "tune", f)));
  const lamGrid = [0.005, 0.02, 0.1, 0.5, 1.0, 2.0, 5.0];
  const tuneSl = {};
  for (const s of SETTINGS) {
    tuneSl[s] = lamGrid.map((l) => {
      const r = tune.find((t) => t.setting === s && t.method === "ce_both_sl" && t.lam === l);
      return r ? r.val.fine_acc : null;
    });
  }
  const tuneEo = {};
  for (const s of SETTINGS) {
    tuneEo[s] = [0.5, 1.0, 2.0].map((l) => {
      const r = tune.find((t) => t.setting === s && t.method === "ce_both_eo" && t.lam === l);
      return r ? r.val.fine_acc : null;
    });
  }
  return { best, bestEo, agg, lamGrid, tuneSl, tuneEo };
}

module.exports = { load, SETTINGS, METHODS };
