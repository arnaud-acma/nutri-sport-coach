-- V1.3 : glucides, lipides et fibres (estimations et cibles), fiche cuisine.
-- Voir DECISIONS.md, décisions 19 à 22.
-- À exécuter UNE fois dans Supabase > SQL Editor (après 0003_journee.sql).
-- Uniquement des ajouts, aucune donnée existante modifiée.
-- Peut être relancée sans erreur.

-- 1. Estimations par prise, en fourchettes (grammes)
alter table public.meals add column if not exists gluc_min numeric(5,1);
alter table public.meals add column if not exists gluc_max numeric(5,1);
alter table public.meals add column if not exists lip_min numeric(5,1);
alter table public.meals add column if not exists lip_max numeric(5,1);
alter table public.meals add column if not exists fib_min numeric(5,1);
alter table public.meals add column if not exists fib_max numeric(5,1);

-- 2. Cibles : vide (null) = calculée à partir de la cible calorique
--    (repères ANSES 2016 : lipides 35-40 % de l'énergie, fibres 30 g/j,
--    glucides = énergie restante).
alter table public.nutrition_targets add column if not exists glucides_g int;
alter table public.nutrition_targets add column if not exists lipides_g int;
alter table public.nutrition_targets add column if not exists fibres_g int;

-- 3. Sixième fiche de connaissance : cuisine et matériel (contenu vide ;
--    le vrai contenu s'importe par Réglages, jamais dans le dépôt).
insert into public.knowledge_pages (slug, title, sort_order, content_md)
  values ('cuisine', 'Cuisine et matériel', 60, '')
  on conflict (slug) do nothing;
