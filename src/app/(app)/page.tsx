import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dayKey } from "@/lib/journee";
import { loadDay } from "@/lib/journee-db";
import DayView from "@/components/DayView";

export const dynamic = "force-dynamic";

/** Accueil : la journée nutritionnelle en cours (de 4h à 4h). */
export default async function Home() {
  await requireUser();
  const supabase = await createClient();
  const day = await loadDay(supabase, dayKey(new Date()));
  return <DayView day={day} />;
}
