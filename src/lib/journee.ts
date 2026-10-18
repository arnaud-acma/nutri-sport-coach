/** Journée nutritionnelle : créneaux, bornes de journée (4h à 4h, Paris),
 *  cibles et score du jour. Fonctions pures, sans accès à la base :
 *  testées par scripts/test-journee.mts. Voir DECISIONS.md, 11 à 16. */

export const TZ = "Europe/Paris";
/** La journée nutritionnelle commence à 4h du matin (décision 13). */
export const DAY_START_HOUR = 4;

export const SLOTS = [
  "petit-déjeuner",
  "collation du matin",
  "déjeuner",
  "goûter",
  "dîner",
  "collation du soir",
] as const;
export type Slot = (typeof SLOTS)[number];

/** Créneaux analysés en silence (décision 16). « collation » : ancien
 *  libellé de la V1, conservé pour les repas déjà enregistrés. */
export function isCollation(slot: string | null | undefined): boolean {
  if (!slot) return false;
  return slot.includes("collation") || slot === "goûter";
}

/** Créneau proposé par défaut selon l'heure (heure de Paris). */
export function defaultSlot(d: Date): Slot {
  const { hour, minute } = parisParts(d);
  const h = hour + minute / 60;
  if (h < DAY_START_HOUR) return "collation du soir";
  if (h < 10.5) return "petit-déjeuner";
  if (h < 12) return "collation du matin";
  if (h < 15) return "déjeuner";
  if (h < 18.5) return "goûter";
  if (h < 22) return "dîner";
  return "collation du soir";
}

export const CATEGORIES = [
  { key: "proteines", label: "Protéines" },
  { key: "legumes", label: "Légumes" },
  { key: "feculents", label: "Féculents" },
  { key: "bon_gras", label: "Bon gras" },
  { key: "fruits", label: "Fruits" },
] as const;
export type CategoryKey = (typeof CATEGORIES)[number]["key"];
export const CATEGORY_KEYS: readonly string[] = CATEGORIES.map((c) => c.key);

/* ---------- Dates et fuseau ---------- */

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const partsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Composantes de la date à l'heure de Paris. */
export function parisParts(d: Date): Parts {
  const p: Record<string, number> = {};
  for (const { type, value } of partsFmt.formatToParts(d)) {
    if (type !== "literal") p[type] = Number(value);
  }
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute };
}

/** Décalage de Paris par rapport à UTC, en minutes, à cet instant. */
function parisOffsetMinutes(d: Date): number {
  const p = parisParts(d);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - Math.floor(d.getTime() / 60000) * 60000) / 60000);
}

/** Instant UTC correspondant à une heure locale de Paris. */
export function parisLocalToDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // Deux passes : suffit pour les changements d'heure d'été et d'hiver.
  let t = guess - parisOffsetMinutes(new Date(guess)) * 60000;
  t = guess - parisOffsetMinutes(new Date(t)) * 60000;
  return new Date(t);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Clé « AAAA-MM-JJ » de la journée nutritionnelle d'un instant. */
export function dayKey(d: Date): string {
  const p = parisParts(d);
  // Avant 4h : on appartient à la veille.
  const base = Date.UTC(p.year, p.month - 1, p.day) -
    (p.hour < DAY_START_HOUR ? 86400000 : 0);
  const b = new Date(base);
  return `${b.getUTCFullYear()}-${pad(b.getUTCMonth() + 1)}-${pad(b.getUTCDate())}`;
}

