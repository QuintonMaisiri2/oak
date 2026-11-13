// Only non-sensitive UI state is returned. Authentication remains server-side.
export interface AttendeeProfile {
  name: string;
  email: string;
  organization: string;
}

export interface SessionStatus {
  isStaff: boolean;
  isSuperAdmin?: boolean;
  adminRole?: "super_admin" | "admin" | null;
  adminTeam?: string | null;
  partnerId: string | null;
  isRegistered: boolean;
  attendee?: AttendeeProfile | null;
}

export async function getSessionStatus(): Promise<SessionStatus> {
  const response = await fetch("/api/auth/session", { cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("Unable to check session");
  return response.json();
}

export async function clearAdminSession() {
  const response = await fetch("/api/auth/logout", { method: "POST" });
  if (!response.ok) throw new Error("Unable to sign out. Please try again.");
  window.dispatchEvent(new Event("oak-admin-auth-changed"));
}
