import { google } from 'googleapis';
import { getServiceAccountCredentials } from './service-account';

/**
 * Read access to the Shared Files folder.
 *
 * Preferred: a Google service account. The Drive folder stays private (Restricted) and is
 * shared only with the service account, so files are reachable only through this app,
 * after the attendee check. Fallback: an API key, which only works on folders shared as
 * "Anyone with the link".
 */
let cachedToken: { value: string; expiresAt: number } | null = null;

export function hasServiceAccountReadAccess(): boolean {
  const creds = getServiceAccountCredentials();
  return (
    !creds.missingVars.includes('GOOGLE_SERVICE_ACCOUNT_EMAIL') &&
    !creds.missingVars.includes('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
  );
}

async function getReadToken(): Promise<string | null> {
  if (!hasServiceAccountReadAccess()) return null;
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) return cachedToken.value;

  const creds = getServiceAccountCredentials();
  const jwt = new google.auth.JWT({
    email: creds.clientEmail,
    key: creds.privateKey,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const result = await jwt.authorize();
  if (!result.access_token) throw new Error('Google did not return an access token for the service account.');
  cachedToken = { value: result.access_token, expiresAt: result.expiry_date ?? Date.now() + 30 * 60_000 };
  return cachedToken.value;
}

/** Fetches a Drive API URL using the service account if configured, otherwise the API key. */
export async function driveFetch(input: string | URL, apiKey: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(input.toString());
  const headers = new Headers(init.headers);
  const token = await getReadToken();
  if (token) {
    url.searchParams.delete('key');
    headers.set('Authorization', `Bearer ${token}`);
    // Never share an authenticated response through the Next.js data cache.
    return fetch(url.toString(), { ...init, headers, cache: 'no-store' });
  }
  url.searchParams.set('key', apiKey);
  return fetch(url.toString(), { ...init, headers });
}
