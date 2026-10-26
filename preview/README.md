# Preview & tests de l'app Malaw (web)

Ce dossier équipe la **prévisualisation web** de l'app et ses **tests de
parcours** — il ne fait pas partie du bundle mobile (shims réservés à
`platform=web`, voir `metro.config.js`).

## Lancer la prévisualisation

```bash
npm run preview:web      # Expo sur http://localhost:8091, API mock branchée
npm run test:smoke       # tests E2E headless (jsdom) contre le serveur lancé
```

`EXPO_PUBLIC_API_URL=/api` (posée par le script) rend les appels API
**relatifs** : ils repassent par le serveur de développement, où
`metro.config.js` les confie à `mockApi.js` — même origine, aucun CORS,
aucun backend réel requis.

## Contenu

| Fichier | Rôle |
| --- | --- |
| `mockApi.js` | API de démonstration (restaurants, commandes, paiement stub, favoris…). Les commandes créées **évoluent seules** (acceptée → préparation → livraison) pour rendre les écrans de suivi réellement démontrables. |
| `web-shims/react-native-maps.js` | Remplacement de `react-native-maps` sur web (l'appelant `codegenNativeComponent` planterait à l'import). Le build natif garde la vraie lib. |
| `web-shims/react-native-webview.js` | `react-native-webview` rendu en `<iframe>` sur web. |
| `smoke.mjs` | Tests E2E : exécute le **vrai bundle web** dans jsdom et pilote les parcours au niveau du DOM. |

## Ce que couvre `test:smoke`

- **A — parcours complet** : onboarding invité → accueil → fiche restaurant
  → fiche plat → panier → invite de connexion au bon moment → login avec
  retour au checkout → commande (paiement stub) → attente d'acceptation →
  confirmation → bandeau temps réel → suivi → onglets → profil connecté.
- **C — invité** : recherche, profil invité, favoris sans session.
- **B — formats** : boots en 360×640, 414×896 et 768×1024.
- Aucune exception JS non interceptée, aucun écran d'erreur.

Compteur final : `53/53 vérifications OK`.

## Notes de debug connues

- jsdom n'a ni moteur de rendu ni Permissions API : le harnais fournit les
  polyfills nécessaires (UA « Safari » pour court-circuiter
  FontFaceObserver, `navigator.permissions`, `WebSocket` muet — le client
  HMR de Metro plante son serveur sinon).
- RNW n'invoque `onPress` que sur `click`, et reconfigure son
  `PressResponder` dans un `useEffect` : le harnais laisse 60 ms entre
  l'activation d'un bouton et l'appui, comme un doigt réel.
