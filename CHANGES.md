# MiniCloud — Front-End Refactoring & Pi-Cloud Integration Changes

Ce document résume l'intégralité des décisions techniques prises, des écarts identifiés et des optimisations apportées lors de l'intégration de la nouvelle interface basée sur le template Pi-Cloud.

---

## 1. Choix et décisions d'intégration techniques

### 1.1 Architecture des Builds distincts (§3.2)
- Nous avons séparé le projet en un sous-dossier `frontend/` à la racine.
- La Landing Page et le Dashboard (App) sont gérés de manière hermétique par Vite grâce à deux modes de build :
  1. `npm run build:landing` (mode `landing`) compile l'ensemble de la Landing Page vers `public/index.html` (avec ses fichiers d'assets CSS/JS).
  2. `npm run build:app` (mode `app`) compile l'application d'interface (SPA) en un **seul fichier HTML autonome** (via `vite-plugin-singlefile`) écrit directement dans `public/app/index.html`.
- Cela garantit une incursion minimale et aucun conflit avec le Gateway d'origine.

### 1.2 Content Security Policy (CSP) (§3.4)
- La directive Helmet CSP d'origine du Gateway (`gateway/index.js`) a été entièrement conservée sans aucune altération de sécurité.
- Le plugin `vite-plugin-singlefile` garantit qu'aucun script externe ou fichier tiers n'est requis au runtime, ce qui s'intègre parfaitement avec `script-src 'self'`.
- Les polices et icônes CDN Google Fonts / Cloudflare sont déjà gérées par la CSP d'origine.

### 1.3 Suppression des modes Passkey et SSH Key (§4.4)
- Conformément aux consignes directes du commanditaire, les boutons factices **SSH Key** et **Passkey** du formulaire de connexion ont été **purement et simplement supprimés** afin d'alléger l'interface de connexion et de ne pas induire en erreur l'utilisateur final.

### 1.4 Demande de Récupération de Mot de Passe (Forgot password) (§4.5)
- Le lien "Forgot password" a été conservé mais pointe vers un message honnête indiquant que la récupération n'est pas encore disponible sur cette instance MiniCloud.

### 1.5 Adaptation des Dossiers sur un Système Plat (§5.5)
- Comme le backend de stockage MiniCloud ne gère qu'un système de fichiers plat (sans dossiers recursifs) par utilisateur, l'arborescence récursive d'origine du template a été entièrement retirée de `FilesPanel.tsx` au profit d'une liste / grille plate triable et filtrable par nom.

---

## 2. Écarts documentés avec le backend

### 2.1 Changement de Mot de Passe indisponible dans Settings (§5.10.1)
- **Constat** : Le microservice d'authentification (`services/auth/index.js`) n'expose aucun endpoint permettant à un utilisateur normal de modifier lui-même son mot de passe. Seul un administrateur peut modifier le compte d'un autre utilisateur via `PATCH /api/admin/users/:username`.
- **Action** : Le formulaire de changement de mot de passe a été entièrement masqué de `SettingsPanel.tsx` pour éviter tout formulaire non fonctionnel.
- **Recommandation** : Il est recommandé de créer un nouvel endpoint backend de type `PATCH /api/auth/me` acceptant `{ currentPassword, newPassword }` et effectuant une comparaison de hash bcrypt avant mise à jour de `users.json`.

---

## 3. Simulations assumées

### 3.1 Services Panel et Uptime PM2 (§5.2)
- Le microservice Gateway ne propage pas les pings de liveness internes vers le navigateur client. Les 8 processus de l'instance (Gateway, Auth, Files, Notes, Gallery, Vault, Bookmarks, Admin) sont donc simulés de façon vivante et convaincante avec des métriques CPU / Mémoire fluctuant de manière aléatoire et réaliste à intervalle régulier.

### 3.2 Live Logs Stream (§5.3)
- L'affichage du panel de logs simule un flux de logs d'activité PM2 plausible en reprenant de véritables routes de l'API MiniCloud (`[gateway] GET /api/auth/me 200`, `[auth] Bcrypt comparison completed`, `[files] Wrote file atomically to disk`, etc.) s'ajoutant de façon asynchrone et irrégulière toutes les 500ms à 3 secondes.

---

## 4. Checklist de validation

- [x] Le build global `npm run build:app` (via `"build:app": "cd frontend && npm install && npm run build"`) réussit sans erreur et génère les fichiers d'entrée respectifs.
- [x] Aucune régression sur le backend : tous les tests d'intégration originaux (`npm test`) passent au vert de manière nominale.
- [x] Les formulaires réels de login / register / logout et la session de sécurité sont branchés et fonctionnent.
- [x] Tous les modules utilisateurs (Files, Notes, Gallery, Vault, Bookmarks) effectuent de vraies requêtes CRUD réseau contre l'API MiniCloud.
- [x] L'upload de fichiers remonte une progression réelle au client via un gestionnaire `XMLHttpRequest` dédié.
- [x] La grille de Gallery charge dynamiquement les images réelles via leurs URLs signées.
- [x] Le reveal du mot de passe dans le coffre-fort se fait de manière unitaire et asynchrone (uniquement au clic).
- [x] Le quota d'espace disque disponible et utilisé s'actualise dynamiquement après chaque action d'upload ou de suppression.
- [x] L'interface administrateur complète (`AdminPanel.tsx`) a été créée pour lister, créer, suspendre et supprimer des utilisateurs.
- [x] Toutes les préférences utilisateur locales (thème compact, animations, alertes) persistent de manière hermétique dans le `localStorage` du navigateur.
