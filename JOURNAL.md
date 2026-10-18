# Journal du projet

Une entrée par version. Objectif affiché : V1 → V40.

## V1 (nuit du 17 au 18 octobre 2026)

**Construit par Claude (session de nuit), cadré avec Arnaud le 17/10.**

Contenu :
- Authentification par lien magique (Supabase), verrou mono-utilisateur
  `OWNER_EMAIL`.
- Fiches de connaissance (profil, objectifs, positions, régime, santé) :
  éditables dans l'appli, chaque sauvegarde archive la version
  précédente (historique daté). Import JSON local, export Markdown et
  JSON complets.
- Repas : photo (appareil du téléphone), note, type de repas ; analyse
  par le coach LLM qui lit d'abord les fiches ; verdict
  valide / à compléter + ajouts concrets ; photo stockée en bucket privé,
  servie par URL signées ; historique des repas.
- Pesée hebdomadaire : saisie rapide, courbe, écart vs pesée précédente.
- Adaptateur LLM : `anthropic` (défaut, modèle via `LLM_MODEL`) et
  `mock` (simulé, sans clé) ; bascule automatique en mock si pas de clé.
- PWA : manifest, icônes, installable sur l'écran d'accueil iPhone.

Vérifié cette nuit :
- `npm run build` : succès (Next 16.4.2, TypeScript strict).
- `node scripts/test-llm.mjs` : 5/5 (parseur de réponse coach).
- Test de fumée sur le serveur de production local : redirection des
  pages protégées vers /connexion, page de connexion rendue, API repas
  refusée sans session (401).

Non vérifié (impossible sans les comptes d'Arnaud) :
- Appels réels à l'API Anthropic (testé en mock uniquement).
- Parcours complet lien magique + Storage sur un vrai projet Supabase.
- Déploiement Vercel.

## V1 en production (18 octobre 2026, matin)

Mise en ligne guidée avec Arnaud : Supabase, Vercel
(nutri-sport-coach.vercel.app), connexion par lien magique (Mac et iPhone),
installation sur l'écran d'accueil, import des 5 fiches, crédits API du
forfait Max liés à « Arnaud's Individual Org ».

Bugs trouvés et corrigés en conditions réelles :
- Marge haute iPhone (contenu sous la barre d'état) : zone sûre ajoutée.
- Envoi photo « Cannot convert argument to a ByteString » : caractère
  invisible U+2028 collé en fin de clé dans Vercel. Toutes les variables
  sont désormais nettoyées (`src/lib/env.ts`). Reproduit puis vérifié.
- Réponse du coach affichée en JSON brut : réponse probablement tronquée
  (1024 jetons). Passage à 4096 et sortie via outil `verdict_repas`.
- `tool_choice` forcé refusé par Sonnet 5.5 (erreur 400) : passage en
  `auto`, avec repli sur la lecture du texte.
- Heures affichées en UTC : fuseau Europe/Paris partout.
Vérifié par Arnaud : analyse réelle d'un déjeuner avec claude-sonnet-5-5,
qui s'appuie bien sur les fiches.

Non résolu : bande vide sous la barre d'onglets sur iPhone (cosmétique,
cause inconnue).

## V1.1 (18 octobre 2026, midi) : discussion avec le coach

- Fil de discussion sous chaque repas (`/repas/[id]`) et onglet Coach
  (`/coach`). Contexte : fiches, repas des 7 derniers jours, pesées.
- Propositions de modification de fiche, validées par Arnaud (décision 10).
- Migration `0002_coach.sql` (table `coach_messages`) à exécuter une fois.
- Italique Markdown corrigé (ne casse plus `invalid_request_error`).
Vérifié : build, lint, application des propositions (4 cas).
Non vérifié au moment du commit : appel réel de la discussion (pas de clé
côté développement), rendu sur iPhone.

Reste V2 : journal des selles (échelle de Bristol), séances et charges,
revue hebdomadaire automatique, programme 6 mois.
Reste V3 : import Garmin, multi-utilisateurs
(Aurore), notifications.
