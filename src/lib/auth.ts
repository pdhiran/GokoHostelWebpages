import { getUserByUsername, getAllUsers } from "@/db/queries";
import type { UserRole } from "@/lib/actionPermissions";

export type { UserRole };

export type AuthResult = {
  role: UserRole;
  displayName: string;
  permissions: Record<string, boolean>;
};

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "goko-salt-2026");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

export async function authenticateUser(password: string, username?: string): Promise<AuthResult | null> {
  if (!password) return null;

  if (!username) {
    if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) return { role: "admin", displayName: "Admin", permissions: {} };
    if (process.env.MANAGER_PASSWORD && password === process.env.MANAGER_PASSWORD) return { role: "manager", displayName: "Manager", permissions: {} };
    return null;
  }

  if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD && username === "admin") return { role: "admin", displayName: "Admin", permissions: {} };
  if (process.env.MANAGER_PASSWORD && password === process.env.MANAGER_PASSWORD && username === "manager") return { role: "manager", displayName: "Manager", permissions: {} };

  try {
    const user = await getUserByUsername(username);
    if (!user) return null;
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return null;
    let permissions: Record<string, boolean> = {};
    try { permissions = JSON.parse(user.permissions || "{}"); } catch {}
    return { role: (user.role as UserRole) || "manager", displayName: user.displayName || username, permissions };
  } catch {
    return null;
  }
}

export async function authenticateSimple(password: string, username?: string): Promise<boolean> {
  const result = await authenticateUser(password, username);
  return result !== null;
}

export async function authenticateKitchen(password: string): Promise<{ role: UserRole; displayName: string } | null> {
  if (!password) return null;

  if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) return { role: "admin", displayName: "Admin" };
  if (process.env.MANAGER_PASSWORD && password === process.env.MANAGER_PASSWORD) return { role: "manager", displayName: "Manager" };

  try {
    const computed = await hashPassword(password);
    const allUsers = await getAllUsers();
    for (const user of allUsers) {
      if (computed === user.passwordHash) {
        return { role: (user.role as UserRole) || "staff", displayName: user.displayName || user.username };
      }
    }
  } catch {}

  return null;
}
