import { isValidAdminEmailDomain } from "./domains";

export interface AdminUserRecord {
  id?: string;
  email: string;
  full_name: string;
  role: "super_admin" | "admin";
  team: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Returns the configured super admin email.
 * Defaults to vincent@uncommon.org if not set in environment.
 */
export function getSuperAdminEmail(): string {
  const envEmail = process.env.SUPER_ADMIN_EMAIL?.toLowerCase().trim();
  if (envEmail && isValidAdminEmailDomain(envEmail)) {
    return envEmail;
  }
  return "vincent@uncommon.org";
}

export const SEEDED_ADMIN_USERS: AdminUserRecord[] = [
  // Tapiwa Chikwanha - role is 'admin' (not super_admin)
  {
    email: "tapiwa.chikwanha@uncommon.org",
    full_name: "Tapiwa Chikwanha",
    role: "admin",
    team: "Coordination Team",
    is_active: true,
  },

  // Designated Super Admin (Vincent Mugondora)
  {
    email: "vincent@uncommon.org",
    full_name: "Vincent Mugondora",
    role: "super_admin",
    team: "Coordination Team",
    is_active: true,
  },

  // Uncommon (role: admin), team: Coordination Team
  {
    email: "walter@uncommon.org",
    full_name: "Walter Gombarume",
    role: "admin",
    team: "Coordination Team",
    is_active: true,
  },
  {
    email: "michelle.gwatiringa@uncommon.org",
    full_name: "Michelle Gwatiringa",
    role: "admin",
    team: "Coordination Team",
    is_active: true,
  },
  {
    email: "tanatswa@uncommon.org",
    full_name: "Tanatswa Lionde",
    role: "admin",
    team: "Coordination Team",
    is_active: true,
  },
  {
    email: "kirsty@uncommon.org",
    full_name: "Kirsty Matyukira",
    role: "admin",
    team: "Coordination Team",
    is_active: true,
  },
  {
    email: "farayi@uncommon.org",
    full_name: "Farayi Nyamayaro",
    role: "admin",
    team: "Coordination Team",
    is_active: true,
  },
  {
    email: "elisha.urombo@uncommon.org",
    full_name: "Elisha Urombo",
    role: "admin",
    team: "Coordination Team",
    is_active: true,
  },
  {
    email: "beyond@uncommon.org",
    full_name: "Beyond Bechani",
    role: "admin",
    team: "Coordination Team",
    is_active: true,
  },
  {
    email: "noriahmarecha@uncommon.org",
    full_name: "Noriah Marecha",
    role: "admin",
    team: "Coordination Team",
    is_active: true,
  },
  {
    email: "khesani@uncommon.org",
    full_name: "Khesani Majoko",
    role: "admin",
    team: "Coordination Team",
    is_active: true,
  },
  {
    email: "comms@uncommon.org",
    full_name: "Oak Comms",
    role: "admin",
    team: "Coordination Team",
    is_active: true,
  },

  // OAK (role: admin), team: OAK
  {
    email: "karl.riber@oakfnd.org",
    full_name: "Karl Riber",
    role: "admin",
    team: "OAK",
    is_active: true,
  },
  {
    email: "adriana.craciun@oakfnd.ch",
    full_name: "Adriana Craciun",
    role: "admin",
    team: "OAK",
    is_active: true,
  },
  {
    email: "merciful.machuwe@oakfnd.org",
    full_name: "Merciful Machuwe",
    role: "admin",
    team: "OAK",
    is_active: true,
  },
  {
    email: "cheryl.chang@oakfnd.ch",
    full_name: "Cheryl Chang",
    role: "admin",
    team: "OAK",
    is_active: true,
  },
  {
    email: "silvia.guizzardi@oakfnd.ch",
    full_name: "Silvia Guizzardi",
    role: "admin",
    team: "OAK",
    is_active: true,
  },
];

// Helper to identify shared or role-based mailboxes
export function isSharedMailbox(email: string): boolean {
  if (!email) return false;
  const prefix = email.split("@")[0].toLowerCase().trim();
  const sharedPrefixes = [
    "comms",
    "info",
    "contact",
    "admin",
    "support",
    "press",
    "media",
    "events",
    "team",
    "office",
    "operations",
    "coordination",
  ];
  return sharedPrefixes.includes(prefix);
}

// Memory cache of runtime overrides for local/development/resilience fallback
const memoryAdminOverrides = new Map<string, AdminUserRecord>();

// Helper to dynamically adjust seed list if SUPER_ADMIN_EMAIL environment variable is set
function getEffectiveSeedList(): AdminUserRecord[] {
  const designatedSuperAdmin = getSuperAdminEmail();
  return SEEDED_ADMIN_USERS.map((user) => {
    if (user.email === designatedSuperAdmin) {
      return { ...user, role: "super_admin" as const };
    }
    // Tapiwa must strictly be 'admin'
    if (user.email === "tapiwa.chikwanha@uncommon.org") {
      return { ...user, role: "admin" as const };
    }
    // If designated super admin is someone else, ensure others remain admin
    if (user.role === "super_admin" && user.email !== designatedSuperAdmin) {
      return { ...user, role: "admin" as const };
    }
    return user;
  });
}

// Synchronous check against seeded admin list
export function isSeededAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  const seeds = getEffectiveSeedList();
  return seeds.some((u) => u.email === normalized && u.is_active);
}

