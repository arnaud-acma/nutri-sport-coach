# Guide d'installation (environ 25 minutes)

Objectif : mettre l'appli en ligne, sur TES comptes, avec TES clés.
Trois services à créer, tous gratuits à ton échelle (offre gratuite
supposée suffisante pour un utilisateur ; à confirmer à l'usage).
Les intitulés exacts des menus peuvent différer légèrement : ils changent
souvent. Si un écran ne correspond pas, demande à Claude dans la
conversation.

Règle de sécurité : les clés se collent dans Vercel ou dans `.env.local`,
jamais dans un fichier commité, jamais dans une conversation.

## Étape 1 : Supabase (base de données + photos + connexion)

1. Va sur https://supabase.com > Sign in > continue avec GitHub.
2. Crée un projet : nom `nutri-sport-coach`, région Europe (Frankfurt ou
   Paris), génère le mot de passe base de données proposé (garde-le dans
   ton gestionnaire de mots de passe, il ne resservira pas au quotidien).
3. Attends la fin de la création (1 à 2 minutes).
4. Menu SQL Editor > New query : colle TOUT le contenu du fichier
   `supabase/migrations/0001_init.sql` du dépôt > Run. Attendu :
   "Success. No rows returned".
5. Récupère trois valeurs (écran mis à jour par Supabase en 2026) :
   - Project URL : bouton vert "Connect" en haut, ou simplement
     `https://<identifiant-du-projet>.supabase.co` (l'identifiant est
     dans l'adresse du tableau de bord, après /project/).
   - Settings > API Keys > onglet **"Legacy anon, service_role API
     keys"** :
     - clé `anon` (publique)
     - clé `service_role` (secrète : ne la mets nulle part d'autre que
       dans les variables Vercel)
   - Les nouvelles clés `sb_publishable_` / `sb_secret_` du premier
     onglet devraient aussi fonctionner, mais n'ont pas été testées avec
     l'appli : utiliser les clés Legacy pour le premier démarrage.

## Étape 2 : Vercel (hébergement)

1. Va sur https://vercel.com > Sign up > continue avec GitHub.
2. Add New > Project > importe le dépôt `nutri-sport-coach`.
3. Avant de cliquer Deploy, ouvre Environment Variables et ajoute :
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL de l'étape 1
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = clé anon
   - `SUPABASE_SERVICE_ROLE_KEY` = clé service_role
   - `OWNER_EMAIL` = ton adresse mail (celle qui aura le droit de se
     connecter ; toute autre adresse sera refusée)
   - `LLM_PROVIDER` = `mock` pour l'instant (on active le vrai coach à
     l'étape 4)
4. Deploy. À la fin, Vercel affiche l'URL de l'appli (du type
   https://nutri-sport-coach.vercel.app). Note-la.

## Étape 3 : relier la connexion par mail

1. Retour dans Supabase > Authentication > URL Configuration :
   - Site URL : l'URL Vercel de l'étape 2
   - Redirect URLs : ajoute `https://TON-URL.vercel.app/auth/callback`
2. Ouvre l'appli sur ton iPhone (Safari), entre ton adresse, clique sur
   le lien reçu par mail : tu dois arriver sur l'accueil.
   - Si le mail n'arrive pas : regarde les spams. Supabase limite aussi
     l'envoi à quelques mails par heure sur l'offre de base (limite
     exacte non vérifiée) ; au quotidien tu restes connecté, ce n'est
     pas gênant.
3. Installe l'appli : dans Safari, bouton Partager > "Sur l'écran
   d'accueil". L'icône Coach apparaît comme une vraie app.

## Étape 4 : activer le vrai coach (Anthropic)

1. Crédits inclus dans ton forfait Max : sur claude.ai > Settings >
   Billing > section API credits > Link organization (crée une
   organisation Console si besoin). Référence :
   https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-and-team-plans
2. Sur https://console.anthropic.com > API Keys > Create key, nom
   `nutri-sport-coach`. Copie la clé (elle ne s'affiche qu'une fois).
3. Dans Vercel > ton projet > Settings > Environment Variables :
   - `ANTHROPIC_API_KEY` = la clé
   - `LLM_PROVIDER` = `anthropic`
   - `LLM_MODEL` = `claude-sonnet-5-5` (modifiable plus tard)
4. Deployments > bouton ... du dernier déploiement > Redeploy (les
   variables ne s'appliquent qu'au prochain déploiement).

## Étape 5 : importer ta connaissance

1. Récupère le fichier `connaissance-initiale.json` envoyé par Claude
   dans la conversation (il n'est volontairement PAS dans le dépôt :
   il contient tes données).
2. Dans l'appli : Réglages > Importer la connaissance initiale >
   choisis le fichier. Les 5 fiches se remplissent.
3. Va dans Fiches, relis chaque fiche et corrige ce qui est faux :
   c'est TA base, le coach ne sait que ce qu'elle contient.

## Étape 6 : premier test réel

1. Photographie ton prochain repas dans l'appli, ajoute une note.
2. Vérifie que la réponse n'est plus marquée "simulée" et que le coach
   s'appuie bien sur tes fiches.
3. Saisis ta première pesée dans Poids.
4. Réglages > Export JSON : vérifie que le fichier se télécharge. Cet
   export est ta garantie de sortie à tout moment.

## En cas de blocage

Reviens dans la conversation Claude avec une capture d'écran de
l'erreur : le diagnostic est immédiat dans 90 % des cas.
