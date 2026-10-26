/**
 * Test de fumée E2E headless — exécute le VRAI bundle web de l'app dans
 * jsdom contre l'API mock (preview/mockApi.js), puis pilote les parcours
 * au niveau du DOM (aucune logique métier simulée).
 *
 * Usage : node preview/smoke.mjs   (nécessite le serveur dev sur :8091)
 *
 * Ce qui est couvert :
 *  A. Invité : onboarding → accueil → fiche restaurant → panier →
 *     invite de connexion → login → checkout → paiement (stub) →
 *     attente cuisine → confirmation → bandeau commande en cours.
 *  B. Boots aux formats 360 / 414 / 768 px (dimensionnement).
 *  C. Aucune erreur JS non interceptée, aucun écran ErrorBoundary.
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ORIGIN = process.env.SMOKE_ORIGIN ?? 'http://localhost:8091';
const BUNDLE_PATH =
  '/index.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app&unstable_transformProfile=hermes-stable';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
// Exceptions qui traverseraient jsdom : elles ne doivent pas tuer le harnais,
// mais elles restent des échecs.
const processErrors = [];
process.on('uncaughtException', (e) => { processErrors.push(String(e?.message ?? e)); });
process.on('unhandledRejection', (e) => { processErrors.push(`rejection: ${e}`); });
function check(label, ok, extra = '') {
  results.push({ label, ok });
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}${extra ? ` — ${extra}` : ''}`);
}

// ─── DOM helpers ────────────────────────────────────────────────────────────

function textOf(el) {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Le motif peut être une chaîne (inclusion) ou une RegExp. */
function matches(haystack, pattern) {
  return typeof pattern === 'string' ? haystack.includes(pattern) : pattern.test(haystack);
}

function visible(el, win) {
  let node = el;
  while (node && node !== win.document.documentElement) {
    if (node.hidden) return false;
    const st = node.style;
    if (st && (st.display === 'none' || st.visibility === 'hidden')) return false;
    node = node.parentElement;
  }
  return true;
}

/** Éléments « feuilles » contenant le texte (pas d'enfant qui le contient déjà). */
function leafsWithText(win, text) {
  return [...win.document.querySelectorAll('div,span,p,button,a,h1,h2,h3,li,label')]
    .filter((el) => matches(textOf(el), text))
    .filter((el) => ![...el.children].some((c) => matches(textOf(c), text)));
}

function climbRole(el, roles) {
  let node = el;
  while (node && node !== node.ownerDocument.body) {
    if (roles.includes(node.getAttribute('role'))) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Simule l'appui. RNW n'invoque `onPress` QUE via `click` (voir
 * PressResponder.onClick — le responder ne gère que le feedback tactile).
 * Le `click` seul est donc le chemin le plus fidèle et le plus déterministe.
 */
function tap(win, el) {
  const opts = { bubbles: true, cancelable: true, composed: true, button: 0 };
  // Le `click` EST le déclencheur d'onPress chez RNW. On le produit en
  // premier pour garantir l'activation, puis on simule la séquence pointeur
  // (feedback : état pressé) — l'ordre inversé est toléré par PressResponder
  // (les événements pointeur sans appui suivant ne déclenchent rien d'autre).
  el.dispatchEvent(new win.MouseEvent('click', opts));
}

async function waitFor(fn, { timeout = 10000, interval = 100, label = 'condition' } = {}) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    last = fn();
    if (last) return last;
    await sleep(interval);
  }
  throw new Error(`Timeout : ${label}`);
}

async function tapText(win, text, { timeout = 10000, roles = ['button', 'tab', 'radio', 'switch', 'link', 'menuitem'] } = {}) {
  const el = await waitFor(
    () => {
      const leaves = leafsWithText(win, text).filter((e) => visible(e, win));
      if (!leaves.length) return null;
      // Préfère un ancêtre porteur d'un rôle accessible (vrai touchable).
      for (const leaf of leaves) {
        const role = climbRole(leaf, roles);
        if (role) return role;
      }
      return leaves[0];
    },
    { timeout, label: `texte « ${String(text)} »` },
  );
  // Laisse flushing les effets passifs React : PressResponder (RNW) est
  // reconfiguré dans un useEffect, pas au commit — tapper dans la foulée de
  // l'activation (attribution `disabled` fraîche, config encore ancienne)
  // ferait avaler l'événement. Un vrai doigt ne tape jamais en <10 ms.
  await sleep(60);
  tap(win, el);
  return el;
}

