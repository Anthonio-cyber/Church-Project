import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

/**
 * The mobile API client.
 *
 * The session token lives in the device keychain (Keychain on iOS, Keystore-backed
 * EncryptedSharedPreferences on Android) and is presented as a Bearer credential.
 * It is the same opaque token the browser holds in an httpOnly cookie, resolving
 * to the same session row, the same authorisation model and the same audit trail
 * — there is no second, weaker path into the platform for mobile.
 */

const TOKEN_KEY = 'ipastor.session';

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function storeToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function readToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Set false for sign-in and registration, which carry no session yet. */
  authenticated?: boolean;
};

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, authenticated = true } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (authenticated) {
    const token = await readToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      0,
      'offline',
      'We could not reach the ministry platform. Check your connection and try again.',
    );
  }

  let payload: { ok?: boolean; data?: T; error?: { code: string; message: string; detail?: unknown } };
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(response.status, 'invalid_response', 'The server sent an unexpected response.');
  }

  if (!response.ok || payload.ok === false) {
    // A rejected session is cleared immediately, so the app never sits in a
    // half-authenticated state showing stale screens.
    if (response.status === 401) await clearToken();
    throw new ApiError(
      response.status,
      payload.error?.code ?? 'request_failed',
      payload.error?.message ?? 'Something went wrong. Please try again.',
      payload.error?.detail,
    );
  }

  return payload.data as T;
}
