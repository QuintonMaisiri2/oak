/**
 * Allowed domains for administrative access.
 * Default: oakfnd.org, oakfnd.ch, uncommon.org
 */
export function getAllowedAdminDomains(): string[] {
  const envVal = process.env.ADMIN_ALLOWED_DOMAINS || "oakfnd.org,oakfnd.ch,uncommon.org";
  return envVal
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Validates that an email strictly belongs to an authorized admin domain.
 * Exact case-insensitive match against allowed domains.
 * Rejects subdomains (e.g. sub.oakfnd.org), lookalikes (e.g. oakfnd.org.evil.com, oakfnd.co),
 * and public domains (e.g. gmail.com).
 */
export function isValidAdminEmailDomain(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim().toLowerCase();

  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) return false;
  if (trimmed.lastIndexOf("@") !== atIndex) return false;

  const localPart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex + 1);

  if (!/^[a-z0-9._%+-]+$/.test(localPart)) return false;

  const allowed = getAllowedAdminDomains();
  return allowed.includes(domainPart);
}

/**
 * Validates that the authentication provider reports the email as verified (`email_verified === true`).
 */
export function isEmailVerified(
  user: {
    email_confirmed_at?: string | null;
    user_metadata?: Record<string, any>;
    app_metadata?: Record<string, any>;
    identities?: Array<{ identity_data?: Record<string, any> }>;
  } | null | undefined
): boolean {
  if (!user) return false;
  if (user.user_metadata?.email_verified === false || user.app_metadata?.email_verified === false) {
    return false;
  }
  if (user.user_metadata?.email_verified === true) return true;
  if (user.app_metadata?.email_verified === true) return true;
  if (Array.isArray(user.identities)) {
    for (const id of user.identities) {
      if (id?.identity_data?.email_verified === true) {
        return true;
      }
    }
  }
  if (user.email_confirmed_at) return true;
  return false;
}
