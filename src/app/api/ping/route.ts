import { NextResponse } from "next/server";
import { cleanEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Mesure de diagnostic, sans donnée personnelle : région où tourne la
 *  fonction et durée de 3 allers-retours vers Supabase (point de santé de
 *  l'authentification, public). Sert à vérifier la lenteur avant et après
 *  un changement de région. */
export async function GET() {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const supabase_ms: number[] = [];
  if (url && key) {
    for (let i = 0; i < 3; i++) {
      const t = performance.now();
      try {
        await fetch(`${url}/auth/v1/health`, {
          headers: { apikey: key },
          cache: "no-store",
        });
        supabase_ms.push(Math.round(performance.now() - t));
      } catch {
        supabase_ms.push(-1);
      }
    }
  }
  return NextResponse.json(
    { region: process.env.VERCEL_REGION ?? "local", supabase_ms },
    { headers: { "cache-control": "no-store" } }
  );
}
