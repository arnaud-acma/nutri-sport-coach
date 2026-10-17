/** Rendu Markdown minimal et sûr (gras, listes, paragraphes).
 *  Volontairement sans dépendance : le contenu vient du coach ou d'Arnaud. */
function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>");
}

export function mdToHtml(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("- ") || t.startsWith("* ")) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(t.slice(2))}</li>`);
      continue;
    }
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
    if (!t) continue;
    const h = t.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level + 1}>${inline(h[2])}</h${level + 1}>`);
    } else {
      out.push(`<p>${inline(t)}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

export default function Markdown({ md }: { md: string }) {
  return (
    <div
      className="prose-coach text-sm"
      dangerouslySetInnerHTML={{ __html: mdToHtml(md) }}
    />
  );
}
