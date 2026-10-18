/** Affiché instantanément pendant le chargement d'un écran (pré-chargé par
 *  Next) : le toucher d'un lien répond tout de suite, même si le serveur
 *  met du temps. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4 animate-pulse" aria-busy="true" aria-label="Chargement">
      <div className="h-7 w-40 rounded-lg bg-border" />
      <div className="h-48 rounded-xl bg-card border border-border" />
      <div className="h-12 rounded-xl bg-card border border-border" />
      <div className="h-20 rounded-lg bg-card border border-border" />
      <div className="h-20 rounded-lg bg-card border border-border" />
    </div>
  );
}
