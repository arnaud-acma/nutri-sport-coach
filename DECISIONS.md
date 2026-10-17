# Journal des décisions

Chaque décision structurante du projet est notée ici, datée, avec sa raison.
Format : date, décision, raison, statut (active / remplacée par X).

## 2026-10-17 : décisions fondatrices (V1)

1. **Propriété de la connaissance.** Tout ce que l'appli sait d'Arnaud (profil,
   objectifs, positions, régime, santé) vit dans des fiches éditables, datées,
   avec historique, stockées dans SA base de données, exportables en un clic
   en Markdown et JSON. Le coach LLM lit ces fiches avant chaque réponse :
   elles sont sa seule source sur Arnaud. *Raison : indépendance vis-à-vis des
   abonnements et des modèles.* **Active.**

2. **Données de santé jamais dans GitHub.** Le dépôt contient le code, la
   méthode et des gabarits vides. Le contenu réel des fiches (bilans, poids,
   selles) vit uniquement dans la base Supabase d'Arnaud, importé via un
   fichier local `connaissance-initiale.json` (gitignoré) fourni hors dépôt.
   *Raison : un dépôt se partage, se clone, se fuite.* **Active.**

3. **Pile technique V1** : Next.js (App Router, TypeScript, Tailwind),
   Supabase (Postgres + Auth lien magique + Storage photos), Vercel
   (hébergement), appels LLM côté serveur uniquement. *Raison : standard,
   gratuit à l'échelle d'un utilisateur, déployable par un non-développeur.*
   **Active.**

4. **Adaptateur LLM.** Le code parle à une interface `LlmProvider`, pas à
   Anthropic directement. Fournisseurs V1 : `anthropic` (défaut) et `mock`
   (sans clé, pour tests). Changer de modèle = changer une variable
   d'environnement. *Raison : ne pas dépendre d'un fournisseur.* **Active.**

5. **Mono-utilisateur assumé.** L'appli est pour Arnaud seul. Un verrou par
   adresse e-mail (`OWNER_EMAIL`) refuse tout autre compte. Le
   multi-utilisateurs (Aurore, famille) est un chantier V3+, pas un bricolage
   V1. *Raison : start small.* **Active.**

6. **Évolutif par versions.** Chaque fonction est un module. Chaque changement
   de structure de base passe par un fichier de migration SQL numéroté dans
   `supabase/migrations/`. Le journal du projet (`JOURNAL.md`) note chaque
   version. *Raison : objectif affiché de V1 → V40.* **Active.**

7. **Périmètre V1** : fiches de connaissance, photo de repas avec retour du
   coach, pesée hebdomadaire, export complet. Le journal des selles, les
   séances, la revue hebdomadaire et le programme 6 mois sont V2. Garmin et
   discussion libre : V3. *Raison : valider l'habitude avant d'empiler.*
   **Active.**

8. **Analyse photo = qualitative, pas comptable.** Le coach juge la qualité du
   repas et dit quoi ajouter ; il ne prétend pas compter les calories au
   gramme, l'estimation sur photo étant imprécise par nature. *Raison :
   honnêteté sur les limites de l'outil.* **Active.**
