import { google } from "googleapis";
import { postToSheetsWebhook, sanitizeSheetError } from "@/lib/sheets/sync";

const DEFAULT_SPREADSHEET_ID = "1qKaOFXnL3vhr9YUwCwkzaWVf2k2ZgFB8L83EsjVMm5c";
const DEFAULT_SHEET_TAB_NAME = "1-on-1 Booking Tracker";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export type SheetsAuthMode =
  | "vercel_oidc_wif"
  | "service_account_jwt"
  | "local_adc_impersonation"
  | "apps_script_webhook"
  | "unconfigured";

export interface SheetsAuthDiagnostics {
  activeMode: SheetsAuthMode;
  spreadsheetId: string;
  tabName: string;
  wif: {
    hasWorkloadIdentityProvider: boolean;
    hasServiceAccountEmail: boolean;
    hasVercelOidcToken: boolean;
    isReady: boolean;
  };
  appsScript: {
    hasWebhookUrl: boolean;
    hasWebhookSecret: boolean;
    urlEndsWithExec: boolean;
    isReady: boolean;
  };
}

/**
 * Extracts the Vercel OIDC token from the incoming request header (`x-vercel-oidc-token`)
 * or runtime environment (`VERCEL_OIDC_TOKEN`). Never logs or returns the raw token.
 */
export function getVercelOidcToken(request?: Request): string | null {
  const fromHeader = request?.headers.get("x-vercel-oidc-token")?.trim();
  if (fromHeader) return fromHeader;
  const fromEnv = process.env.VERCEL_OIDC_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  return null;
}

/**
 * Inspects which Google Sheets authentication mode is configured in the current environment.
 */
export function getSheetsAuthDiagnostics(request?: Request): SheetsAuthDiagnostics {
  const spreadsheetId = (
    process.env.SHEET_ID ||
    process.env.GOOGLE_SHEET_ID ||
    DEFAULT_SPREADSHEET_ID
  ).trim();
  const tabName = (process.env.GOOGLE_SHEET_TAB_NAME || DEFAULT_SHEET_TAB_NAME).trim();

  const wifProvider = (process.env.GCP_WORKLOAD_IDENTITY_PROVIDER || "").trim();
  const wifSaEmail = (
    process.env.GCP_SERVICE_ACCOUNT_EMAIL ||
    process.env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT ||
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    ""
  ).trim();
  const oidcToken = getVercelOidcToken(request);

  const wifReady = Boolean(wifProvider && wifSaEmail && oidcToken);

  const webhookUrl = (process.env.SHEETS_WEBHOOK_URL || "").trim();
  const webhookSecret = (process.env.SHEETS_WEBHOOK_SECRET || "").trim();
  const urlEndsWithExec = Boolean(webhookUrl && /\/exec(?:\?.*)?$/i.test(webhookUrl));
  const appsScriptReady = Boolean(webhookUrl && webhookSecret && urlEndsWithExec);

  const hasSaKey = Boolean(
    (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) ||
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  );

  let activeMode: SheetsAuthMode = "unconfigured";
  if (wifReady) {
    activeMode = "vercel_oidc_wif";
  } else if (hasSaKey) {
    activeMode = "service_account_jwt";
  } else if (process.env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT && !process.env.VERCEL) {
    activeMode = "local_adc_impersonation";
  } else if (appsScriptReady) {
    activeMode = "apps_script_webhook";
  }

  return {
    activeMode,
    spreadsheetId,
    tabName,
    wif: {
      hasWorkloadIdentityProvider: Boolean(wifProvider),
      hasServiceAccountEmail: Boolean(wifSaEmail),
      hasVercelOidcToken: Boolean(oidcToken),
      isReady: wifReady,
    },
    appsScript: {
      hasWebhookUrl: Boolean(webhookUrl),
      hasWebhookSecret: Boolean(webhookSecret),
      urlEndsWithExec,
      isReady: appsScriptReady,
    },
  };
}

/**
 * Keyless Production Authentication via Google Cloud Workload Identity Federation (WIF) + Vercel OIDC:
 * 1. Exchanges the short-lived Vercel OIDC JWT at Google STS (`https://sts.googleapis.com/v1/token`)
 *    for a federated STS access token.
 * 2. Exchanges the federated STS token at IAM Credentials (`generateAccessToken`) to impersonate
 *    `GCP_SERVICE_ACCOUNT_EMAIL` with `https://www.googleapis.com/auth/spreadsheets` scope.
 */
