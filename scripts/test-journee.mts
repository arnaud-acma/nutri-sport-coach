// Tests des fonctions pures de la journée nutritionnelle.
// Lancer : node scripts/test-journee.mts
import assert from "node:assert/strict";
import {
  dayKey,
  dayBounds,
  defaultSlot,
  isCollation,
  summarizeDay,
  targetFor,
  shiftDay,
  toParisInputValue,
  fromParisInputValue,
  groupByDay,
  DEFAULT_TARGET,
} from "../src/lib/journee.ts";

let n = 0;
function test(name: string, fn: () => void) {
  fn();
  n++;
  console.log(`ok - ${name}`);
}

test("bascule de journée à 4h (heure d'été, UTC+2)", () => {
  // 18/10/2026 03:59 Paris = 01:59 UTC -> journée du 17
  assert.equal(dayKey(new Date("2026-10-18T01:59:00Z")), "2026-10-17");
  // 18/10/2026 04:00 Paris = 02:00 UTC -> journée du 18
  assert.equal(dayKey(new Date("2026-10-18T02:00:00Z")), "2026-10-18");
  // Collation à 0h30 le 19 -> journée du 18
  assert.equal(dayKey(new Date("2026-10-18T22:30:00Z")), "2026-10-18");
});

test("bascule de journée en heure d'hiver (UTC+1)", () => {
  assert.equal(dayKey(new Date("2026-12-01T02:59:00Z")), "2026-11-30");
  assert.equal(dayKey(new Date("2026-12-01T03:00:00Z")), "2026-12-01");
});

test("bornes d'une journée", () => {
  const b = dayBounds("2026-10-18");
  assert.equal(b.start.toISOString(), "2026-10-18T02:00:00.000Z");
  assert.equal(b.end.toISOString(), "2026-10-19T02:00:00.000Z");
});

test("bornes autour du passage à l'heure d'hiver (25 octobre 2026)", () => {
  const b = dayBounds("2026-10-25");
  // 25/10 4h Paris : déjà en heure d'hiver (changement à 3h) -> 03:00 UTC
  assert.equal(b.start.toISOString(), "2026-10-25T03:00:00.000Z");
  assert.equal(b.end.toISOString(), "2026-10-26T03:00:00.000Z");
  const prev = dayBounds("2026-10-24");
  assert.equal(prev.start.toISOString(), "2026-10-24T02:00:00.000Z");
  assert.equal(prev.end.toISOString(), b.start.toISOString());
});

test("décalage de jour, y compris fin de mois", () => {
  assert.equal(shiftDay("2026-10-31", 1), "2026-11-01");
  assert.equal(shiftDay("2026-11-01", -1), "2026-10-31");
});

test("créneau par défaut selon l'heure de Paris", () => {
  assert.equal(defaultSlot(new Date("2026-10-18T06:00:00Z")), "petit-déjeuner"); // 8h
  assert.equal(defaultSlot(new Date("2026-10-18T09:00:00Z")), "collation du matin"); // 11h
  assert.equal(defaultSlot(new Date("2026-10-18T11:00:00Z")), "déjeuner"); // 13h
  assert.equal(defaultSlot(new Date("2026-10-18T15:00:00Z")), "goûter"); // 17h
  assert.equal(defaultSlot(new Date("2026-10-18T18:00:00Z")), "dîner"); // 20h
  assert.equal(defaultSlot(new Date("2026-10-18T21:00:00Z")), "collation du soir"); // 23h
  assert.equal(defaultSlot(new Date("2026-10-18T23:30:00Z")), "collation du soir"); // 1h30
});

test("collations silencieuses", () => {
  assert.ok(isCollation("goûter"));
  assert.ok(isCollation("collation du matin"));
  assert.ok(isCollation("collation"));
  assert.ok(!isCollation("déjeuner"));
  assert.ok(!isCollation(null));
});

test("champ heure : aller-retour à l'heure de Paris", () => {
  const d = new Date("2026-10-18T10:45:00Z");
  assert.equal(toParisInputValue(d), "2026-10-18T12:45");
  assert.equal(fromParisInputValue("2026-10-18T12:45")!.toISOString(), d.toISOString());
  assert.equal(fromParisInputValue("n'importe quoi"), null);
});

