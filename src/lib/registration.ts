/**
 * Public registration for the convening. Closed now that the event (9-11 November 2026) has ended.
 * To reopen it, set NEXT_PUBLIC_REGISTRATION_OPEN=true in the environment and redeploy.
 * Admin tools for managing existing attendees are not affected.
 */
export const REGISTRATION_OPEN = process.env.NEXT_PUBLIC_REGISTRATION_OPEN === "true";
