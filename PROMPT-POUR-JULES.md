# Mission : Refonte de l'interface MiniCloud avec le template Pi-Cloud

## 0. Contexte et fichiers fournis

Tu reçois deux archives :
1. **`minicloud-v4.zip`** — le projet SaaS backend réel, en production. Node.js/Express, architecture microservices (gateway + 7 services indépendants), stockage fichier (JSON + volume disque). **Ce backend ne doit JAMAIS être modifié dans sa logique métier**, seulement dans son point de service statique (voir §3).
2. **`pi-cloud-template-complet.zip`** — un template UI React 19 + TypeScript + Vite 7 + Tailwind v4, avec `vite-plugin-singlefile` (le build produit **un seul fichier HTML autonome**). Ce zip contient TROIS sections dans une seule arborescence `src/` :
   - Une landing page marketing (`src/components/Hero.tsx`, `Features.tsx`, `Pricing.tsx`, `FAQ.tsx`, `Navbar.tsx`, `Footer.tsx`, `CTA.tsx`, `Testimonials.tsx`, `SocialProof.tsx`, `ServiceShowcase.tsx`, `Benefits.tsx`)
   - Un écran de connexion (`src/components/auth/LoginPage.tsx`)
   - Un dashboard applicatif complet (`src/components/dashboard/*.tsx` : Sidebar, TopBar, MobileSidebar, Overview, ServicesPanel, LogsViewer, FilesPanel, NotesPanel, GalleryPanel, VaultPanel, BookmarksPanel, SettingsPanel)

**Fait vérifié et important** : dans ce template, **TOUT le dashboard fonctionne sur des données statiques fictives** (`src/data/mockData.ts`) — aucun `fetch`, aucun appel réseau. Le formulaire de login (`LoginPage.tsx`) **accepte n'importe quel identifiant/mot de passe** sans vérification réelle (`setSuccess(true)` inconditionnel dans `handleSubmit`). Ton travail principal consiste à **remplacer entièrement cette couche mock par de vrais appels à l'API MiniCloud existante**, tout en conservant l'identité visuelle et les animations du template.

---

## 1. Principes non négociables (à respecter strictement)

1. **Ne jamais casser le backend.** Les 8 services Node.js (`gateway`, `auth`, `files`, `notes`, `gallery`, `vault`, `bookmarks`, `admin`) sont fonctionnels, testés (voir `test/integration.test.js`), et durcis en sécurité (rate limiting, CSRF, quotas, JWT, chiffrement AES-256-GCM du vault). Tu ne modifies **aucune** logique métier dans `services/*/index.js` ni dans `shared/lib.js`, sauf demande explicite ci-dessous.
2. **Ne jamais inventer un endpoint qui n'existe pas.** Si une fonctionnalité du template UI n'a pas d'équivalent backend, tu dois soit la retirer, soit la marquer clairement comme non fonctionnelle (voir §5 — jamais silencieusement).
3. **Aucune donnée simulée présentée comme réelle** dans les sections branchées au vrai backend (Files, Notes, Gallery, Vault, Bookmarks, Admin, Auth). Ces sections utilisent OBLIGATOIREMENT les vraies données de l'API.
4. **Pour Services et Live Logs uniquement** (voir §5.1 et §5.2), la simulation est **autorisée et demandée explicitement** — mais elle doit être fluide, vivante et convaincante visuellement (mise à jour périodique des valeurs, animations), sans jamais prétendre lire un vrai flux serveur.
5. **Sécurité inchangée ou améliorée, jamais dégradée.** Le cookie JWT est `httpOnly` — le frontend React ne peut PAS le lire en JS, c'est voulu et normal (tous les appels API doivent utiliser `credentials: 'include'`, jamais essayer de lire le cookie côté client).
6. **CSP stricte à respecter.** Le gateway impose actuellement `script-src 'self'` (aucun script externe autorisé). Le build `vite-plugin-singlefile` produit un fichier autonome servi en `'self'`, donc compatible — mais si tu gardes les imports Google Fonts CDN du template, il faudra soit les auto-héberger, soit élargir la CSP (voir §3.4, décision à documenter, pas à faire en silence).
7. **Documente chaque écart** entre ce qui est demandé ici et ce que tu livres, dans un fichier `CHANGES.md` à la racine du projet livré : quoi, pourquoi, quel risque/impact.

