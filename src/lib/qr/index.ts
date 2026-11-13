/**
 * Generates a human-readable event code matching the OAK convening format:
 * e.g., OAK-2026-7842-XKPH
 */
export function generateEventCode(): string {
  const digits = Math.floor(1000 + Math.random() * 9000).toString();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit ambiguous I, O, 0, 1
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `OAK-2026-${digits}-${suffix}`;
}

/**
 * Extracts candidate attendee identifier (UUID or Event Code) from a scanned string.
 * Supports:
 * - Plain UUID: 123e4567-e89b-12d3-a456-426614174000
 * - Event Code: OAK-2026-XXXX-XXXX
 * - JSON string: {"id":"...", "eventCode":"..."}
 * - URL: https://.../pass/123e4567-e89b-12d3-a456-426614174000
 */
export const MAX_QR_PAYLOAD_LENGTH = 2048;

export function parseScannedQrPayload(rawPayload: string): string {
  if (typeof rawPayload !== 'string' || rawPayload.length > MAX_QR_PAYLOAD_LENGTH) return '';
  const trimmed = rawPayload.trim();

  // 1. JSON payload
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.id && typeof parsed.id === 'string') return parsed.id.trim();
      if (parsed.eventCode && typeof parsed.eventCode === 'string') return parsed.eventCode.trim();
      if (parsed.code && typeof parsed.code === 'string') return parsed.code.trim();
    } catch {
      return '';
    }
    return '';
  }

  // 2. URL containing pass link (/pass/<id>)
  const passUrlMatch = trimmed.match(/\/pass\/([a-zA-Z0-9_-]+)/);
  if (passUrlMatch && passUrlMatch[1]) {
    return passUrlMatch[1];
  }

  // 3. Plain UUID or Event Code or raw string
  return trimmed;
}

/**
 * Validates if the string is formatted as an OAK event code.
 */
export function isEventCode(code: string): boolean {
  return /^OAK-2026-\d{4}-[A-Z0-9]{4}$/i.test(code.trim());
}

/**
 * Validates if the string is formatted as a standard UUID v4.
 */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}
