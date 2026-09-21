import AsyncStorage from '@react-native-async-storage/async-storage';
import { emitSessionExpired } from './sessionEvents';

export const API_URL = 'https://api.malaw.app/api';

const TOKEN_KEY = '@malaw/token';
const REFRESH_KEY = '@malaw/refreshToken';
const USER_KEY = '@malaw/user';
const ACCOUNT_KEY = '@malaw/simulatedAccount';

// ---------- token & session storage ----------

export async function saveSession({ token, refreshToken, user }) {
  const pairs = [];
  if (token) pairs.push([TOKEN_KEY, token]);
  if (refreshToken) pairs.push([REFRESH_KEY, refreshToken]);
  if (user) pairs.push([USER_KEY, JSON.stringify(user)]);
  if (pairs.length) await AsyncStorage.multiSet(pairs);
}

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getRefreshToken() {
  return AsyncStorage.getItem(REFRESH_KEY);
}

export async function getStoredUser() {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY, USER_KEY]);
}

// Compte local utilisé UNIQUEMENT par le mode simulation (pas de backend) :
// il tient lieu de "base de données" le temps que l'auth réelle soit activée.
export async function saveSimulatedAccount(account) {
  await AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
}

export async function getSimulatedAccount() {
  const raw = await AsyncStorage.getItem(ACCOUNT_KEY);
  return raw ? JSON.parse(raw) : null;
}

// ---------- error type ----------

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function extractMessage(body, fallback) {
  if (!body) return fallback;
  const msg = body.message;
  if (Array.isArray(msg)) return msg.join('\n');
  return msg || body.error || fallback;
}

// ---------- core fetch wrapper ----------

async function rawRequest(path, { method = 'GET', body, token, headers } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError('Impossible de joindre le serveur. Vérifiez votre connexion.', 0, null);
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    throw new ApiError(extractMessage(data, `Erreur ${res.status}`), res.status, data);
  }
  return data;
}

let refreshing = null;

async function refreshSession() {
  // Single-flight: concurrent 401s share one refresh call.
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) throw new ApiError('Session expirée', 401, null);
      const data = await rawRequest('/auth/refresh', { method: 'POST', body: { refreshToken } });
      await saveSession(data);
      return data.token;
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}

/**
 * Authenticated-aware request. Attaches the stored access token when present;
 * on a 401, tries one token refresh then replays the request.
 */
export async function api(path, options = {}) {
  const token = await getToken();
  try {
    return await rawRequest(path, { ...options, token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && token) {
      try {
        const newToken = await refreshSession();
        return await rawRequest(path, { ...options, token: newToken });
      } catch {
        // Le refresh a échoué (token de refresh expiré/révoqué) : la
        // session est définitivement perdue, pas juste ce seul appel.
        // On prévient l'UI pour afficher une invite de reconnexion claire
        // au lieu de laisser chaque écran échouer avec "Unauthorized".
        await clearSession();
        emitSessionExpired();
        throw e;
      }
    }
    throw e;
  }
}

/** Unauthenticated request (login/signup endpoints). */
export function apiPublic(path, options = {}) {
  return rawRequest(path, options);
}
