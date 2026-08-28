export type UserRole = "admin" | "manager" | "staff";

/** Single key, admin-only, or OR-list (any listed key is enough). */
export type ActionPerm = "admin_only" | string | readonly string[];

export function actionAllowed(
  role: UserRole,
  permissions: Record<string, boolean>,
  required: ActionPerm | undefined
): "allowed" | "forbidden" | "admin_required" {
  if (required == null) return "allowed";
  if (required === "admin_only") return role === "admin" ? "allowed" : "admin_required";
  if (role === "admin") return "allowed";
  const keys = typeof required === "string" ? [required] : required;
  return keys.some((k) => permissions[k]) ? "allowed" : "forbidden";
}