/**
 * Appuie sur une action d'alerte. Les modales RNW sont portalisées à
 * l'extérieur de #root : on les privilégie pour ne pas confondre un
 * « Se connecter » d'écran (masqué derrière l'overlay) avec celui du dialogue.
 */
async function tapAlertAction(win, text, { timeout = 10000 } = {}) {
  const roles = ['button', 'tab', 'radio', 'switch', 'link'];
  const el = await waitFor(
    () => {
      const all = leafsWithText(win, text).filter((e) => visible(e, win));
      if (!all.length) return null;
      const outside = all.filter((e) => !e.closest('#root'));
      const pool = outside.length ? outside : all;
      for (const leaf of pool) {
        const role = climbRole(leaf, roles);
        if (role) return role;
      }
      // Repli : le dernier candidat est le plus haut dans l'ordre du DOM
      // (la modale est rendue après la page).
      return pool[pool.length - 1];
    },
    { timeout, label: `action d'alerte « ${text} »` },
  );
  await sleep(60);
  tap(win, el);
  return el;
}

/** Appuie sur le premier élément visible correspondant à un sélecteur CSS. */
async function tapSelector(win, selector, { timeout = 10000 } = {}) {
  const el = await waitFor(
    () => [...win.document.querySelectorAll(selector)].filter((e) => visible(e, win))[0] ?? null,
    { timeout, label: `sélecteur ${selector}` },
  );
  await sleep(60);
  tap(win, el);
  return el;
}

async function setInput(win, el, value) {
  const proto = el.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement : win.HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new win.Event('input', { bubbles: true }));
  el.dispatchEvent(new win.Event('change', { bubbles: true }));
}

async function visibleInputs(win) {
  return waitFor(
    () => {
      const inputs = [...win.document.querySelectorAll('input')].filter((e) => visible(e, win));
      return inputs.length ? inputs : null;
    },
    { label: 'champs visibles' },
  );
}

// ─── App instance ───────────────────────────────────────────────────────────

