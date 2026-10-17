import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Connaissance() {
  await requireUser();
  const supabase = await createClient();
  const { data: pages } = await supabase
    .from("knowledge_pages")
    .select("slug,title,content_md,updated_at")
    .order("sort_order");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Fiches de connaissance</h1>
      <p className="text-sm text-muted">
        Ces fiches sont la seule source du coach sur toi. Tu peux tout
        modifier : chaque changement est daté et conservé dans
        l&apos;historique.
      </p>
      <div className="flex flex-col gap-2">
        {pages?.map((p) => (
          <Link
            key={p.slug}
            href={`/connaissance/${p.slug}`}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="font-semibold">{p.title}</p>
            <p className="text-xs text-muted">
              {p.content_md.trim()
                ? `Modifiée le ${new Date(p.updated_at).toLocaleDateString("fr-FR")}`
                : "Vide : à remplir ou à importer (Réglages > Importer)"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
