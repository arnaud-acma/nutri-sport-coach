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
  /** null ou absent : calculé à partir de la cible calorique (décision 20). */
  glucides_g?: number | null;
  lipides_g?: number | null;
  fibres_g?: number | null;
  note?: string | null;
}

/** Repères ANSES pour l'adulte (rapport « Actualisation des repères du
 *  PNNS », décembre 2016, tableau 4) : lipides 35 à 40 % de l'apport
 *  énergétique, glucides 40 à 55 %, fibres 30 g par jour. Population
 *  générale, pas spécifique au sport : point de départ. */
export const ANSES = {
  lipidesPctMin: 35,
  lipidesPctMax: 40,
  glucidesPctMin: 40,
  glucidesPctMax: 55,
  fibresG: 30,
} as const;
/** Part des lipides retenue pour le calcul automatique : milieu de 35-40 %. */
const LIPIDES_PCT_AUTO = 37.5;

export interface MacroTargets {
  glucides: number;
  lipides: number;
  fibres: number;
  /** true quand la valeur est calculée (champ laissé vide dans Réglages). */
  auto: { glucides: boolean; lipides: boolean; fibres: boolean };
}

/** Cibles de glucides, lipides et fibres en grammes. Valeur saisie si
 *  elle existe ; sinon calcul automatique : lipides à 37,5 % de l'énergie,
 *  fibres 30 g, glucides = énergie restante après protéines et lipides
 *  (4 kcal/g pour protéines et glucides, 9 kcal/g pour les lipides). */
export function macroTargets(t: Target): MacroTargets {
  const lipides = t.lipides_g ?? Math.round((t.kcal * LIPIDES_PCT_AUTO) / 100 / 9);
  const glucides =
    t.glucides_g ?? Math.max(0, Math.round((t.kcal - t.proteines_g * 4 - lipides * 9) / 4));
  return {
    glucides,
    lipides,
    fibres: t.fibres_g ?? ANSES.fibresG,
    auto: {
      glucides: t.glucides_g == null,
      lipides: t.lipides_g == null,
      fibres: t.fibres_g == null,
    },
  };
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
  gluc_min?: number | null;
  gluc_max?: number | null;
  lip_min?: number | null;
  lip_max?: number | null;
  fib_min?: number | null;
  fib_max?: number | null;
  categories: string[] | null;
}

export interface Range {
  min: number;
  max: number;
  mid: number;
}

export interface DaySummary {
  prises: number;
  /** Prises sans estimation (anciens repas, erreur d'analyse). */
  nonEstimees: number;
  kcal: Range;
  prot: Range;
  /** Glucides, lipides, fibres : hors score (décision 20). */
  gluc: Range;
  lip: Range;
  fib: Range;
  /** Prises sans estimation de glucides, lipides et fibres (avant la V1.3). */
  sansMacros: number;
  categories: string[];
  score: number;
  parts: { energie: number; proteines: number; qualite: number; prises: number };
}

const ratio = (v: number, target: number) =>
  target > 0 ? Math.min(1, Math.max(0, v / target)) : 0;

export function summarizeDay(meals: MealEstimate[], target: Target): DaySummary {
  let kMin = 0, kMax = 0, pMin = 0, pMax = 0, nonEstimees = 0, sansMacros = 0;
  const macro = { gluc: [0, 0], lip: [0, 0], fib: [0, 0] };
  const cats = new Set<string>();
  for (const m of meals) {
    if (m.gluc_min == null && m.lip_min == null && m.fib_min == null) sansMacros++;
    for (const k of ["gluc", "lip", "fib"] as const) {
      const lo = m[`${k}_min`];
      const hi = m[`${k}_max`];
      if (lo != null && hi != null) {
        macro[k][0] += Number(lo);
        macro[k][1] += Number(hi);
      }
    }
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
    gluc: toRange(macro.gluc),
    lip: toRange(macro.lip),
    fib: toRange(macro.fib),
    sansMacros,
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

function toRange([lo, hi]: number[]): Range {
  return { min: Math.round(lo), max: Math.round(hi), mid: Math.round((lo + hi) / 2) };
}

/** Cohérence d'une estimation : les calories annoncées doivent être proches
 *  de 4 x protéines + 4 x glucides + 9 x lipides (milieux des fourchettes).
 *  Renvoie l'écart relatif, ou null si les données manquent. Au-delà de
 *  ECART_MAX, l'estimation est signalée « à vérifier ». */
export const ECART_MAX = 0.25;
export function ecartCoherence(m: MealEstimate): number | null {
  const mid = (a?: number | null, b?: number | null) =>
    a == null || b == null ? null : (Number(a) + Number(b)) / 2;
  const k = mid(m.kcal_min, m.kcal_max);
  const p = mid(m.prot_min, m.prot_max);
  const g = mid(m.gluc_min, m.gluc_max);
  const l = mid(m.lip_min, m.lip_max);
  if (k == null || p == null || g == null || l == null || k <= 0) return null;
  return Math.abs(4 * p + 4 * g + 9 * l - k) / k;
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