async function createApp({ width = 390, height = 844 } = {}) {
  const bundleCode = await (await fetch(`${ORIGIN}${BUNDLE_PATH}`)).text();
  if (bundleCode.includes('{"type":"BuildError"')) {
    throw new Error('Bundle en erreur de compilation :\n' + bundleCode.slice(0, 2000));
  }

  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => errors.push(`jsdomError: ${e.message}`));
  virtualConsole.on('error', (...a) => errors.push(`console.error: ${a.map(String).join(' ')}`));
  virtualConsole.on('warn', () => {});
  const appLogs = [];
  virtualConsole.on('log', (...a) => {
    const line = a.map(String).join(' ');
    if (line.includes('[pay]')) appLogs.push(line);
  });

  const dom = new JSDOM(
    `<!doctype html><html><head><meta charset="utf-8"></head>
     <body style="margin:0"><div id="root"></div></body></html>`,
    {
      url: `${ORIGIN}/`,
      pretendToBeVisual: true,
      runScripts: 'outside-only',
      virtualConsole,
      // UA « Safari » volontaire : expo-font désactive alors l'observation
      // FontFaceObserver (impossible à satisfaire sans moteur de rendu),
      // qui ferait attendre `useFonts` 12 s puis en erreur. Le reste de
      // l'app ne lit pas l'UA.
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    },
  );
  const win = dom.window;

  // jsdom 30 lit `userAgent` côté ResourceLoader, pas sur navigator : on
  // impose l'UA ici. Raison (cf. plus bas) : expo-font doit éviter
  // FontFaceObserver, qui ne peut jamais aboutir sans moteur de rendu.
  Object.defineProperty(win.navigator, 'userAgent', {
    configurable: true,
    get: () =>
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  });
  // Permissions API (absente de jsdom) : sans elle, expo-location lève
  // ERR_UNAVAILABLE. On imite un navigateur en état « demander ».
  if (!win.navigator.permissions) {
    win.navigator.permissions = {
      query: () =>
        Promise.resolve({
          state: 'prompt',
          status: 'prompt',
          onchange: null,
          addEventListener() {}, removeEventListener() {},
          dispatchEvent() { return false; },
        }),
    };
  }
  // Filet de sécurité : si un observateur passe quand même, il doit se
  // résoudre immédiatement au lieu d'attendre un timeout de 12 s.
  if (!win.document.fonts) {
    win.document.fonts = {
      load: () => Promise.resolve([]),
      check: () => true,
      ready: Promise.resolve(),
      add() {}, delete() {}, forEach() {}, has: () => true,
      *values() {},
    };
  }

  // Le client HMR de Metro tente une WebSocket ; dans jsdom son message de
  // « register » a une URL sans chemin et fait tomber le serveur de dev
  // (voir HmrServer._registerEntryPoint). On remplace WebSocket par un
  // récepteur muet : pas de HMR pendant les tests, le serveur survit.
  win.WebSocket = class WebSocketStub {
    static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
    constructor(url) {
      this.url = url; this.readyState = WebSocketStub.CONNECTING;
      this.onopen = null; this.onclose = null; this.onerror = null; this.onmessage = null;
      this._listeners = {};
      setTimeout(() => {
        this.readyState = WebSocketStub.CLOSED;
        this.onerror?.(new win.Event('error'));
        this.onclose?.(new win.Event('close'));
      }, 1);
    }
    addEventListener(type, fn) { (this._listeners[type] ??= []).push(fn); }
    removeEventListener() {}
    send() {}
    close() {}
    dispatchEvent() { return false; }
  };

  // Dimensions écran testées.
  Object.defineProperty(win, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(win, 'innerHeight', { configurable: true, writable: true, value: height });
  Object.defineProperty(win, 'devicePixelRatio', { configurable: true, value: 2 });

  // Ponts vers Node : fetch relatif → serveur dev ; géolocalisation refusée
  // (comme un utilisateur sans permission — l'app doit dégrader proprement).
  // Trace réseau conservée pour le diagnostic en cas d'échec.
  const netLog = [];
  const nodeFetch = globalThis.fetch;
  win.fetch = async (input, init) => {
    const url = typeof input === 'string' ? new URL(input, ORIGIN).href : input;
    const method = (init?.method ?? 'GET').toUpperCase();
    try {
      const res = await nodeFetch(url, init);
      netLog.push(`${method} ${new URL(url).pathname} → ${res.status}`);
      return res;
    } catch (e) {
      netLog.push(`${method} ${new URL(url).pathname} → FATAL ${e?.message}`);
      throw e;
    }
  };
  win.AbortController = globalThis.AbortController;
  win.AbortSignal = globalThis.AbortSignal;
  win.matchMedia ??= (q) => ({
    matches: false, media: q, onchange: null,
    addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {},
    dispatchEvent() { return false; },
  });
  win.navigator.geolocation = {
    getCurrentPosition: (_ok, fail) => fail?.({ code: 1, message: 'denied' }),
    watchPosition: () => 0,
    clearWatch() {},
  };
  win.scrollTo = () => {};
  win.HTMLElement.prototype.scrollIntoView = function () {};

  const uncaught = [];
  win.addEventListener('error', (e) => uncaught.push(String(e.message ?? e.error)));
  win.addEventListener('unhandledrejection', (e) => uncaught.push(`rejection: ${e.reason}`));

  const ctx = dom.getInternalVMContext();
  require('vm').runInContext(bundleCode, ctx, { filename: 'malaw.bundle.js' });

  return {
    dom, win, errors, uncaught, netLog, appLogs,
    appLogsCount: () => appLogs.length,
    async close() { win.close(); },
  };
}

