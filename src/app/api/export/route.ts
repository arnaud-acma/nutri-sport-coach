import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Export complet : fiches + historique + repas + pesées.
 *  ?format=json (machine) ou ?format=markdown (humain).
 *  Garantie d'indépendance : tout part avec ce fichier (hors photos,
 *  qui restent dans le Storage et sont référencées par chemin). */
export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }
  const format = new URL(request.url).searchParams.get("format") ?? "json";
  const supabase = await createClient();

  const [
    { data: pages },
    { data: revisions },
    { data: meals },
    { data: weights },
    { data: stools },
    { data: targets },
  ] = await Promise.all([
      supabase.from("knowledge_pages").select("*").order("sort_order"),
      supabase
        .from("knowledge_revisions")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("meals").select("*").order("eaten_at"),
      supabase.from("weights").select("*").order("measured_at"),
      // Tables de la migration 0003 : vides si elle n'a pas été exécutée.
      supabase.from("stools").select("*").order("occurred_at"),
      supabase.from("nutrition_targets").select("*").order("valid_from"),
    ]);

  const exportedAt = new Date().toISOString();
  const stamp = exportedAt.slice(0, 10);

  if (format === "markdown") {
    const md: string[] = [
      `# Export complet - Coach nutrition et sport`,
      `Exporté le ${exportedAt}. Ce fichier contient tout ce que l'appli sait.`,
      ``,
      `## Fiches de connaissance`,
    ];
    for (const p of pages ?? []) {
      md.push(`\n### ${p.title} (${p.slug})`, p.content_md || "_(vide)_");
    }
    md.push(`\n## Pesées`);
    for (const w of weights ?? []) {
      md.push(`- ${w.measured_at} : ${w.weight_kg} kg${w.note ? ` (${w.note})` : ""}`);
    }
    md.push(`\n## Cibles du jour`);
    for (const t of targets ?? []) {
      md.push(`- Depuis le ${t.valid_from} : ${t.kcal} kcal, ${t.proteines_g} g de protéines, ${t.prises_min} prises${t.note ? ` (${t.note})` : ""}`);
    }
    md.push(`\n## Selles (${stools?.length ?? 0})`);
    for (const st of stools ?? []) {
      md.push(`- ${st.occurred_at} : Bristol ${st.bristol}${st.flottent === true ? ", flottent" : st.flottent === false ? ", coulent" : ""}${st.note ? ` (${st.note})` : ""}`);
    }
    md.push(`\n## Repas (${meals?.length ?? 0})`);
    for (const m of meals ?? []) {
      md.push(
        `\n### ${m.eaten_at} · ${m.meal_type ?? "repas"} · verdict : ${m.coach_verdict ?? "?"}`
      );
      if (m.note) md.push(`Note : ${m.note}`);
      if (m.kcal_min != null) md.push(`Estimation : ${m.kcal_min} à ${m.kcal_max} kcal, ${m.prot_min} à ${m.prot_max} g de protéines, catégories : ${(m.categories ?? []).join(", ") || "aucune"}`);
      if (m.hypotheses) md.push(`Hypothèses : ${m.hypotheses}`);
      if (m.coach_feedback_md) md.push(`Retour du coach : ${m.coach_feedback_md}`);
      if (m.photo_path) md.push(`Photo : ${m.photo_path}`);
    }
    md.push(`\n## Historique des fiches (${revisions?.length ?? 0} révisions)`);
    for (const r of revisions ?? []) {
      md.push(`\n### Révision du ${r.created_at}${r.note ? ` (${r.note})` : ""}`, r.content_md);
    }
    return new NextResponse(md.join("\n"), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="export-coach-${stamp}.md"`,
      },
    });
  }

  return new NextResponse(
    JSON.stringify(
      {
        exported_at: exportedAt,
        version: 2,
        pages,
        revisions,
        meals,
        weights,
        stools: stools ?? [],
        nutrition_targets: targets ?? [],
      },
      null,
      2
    ),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="export-coach-${stamp}.json"`,
      },
    }
  );
}
