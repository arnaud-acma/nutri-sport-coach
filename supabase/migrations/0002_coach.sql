-- V1.1 : discussion avec le coach (fil sous chaque repas + onglet Coach)
-- et propositions de modification de fiche validées par Arnaud.
-- À exécuter UNE fois dans Supabase > SQL Editor (après 0001_init.sql).

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- null = discussion libre (onglet Coach) ; sinon fil d'un repas
  meal_id uuid references public.meals(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content_md text not null,
  -- Proposition de modification de fiche faite par le coach (facultative) :
  -- {"slug": "...", "ancien_texte": "...", "nouveau_texte": "...", "raison": "..."}
  proposal jsonb,
  proposal_status text check (proposal_status in ('proposee', 'acceptee', 'refusee')),
  model_used text,
  created_at timestamptz not null default now()
);

create index if not exists coach_messages_thread
  on public.coach_messages (user_id, meal_id, created_at);

alter table public.coach_messages enable row level security;

create policy "coach_messages_own" on public.coach_messages
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