export function isDayKey(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

/** Décale une clé de journée de n jours. */
export function shiftDay(key: string, n: number): string {
  const d = new Date(Date.parse(`${key}T00:00:00Z`) + n * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Bornes [début, fin[ d'une journée nutritionnelle, en instants UTC. */
export function dayBounds(key: string): { start: Date; end: Date } {
  const [y, m, d] = key.split("-").map(Number);
  const next = shiftDay(key, 1).split("-").map(Number);
  return {
    start: parisLocalToDate(y, m, d, DAY_START_HOUR),
    end: parisLocalToDate(next[0], next[1], next[2], DAY_START_HOUR),
  };
}

/** Valeur pour un champ <input type="datetime-local">, à l'heure de Paris. */
export function toParisInputValue(d: Date): string {
  const p = parisParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Inverse de toParisInputValue ; null si la valeur est invalide. */
export function fromParisInputValue(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const date = parisLocalToDate(y, mo, d, h, mi);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function frDayLabel(key: string): string {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("fr-FR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/* ---------- Cibles ---------- */

export interface Target {
  valid_from: string;
  kcal: number;
  proteines_g: number;
  prises_min: number;
  note?: string | null;
}

/** Cibles provisoires de départ (décision 12), utilisées tant qu'aucune
 *  cible n'a été enregistrée dans Réglages. */
export const DEFAULT_TARGET: Target = {
  valid_from: "2026-10-18",
  kcal: 3000,
  proteines_g: 115,
  prises_min: 5,
  note: "Cibles provisoires de départ (décision 12)",
};

/** Cible en vigueur pour une journée : la plus récente dont valid_from est
 *  antérieure ou égale à la journée. */
export function targetFor(key: string, targets: Target[]): Target {
  const sorted = [...targets].sort((a, b) => a.valid_from.localeCompare(b.valid_from));
  let current: Target | null = null;
  for (const t of sorted) if (t.valid_from <= key) current = t;
  return current ?? sorted[0] ?? DEFAULT_TARGET;
}

/* ---------- Score du jour ---------- */

export interface MealEstimate {
  kcal_min: number | null;
  kcal_max: number | null;
  prot_min: number | null;
  prot_max: number | null;
  categories: string[] | null;
}

export interface DaySummary {
  prises: number;
  /** Prises sans estimation (anciens repas, erreur d'analyse). */
  nonEstimees: number;
  kcal: { min: number; max: number; mid: number };
  prot: { min: number; max: number; mid: number };
  categories: string[];
  score: number;
  parts: { energie: number; proteines: number; qualite: number; prises: number };
}

const ratio = (v: number, target: number) =>
  target > 0 ? Math.min(1, Math.max(0, v / target)) : 0;

export function summarizeDay(meals: MealEstimate[], target: Target): DaySummary {
  let kMin = 0, kMax = 0, pMin = 0, pMax = 0, nonEstimees = 0;
  const cats = new Set<string>();
  for (const m of meals) {
    if (m.kcal_min == null || m.kcal_max == null) nonEstimees++;
    else {
      kMin += m.kcal_min;
      kMax += m.kcal_max;
    }
    if (m.prot_min != null && m.prot_max != null) {
      pMin += Number(m.prot_min);
      pMax += Number(m.prot_max);
    }
    for (const c of m.categories ?? []) if (CATEGORY_KEYS.includes(c)) cats.add(c);
  }
  const kMid = (kMin + kMax) / 2;
  const pMid = (pMin + pMax) / 2;
  const parts = {
    energie: 35 * ratio(kMid, target.kcal),
    proteines: 35 * ratio(pMid, target.proteines_g),
    qualite: 4 * cats.size,
    prises: 10 * ratio(meals.length, target.prises_min),
  };
  const score = Math.round(parts.energie + parts.proteines + parts.qualite + parts.prises);
  return {
    prises: meals.length,
    nonEstimees,
    kcal: { min: kMin, max: kMax, mid: Math.round(kMid) },
    prot: { min: Math.round(pMin), max: Math.round(pMax), mid: Math.round(pMid) },
    categories: CATEGORY_KEYS.filter((c) => cats.has(c)),
    score,
    parts: {
      energie: Math.round(parts.energie),
      proteines: Math.round(parts.proteines),
      qualite: Math.round(parts.qualite),
      prises: Math.round(parts.prises),
    },
  };
}

/** Regroupe des repas par journée nutritionnelle. */
export function groupByDay<T extends { eaten_at: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = dayKey(new Date(r.eaten_at));
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
}

/** Heure d'une prise envoyée par le téléphone (ISO). Absente : maintenant.
 *  Refusée si plus de 10 minutes dans le futur ou plus de 60 jours avant. */
export function parseEatenAt(v: unknown, now = Date.now()): Date | null {
  if (v == null || v === "") return new Date(now);
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() > now + 10 * 60000) return null;
  if (d.getTime() < now - 60 * 86400000) return null;
  return d;
}

/** Créneau par défaut quand on a choisi « + Repas » ou « + Collation ». */
export function defaultSlotFor(d: Date, kind: "repas" | "collation" | null): Slot {
  const slot = defaultSlot(d);
  if (!kind || isCollation(slot) === (kind === "collation")) return slot;
  const { hour } = parisParts(d);
  const h = hour < DAY_START_HOUR ? hour + 24 : hour;
  if (kind === "repas") return h < 11 ? "petit-déjeuner" : h < 16 ? "déjeuner" : "dîner";
  return h < 12 ? "collation du matin" : h < 19 ? "goûter" : "collation du soir";
}

/** Heure proposée dans un formulaire de saisie : maintenant, ou, pour une
 *  journée passée (?jour=), l'heure donnée ce jour-là. ISO. */
export function initialEntryTime(jour: string | undefined, hour: number, minute: number): string {
  const now = new Date();
  if (jour && isDayKey(jour) && dayBounds(jour).end.getTime() < now.getTime()) {
    const [y, m, d] = jour.split("-").map(Number);
    return parisLocalToDate(y, m, d, hour, minute).toISOString();
  }
  return now.toISOString();
}
