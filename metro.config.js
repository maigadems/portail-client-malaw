// Configuration Metro.
//
// En preview web, l'API de démonstration (preview/mockApi.js) est branchée
// directement dans le serveur de développement : le bundle appelle `/api/...`
// en URL relative, donc même origine, sans CORS et sans backend réel. Hors
// preview (build device/app), l'app garde ses endpoints habituels via
// EXPO_PUBLIC_API_URL.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const { handleMockApi } = require('./preview/mockApi');

// ── Modules natifs sans implémentation web ──────────────────────────────────
// react-native-maps appelle codegenNativeComponent à l'import : sur la cible
// web, l'app entière planterait avant le premier rendu. On dévie le
// spécificateur nu vers des shims web ; le build natif n'est pas touché
// (la résolution ne s'applique que pour platform=web).
const WEB_SHIMS = {
  'react-native-maps': path.join(__dirname, 'preview/web-shims/react-native-maps.js'),
  'react-native-webview': path.join(__dirname, 'preview/web-shims/react-native-webview.js'),
};

const previousResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_SHIMS[moduleName]) {
    return { type: 'sourceFile', filePath: WEB_SHIMS[moduleName] };
  }
  return previousResolve
    ? previousResolve(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

const previousEnhance = config.server?.enhanceMiddleware;

config.server = {
  ...config.server,
  enhanceMiddleware(middleware, server) {
    const inner = previousEnhance ? previousEnhance(middleware, server) : middleware;
    // Metro attend la signature exacte (req, res, next) : `next` enchaîne sur
    // le gestionnaire final (404) lorsqu'aucune route ne répond.
    return (req, res, next) => {
      const url = req.url ?? '';
      const isMock = url.startsWith('/api/') || url.startsWith('/images/') || req.method === 'OPTIONS';
      if (!isMock) {
        inner(req, res, next);
        return;
      }
      Promise.resolve(handleMockApi(req, res))
        .then((handled) => {
          // `headersSent` : garde-fou — même si un routeur oublie de
          // renvoyer `true`, on ne redonne jamais la main après un envoi.
          if (!handled && !res.headersSent) next();
        })
        .catch(next);
    };
  },
};

module.exports = config;
