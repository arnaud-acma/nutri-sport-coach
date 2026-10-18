import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dayKey, isDayKey } from "@/lib/journee";
import { loadDay } from "@/lib/journee-db";
import DayView from "@/components/DayView";

export const dynamic = "force-dynamic";

/** Une journée passée, consultable comme l'accueil. */
export default async function Jour({ params }: { params: Promise<{ date: string }> }) {
  await requireUser();
  const { date } = await params;
  if (!isDayKey(date)) notFound();
  const today = dayKey(new Date());
  if (date >= today) redirect("/");
  const supabase = await createClient();
  const day = await loadDay(supabase, date);
  return <DayView day={day} />;
}
