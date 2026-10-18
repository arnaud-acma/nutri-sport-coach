/** Lecture minimale de la date de prise de vue dans un JPEG (EXIF
 *  DateTimeOriginal, sinon DateTime). Sans dépendance. Renvoie la chaîne
 *  brute « AAAA:MM:JJ HH:MM:SS » et, si présent, le décalage horaire
 *  (« +02:00 »). Toute anomalie renvoie null : l'heure reste alors
 *  modifiable à la main. Testé par scripts/test-exif.mts. */
export interface ExifDate {
  raw: string;
  offset: string | null;
}

export function readExifDate(buf: ArrayBuffer): ExifDate | null {
  try {
    const v = new DataView(buf);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null; // pas un JPEG
    let p = 2;
    while (p + 4 <= v.byteLength) {
      const marker = v.getUint16(p);
      if ((marker & 0xff00) !== 0xff00) return null;
      const size = v.getUint16(p + 2);
      if (marker === 0xffe1 && readAscii(v, p + 4, 6) === "Exif\0\0") {
        return parseTiff(v, p + 10);
      }
      if (marker === 0xffda) return null; // début de l'image : pas d'EXIF
      p += 2 + size;
    }
    return null;
  } catch {
    return null;
  }
}

function readAscii(v: DataView, at: number, len: number): string {
  let s = "";
  for (let i = 0; i < len && at + i < v.byteLength; i++) {
    s += String.fromCharCode(v.getUint8(at + i));
  }
  return s;
}

function parseTiff(v: DataView, tiff: number): ExifDate | null {
  const order = v.getUint16(tiff);
  const le = order === 0x4949; // « II » : little-endian
  if (!le && order !== 0x4d4d) return null;
  const u16 = (o: number) => v.getUint16(tiff + o, le);
  const u32 = (o: number) => v.getUint32(tiff + o, le);

  /** Lit une entrée ASCII d'un IFD, renvoie null si absente. */
  function readIfd(ifd: number): Map<number, string | number> {
    const out = new Map<number, string | number>();
    const count = u16(ifd);
    for (let i = 0; i < count; i++) {
      const e = ifd + 2 + i * 12;
      const tag = u16(e);
      const type = u16(e + 2);
      const n = u32(e + 4);
      if (type === 2) {
        const at = n > 4 ? u32(e + 8) : e + 8;
        out.set(tag, readAscii(v, tiff + at, n).replace(/\0+$/, ""));
      } else if (type === 4) {
        out.set(tag, u32(e + 8));
      }
    }
    return out;
  }

  const ifd0 = readIfd(u32(4));
  let exif = new Map<number, string | number>();
  const exifPtr = ifd0.get(0x8769);
  if (typeof exifPtr === "number") exif = readIfd(exifPtr);

  const raw =
    (exif.get(0x9003) as string | undefined) ?? // DateTimeOriginal
    (ifd0.get(0x0132) as string | undefined); // DateTime
  if (!raw || !/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}/.test(raw)) return null;
  const offset = (exif.get(0x9011) as string | undefined) ?? null; // OffsetTimeOriginal
  return {
    raw: raw.slice(0, 19),
    offset: offset && /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : null,
  };
}

/** Convertit en Date. Sans décalage EXIF, l'heure est supposée être
 *  l'heure de Paris (via la fonction fournie). */
export function exifToDate(
  e: ExifDate,
  parisLocal: (y: number, mo: number, d: number, h: number, mi: number) => Date
): Date | null {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2})/.exec(e.raw);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (y < 2000 || mo < 1 || mo > 12) return null;
  if (e.offset) {
    const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00${e.offset}`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return parisLocal(y, mo, d, h, mi);
}
