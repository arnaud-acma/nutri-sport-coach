// Normalisation des estimations renvoyées par le modèle.
// Lancer : node scripts/test-estimation.mts
import assert from "node:assert/strict";
import { normalizeEstimate, normalizeReply, parseCoachJson } from "../src/lib/llm/anthropic.ts";

let e = normalizeEstimate({ kcal_min: 700, kcal_max: 550, prot_min: "30,5", prot_max: 40,
  categories: ["proteines", "legumes", "proteines", "dessert"], hypotheses: "1 càs huile" });
assert.deepEqual(e, { kcal_min: 550, kcal_max: 700, prot_min: 30.5, prot_max: 40,
  gluc_min: null, gluc_max: null, lip_min: null, lip_max: null, fib_min: null, fib_max: null,
  categories: ["proteines", "legumes"], hypotheses: "1 càs huile" });

e = normalizeEstimate({ kcal_min: 600 }); // une seule borne : valeur ponctuelle
assert.equal(e.kcal_min, 600); assert.equal(e.kcal_max, 600); assert.equal(e.prot_min, null);

e = normalizeEstimate({ kcal_min: 9000, kcal_max: -5, prot_min: "abc" }); // aberrant
assert.equal(e.kcal_min, null); assert.equal(e.kcal_max, null); assert.equal(e.prot_min, null);

const r = normalizeReply({ verdict: "valide", resume: "x", ajouts: [], commentaire: "c",
  kcal_min: 500, kcal_max: 650, prot_min: 25, prot_max: 35, categories: ["fruits"] }, "m", "");
assert.equal(r.kcal_max, 650); assert.deepEqual(r.categories, ["fruits"]); assert.equal(r.hypotheses, "");

const p = parseCoachJson("bla", "m");
assert.equal(p.kcal_min, null); assert.deepEqual(p.categories, []);
console.log("ok - normalisation des estimations (5 cas)");

{
  const e2 = normalizeEstimate({ gluc_min: 80, gluc_max: 60, lip_min: 20, fib_min: 3.25, fib_max: 150 });
  assert.equal(e2.gluc_min, 60); assert.equal(e2.gluc_max, 80);
  assert.equal(e2.lip_min, 20); assert.equal(e2.lip_max, 20);
  assert.equal(e2.fib_min, 3.3); assert.equal(e2.fib_max, 3.3); // 150 g de fibres écarté
  console.log("ok - glucides, lipides, fibres normalisés");
}
