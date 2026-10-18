/** Nettoie une variable d'environnement collée à la main (Vercel) :
 *  retire espaces, retours à la ligne et caractères invisibles
 *  (séparateurs de ligne Unicode, espaces insécables, caractères de largeur
 *  nulle) qui cassent les en-têtes HTTP
 *  ("Cannot convert argument to a ByteString").
 *  Ne reçoit que des valeurs : l'accès `process.env.X` reste littéral
 *  pour que Next.js puisse injecter les NEXT_PUBLIC_* côté navigateur. */

// Codes construits numériquement pour ne jamais mettre ces caractères
// invisibles tels quels dans le source.
const INVISIBLE = [0x00a0, 0x200b, 0x200c, 0x200d, 0x2028, 0x2029, 0xfeff];

export function cleanEnv(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  let cleaned = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (/\s/.test(ch) || INVISIBLE.includes(code)) continue;
    cleaned += ch;
  }
  return cleaned.length > 0 ? cleaned : undefined;
}
