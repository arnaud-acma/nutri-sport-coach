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

Reste V2 : journal des selles (échelle de Bristol), séances et charges,
revue hebdomadaire automatique, programme 6 mois.
Reste V3 : discussion libre avec le coach, import Garmin, multi-utilisateurs
(Aurore), notifications.
