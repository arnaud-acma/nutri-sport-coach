import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import PageEditor from "./PageEditor";

export const dynamic = "force-dynamic";

export default async function FichePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireUser();
  const { slug } = await params;
  const supabase = await createClient();

  const { data: page } = await supabase
    .from("knowledge_pages")
    .select("id,slug,title,content_md,updated_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!page) notFound();

  const { data: revisions } = await supabase
    .from("knowledge_revisions")
    .select("id,note,created_at")
    .eq("page_id", page.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{page.title}</h1>
      <PageEditor slug={page.slug} initialContent={page.content_md} />
      <section>
        <h2 className="font-semibold text-sm mb-1">Historique</h2>
        {!revisions?.length && (
          <p className="text-xs text-muted">Aucune révision pour l&apos;instant.</p>
        )}
        <ul className="text-xs text-muted flex flex-col gap-1">
          {revisions?.map((r) => (
            <li key={r.id}>
              {new Date(r.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
              {r.note ? ` · ${r.note}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
