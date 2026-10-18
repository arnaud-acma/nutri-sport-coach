import { requireUser } from "@/lib/auth";
import { initialEntryTime } from "@/lib/journee";
import SellesForm from "./SellesForm";

export const dynamic = "force-dynamic";

export default async function NouvellesSelles({
  searchParams,
}: {
  searchParams: Promise<{ jour?: string }>;
}) {
  await requireUser();
  const { jour } = await searchParams;
  const initialTime = initialEntryTime(jour, 8, 0);
  return <SellesForm initialTime={initialTime} />;
}
