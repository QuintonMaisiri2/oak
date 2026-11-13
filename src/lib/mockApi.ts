"use client";

export type AttendeeRole = "Grantee" | "OAK Staff" | "Coordination Team" | "Presenter" | "Observer";

export interface AttendeeRecord {
  registrationId: string;
  firstName: string;
  lastName: string;
  organization: string;
  subPartnerProgramArea?: string;
  role: AttendeeRole;
  email: string;
  phone?: string;
  dietaryRequirements?: string;
  accessibilityRequirements?: string;
  travelRequirements?: string;
  accommodationRequirements?: string;
  
  registrationDate: string;
  registrationStatus: "Registered" | "Pending" | "Cancelled";
  
  qrCodeId?: string | null;
  
  attendanceStatus: "Pending" | "Checked In";
  checkInTime?: string | null;
  checkInDate?: string | null;
  checkIns?: { eventDay: string; scannedAt: string }[];
}

export type FetchAttendeeResult =
  | { success: true; data: AttendeeRecord }
  | { success: false; requiresAuth: true; error: string; unauthorizedAccount?: string }
  | { success: false; requiresAuth?: false; error: string; notFound: true };

export async function fetchAttendee(registrationId: string): Promise<FetchAttendeeResult> {
  if (!registrationId) return { success: false, notFound: true, error: "Missing identifier" };
  const trimmed = decodeURIComponent(registrationId).trim();

  try {
    const res = await fetch(`/api/attendees/${encodeURIComponent(trimmed)}`);
    const json = await res.json().catch(() => ({}));

    if (res.ok) {
      return { success: true, data: json };
    }

    if (res.status === 401 || res.status === 403 || json.requiresAuth) {
      return {
        success: false,
        requiresAuth: true,
        error: json.error || "Sign in with Google is required to view this ticket.",
        unauthorizedAccount: json.unauthorizedAccount,
      };
    }

    return {
      success: false,
      notFound: true,
      error: json.error || "Pass not found",
    };
  } catch (err: any) {
    return { success: false, notFound: true, error: err.message || "Failed to load attendee" };
  }
}

export async function getAttendee(registrationId: string): Promise<AttendeeRecord | undefined> {
  const result = await fetchAttendee(registrationId);
  return result.success ? result.data : undefined;
}

export async function getAllAttendees(day?: string): Promise<AttendeeRecord[]> {
  try {
    const url = day ? `/api/attendees?day=${encodeURIComponent(day)}` : "/api/attendees";
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const serverAttendees = await res.json();
      return Array.isArray(serverAttendees) ? serverAttendees : [];
    } else {
      const errText = await res.text();
      throw new Error(`API failed (${res.status}): ${errText}`);
    }
  } catch (err) {
    console.error("Could not fetch all attendees from server API:", err);
    return [];
  }
}
