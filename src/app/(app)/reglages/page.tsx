import { requireUser } from "@/lib/auth";
import ImportKnowledge from "./ImportKnowledge";
import { cleanEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function Reglages() {
  const user = await requireUser();
  const provider = (cleanEnv(process.env.LLM_PROVIDER) ?? "anthropic").toLowerCase();
  const hasKey = Boolean(cleanEnv(process.env.ANTHROPIC_API_KEY));
  const model = cleanEnv(process.env.LLM_MODEL) || "claude-sonnet-5-5";
  const effective = provider === "mock" || !hasKey ? "mock (simulé)" : provider;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold">Réglages</h1>

      <section className="rounded-xl border border-border bg-card p-4 text-sm flex flex-col gap-1">
        <h2 className="font-semibold">Coach LLM</h2>
        <p>
          Fournisseur actif : <strong>{effective}</strong>
        </p>
        <p>
          Modèle configuré : <strong>{model}</strong>
        </p>
        {(!hasKey || provider === "mock") && (
          <p className="text-danger">
            Mode simulé : ajoute ANTHROPIC_API_KEY dans les variables
            d&apos;environnement (voir docs/GUIDE-INSTALLATION.md) pour activer
            le vrai coach.
          </p>
        )}
        <p className="text-xs text-muted">
          Changer de modèle ou de fournisseur = changer les variables
          LLM_MODEL / LLM_PROVIDER. Aucune donnée n&apos;est chez le
          fournisseur : il ne fait que répondre.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 text-sm flex flex-col gap-2">
        <h2 className="font-semibold">Exporter mes données</h2>
        <p className="text-xs text-muted">
          Tout ce que l&apos;appli sait : fiches (avec historique), repas,
          pesées. C&apos;est ta garantie d&apos;indépendance.
        </p>
        <div className="flex gap-2">
          <a
            href="/api/export?format=markdown"
            className="flex-1 rounded-lg bg-accent text-white text-center py-2.5 font-semibold"
          >
            Export Markdown
          </a>
          <a
            href="/api/export?format=json"
            className="flex-1 rounded-lg border border-border text-center py-2.5 font-semibold"
          >
            Export JSON
          </a>
        </div>
      </section>

      <ImportKnowledge />

      <section className="rounded-xl border border-border bg-card p-4 text-sm flex flex-col gap-2">
        <h2 className="font-semibold">Compte</h2>
        <p className="text-muted">{user.email}</p>
        <form action="/api/deconnexion" method="post">
          <button className="rounded-lg border border-border px-4 py-2">
            Se déconnecter
          </button>
        </form>
      </section>
    </div>
  );
}
