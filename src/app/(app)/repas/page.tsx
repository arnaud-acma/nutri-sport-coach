import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import Markdown from "@/components/Markdown";

export const dynamic = "force-dynamic";

interface StoredFeedback {
  resume?: string;
  ajouts?: string[];
  commentaire?: string;
}

function parseFeedback(raw: string | null): StoredFeedback {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as StoredFeedback;
  } catch {
    return { commentaire: raw };
  }
}

export default async function Repas() {
  await requireUser();
  const supabase = await createClient();
  const { data: meals } = await supabase
    .from("meals")
    .select("id,eaten_at,meal_type,note,photo_path,coach_verdict,coach_feedback_md,model_used")
    .order("eaten_at", { ascending: false })
    .limit(30);

  // URL signées pour les photos (bucket privé)
  const service = createServiceClient();
  const photoUrls = new Map<string, string>();
  const paths = (meals ?? [])
    .map((m) => m.photo_path)
    .filter((p): p is string => Boolean(p));
  if (paths.length) {
    const { data: signed } = await service.storage
      .from("meal-photos")
      .createSignedUrls(paths, 3600);
    signed?.forEach((s) => {
      if (s.signedUrl && s.path) photoUrls.set(s.path, s.signedUrl);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Repas</h1>
        <Link
          href="/repas/nouveau"
          className="rounded-lg bg-accent text-white px-4 py-2 text-sm font-semibold"
        >
          + Nouveau
        </Link>
      </div>

      {!meals?.length && (
        <p className="text-sm text-muted">Aucun repas enregistré.</p>
      )}

      {meals?.map((m) => {
        const fb = parseFeedback(m.coach_feedback_md);
        const url = m.photo_path ? photoUrls.get(m.photo_path) : null;
        return (
          <article
            key={m.id}
            id={m.id}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            {url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="" className="w-full max-h-64 object-cover" />
            )}
            <div className="p-4 flex flex-col gap-2">
              <p className="text-sm font-semibold">
                {m.coach_verdict === "valide"
                  ? "✅"
                  : m.coach_verdict === "simule"
                    ? "🧪"
                    : "➕"}{" "}
                {m.meal_type ?? "Repas"} ·{" "}
                {new Date(m.eaten_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              {m.note && <p className="text-sm text-muted">« {m.note} »</p>}
              {fb.resume && <p className="text-sm">{fb.resume}</p>}
              {fb.ajouts && fb.ajouts.length > 0 && (
                <ul className="list-disc pl-5 text-sm">
                  {fb.ajouts.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              )}
              {fb.commentaire && <Markdown md={fb.commentaire} />}
            </div>
          </article>
        );
      })}
    </div>
  );
}
