import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient, isConfigured } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/** Un seul appel réseau à Supabase Auth par requête : le cadre commun et la
 *  page appellent tous deux requireUser, le résultat est partagé (cache de
 *  React, valable le temps d'un rendu serveur). */
const currentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Garde d'authentification + verrou mono-utilisateur (OWNER_EMAIL).
 *  Toute page ou route protégée commence par `const user = await requireUser()`. */
export async function requireUser(): Promise<User> {
  if (!isConfigured()) redirect("/connexion");
  const user = await currentUser();
  if (!user) redirect("/connexion");

  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (owner && user.email?.toLowerCase() !== owner) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/connexion?erreur=non-autorise");
  }
  return user;
}

/** Variante pour les routes API : renvoie null au lieu de rediriger. */
export async function getApiUser(): Promise<User | null> {
  if (!isConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (owner && user.email?.toLowerCase() !== owner) return null;
  return user;
}
