# Coach nutrition et sport

Appli personnelle d'Arnaud : photo de repas analysée par un coach LLM,
pesée hebdomadaire, fiches de connaissance éditables avec historique,
export complet. Web, installable sur iPhone (PWA).

## Principes (voir DECISIONS.md)

- **La connaissance appartient à Arnaud** : fiches éditables, datées,
  historisées, exportables en un clic. Le coach LLM les lit avant chaque
  réponse ; elles sont sa seule source.
- **Aucune donnée de santé dans ce dépôt** : le contenu réel vit dans la
  base Supabase, importé via un fichier local gitignoré.
- **Indépendance du fournisseur LLM** : adaptateur `src/lib/llm/`,
  changer de modèle = changer une variable d'environnement.
- **Évolutif par versions** : V1 → V40, voir JOURNAL.md.

## Démarrage

Suivre `docs/GUIDE-INSTALLATION.md` (guide pas à pas complet).

Résumé : créer un projet Supabase, exécuter
`supabase/migrations/0001_init.sql`, déployer sur Vercel avec les
variables de `.env.example`, se connecter par lien magique, importer
`connaissance-initiale.json` depuis Réglages.

## Développement local

```bash
npm install
cp .env.example .env.local   # puis remplir
npm run dev
```

Tests rapides sans aucune clé : `LLM_PROVIDER=mock` (réponses simulées).

```bash
npm run build   # vérification complète types + build
node scripts/test-llm.mjs   # tests de l'adaptateur LLM (mock + parseur)
node scripts/test-journee.mts     # journée 4h-4h, créneaux, cibles, score
node scripts/test-exif.mts        # heure de prise lue dans la photo
node scripts/test-estimation.mts  # normalisation des estimations du coach
```

Premier déploiement
