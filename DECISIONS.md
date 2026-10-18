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

9. **Discussion avec le coach avancée en V1.1** (18/10, demande d'Arnaud après
   le premier vrai test) : un fil de réponse sous chaque repas et un onglet
   Coach pour les questions libres. Le coach lit les fiches, les repas des
   7 derniers jours et les pesées. La photo n'est pas renvoyée dans la
   discussion (coût) : le coach s'appuie sur sa propre analyse écrite.
   *Raison : le retour d'un repas appelle naturellement une réponse.*
   **Active.** (Modifie la décision n°7 : discussion libre avancée de V3 à V1.1.)

10. **Le coach propose, Arnaud valide.** Quand Arnaud énonce un fait durable,
    le coach propose une modification d'UNE fiche (remplacement d'un passage
    exact, ou ajout d'une ligne). Rien n'est appliqué sans un clic
    « Accepter » ; l'ancienne version est archivée dans l'historique.
    *Raison : décision n°1, Arnaud reste propriétaire de sa connaissance.*
    **Active.**

## 2026-10-18 : V1.2, nutrition au quotidien

11. **Analyse chiffrée en fourchette, cibles provisoires** (remplace la
    décision n°8). Pour chaque prise, le coach estime une fourchette de
    calories et de protéines, et la couverture de cinq catégories
    (protéines, légumes, féculents, bon gras, fruits), en notant ses
    hypothèses (huile supposée, portion). Arnaud peut préciser en texte
    (« 2 càs huile colza ») pour corriger l'estimation. *Raison : le coach
    raisonnait déjà avec une cible implicite ; l'erreur d'estimation sur
    photo est en grande partie systématique, donc les tendances restent
    lisibles, et la courbe de poids sert de juge de paix pour recaler.*
    **Active.**

12. **Cibles du jour datées et modifiables** (Réglages). Valeurs de départ,
    provisoires : 3 000 kcal estimées, 115 g de protéines (environ
    1,8 g/kg), 5 prises ou plus, les cinq catégories couvertes. Chaque
    changement crée une nouvelle cible datée ; les journées passées gardent
    la cible en vigueur à leur date. *Raison : calibrer avec la courbe de
    poids (3 à 4 semaines) et les bilans de fin octobre 2026.* **Active.**

13. **Journée nutritionnelle de 4h à 4h** (heure de Paris). Une collation
    à 0h30 compte pour la veille. *Raison : coucher tardif d'Arnaud.*
    **Active.**

14. **Score du jour** sur 100 : énergie 35, protéines 35, qualité 20
    (4 par catégorie), prises 10. Chaque composante est plafonnée à sa
    cible. Le score est recalculé à partir des estimations stockées par
    repas : les valeurs brutes restent la source, réanalysables plus tard.
    **Active.**

15. **Six créneaux, photo facultative partout.** Petit-déjeuner, collation
    du matin, déjeuner, goûter, dîner, collation du soir. Saisie possible
    en texte seul. Heure de prise modifiable (lue dans la photo quand
    c'est possible). Un repas se modifie, se réanalyse et se supprime.
    **Active.**

16. **Collations analysées en silence.** Collation du matin, goûter et
    collation du soir : le coach estime et classe, sans verdict ni
    commentaire. Elles comptent dans les jauges. *Raison : Arnaud sait
    quoi prendre, il veut seulement que ce soit compté.* **Active.**

17. **Journal des selles avancé en V1.2** (modifie la décision n°7) :
    type de Bristol, flottent oui ou non, remarque libre. Transmis au
    coach. Urines non suivies. *Raison : selles molles et flottantes
    depuis des années, absorption jamais mesurée ; donnée utile au
    médecin.* **Active.**

18. **Boissons, café, alcool et tabac non suivis.** Décision d'Arnaud du
    18/10 : trop de saisie pour la valeur obtenue. **Active.**

## 2026-10-18 (soir) : V1.3, performances, macronutriments, fiche cuisine

19. **Glucides, lipides et fibres estimés pour chaque prise**, en
    fourchettes, avec contrôle de cohérence : si les calories s'écartent de
    plus de 25 % de 4 x protéines + 4 x glucides + 9 x lipides, l'estimation
    est signalée « à vérifier ». Les fibres sont l'estimation la moins
    fiable et sont présentées comme telles. *Raison : données utiles pour
    Arnaud (bon gras), pour Aurore (endurance) et pour croiser avec le
    journal des selles.* **Active.**

20. **Cibles de glucides, lipides et fibres, hors score.** Chaque cible
    est saisissable ; vide, elle est calculée à partir de la cible
    calorique selon les repères ANSES pour l'adulte (rapport
    « Actualisation des repères du PNNS », décembre 2016, tableau 4) :
    lipides 37,5 % de l'énergie (milieu de 35 à 40 %), fibres 30 g par
    jour, glucides = énergie restante après protéines et lipides. Repères
    de population générale, non spécifiques au sport. Elles n'entrent pas
    dans le score, pour que l'historique reste comparable. *Raison :
    penser « système » pour les futurs utilisateurs (saisir calories et
    protéines suffit), sans inventer de valeurs sans source.* **Active.**

21. **Fiche « Cuisine et matériel »** (sixième fiche, slug `cuisine`) :
    goûts, matériel, format d'aide attendu. Contenu personnel importé par
    Réglages, jamais dans le dépôt (décision 2). Version condensée, car
    les fiches sont renvoyées au coach à chaque appel (le modèle n'a pas
    de mémoire entre deux appels). Chaque futur utilisateur aura la sienne.
    **Active.**

22. **Fonctions Vercel à Paris (`cdg1`)** via `vercel.json`, au lieu de
    Washington par défaut. Mesuré avec `/api/ping` : aller-retour vers
    Supabase d'environ 100 ms depuis Washington, environ 40 à 60 ms depuis
    Paris. Région exacte de Supabase non relevée (Europe, déduit de la
    mesure). S'ajoutent : une seule vérification de connexion par requête,
    un écran de chargement instantané et un retour tactile. **Active.**