test("cible en vigueur à une date", () => {
  const ts = [
    { valid_from: "2026-10-18", kcal: 3000, proteines_g: 115, prises_min: 5 },
    { valid_from: "2026-11-10", kcal: 3200, proteines_g: 120, prises_min: 5 },
  ];
  assert.equal(targetFor("2026-10-20", ts).kcal, 3000);
  assert.equal(targetFor("2026-11-10", ts).kcal, 3200);
  // Avant la première cible : la première s'applique
  assert.equal(targetFor("2026-10-01", ts).kcal, 3000);
  assert.equal(targetFor("2026-10-20", []).kcal, DEFAULT_TARGET.kcal);
});

test("score : journée parfaite = 100, plafonné", () => {
  const meals = Array.from({ length: 6 }, () => ({
    kcal_min: 550, kcal_max: 650, prot_min: 22, prot_max: 28,
    categories: ["proteines", "legumes", "feculents", "bon_gras", "fruits"],
  }));
  const s = summarizeDay(meals, DEFAULT_TARGET);
  assert.equal(s.kcal.mid, 3600);
  assert.equal(s.prot.mid, 150);
  assert.equal(s.score, 100);
});

test("score : journée vide = 0", () => {
  const s = summarizeDay([], DEFAULT_TARGET);
  assert.equal(s.score, 0);
  assert.equal(s.prises, 0);
});

test("score : moitié des cibles, 2 catégories, 3 prises", () => {
  const meals = [
    { kcal_min: 400, kcal_max: 600, prot_min: 15, prot_max: 25, categories: ["proteines"] },
    { kcal_min: 450, kcal_max: 550, prot_min: 15, prot_max: 15, categories: ["legumes", "inconnue"] },
    { kcal_min: null, kcal_max: null, prot_min: null, prot_max: null, categories: null },
  ];
  const s = summarizeDay(meals, DEFAULT_TARGET);
  assert.equal(s.kcal.mid, 1000);
  assert.equal(s.prot.mid, 35);
  assert.equal(s.nonEstimees, 1);
  assert.deepEqual(s.categories, ["proteines", "legumes"]);
  // 35*1000/3000 + 35*35/115 + 8 + 10*3/5 = 11.67 + 10.65 + 8 + 6 = 36.3
  assert.equal(s.score, 36);
});

test("regroupement par journée", () => {
  const g = groupByDay([
    { eaten_at: "2026-10-18T06:00:00Z" },
    { eaten_at: "2026-10-18T22:30:00Z" },
    { eaten_at: "2026-10-19T06:00:00Z" },
  ]);
  assert.equal(g.get("2026-10-18")?.length, 2);
  assert.equal(g.get("2026-10-19")?.length, 1);
});

console.log(`\n${n} tests réussis`);

import { defaultSlotFor, parseEatenAt } from "../src/lib/journee.ts";
// 8h : « + Collation » -> collation du matin ; 17h : « + Repas » -> dîner
assert.equal(defaultSlotFor(new Date("2026-10-18T06:00:00Z"), "collation"), "collation du matin");
assert.equal(defaultSlotFor(new Date("2026-10-18T15:00:00Z"), "repas"), "dîner");
assert.equal(defaultSlotFor(new Date("2026-10-18T11:00:00Z"), "repas"), "déjeuner");
assert.equal(defaultSlotFor(new Date("2026-10-18T22:30:00Z"), "repas"), "dîner");
assert.equal(defaultSlotFor(new Date("2026-10-18T11:00:00Z"), null), "déjeuner");
const now = Date.parse("2026-10-18T12:00:00Z");
assert.equal(parseEatenAt("", now)!.getTime(), now);
assert.equal(parseEatenAt("2026-10-18T13:00:00Z", now), null); // futur
assert.equal(parseEatenAt("2026-07-01T13:00:00Z", now), null); // trop ancien
assert.equal(parseEatenAt("2026-10-17T13:00:00Z", now)!.toISOString(), "2026-10-17T13:00:00.000Z");
console.log("ok - créneaux par type et heure de prise");