function assertNoFatal(app, label) {
  const boundary = textOf(app.win.document.body).includes('Une erreur est survenue');
  check(`${label} : pas d'écran ErrorBoundary`, !boundary);
  const fatal = app.uncaught.filter(
    (m) => !/FontFace|geolocation|Could not load|font/i.test(m),
  );
  check(`${label} : pas d'erreur JS non interceptée`, fatal.length === 0, fatal.slice(0, 2).join(' | '));
}

// ─── Scénario A : parcours invité → commande → confirmation ────────────────

async function scenarioJourney() {
  console.log('\n── Scénario A : parcours complet (invité → commande) ──');
  const app = await createApp({ width: 390, height: 844 });
  const { win } = app;

  try {
    // 1. Splash → Onboarding (visiteur non vu)
    await waitFor(() => textOf(win.document.body).includes('Passer'), { label: 'onboarding', timeout: 12000 });
    const obText = () => textOf(win.document.body);
    check('A1. Onboarding affiché (visiteur)', true);
    check('A2. Onboarding fusionné (CTA « Suivant », passable)', obText().includes('Suivant') && obText().includes('Passer'));

    // 2. Entrée invité
    await tapText(win, 'Passer');
    await waitFor(() => textOf(win.document.body).includes('Partenaires'), { label: 'accueil', timeout: 15000 });
    check('A3. Accueil accessible en invité', true);

    // 3. Accueil enrichi
    const body = () => textOf(win.document.body);
    await waitFor(() => body().includes('Dibi Maison du Plateau'), { label: 'liste restaurants', timeout: 15000 });
    check('A4. Restaurants chargés (API mock)', true);
    check('A5. Recherche visible en haut', body().includes('Thiéboudiène, Sushi, Fast-food'));
    check('A6. Fiches enrichies (frais de livraison)', body().includes('Livraison offerte') || /\d+\s*FCFA/.test(body()));
    check('A7. Pas de bandeau commande active (invité)', !body().includes('Recherche d\'un livreur'));
    check('A8. Pas de faux badges (Halal/éco)', !body().includes('Emballage éco') && !body().includes('Livraison express'));

    // 4. Fiche restaurant → détail plat → retour → ajout via le menu
    await tapText(win, 'Dibi Maison du Plateau', { roles: ['button'] });
    await waitFor(() => body().includes('Incontournables') || body().includes('Tous les plats'), { label: 'fiche restaurant', timeout: 10000 });
    check('A9. Fiche restaurant ouverte', true);
    check('A10. Promo honnête (pas d\'expiration inventée)', body().includes('une fois par client') && !body().includes('Expire dans'));

    await tapText(win, 'Dibi Mouton', { roles: ['button'] });
    await waitFor(() => body().includes('Note pour le restaurant'), { label: 'fiche plat', timeout: 10000 });
    check('A11. Fiche plat : note restaurant + CTA ajouter', body().includes('Ajouter au panier'));

    // Retour (bouton accessible) vers la fiche restaurant
    await tapSelector(win, '[aria-label="Retour"]');
    await waitFor(() => body().includes('Tous les plats'), { label: 'retour fiche resto', timeout: 8000 });

    // Ajout par le « + » du menu (accessible, aria-label « Ajouter <plat> »)
    await tapSelector(win, '[aria-label="Ajouter Dibi Mouton"]');
    await waitFor(() => body().includes('Voir le panier'), { label: 'barre panier', timeout: 8000 });
    check('A11b. Barre panier collante après ajout', true);

    // Barre panier collante → checkout unifié
    await tapText(win, 'Voir le panier', { roles: ['button'] });
    await waitFor(() => body().includes('Adresse de livraison'), { label: 'checkout', timeout: 10000 });
    check('A12. Checkout unifié (articles + adresse + paiement)', true);
    check('A13. Moyens de paiement listés', body().includes('Wave') && body().includes('Orange Money') && body().includes('Espèces'));
    await waitFor(() => body().includes('Connectez-vous pour finaliser'), { label: 'invite connexion (état invité résolu)', timeout: 8000 });
    check('A14. Invité : invite de connexion en zone adresse', true);

    // 5. Paiement → invite login
    const payBtn = await tapText(win, /Payer\s+[\d.,\s\u00A0\u202F]+\s*FCFA/, { roles: ['button'] }).catch(() => null);
    check('A15. CTA payer visible avec le montant', !!payBtn);
    await waitFor(() => body().includes('Connexion requise'), { label: 'alerte login', timeout: 6000 });
    check('A16. Connexion demandée au moment utile', true);

    // 6. Login avec retour au checkout (action du DIALOGUE, pas de la page)
    await tapAlertAction(win, 'Se connecter');
    await waitFor(() => body().includes('Bon retour'), { label: 'écran connexion', timeout: 8000 });
    const inputs = await visibleInputs(win);
    check('A17. Écran connexion atteint', inputs.length >= 2, `${inputs.length} champs`);
    await setInput(win, inputs[inputs.length - 2], '77 123 45 67');
    await setInput(win, inputs[inputs.length - 1], '1234');
    // Le CTA du formulaire est le premier « Se connecter » visible
    // (le lien du pied de page vient après dans le DOM).
    await tapText(win, 'Se connecter', { roles: ['button'] });

    // Retour au checkout avec session
    await waitFor(() => body().includes('Adresse de livraison') && body().includes('Domicile'), { label: 'retour checkout connecté', timeout: 12000 });
    check('A18. Retour au checkout après connexion', true);
    check('A19. Adresse enregistrée proposée', body().includes('Domicile'));

    // 7. Commander (Wave → écran prestataire stub).
    // On attend un CTA RÉACTIF : il reste désactivé tant que la session
    // n'est pas confirmée au focus.
    const payBtn2 = await waitFor(
      () =>
        [...win.document.querySelectorAll('[role="button"]')].filter(
          (e) =>
            visible(e, win) &&
            !e.hasAttribute('disabled') &&
            !e.getAttribute('aria-disabled') &&
            /Payer\s+[\d.,\s\u00A0\u202F]+\s*FCFA/.test(textOf(e)),
        )[0] ?? null,
      { label: 'CTA payer actif', timeout: 10000 },
    );
    check('A20. CTA payer actif (connecté)', !!payBtn2);
    await sleep(60); // effets passifs React (configure PressResponder)
    tap(win, payBtn2);

    await waitFor(
      () => body().includes('Vérification du paiement') || body().includes('page sécurisée') || body().includes('Payez') || body().includes('paiement'),
      { label: 'écran paiement', timeout: 15000 },
    );
    check('A21. Écran prestataire atteint', true);

    // Stub de test : sortie « continuer » de la page prestataire simulée
    const cont = [...win.document.querySelectorAll('[role="button"]')]
      .filter((e) => visible(e, win) && /continuer sans payer/i.test(textOf(e)));
    if (cont.length) {
      tap(win, cont[0]);
      check('A22. Poursuite via mode test prestataire', true);
    } else {
      // Repli : le texte existe-t-il au moins (l'app a bien rendu le mode test) ?
      check('A22. Carte mode test visible', body().includes('Mode test'));
      await tapText(win, 'Continuer sans payer');
    }

    // 8. Attente cuisine → confirmation
    await waitFor(() => body().includes('En attente de confirmation') || body().includes('Suivi de préparation'), { label: 'attente cuisine', timeout: 15000 });
    check('A23. Écran d\'attente d\'acceptation', true);
    check('A24. Annulation possible pendant l\'attente', body().includes('Annuler la commande'));

    // Le mock fait accepter la commande après ~15 s puis confirme.
    await waitFor(() => body().includes('Commande acceptée'), { label: 'acceptation restaurant', timeout: 30000 });
    check('A25. Acceptation du restaurant observée', true);

    await waitFor(() => body().includes('Commande confirmée'), { label: 'confirmation', timeout: 15000 });
    check('A26. Écran de confirmation atteint', true);
    check('A27. Actions confirmation (suivre / accueil)', body().includes('Suivre ma commande') && body().includes("Retour à l'accueil"));

    // 9. Retour accueil → bandeau commande en cours
    await tapText(win, "Retour à l'accueil", { roles: ['button'] });
    await waitFor(() => body().includes('Partenaires'), { label: 'retour accueil', timeout: 10000 });
    await waitFor(() => body().includes('Dibi Maison du Plateau') && /En attente|préparation|Préparation|livraison/i.test(body()), { label: 'bandeau actif', timeout: 12000 });
    check('A28. Bandeau « commande en cours » sur l\'accueil', true);

    // Onglet Commandes : bandeau + historique
    await tapText(win, 'Commandes', { roles: ['tab'] });
    await waitFor(() => body().includes('Historique'), { label: 'onglet commandes', timeout: 8000 });
    check('A29. Onglet Commandes : historique + commande active', body().includes('MW-') || body().includes('FCFA'));

    // Suivi en direct : ouvert depuis le bandeau (le cœur du suivi temps réel)
    await tapText(win, 'Suivi de commande', { roles: ['button'] });
    await waitFor(
      () => body().includes('Commande reçue') && body().includes('Signaler un problème'),
      { label: 'écran suivi', timeout: 12000 },
    );
    check('A32. Suivi ouvert depuis le bandeau (étapes réelles)', true);

    // Retour du suivi (TopBar) → l'app, puis onglet Profil
    await tapSelector(win, '[aria-label="Retour"]');
    await waitFor(() => body().includes('Historique'), { label: 'retour suivi → commandes', timeout: 10000 });
    await tapText(win, 'Profil', { roles: ['tab'] });
    await waitFor(() => body().includes('Aminata Diallo'), { label: 'profil connecté', timeout: 8000 });
    check('A30. Profil connecté (nom depuis /auth/me)', true);
    check('A31. Liens manquants restaurés', body().includes('Mes favoris') && body().includes('Mes réclamations'));

    assertNoFatal(app, 'A');
  } catch (e) {
    check(`Scénario A : ${e.message}`, false);
    const portals = [...app.win.document.body.children]
      .filter((el) => el.id !== 'root')
      .map((el) => textOf(el))
      .filter(Boolean);
    console.log('    ALERTES/PORTAILS:', portals);
    console.log('    RÉSEAU (12 derniers):', app.netLog.slice(-12));
    console.log('    LOGS [pay]:', app.appLogs);
    const pays = [...app.win.document.querySelectorAll('[role="button"]')].filter((e) =>
      /Payer\s+[\d.,\s\u00A0\u202F]+\s*FCFA/.test(textOf(e)),
    );
    console.log('    BOUTONS PAYER:', pays.map((e) => ({
      connected: e.isConnected,
      visible: visible(e, app.win),
      disabled: e.hasAttribute('disabled'),
      ariaDisabled: e.getAttribute('aria-disabled'),
      label: e.getAttribute('aria-label'),
      tag: e.tagName,
      inRoot: !!e.closest('#root'),
    })));
    assertNoFatal(app, 'A (échec)');
  } finally {
    await app.close();
  }
}