---

## 2. Vue d'ensemble de l'API backend réelle (contrat exact — à respecter au caractère près)

Toutes les routes passent par le gateway (port 3000) sous `/api/*`. Le cookie de session est automatique via `credentials: 'include'` — ne jamais gérer de token manuellement côté front.

### 2.1 Auth (`/api/auth`)
> ⚠️ Le backend utilise un **`username`**, PAS un email. Le `LoginPage.tsx` du template utilise un champ `email` — **tu dois le remplacer par un champ `username`** (label, placeholder, type de l'input en `text`, pas `email`). Ne garde pas de validation de format email.

- `POST /api/auth/register` — body `{ username, password }` → `200 { ok, username, role }` ou `400/409 { error }`. Contraintes : username ≥ 3 caractères, password ≥ 6 caractères. Pose un cookie JWT httpOnly automatiquement.
- `POST /api/auth/login` — body `{ username, password }` → `200 { ok, username, role }` ou `401 { error: "Invalid credentials" }`. Rate-limité à 20 tentatives / 15 min par IP côté serveur (prévoir l'affichage propre du message d'erreur retourné).
- `POST /api/auth/logout` → `200 { ok: true }`.
- `GET /api/auth/me` (authentifié) → `200 { username, role, status, quotaBytes, usedBytes }` ou `401`. C'est l'endpoint à appeler au chargement de l'app pour savoir si une session est active (remplace le `useState(false)` actuel de `isAuthenticated`).

### 2.2 Files (`/api/files`)
- `GET /api/files` (auth) → `{ files: [{ name, size, modified }] }` (`modified` = timestamp ms).
- `POST /api/files/upload` (auth, `multipart/form-data`, champ `files`, jusqu'à 50 fichiers) → `{ ok, files: [{ name, size }] }` ou `413 { error: "Storage quota exceeded" }`.
- `GET /api/files/download/:name` (auth) → téléchargement direct du fichier.
- `DELETE /api/files/:name` (auth) → `{ ok: true }` ou `404`.

### 2.3 Notes (`/api/notes`)
- `GET /api/notes` (auth) → `{ notes: [{ id, title, updatedAt }] }` (liste allégée, sans le corps).
- `GET /api/notes/:id` (auth) → `{ note: { id, title, body, createdAt, updatedAt } }`.
- `POST /api/notes` (auth) — body `{ title, body }` → `{ ok, note }`.
- `PUT /api/notes/:id` (auth) — body `{ title?, body? }` → `{ ok, note }`.
- `DELETE /api/notes/:id` (auth) → `{ ok: true }`.

### 2.4 Gallery (`/api/gallery`)
- `GET /api/gallery` (auth) → `{ files: [{ name, size, modified, url }] }` — `url` pointe déjà vers `/api/gallery/:name`, utilisable directement en `<img src>`.
- `POST /api/gallery/upload` (auth, `multipart/form-data`, champ `files`) → `{ ok, files }` ou `413`.
- `GET /api/gallery/:name` (auth) → sert l'image inline (si signature de fichier valide) ou en téléchargement.
- `DELETE /api/gallery/:name` (auth) → `{ ok: true }`.

### 2.5 Vault (`/api/vault`)
- `GET /api/vault` (auth) → `{ entries: [{ id, title, site, username, createdAt, updatedAt }] }` — **le secret n'est jamais renvoyé dans la liste**, il reste chiffré côté serveur.
- `GET /api/vault/:id` (auth) → `{ entry: { ...champs ci-dessus, secret, notes } }` — c'est le SEUL endpoint qui déchiffre et renvoie le secret en clair. À utiliser uniquement au clic sur "Reveal" (jamais préchargé pour toute la liste).
- `POST /api/vault` (auth) — body `{ title, site, username, secret, notes }` → `{ ok, id }`.
- `PUT /api/vault/:id` (auth) — body partiel → `{ ok: true }`.
- `DELETE /api/vault/:id` (auth) → `{ ok: true }`.

### 2.6 Bookmarks (`/api/bookmarks`)
- `GET /api/bookmarks` (auth) → `{ bookmarks: [{ id, title, url, tags, createdAt }] }`.
- `POST /api/bookmarks` (auth) — body `{ title, url, tags }` → `{ ok, bookmark }` ou `400` si l'URL ne commence pas par `http://`/`https://`.
- `PUT /api/bookmarks/:id` (auth) — body partiel → `{ ok, bookmark }`.
- `DELETE /api/bookmarks/:id` (auth) → `{ ok: true }`.

### 2.7 Admin (`/api/admin`, rôle admin uniquement)
- `GET /api/admin/users` → `{ users: [{ username, role, status, quotaBytes, usedBytes, createdAt }] }`.
- `POST /api/admin/users` — body `{ username, password, role?, quotaMB?, status? }` → `{ ok, username }` ou `400/409`.
- `PATCH /api/admin/users/:username` — body partiel `{ role?, status?, quotaMB? }` → `{ ok: true }`. Un admin ne peut pas changer son propre rôle/statut (retourne `400`).
- `DELETE /api/admin/users/:username` → `{ ok: true }`. Un admin ne peut pas se supprimer lui-même (`400`).
- `GET /api/admin/stats` → `{ totalUsers, activeUsers, totalUsedBytes, perServiceBytes: { files, notes, gallery, vault, bookmarks }, quotaTotalBytes }`.

### 2.8 Santé
- `GET /healthz` (non authentifié) — liveness check, sur le gateway uniquement côté client.

### 2.9 Comportements transverses à respecter
- Toute réponse `401` sur n'importe quel appel `/api/*` doit ramener l'utilisateur à l'écran de login (session expirée ou compte suspendu — le backend revérifie l'utilisateur en base à chaque requête, donc un compte suspendu perd l'accès immédiatement, pas seulement à l'expiration du JWT).
- Utiliser systématiquement `fetch(url, { credentials: 'include', ... })`.
- Gérer et afficher les messages d'erreur retournés par le serveur (`data.error`) plutôt que des messages génériques, chaque fois que possible.

---

## 3. Architecture technique de l'intégration

### 3.1 Emplacement du code source
Crée un dossier `frontend/` à la racine du projet MiniCloud, contenant l'intégralité du projet Vite/React (déplace-y le contenu du template, adapté). Ne mélange pas les sources React avec `public/app/` (qui devient uniquement le dossier de sortie du build).

### 3.2 Configuration du build
- Adapte `frontend/vite.config.ts` pour que `vite build` sorte dans `../public/app/dist/` (ou équivalent — garde `vite-plugin-singlefile` actif, un seul fichier HTML en sortie).
- Ajoute dans le `package.json` **racine** (celui de MiniCloud, pas celui du frontend) un script `"build:app": "cd frontend && npm install && npm run build"`, et documente dans le README qu'il faut le lancer avant `start.sh` / `pm2 start` en production.
- Ne touche pas à `public/index.html` (landing statique actuelle) sauf si tu remplaces aussi la landing par la version React du template — dans ce cas, le build de la landing doit sortir séparément vers `public/` (racine), sans écraser le comportement de `/app`.

### 3.3 Adaptation du gateway (`gateway/index.js`)
Actuellement :
```js
app.get('/app', (req, res) => res.sendFile(path.join(publicDir, 'app', 'index.html')));
app.get('/app/*', (req, res) => res.sendFile(path.join(publicDir, 'app', 'index.html')));
```
Ces deux routes doivent continuer à fonctionner à l'identique, en pointant simplement vers le fichier HTML buildé (`public/app/dist/index.html` ou le chemin que tu choisis en 3.2 — reste cohérent entre les deux). `app.use(express.static(publicDir))` sert déjà tout `public/` statiquement, donc si le build sort bien sous `public/app/`, aucune autre modification du gateway n'est nécessaire. **Ne touche à rien d'autre dans ce fichier.**

### 3.4 CSP (Content-Security-Policy) — décision à documenter, pas à improviser
Le template importe Google Fonts (Inter, JetBrains Mono) via `<link>` CDN dans `index.html`, ce qui est déjà autorisé par la CSP actuelle (`fontSrc` et `styleSrc` incluent `fonts.googleapis.com`/`fonts.gstatic.com`). **Tu n'as donc rien à changer côté CSP si tu gardes ces imports CDN tels quels.** Si pour une raison technique tu dois ajouter un nouveau domaine externe (autre CDN, autre police), tu dois :
1. L'ajouter explicitement dans `gateway/index.js` (bloc `helmet.contentSecurityPolicy.directives`).
2. Le noter dans `CHANGES.md` avec la justification.
Ne jamais mettre `'unsafe-eval'` ou élargir `script-src` au-delà de `'self'` — le bundle React doit rester 100% self-hosted (`vite-plugin-singlefile` garantit ça nativement, ne le contourne pas).

### 3.5 Dépendances — évaluation obligatoire avant usage
Le template déclare ces dépendances (`package.json` du dossier `frontend/`) : `react`, `react-dom`, `framer-motion`, `recharts`, `lucide-react`, `clsx`, `tailwind-merge`. Avant de les garder toutes, vérifie leur usage réel dans le résultat final :
- `recharts` n'a de sens que si tu conserves des graphiques (Overview, ServicesPanel simulé — voir §5.1). Si tu les retires entièrement, retire aussi la dépendance.
- `framer-motion` est utilisé massivement pour les animations (LoginPage, transitions de panels) — à garder si tu conserves ces animations, ce qui est demandé (voir §4 et §5).
- Ne rajoute AUCUNE dépendance supplémentaire non listée ici sans la justifier explicitement dans `CHANGES.md` (nom, version, pourquoi, alternative déjà présente écartée).

---

## 4. Page Login — branchement réel, changements visuels minimaux

Consigne du commanditaire : *« pour le login tu vas pas trop changer les choses juste l'interface »* — c'est-à-dire : **le rendu visuel de `LoginPage.tsx` reste quasiment tel quel** (branding, particules animées, glassmorphism, panneau gauche avec le terminal animé listant les services). Les seuls changements requis :

1. **Champ `email` → `username`** : renomme l'état, le label ("Email Address" → "Username"), le placeholder (`admin@pi-cloud.local` → quelque chose comme `admin`), retire le `type="email"` (utilise `type="text"`), retire toute validation de format email.
2. **`handleSubmit` doit appeler réellement `POST /api/auth/login`** avec `{ username, password }` et `credentials: 'include'` :
   - Succès (`200`) → déclenche `onLogin()` comme aujourd'hui (garde l'animation de succès existante), mais seulement après confirmation serveur.
   - Échec (`401`) → affiche `data.error` dans le composant d'erreur existant (`AlertCircle` + message), déclenche l'animation `shake` existante. Ne jamais afficher "Welcome back!" sur un échec.
   - Retire le hint textuel `"hint: enter any credentials to continue →"` — il n'a plus lieu d'être puisque l'auth est réelle.
