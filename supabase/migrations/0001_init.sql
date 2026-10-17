-- V1 : schéma initial
-- À exécuter dans Supabase : SQL Editor > New query > coller > Run.

-- Fiches de connaissance (la source de vérité sur Arnaud)
create table if not exists public.knowledge_pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  content_md text not null default '',
  sort_order int not null default 100,
  updated_at timestamptz not null default now()
);

-- Historique : chaque modification d'une fiche crée une révision
create table if not exists public.knowledge_revisions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.knowledge_pages(id) on delete cascade,
  content_md text not null,
  note text,
  created_at timestamptz not null default now()
);

-- Repas (photo + retour du coach)
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  eaten_at timestamptz not null default now(),
  meal_type text, -- petit-dejeuner | dejeuner | gouter | diner | collation
  photo_path text,
  note text,
  coach_verdict text, -- valide | a_completer | simule
  coach_feedback_md text,
  model_used text,
  created_at timestamptz not null default now()
);

-- Pesées
create table if not exists public.weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at date not null,
  weight_kg numeric(5,2) not null,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, measured_at)
);

-- Sécurité : RLS activée partout, accès réservé aux utilisateurs connectés.
-- (L'appli est mono-utilisateur : le verrou OWNER_EMAIL est appliqué côté serveur.)
alter table public.knowledge_pages enable row level security;
alter table public.knowledge_revisions enable row level security;
alter table public.meals enable row level security;
alter table public.weights enable row level security;

create policy "knowledge_rw" on public.knowledge_pages
  for all to authenticated using (true) with check (true);
create policy "revisions_rw" on public.knowledge_revisions
  for all to authenticated using (true) with check (true);
create policy "meals_own" on public.meals
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "weights_own" on public.weights
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Bucket privé pour les photos de repas (lu via URL signées côté serveur)
insert into storage.buckets (id, name, public)
  values ('meal-photos', 'meal-photos', false)
  on conflict (id) do nothing;

-- Gabarits de fiches (contenu vide : le vrai contenu est importé localement,
-- jamais commité — voir DECISIONS.md, décision n°2)
insert into public.knowledge_pages (slug, title, sort_order, content_md) values
  ('profil',     'Profil',                 10, ''),
  ('objectifs',  'Objectifs et priorités', 20, ''),
  ('positions',  'Mes positions',          30, ''),
  ('regime',     'Régime et habitudes',    40, ''),
  ('sante',      'Santé',                  50, '')
on conflict (slug) do nothing;
