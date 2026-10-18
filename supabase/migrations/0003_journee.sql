-- V1.2 : journée nutritionnelle (estimations chiffrées, cibles datées)
-- et journal des selles. Voir DECISIONS.md, décisions 11 à 17.
-- À exécuter UNE fois dans Supabase > SQL Editor (après 0002_coach.sql).
-- Sans risque pour les données existantes : uniquement des ajouts.
-- Peut être relancée sans erreur.

-- 1. Estimations chiffrées par repas (fourchettes) et catégories couvertes
alter table public.meals add column if not exists kcal_min int;
alter table public.meals add column if not exists kcal_max int;
alter table public.meals add column if not exists prot_min numeric(5,1);
alter table public.meals add column if not exists prot_max numeric(5,1);
-- Sous-ensemble de : proteines, legumes, feculents, bon_gras, fruits
alter table public.meals add column if not exists categories text[];
-- Hypothèses du coach (huile supposée, portion estimée...)
alter table public.meals add column if not exists hypotheses text;
alter table public.meals add column if not exists updated_at timestamptz;

create index if not exists meals_user_eaten on public.meals (user_id, eaten_at);

-- 2. Cibles du jour, datées : chaque changement crée une ligne.
create table if not exists public.nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  valid_from date not null,
  kcal int not null,
  proteines_g int not null,
  prises_min int not null default 5,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, valid_from)
);

alter table public.nutrition_targets enable row level security;
drop policy if exists "targets_own" on public.nutrition_targets;
create policy "targets_own" on public.nutrition_targets
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3. Journal des selles
create table if not exists public.stools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  bristol smallint not null check (bristol between 1 and 7),
  flottent boolean,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists stools_user_time on public.stools (user_id, occurred_at);

alter table public.stools enable row level security;
drop policy if exists "stools_own" on public.stools;
create policy "stools_own" on public.stools
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
