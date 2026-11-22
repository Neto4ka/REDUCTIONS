#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(ROOT, "reductions.json");
const REPORT = path.join(ROOT, "tests", "report.json");

const SERIAL = new Set(["filt","ring","trem","pan","echo","comb","res","shaper","gate","dyn","notch","formant","space","chain","canon","phase"]);
const LAYER  = new Set(["dry","grain","freeze","cloud","harm","warp","tape","osc","clicks","silence","xf","alt"]);
const KNOWN  = new Set([...SERIAL, ...LAYER]);

const results = [];
let failed = 0;
function test(id, name, status, detail) {
  results.push({ id, name, status, detail: detail || "" });
  if (status === "fail") failed++;
}
const invDB = b => (b <= 0 ? Infinity : b >= 1 ? -Infinity : 20 * Math.log10((1 - b) / b));
const sym = I => (!Number.isFinite(I) ? (I === Infinity ? "S" : "E") : I >= 12 ? "A" : I >= 6 ? "B" : I >= 0 ? "C" : I >= -12 ? "D" : "E");

if (!existsSync(MANIFEST)) {
  console.error("reductions.json not found in repo root.");
  console.error("Generate: open REDUCTIONS.html, press the manifest .json button, rename to reductions.json, put in repo root.");
  process.exit(2);
}
const M = JSON.parse(readFileSync(MANIFEST, "utf8"));

const slots = [];
for (const c of M.composers || []) for (const p of c.patterns || []) slots.push({ no: c.no, p });

function walkOps(fx, visit) {
  for (const [name, params] of fx || []) {
    visit(name, params || {});
    if (name === "chain") walkOps(params.steps || [], visit);
    if (name === "xf" || name === "alt") { walkOps(params.a || [], visit); walkOps(params.b || [], visit); }
  }
}

test("T0", "manifest: 100 composers / 300 slots",
  (M.composers || []).length === 100 && slots.length === 300 ? "pass" : "fail",
  `${(M.composers || []).length} composers / ${slots.length} slots`);
test("T0b", "manifest version >= 4 (per-slot bed present)", (M.version || 0) >= 4 ? "pass" : "fail", `v${M.version}`);
test("T7", "timeline math: 300 slots x 10 s = 3000 s", slots.length * 10 === 3000 ? "pass" : "fail");

const heat = [];
let unknown = [], dead = [], lowBed = [], byDesign = [];
for (const s of slots) {
  const fx = s.p.fx || [], bed = s.p.bed;
  let serial = false, layer = false;
  walkOps(fx, n => {
    if (!KNOWN.has(n)) unknown.push(`${s.no}.${s.p.slot}:${n}`);
    if (SERIAL.has(n)) serial = true;
    if (LAYER.has(n)) layer = true;
  });
  const alive = serial || layer;
  const I = invDB(bed);
  if (!alive) dead.push(`${s.no}.${s.p.slot}`);
  if (typeof bed === "number" && bed >= 0.8) byDesign.push(`${s.no}.${s.p.slot}=${bed}`);
  if (typeof bed === "number" && I < -40 && bed < 0.8) lowBed.push(`${s.no}.${s.p.slot}`);
  heat.push({
    id: `${String(s.no).padStart(3, "0")}.${s.p.slot}`,
    bed,
    invasion: Number.isFinite(I) ? Math.round(I * 10) / 10 : String(I),
    live: alive ? (serial && layer ? "#" : serial ? "+" : "~") : "."
  });
}
test("T2", "graph liveness: every slot declares >= 1 known op", dead.length ? "fail" : "pass", dead.join(", ") || "all 300 alive");
test("T3", "op whitelist: no unknown ops in fx / chain / xf / alt", unknown.length ? "fail" : "pass", unknown.slice(0, 8).join(", ") || "clean");
test("T6", "no unintended near-silent slots (I < -40 dB and bed < 0.8)", lowBed.length ? "fail" : "pass", lowBed.join(", ") || "none");
test("T6b", "near-dry slots are declared by design (bed >= 0.8)", "info", byDesign.join(", ") || "none");

let canonBad = [];
for (const s of slots) walkOps(s.p.fx, (n, p) => {
  if (n === "canon") for (const r of p.r || [1]) if (r < 0.5 || r > 2) canonBad.push(`${s.no}:${r}`);
});
test("T9", "canon ratios inside delay-safe range [0.5, 2]", canonBad.length ? "fail" : "pass", canonBad.join(", ") || "ok");

let cloudBad = [], clouds = [];
for (const s of slots) walkOps(s.p.fx, (n, p) => {
  if (n === "cloud") {
    const nV = Math.max(3, Math.min(52, Math.round(p.n || 8)));
    if ((p.n || 0) > 52) cloudBad.push(`${s.no}:${p.n}`);
    clouds.push([`${s.no}.${s.p.slot}`, p.n, Math.min(48, Math.round(nV * 1.2)), Math.round(Math.min(48, Math.round(nV * 1.2)) * 0.13)]);
  }
});
test("T10", "cloud voice counts within CPU budget (n <= 52)", cloudBad.length ? "fail" : "pass", cloudBad.join(", ") || "ok");

let implicitSeed = [];
for (const s of slots) walkOps(s.p.fx, (n, p) => {
  if (n === "tape" && (p.op === "shuffle" || p.op === "stutter") && p.seed === undefined) implicitSeed.push(`${s.no}.${s.p.slot}`);
});
test("T4", "determinism: explicit seeds vs source-hash seeds", "info", `${implicitSeed.length} slots rely on implicit source-hash seed`);

test("T1", "invasion depth (acoustic): delegated to in-page selfTest + REC A/B", "delegated", "predicted dB in report.json");
test("T5", "analysis validity (acoustic): delegated to in-page diagnostics", "delegated", "f0 / peaks rows in diagnostics pane");
test("T8", "freeze stability (acoustic): delegated to ear pass, AUDIT control points", "delegated", "see AUDIT.md section 4");

const live = heat.map(h => h.live).join("");
const invs = heat.map(h => sym(typeof h.invasion === "number" ? h.invasion : h.invasion === "Infinity" ? Infinity : -Infinity)).join("");
console.log("REDUCTIONS acceptance report");
console.log("liveness  (# serial+layer, + serial, ~ layer, . dead):");
for (let i = 0; i < 100; i++) console.log(`  ${String(i + 1).padStart(3, "0")} ${live.slice(i * 3, i * 3 + 3)}  ${invs.slice(i * 3, i * 3 + 3)}`);
console.log("invasion  (S silence, A >=12dB, B >=6, C >=0, D >=-12, E lower)");
for (const r of results) console.log(`  [${r.status.toUpperCase().padEnd(9)}] ${r.id} ${r.name}${r.detail ? " — " + r.detail : ""}`);

writeFileSync(REPORT, JSON.stringify({
  generated: new Date().toISOString(),
  manifestVersion: M.version,
  legend: {
    liveness: "# serial+layer, + serial, ~ layer, . dead",
    invasion: "S bed=0, A >=12dB, B >=6, C >=0, D >=-12, E lower",
    slotRow: "[id, bed, predicted invasion dB, liveness]"
  },
  tests: results,
  heatmap: { liveness: live, invasion: invs },
  slots: heat.map(h => [h.id, h.bed, h.invasion, h.live]),
  clouds
}, null, 1));
console.log(failed ? `FAILED: ${failed} test(s)` : "ALL STATIC TESTS PASSED");
process.exit(failed ? 1 : 0);