3. **Ajoute un mode inscription**, cohérent visuellement avec le design existant (tu peux réutiliser la structure de `LoginPage` — un lien "First time? Create an account" qui bascule vers un formulaire équivalent avec confirmation de mot de passe côté client, appelant `POST /api/auth/register`). Actuellement ce lien n'a pas de `onClick`.
4. **Retire les boutons "SSH Key" et "Passkey"** (aucun backend ne les supporte) OU désactive-les visuellement avec un badge "Bientôt disponible" — choisis l'option qui dégrade le moins l'esthétique, documente ton choix dans `CHANGES.md`.
5. **Retire le lien "Forgot password"** fonctionnellement (le mock actuel simule un envoi d'email qui ne part jamais) OU garde-le avec un message honnête "La récupération de mot de passe n'est pas encore configurée" (c'est exactement le comportement actuel de l'ancien frontend vanilla JS, à reproduire pour cohérence) plutôt que de simuler un faux email envoyé.
6. Au chargement de l'app (`App.tsx`), avant d'afficher quoi que ce soit, appelle `GET /api/auth/me` : si `200`, va direct au dashboard avec les données utilisateur reçues ; si `401`, affiche `LoginPage`. Remplace complètement le `useState(false)` actuel.

---

## 5. Dashboard — page par page

### 5.0 Structure de navigation (Sidebar / MobileSidebar / TopBar)
Ordre et contenu du menu, tel que décidé par le commanditaire :
```
Overview | Services | Live Logs | Notes | Files | Gallery | Vault | Bookmarks | Admin | Settings
```
- **Admin** n'existe pas dans le template — tu dois le créer (voir §5.8).
- **Admin** ne doit apparaître dans le menu QUE si `role === 'admin'` (reproduit le comportement actuel de `admin-only hidden` dans l'ancien frontend). Récupère le rôle depuis la réponse de `GET /api/auth/me`.
- Le bouton de déconnexion (actuellement absent du template, présent dans l'ancien frontend `#logout-btn`) doit être ajouté dans la Sidebar/TopBar, appelant `POST /api/auth/logout` puis retour à `LoginPage`.
- Affiche le nom d'utilisateur et son rôle (Administrator / Member) quelque part dans la sidebar ou la topbar, comme le faisait l'ancien frontend (`#side-user`).
- Affiche un indicateur de quota (utilisé / total), comme l'ancien `#quota-bar` — le template n'a pas cet élément nativement, ajoute-le dans le style visuel du template (ex: une petite barre de progression dans la Sidebar ou la TopBar), alimenté par `quotaBytes`/`usedBytes` de `GET /api/auth/me`, à rafraîchir après chaque upload/suppression.

### 5.1 Overview
Combine des données réelles et des données simulées, clairement dans cet esprit :
- **Réel** : quota de stockage global de l'utilisateur (`usedBytes`/`quotaBytes` depuis `/api/auth/me`), nombre de fichiers/notes/entrées vault/bookmarks réels (à récupérer via les endpoints respectifs — `GET /api/files`, `/api/notes`, `/api/vault`, `/api/bookmarks`, `/api/gallery`, et comparer les `.length`).
- **Simulé** (autorisé explicitement) : graphiques de charge système, requêtes/latence dans le temps (`generateTimeSeriesData`/`generateRequestData` du `mockData.ts` existant peuvent rester, alimentant `recharts`) — **à condition qu'aucun texte ne prétende que ces graphiques reflètent une télémétrie réelle**. Ajoute un badge discret ou une légende du type "Aperçu système (démo)" si le commanditaire souhaite garder l'ambiguïté volontairement esthétique — sinon retire ce label pour préserver l'expérience visuelle voulue (« ça doit vraiment bouger pour une bonne expérience visuelle » — la demande explicite est de garder l'aspect vivant, donc NE PAS ajouter de disclaimer qui casserait l'immersion, sauf si such demande contredirait le principe de transparence ; documente ce compromis dans `CHANGES.md`).

### 5.2 Services (simulation demandée explicitement — §1.4)
Reprend `ServicesPanel.tsx` et `mockData.ts` (`services: Service[]`) tels quels dans leur logique de présentation, mais améliore le réalisme du mouvement :
- Fais varier `cpu`, `memory`, et `uptime` à intervalle régulier (ex: `setInterval` toutes les 2-3 secondes) avec de petites variations aléatoires bornées (pas de sauts brusques irréalistes), pour un rendu "vivant".
- Les noms des 7 services simulés doivent correspondre exactement aux 7 vrais services MiniCloud : Gateway, Auth, Files, Notes, Gallery, Vault, Bookmarks (déjà le cas dans `mockData.ts` — vérifie la correspondance, ajoute Admin qui manque actuellement dans la liste `services` de `mockData.ts` si tu veux une couverture complète des 8 process réels du fichier `ecosystem.config.js`).
- Optionnel mais recommandé pour le réalisme : synchronise le statut "online/stopped/errored" avec un vrai ping à `GET /healthz` de chaque service si le gateway les expose publiquement (à vérifier — actuellement `/healthz` existe sur le gateway ET sur chaque microservice en interne sur les ports 4001-4007, mais ces ports internes ne sont PAS exposés au navigateur ; donc ce point est **hors de portée sans modification backend** — reste sur la simulation pure et ne tente pas d'appeler ces ports depuis le front).

### 5.3 Live Logs (simulation demandée explicitement — §1.4)
Reprend `LogsViewer.tsx` tel quel dans son principe (flux de logs qui défile), mais :
- Génère des lignes de log plausibles correspondant aux vraies routes API du backend (ex: `[gateway] POST /api/files/upload 200 45ms`, `[auth] POST /api/auth/login 401 12ms`) plutôt que du texte totalement générique, pour renforcer la cohérence avec le vrai projet.
- Fais défiler l'ajout de nouvelles lignes à intervalle irrégulier (ex: 500ms à 3s) pour un effet naturel, pas un timer parfaitement régulier.

### 5.4 Notes
Remplace `mockData.notes` par de vrais appels :
- Liste (`GET /api/notes`) au chargement du panel.
- Sélection d'une note → `GET /api/notes/:id` pour charger le corps complet (la liste ne contient pas `body`).
- Création → `POST /api/notes`.
- Sauvegarde → `PUT /api/notes/:id`.
- Suppression → `DELETE /api/notes/:id`, avec confirmation utilisateur (garde une modale de confirmation, le template n'en a pas — l'ancien frontend utilisait `confirm()` natif, tu peux faire mieux avec une modale stylée cohérente avec le design system, mais NE RETIRE PAS la confirmation avant suppression).
- Retire tout champ "Pin", "Star", tags si le backend ne les supporte pas (vérifié : le backend Notes ne stocke que `title`/`body`, pas de pin/star/tags — retire ces éléments visuels de `NotesPanel.tsx` ou documente-les comme non fonctionnels si tu choisis de les garder pour l'esthétique, mais alors ils ne doivent rien persister de trompeur).

### 5.5 Files
Remplace `mockData.fileTree` (arborescence avec dossiers, actuellement fictive) — **le backend ne supporte PAS de dossiers**, c'est une liste plate de fichiers par utilisateur. Donc :
- Retire la logique d'arborescence/dossiers de `FilesPanel.tsx` (`toggle`, `expanded`, `renderItem` récursif) — remplace par une liste plate alimentée par `GET /api/files`.
- Implémente un vrai upload : zone de drop + input file, `POST /api/files/upload` en `multipart/form-data`, avec une barre de progression réelle (utilise `XMLHttpRequest.upload.onprogress`, comme le faisait l'ancien frontend — `fetch` ne permet pas nativement de suivre la progression d'upload).
- Bouton Download → redirige vers `GET /api/files/download/:name`.
- Bouton Delete → `DELETE /api/files/:name` avec confirmation, puis rafraîchit la liste ET le quota affiché dans la sidebar.
- Retire le bouton "Share" (aucun endpoint de partage n'existe côté backend) — ne le laisse pas actif sans fonction.
- Les compteurs "89,247 fichiers", "24 uploads récents" sont des chiffres en dur à supprimer : remplace par le vrai nombre de fichiers (`files.length`) et la vraie taille totale utilisée.

### 5.6 Gallery
Remplace `mockData.galleryImages` par `GET /api/gallery` :
- Affichage en grille avec `<img src={f.url}>` (l'URL est déjà correcte, pointant vers l'endpoint authentifié qui sert l'image inline après vérification de signature).
- Upload → `POST /api/gallery/upload`.
- Suppression → `DELETE /api/gallery/:name`, avec confirmation.
- Retire le système d'albums fictifs (`Landscapes`, `Architecture`, etc.) — le backend ne stocke aucune métadonnée d'album/localisation/date de prise de vue (`MapPin`, `Calendar` dans le template sont purement décoratifs sur des données inventées). Soit tu retires ces filtres, soit tu les documentes clairement comme non fonctionnels dans `CHANGES.md` — ne les laisse pas actifs avec de fausses données.
- Le compteur "47,281 photos" est fictif à remplacer par le vrai compte.

### 5.7 Vault
Remplace `mockData.vaultEntries` par `GET /api/vault` :
- Liste : `id, title, site, username` uniquement (jamais le secret dans la liste — c'est une contrainte de sécurité backend, pas une limitation à contourner).
- Bouton "Reveal" → appelle `GET /api/vault/:id` **au moment du clic**, jamais avant, et affiche le secret déchiffré reçu. Au clic sur "Hide", efface la valeur affichée (ne la garde pas en mémoire React plus que nécessaire).
- Bouton "Copy" → copie le secret dans le presse-papier (`navigator.clipboard.writeText`), mais uniquement après l'avoir déjà révélé (n'appelle pas l'endpoint juste pour copier sans afficher, pour rester cohérent avec le comportement révélé/caché).
- Formulaire d'ajout → `POST /api/vault` avec `{ title, site, username, secret, notes }`.
- Suppression → `DELETE /api/vault/:id`, avec confirmation.
- Retire le système de "strength" (`strong`/`medium`/`weak`) s'il est purement esthétique sans calcul réel, OU implémente un vrai calcul de force de mot de passe côté client (longueur, variété de caractères) si tu veux le garder — mais ne l'affiche jamais comme s'il venait du serveur.
- Retire les catégories fictives (`categories` dans le template) — le backend ne stocke pas de catégorie pour les entrées vault.

### 5.8 Bookmarks
Remplace `mockData.bookmarks` par `GET /api/bookmarks` :
- Formulaire d'ajout → `POST /api/bookmarks` avec `{ title, url, tags }`. Valide côté client que l'URL commence par `http://`/`https://` avant envoi (le serveur le revalide de toute façon, mais un retour immédiat améliore l'UX).
- Suppression → `DELETE /api/bookmarks/:id`, avec confirmation.
- Retire les catégories fictives si le backend ne les supporte pas (vérifié : le backend stocke `tags` en texte libre, pas de système de catégories structuré — tu peux dériver un système de filtres à partir des tags réels si tu veux garder l'UX de filtrage, mais pas à partir de catégories inventées).

### 5.9 Admin — À CRÉER (absent du template, présent dans le vrai backend)
Reproduis le style visuel du template (cartes `glass-card`, palette `brand`/`surface`, iconographie `lucide-react`) pour une nouvelle page `AdminPanel.tsx`, visible uniquement si `role === 'admin'` :
- Bloc statistiques (cartes façon `stat-grid` de l'ancien frontend, mais avec le style visuel du nouveau template) alimenté par `GET /api/admin/stats` : nombre total d'utilisateurs, utilisateurs actifs, stockage total utilisé, quota total.
- Formulaire de création d'utilisateur : `username`, `password`, `role` (select user/admin), `quotaMB` (nombre) → `POST /api/admin/users`. Affiche les erreurs serveur (username déjà pris, validation).
- Tableau des utilisateurs (`GET /api/admin/users`) avec colonnes : Utilisateur, Rôle (badge), Statut (badge actif/suspendu), Stockage utilisé, Quota, Actions.
- Actions par ligne :
  - Suspendre/Activer → `PATCH /api/admin/users/:username` avec `{ status: 'suspended' | 'active' }`.
  - Supprimer → `DELETE /api/admin/users/:username`, avec confirmation forte (le message doit avertir que ça supprime toutes les données de l'utilisateur, comme le faisait l'ancien frontend).
- L'admin ne doit pas pouvoir se suspendre/dégrader/supprimer lui-même — le backend renvoie déjà une erreur `400` dans ces cas, **affiche cette erreur proprement** plutôt que de la masquer ; tu peux en plus désactiver visuellement ces boutons sur sa propre ligne pour une meilleure UX (amélioration, pas une obligation).

### 5.10 Settings — à construire avec de vraies fonctionnalités (demande explicite du commanditaire : *« ajoute ces fonctionnalités »*)
Le template actuel n'a que des toggles visuels sans effet. Construis une page Settings avec des fonctionnalités qui persistent réellement, dans la limite de ce que le backend permet. Fonctionnalités réalistes à implémenter avec les endpoints existants :
1. **Changement de mot de passe** : ⚠️ vérifié — **aucun endpoint backend ne permet actuellement à un utilisateur de changer son propre mot de passe** (`services/auth/index.js` n'a que register/login/logout/me ; seul `PATCH /api/admin/users/:username` permet à un admin de modifier un autre compte, pas un self-service). Tu ne peux donc PAS implémenter cette fonctionnalité sans ajouter un nouvel endpoint backend. **Ne l'ajoute pas silencieusement côté backend** — signale ce manque explicitement dans `CHANGES.md` comme une fonctionnalité désirée mais hors de portée sans modification serveur, et propose en une phrase l'endpoint qu'il faudrait (ex: `PATCH /api/auth/me` avec `{ currentPassword, newPassword }`) sans l'implémenter toi-même sauf si on te le demande explicitement dans un second temps.
2. **Affichage du profil réel** : nom d'utilisateur, rôle, date de création du compte — tout est déjà disponible via `GET /api/auth/me` (ajoute `createdAt` si absent de la réponse actuelle — vérifié : `createdAt` n'est PAS retourné par `/api/auth/me` actuellement, uniquement par `/api/admin/users`. Pour un utilisateur normal, tu n'as donc pas cette date. Documente aussi ce manque plutôt que d'inventer une date.).
3. **Résumé de consommation par service** : accessible uniquement en agrégeant `GET /api/files`, `/api/notes`, `/api/gallery`, `/api/vault`, `/api/bookmarks` côté client (compter les entrées et sommer les tailles quand disponibles) — c'est faisable avec les données déjà exposées, fais-le.
4. **Thème (clair/sombre), notifications, langue** : purement des préférences d'affichage sans backend — si tu les gardes, utilise le `localStorage`/état React local en étant honnête que ce sont des préférences locales au navigateur, pas un profil serveur. Ne prétends jamais qu'elles sont synchronisées côté serveur.
5. **Retire tout ce qui ne rentre dans aucune des 4 catégories ci-dessus** plutôt que de garder des toggles qui ne font rien.

---

## 6. Landing page

Le template contient une landing page complète et déjà cohérente visuellement (Hero, Features, Pricing, FAQ, etc.). Le projet actuel a déjà une landing statique (`public/index.html`, HTML/CSS pur, sans React) avec des sections similaires mais un contenu différent (pas de plans tarifaires visibles dans l'ancien).

- Remplace `public/index.html` par le build React de la landing du template (build séparé, voir §3.2), en adaptant les textes/contenus pour qu'ils décrivent fidèlement MiniCloud (7 services réels : Files, Notes, Gallery, Vault, Bookmarks, plus Auth et Admin en interne) plutôt que le contenu générique "Pi-Cloud" du template.
- Si le template inclut une section Pricing avec des plans payants, et que MiniCloud n'a actuellement aucun système de paiement/plans (vérifié : aucun endpoint billing n'existe dans le backend), retire cette section ou reformule-la en "quotas par défaut" honnêtes plutôt que d'afficher de faux plans tarifaires cliquables.
- Le lien "Se connecter" / CTA principal doit pointer vers `/app` (route existante du gateway).
- Utilise le vrai logo du projet (`public/logo.jpg`, déjà présent) à la place de toute icône `Cloud` générique de `lucide-react`, pour cohérence de marque avec le reste du produit.

---

## 7. Checklist de validation avant livraison

Avant de considérer la mission terminée, vérifie et documente dans `CHANGES.md` :

- [ ] `npm run build:app` (ou équivalent) réussit sans erreur, produit un fichier HTML autonome sous `public/app/`.
- [ ] Le build de la landing (si applicable) réussit et sort sous `public/`.
- [ ] Aucune régression sur le backend : les tests existants (`npm test`, `test/integration.test.js`, `test/lib.test.js`) passent toujours (tu n'as rien dû y toucher).
- [ ] Connexion, inscription, déconnexion fonctionnent contre le vrai backend (teste avec `node scripts/seed-admin.js admin StrongPass123` puis connexion réelle).
- [ ] Chaque module (Files, Notes, Gallery, Vault, Bookmarks, Admin) effectue de vraies opérations CRUD contre l'API — plus aucune référence à `mockData.ts` dans ces modules.
- [ ] Le quota s'actualise après chaque upload/suppression de fichier ou média.
- [ ] Un compte suspendu perd l'accès à la prochaine requête (comportement backend existant — vérifie juste que le front gère bien le `401` en te redirigeant vers le login).
- [ ] La CSP du gateway n'a pas été affaiblie (`script-src 'self'` inchangé au minimum).
- [ ] Liste exhaustive des dépendances npm ajoutées/retirées par rapport à `frontend/package.json` d'origine, avec justification.
- [ ] Liste exhaustive de toute fonctionnalité visuelle du template qui a été retirée, désactivée, ou laissée en simulation assumée (Services, Live Logs), avec justification.
- [ ] Le point du §5.10.1 (changement de mot de passe) est bien documenté comme hors de portée sans modification backend, pas implémenté en douce avec un faux formulaire qui ne fait rien.

---

## 8. Ce qu'on attend de toi en retour

Livre le projet complet (backend inchangé dans sa logique + nouveau frontend intégré), accompagné de :
1. `CHANGES.md` à la racine, structuré selon les points ci-dessus.
2. Une brève note sur les décisions prises pour tout point marqué "à documenter" dans ce prompt (§3.4, §5.1, §5.10) plutôt qu'un choix totalement autonome.
3. Confirmation explicite que la checklist du §7 a été vérifiée point par point — indique clairement tout point que tu n'as pas pu valider et pourquoi.
