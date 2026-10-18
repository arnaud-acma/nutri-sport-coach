import { requireUser } from "@/lib/auth";
import { initialEntryTime } from "@/lib/journee";
import NouveauRepasForm from "./NouveauRepasForm";

export const dynamic = "force-dynamic";

/** ?creneau=repas|collation (bouton de l'accueil), ?jour=AAAA-MM-JJ pour
 *  ajouter une prise oubliée à une journée passée. */
export default async function NouveauRepas({
  searchParams,
}: {
  searchParams: Promise<{ creneau?: string; jour?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const kind = sp.creneau === "repas" || sp.creneau === "collation" ? sp.creneau : null;

  // Journée passée : 12h30 (repas) ou 17h (collation), modifiable ; sinon
  // maintenant. Calculée ici pour que serveur et téléphone affichent la même.
  const initialTime =
    kind === "collation" ? initialEntryTime(sp.jour, 17, 0) : initialEntryTime(sp.jour, 12, 30);
  return <NouveauRepasForm kind={kind} initialTime={initialTime} />;
}