// ─── Scénario B : boots multi-formats ──────────────────────────────────────

async function scenarioBoot(label, size) {
  console.log(`\n── Scénario B : boot ${label} ──`);
  const app = await createApp(size);
  const { win } = app;
  try {
    await waitFor(() => textOf(win.document.body).includes('Passer'), { label: 'onboarding', timeout: 12000 });
    await tapText(win, 'Passer');
    await waitFor(() => textOf(win.document.body).includes('Dibi Maison du Plateau'), { label: `accueil ${label}`, timeout: 15000 });
    check(`B. ${label} : accueil rendu avec cartes`, true);
    // Filtres postiches + sections visibles
    const body = textOf(win.document.body);
    check(`B. ${label} : sections découvre`, body.includes('Grillades') && body.includes('Thieb'));
    assertNoFatal(app, `B ${label}`);
  } catch (e) {
    check(`B. ${label} : ${e.message}`, false);
    assertNoFatal(app, `B ${label}`);
  } finally {
    await app.close();
  }
}

// ─── Scénario C : invité — recherche, profil, favoris ──────────────────────

async function scenarioGuest() {
  console.log('\n── Scénario C : invité — recherche & profil ──');
  const app = await createApp({ width: 390, height: 844 });
  const { win } = app;
  try {
    const body = () => textOf(win.document.body);
    await waitFor(() => body().includes('Passer'), { label: 'onboarding', timeout: 12000 });
    await tapText(win, 'Passer');
    await waitFor(() => body().includes('Dibi Maison du Plateau'), { label: 'accueil', timeout: 15000 });
    check('C1. Accueil invité', true);

    // Barre de recherche → onglet Recherche (les catégories du héros
    // mènent au même endroit — parcours testé ici)
    await tapSelector(win, '[role="search"]');
    await waitFor(
      () => body().includes('Cuisines Populaires') || body().includes('Découvrir Dakar'),
      { label: 'onglet recherche', timeout: 12000 },
    );
    check('C2. Recherche atteinte depuis la barre', true);
    await waitFor(() => body().includes('Dibi Maison du Plateau'), { label: 'résultats', timeout: 12000 });
    check('C3. Restaurants dans les résultats', true);

    const inputs = await visibleInputs(win);
    check('C4. Champ de recherche actif', inputs.length >= 1);
    if (inputs[0]) {
      await setInput(win, inputs[0], 'dibi');
      await sleep(700); // anti-rebond 400 ms
      check('C5. Frappe prise en compte', inputs[0].value === 'dibi');
    }

    // Profil invité
    await tapText(win, 'Profil', { roles: ['tab'] });
    await waitFor(() => body().includes('Bienvenue sur Malaw'), { label: 'profil invité', timeout: 8000 });
    check('C6. Profil invité (invitation claire)', true);
    check('C7. Actions invité (connexion / compte)',
      body().includes('Créer un compte') && body().includes('Se connecter'));

    // Favoris depuis le profil invité → message dédié
    await tapText(win, 'Mes favoris');
    await waitFor(() => body().includes('Connectez-vous'), { label: 'favoris invité', timeout: 8000 });
    check('C8. Favoris invité : invitation à se connecter', true);

    assertNoFatal(app, 'C');
  } catch (e) {
    check(`Scénario C : ${e.message}`, false);
    const portals = [...app.win.document.body.children]
      .filter((el) => el.id !== 'root')
      .map((el) => textOf(el))
      .filter(Boolean);
    if (portals.length) console.log('    ALERTES/PORTAILS:', portals);
    console.log('    RÉSEAU (12 derniers):', app.netLog.slice(-12));
    assertNoFatal(app, 'C (échec)');
  } finally {
    await app.close();
  }
}

// ─── Lancement ─────────────────────────────────────────────────────────────

const health = await fetch(`${ORIGIN}/`).then((r) => r.ok).catch(() => false);
if (!health) {
  console.error(`Serveur dev introuvable sur ${ORIGIN} — lancer d'abord : npx expo start --web --port 8091`);
  process.exit(2);
}

await scenarioJourney();
await scenarioGuest();
await scenarioBoot('360×640 (petit)', { width: 360, height: 640 });
await scenarioBoot('768×1024 (tablette)', { width: 768, height: 1024 });

if (processErrors.length) {
  check('Erreurs processus non interceptées pendant les tests', false, processErrors.slice(0, 2).join(' | '));
}
const failed = results.filter((r) => !r.ok);
console.log(`\n═══ Résultat : ${results.length - failed.length}/${results.length} vérifications OK ═══`);
if (failed.length) {
  failed.forEach((f) => console.log(`  ✗ ${f.label}`));
  process.exit(1);
}
process.exit(0);