export async function exchangeVercelOidcForGoogleAccessToken(
  request?: Request
): Promise<string> {
  const oidcToken = getVercelOidcToken(request);
  if (!oidcToken) {
    throw new Error(
      "Missing Vercel OIDC token (x-vercel-oidc-token header or VERCEL_OIDC_TOKEN env var). Enable OIDC Federation in Vercel Project Settings > Security."
    );
  }

  const providerResource = (process.env.GCP_WORKLOAD_IDENTITY_PROVIDER || "").trim();
  if (!providerResource) {
    throw new Error("Missing GCP_WORKLOAD_IDENTITY_PROVIDER environment variable.");
  }

  const serviceAccountEmail = (
    process.env.GCP_SERVICE_ACCOUNT_EMAIL ||
    process.env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT ||
    ""
  ).trim();
  if (!serviceAccountEmail) {
    throw new Error("Missing GCP_SERVICE_ACCOUNT_EMAIL environment variable.");
  }

  const audience = providerResource.startsWith("//iam.googleapis.com/")
    ? providerResource
    : `//iam.googleapis.com/${providerResource.replace(/^\/+/, "")}`;

  // Step 1: Exchange Vercel OIDC JWT for a Google STS federated access token
  const stsRes = await fetch("https://sts.googleapis.com/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audience,
      grantType: "urn:ietf:params:oauth:grant-type:token-exchange",
      requestedTokenType: "urn:ietf:params:oauth:token-type:access_token",
      scope: "https://www.googleapis.com/auth/cloud-platform",
      subjectTokenType: "urn:ietf:params:oauth:token-type:jwt",
      subjectToken: oidcToken,
    }),
  });

  if (!stsRes.ok) {
    const errText = await stsRes.text();
    throw new Error(`Google STS token exchange failed (HTTP ${stsRes.status}): ${errText.slice(0, 240)}`);
  }

  const stsData = await stsRes.json();
  const federatedToken = stsData.access_token;
  if (!federatedToken) {
    throw new Error("Google STS response did not contain an access_token.");
  }

  // Step 2: Impersonate the target Google Service Account to obtain a Sheets-scoped access token
  const iamUrl = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(
    serviceAccountEmail
  )}:generateAccessToken`;

  const iamRes = await fetch(iamUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${federatedToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      scope: [SHEETS_SCOPE],
      lifetime: "3600s",
    }),
  });

  if (!iamRes.ok) {
    const errText = await iamRes.text();
    throw new Error(
      `Service account impersonation via IAM Credentials failed (HTTP ${iamRes.status}): ${errText.slice(0, 240)}`
    );
  }

  const iamData = await iamRes.json();
  if (!iamData.accessToken) {
    throw new Error("IAM Credentials response did not contain an accessToken.");
  }

  return iamData.accessToken as string;
}

/**
 * Reads the live header row (Row 1) and Slot ID column (Col A) from the Google Sheet
 * using whichever production authentication mode is configured:
 *   1. Keyless Workload Identity Federation (Vercel OIDC -> Google STS -> SA Impersonation)
 *   2. Service Account / Local ADC (`GOOGLE_IMPERSONATE_SERVICE_ACCOUNT`)
 *   3. Keyless Apps Script Web App (`SHEETS_WEBHOOK_URL` with `action: "read_headers"` or `"upsert"`)
 */
export async function verifyLiveSheetHeaderRead(request?: Request): Promise<{
  ok: boolean;
  authMode: SheetsAuthMode;
  spreadsheetId: string;
  tabName: string;
  headers: string[];
  slotRows: Array<{ rowIndex: number; slotId: string; date?: string; time?: string; status?: string }>;
  error: string | null;
  diagnostics: SheetsAuthDiagnostics;
}> {
  const diagnostics = getSheetsAuthDiagnostics(request);
  const { spreadsheetId, tabName } = diagnostics;

  // 1. Try Keyless Vercel OIDC Workload Identity Federation first if configured
  if (diagnostics.wif.hasWorkloadIdentityProvider && diagnostics.wif.hasServiceAccountEmail) {
    try {
      const accessToken = await exchangeVercelOidcForGoogleAccessToken(request);
      const range = encodeURIComponent(`'${tabName}'!A1:P50`);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${range}?valueRenderOption=FORMATTED_VALUE`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      });

      if (!res.ok) {
        const errBody = await res.text();
        return {
          ok: false,
          authMode: "vercel_oidc_wif",
          spreadsheetId,
          tabName,
          headers: [],
          slotRows: [],
          error: sanitizeSheetError(`Sheets v4 GET failed (HTTP ${res.status}): ${errBody}`),
          diagnostics,
        };
      }

      const data = await res.json();
      const rows: string[][] = Array.isArray(data?.values) ? data.values : [];
      const headers = (rows[0] || []).map((h) => String(h));
      const slotRows = rows.slice(1).map((r, idx) => ({
        rowIndex: idx + 2,
        slotId: String(r?.[0] || "").trim(),
        date: String(r?.[1] || "").trim(),
        time: String(r?.[2] || "").trim(),
        status: String(r?.[11] || "").trim(),
      }));

      return {
        ok: headers.length > 0,
        authMode: "vercel_oidc_wif",
        spreadsheetId,
        tabName,
        headers,
        slotRows,
        error: headers.length > 0 ? null : "Sheet returned empty header row",
        diagnostics,
      };
    } catch (err) {
      return {
        ok: false,
        authMode: "vercel_oidc_wif",
        spreadsheetId,
        tabName,
        headers: [],
        slotRows: [],
        error: sanitizeSheetError(err),
        diagnostics,
      };
    }
  }

  // 2. Try Local ADC / Service Account if configured outside Vercel
  if (diagnostics.activeMode === "service_account_jwt" || diagnostics.activeMode === "local_adc_impersonation") {
    try {
      const authOptions: Record<string, any> = {
        scopes: [SHEETS_SCOPE],
      };
      if (process.env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT) {
        authOptions.clientOptions = {
          impersonateServiceAccount: process.env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT.trim(),
        };
      }
      const auth = new google.auth.GoogleAuth(authOptions);
      const sheets = google.sheets({ version: "v4", auth });
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${tabName}'!A1:P50`,
        valueRenderOption: "FORMATTED_VALUE",
      });
      const rows = res.data.values || [];
      const headers = (rows[0] || []).map((h) => String(h));
      const slotRows = rows.slice(1).map((r, idx) => ({
        rowIndex: idx + 2,
        slotId: String(r?.[0] || "").trim(),
        date: String(r?.[1] || "").trim(),
        time: String(r?.[2] || "").trim(),
        status: String(r?.[11] || "").trim(),
      }));

      return {
        ok: headers.length > 0,
        authMode: diagnostics.activeMode,
        spreadsheetId,
        tabName,
        headers,
        slotRows,
        error: null,
        diagnostics,
      };
    } catch (err) {
      return {
        ok: false,
        authMode: diagnostics.activeMode,
        spreadsheetId,
        tabName,
        headers: [],
        slotRows: [],
        error: sanitizeSheetError(err),
        diagnostics,
      };
    }
  }

  // 3. Try Keyless Apps Script Web App (`action: "read_headers"`)
  if (diagnostics.appsScript.isReady) {
    const res = await postToSheetsWebhook({
      action: "read_headers" as any,
      tabName,
    } as any);

    if (res.ok && res.data) {
      const headers: string[] = Array.isArray(res.data.headers) ? res.data.headers : [];
      const slotRows = Array.isArray(res.data.slotRows) ? res.data.slotRows : [];
      return {
        ok: true,
        authMode: "apps_script_webhook",
        spreadsheetId,
        tabName: res.data.tabName || tabName,
        headers,
        slotRows,
        error: null,
        diagnostics,
      };
    }

    return {
      ok: false,
      authMode: "apps_script_webhook",
      spreadsheetId,
      tabName,
      headers: [],
      slotRows: [],
      error: res.error || "Apps Script read_headers call failed",
      diagnostics,
    };
  }

  return {
    ok: false,
    authMode: "unconfigured",
    spreadsheetId,
    tabName,
    headers: [],
    slotRows: [],
    error:
      "Neither Workload Identity Federation (GCP_WORKLOAD_IDENTITY_PROVIDER + GCP_SERVICE_ACCOUNT_EMAIL) nor Apps Script Webhook (SHEETS_WEBHOOK_URL + SHEETS_WEBHOOK_SECRET) is configured.",
    diagnostics,
  };
}
