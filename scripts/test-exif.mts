// Tests de la lecture de date EXIF. Lancer : node scripts/test-exif.mts
// Les images de scripts/fixtures sont générées (aucune donnée personnelle).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readExifDate, exifToDate } from "../src/lib/exif.ts";
import { parisLocalToDate } from "../src/lib/journee.ts";

const load = (f: string) => {
  const b = readFileSync(new URL(`./fixtures/${f}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

const a = readExifDate(load("with_offsetless.jpg"));
assert.deepEqual(a, { raw: "2026:10:18 12:34:56", offset: null });
assert.equal(exifToDate(a!, parisLocalToDate)!.toISOString(), "2026-10-18T10:34:00.000Z");

const b = readExifDate(load("with_offset.jpg"));
assert.equal(b!.offset, "+02:00");
assert.equal(exifToDate(b!, parisLocalToDate)!.toISOString(), "2026-10-18T10:34:00.000Z");

const c = readExifDate(load("ifd0_only.jpg"));
assert.equal(c!.raw, "2026:10:16 08:15:00");

assert.equal(readExifDate(load("none.jpg")), null);
assert.equal(readExifDate(new ArrayBuffer(10)), null);
assert.equal(readExifDate(new Uint8Array([0xff, 0xd8, 0x00, 0x00]).buffer), null);
console.log("ok - 6 vérifications EXIF réussies");
