/** Suggest an Aiosell room-type code from a Goko dorm name. Staff can still edit it. */
export function suggestAiosellRoomCode(dormName: string, dormId: number): string {
  const slug = dormName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `dorm-${dormId}`;
}