export function getSeededAdmin(email: string | null | undefined): AdminUserRecord | null {
  if (!email) return null;
  const normalized = email.toLowerCase().trim();
  const seeds = getEffectiveSeedList();
  const found = seeds.find((u) => u.email === normalized);
  if (found) return found;

  // If a custom SUPER_ADMIN_EMAIL was set and not in SEEDED_ADMIN_USERS list, auto-seed it
  const designatedSuper = getSuperAdminEmail();
  if (normalized === designatedSuper && isValidAdminEmailDomain(designatedSuper)) {
    const isOak = designatedSuper.endsWith("@oakfnd.org") || designatedSuper.endsWith("@oakfnd.ch");
    return {
      email: designatedSuper,
      full_name: designatedSuper.split("@")[0].replace(/[._]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      role: "super_admin",
      team: isOak ? "OAK" : "Coordination Team",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return null;
}

async function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes("your-project")) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Fetch an admin user by email (normalised to lowercase).
 * Checks the database table `admin_users` first.
 * If the database table is not yet present or query fails,
 * falls back to the authoritative seeded list with any in-memory updates.
 */
export async function getAdminUser(email: string | null | undefined): Promise<AdminUserRecord | null> {
  if (!email) return null;
  const normalized = email.toLowerCase().trim();

  if (!isValidAdminEmailDomain(normalized)) {
    return null;
  }

  try {
    const adminClient = await getSupabaseAdmin();
    if (adminClient) {
      const { data, error } = await adminClient
        .from("admin_users")
        .select("id, email, full_name, role, team, is_active, created_at, updated_at")
        .eq("email", normalized)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          email: data.email.toLowerCase().trim(),
          full_name: data.full_name,
          role: data.role as "super_admin" | "admin",
          team: data.team || "Coordination Team",
          is_active: Boolean(data.is_active),
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
      }

      // If the query worked and explicitly returned null, check memory override
      if (!error && data === null) {
        if (memoryAdminOverrides.has(normalized)) {
          return memoryAdminOverrides.get(normalized) || null;
        }
        return null;
      }
    }
  } catch (err) {
    console.warn("[getAdminUser] Database query failed, falling back to static seeds:", err);
  }

  // Fallback: in-memory overrides or seeded list
  if (memoryAdminOverrides.has(normalized)) {
    return memoryAdminOverrides.get(normalized) || null;
  }
  return getSeededAdmin(normalized);
}

/**
 * List all admin users.
 */
export async function listAdminUsers(): Promise<AdminUserRecord[]> {
  try {
    const adminClient = await getSupabaseAdmin();
    if (adminClient) {
      const { data, error } = await adminClient
        .from("admin_users")
        .select("id, email, full_name, role, team, is_active, created_at, updated_at")
        .order("created_at", { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((d) => ({
          id: d.id,
          email: d.email.toLowerCase().trim(),
          full_name: d.full_name,
          role: d.role as "super_admin" | "admin",
          team: d.team || "Coordination Team",
          is_active: Boolean(d.is_active),
          created_at: d.created_at,
          updated_at: d.updated_at,
        }));
      }
    }
  } catch (err) {
    console.warn("[listAdminUsers] Database lookup error, using seeds:", err);
  }

  // Combine seeded admins with memory overrides
  const result: AdminUserRecord[] = [];
  const map = new Map<string, AdminUserRecord>();

  for (const user of getEffectiveSeedList()) {
    map.set(user.email, { ...user });
  }

  // Also include custom super admin if not present
  const designatedSuper = getSuperAdminEmail();
  if (!map.has(designatedSuper)) {
    const customSuper = getSeededAdmin(designatedSuper);
    if (customSuper) map.set(designatedSuper, customSuper);
  }

  for (const [email, user] of memoryAdminOverrides.entries()) {
    map.set(email, user);
  }

  for (const user of map.values()) {
    result.push(user);
  }

  return result;
}

/**
 * Create a new admin user.
 */
export async function createAdminUser(params: {
  email: string;
  full_name: string;
  role?: "super_admin" | "admin";
  team: string;
}): Promise<AdminUserRecord> {
  const normalizedEmail = params.email.toLowerCase().trim();

  if (!isValidAdminEmailDomain(normalizedEmail)) {
    throw new Error("Invalid domain. Email must belong to oakfnd.org, oakfnd.ch, or uncommon.org.");
  }

  const existing = await getAdminUser(normalizedEmail);
  if (existing) {
    throw new Error(`An admin with email "${normalizedEmail}" already exists.`);
  }

  const newAdmin: AdminUserRecord = {
    email: normalizedEmail,
    full_name: params.full_name.trim(),
    role: params.role || "admin",
    team: params.team.trim() || "Coordination Team",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const adminClient = await getSupabaseAdmin();
    if (adminClient) {
      const { data, error } = await adminClient
        .from("admin_users")
        .insert({
          email: newAdmin.email,
          full_name: newAdmin.full_name,
          role: newAdmin.role,
          team: newAdmin.team,
          is_active: newAdmin.is_active,
        })
        .select()
        .single();

      if (error) {
        console.error("[createAdminUser] DB error:", error);
      } else if (data) {
        newAdmin.id = data.id;
      }
    }
  } catch (err) {
    console.warn("[createAdminUser] Database fallback mode:", err);
  }

  memoryAdminOverrides.set(normalizedEmail, newAdmin);
  return newAdmin;
}

/**
 * Update an admin's role ('super_admin' | 'admin').
 */
export async function updateAdminUserRole(
  email: string,
  role: "super_admin" | "admin",
  actorEmail?: string
): Promise<AdminUserRecord> {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedActor = actorEmail?.toLowerCase().trim();

  const existing = await getAdminUser(normalizedEmail);
  if (!existing) {
    throw new Error(`Admin user "${normalizedEmail}" not found.`);
  }

  // Protection: A super admin cannot demote themselves
  if (normalizedActor && normalizedEmail === normalizedActor && existing.role === "super_admin" && role !== "super_admin") {
    throw new Error("Security restriction: A super administrator cannot demote their own account.");
  }

  // Protection: There must always be at least one active super admin
  if (existing.role === "super_admin" && role !== "super_admin") {
    const allAdmins = await listAdminUsers();
    const remainingActiveSuper = allAdmins.filter(
      (a) => a.role === "super_admin" && a.is_active && a.email !== normalizedEmail
    );
    if (remainingActiveSuper.length === 0) {
      throw new Error("Security restriction: Cannot demote this super administrator. There must always be at least one active super administrator.");
    }
  }

  const updated: AdminUserRecord = {
    ...existing,
    role,
    updated_at: new Date().toISOString(),
  };

  try {
    const adminClient = await getSupabaseAdmin();
    if (adminClient) {
      const { error } = await adminClient
        .from("admin_users")
        .update({ role, updated_at: updated.updated_at })
        .eq("email", normalizedEmail);

      if (error) {
        console.error("[updateAdminUserRole] DB error:", error);
      }
    }
  } catch (err) {
    console.warn("[updateAdminUserRole] Database fallback mode:", err);
  }

  memoryAdminOverrides.set(normalizedEmail, updated);
  return updated;
}

/**
 * Update an admin's active status.
 */
export async function updateAdminUserStatus(
  email: string,
  is_active: boolean,
  actorEmail?: string
): Promise<AdminUserRecord> {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedActor = actorEmail?.toLowerCase().trim();

  const existing = await getAdminUser(normalizedEmail);
  if (!existing) {
    throw new Error(`Admin user "${normalizedEmail}" not found.`);
  }

  // Protection: A super admin cannot deactivate themselves
  if (normalizedActor && normalizedEmail === normalizedActor && !is_active) {
    throw new Error("Security restriction: You cannot deactivate your own super administrator account.");
  }

  // Protection: There must always be at least one active super admin
  if (existing.role === "super_admin" && !is_active) {
    const allAdmins = await listAdminUsers();
    const activeSuperAdmins = allAdmins.filter(
      (a) => a.role === "super_admin" && a.is_active && a.email !== normalizedEmail
    );
    if (activeSuperAdmins.length === 0) {
      throw new Error("Security restriction: Cannot deactivate this super administrator. There must always be at least one active super administrator.");
    }
  }

  const updated: AdminUserRecord = {
    ...existing,
    is_active,
    updated_at: new Date().toISOString(),
  };

  try {
    const adminClient = await getSupabaseAdmin();
    if (adminClient) {
      const { error } = await adminClient
        .from("admin_users")
        .update({ is_active, updated_at: updated.updated_at })
        .eq("email", normalizedEmail);

      if (error) {
        console.error("[updateAdminUserStatus] DB error:", error);
      }
    }
  } catch (err) {
    console.warn("[updateAdminUserStatus] Database fallback mode:", err);
  }

  memoryAdminOverrides.set(normalizedEmail, updated);
  return updated;
}

/**
 * Remove an admin user.
 */
export async function deleteAdminUser(email: string, actorEmail?: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedActor = actorEmail?.toLowerCase().trim();

  const existing = await getAdminUser(normalizedEmail);
  if (!existing) {
    throw new Error(`Admin user "${normalizedEmail}" not found.`);
  }

  // Protection: A super admin cannot remove themselves
  if (normalizedActor && normalizedEmail === normalizedActor) {
    throw new Error("Security restriction: You cannot remove your own super administrator account.");
  }

  // Protection: There must always be at least one active super admin
  if (existing.role === "super_admin") {
    const allAdmins = await listAdminUsers();
    const activeSuperAdmins = allAdmins.filter(
      (a) => a.role === "super_admin" && a.is_active && a.email !== normalizedEmail
    );
    if (activeSuperAdmins.length === 0) {
      throw new Error("Security restriction: Cannot remove this super administrator. There must always be at least one active super administrator.");
    }
  }

  try {
    const adminClient = await getSupabaseAdmin();
    if (adminClient) {
      const { error } = await adminClient
        .from("admin_users")
        .delete()
        .eq("email", normalizedEmail);

      if (error) {
        console.error("[deleteAdminUser] DB error:", error);
      }
    }
  } catch (err) {
    console.warn("[deleteAdminUser] Database fallback mode:", err);
  }

  // Mark deactivated or removed in memory
  memoryAdminOverrides.set(normalizedEmail, {
    ...existing,
    is_active: false,
    updated_at: new Date().toISOString(),
  });

  return true;
}
