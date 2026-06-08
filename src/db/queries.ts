import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { getDb } from "./index";
import { checkins, dorms, beds, bedHistory, settings, apiStats, users, auditLog, systemLogs, rateScrapes, bookings, menuCategories, menuItems, foodOrders, foodOrderItems, orderModifications } from "./schema";

// --- Check-ins ---

export async function getCheckinsByMonth(month: string) {
  const db = getDb();
  return db.select().from(checkins).where(eq(checkins.createdMonth, month)).orderBy(desc(checkins.id));
}

export async function addCheckin(data: {
  submittedAt: string; arrivalDate: string; arrivalTime: string; name: string;
  persons: string; contact: string; stayingDays: string; comingFrom: string;
  nationality: string; emergencyName: string; emergencyPhone: string;
  idType: string; idCardLink: string; visaLink: string; verified: string;
  formCData?: string; createdMonth: string;
  bookingPlatform?: string; bookingId?: string;
}) {
  const db = getDb();
  return db.insert(checkins).values(data);
}

export async function updateCheckin(id: number, data: Partial<typeof checkins.$inferInsert>) {
  const db = getDb();
  return db.update(checkins).set(data).where(eq(checkins.id, id));
}

export async function deleteCheckin(id: number) {
  const db = getDb();
  return db.delete(checkins).where(eq(checkins.id, id));
}

export async function getLatestCheckinByContact(contact: string) {
  const db = getDb();
  const rows = await db.select().from(checkins)
    .where(eq(checkins.contact, contact))
    .orderBy(desc(checkins.id))
    .limit(1);
  return rows[0] || null;
}

export async function getCheckinMonths(): Promise<string[]> {
  const db = getDb();
  const rows = await db.selectDistinct({ month: checkins.createdMonth }).from(checkins);
  return rows.map((r) => r.month);
}

// --- Dorms ---

export async function getAllDorms() {
  const db = getDb();
  return db.select().from(dorms);
}

export async function getDormByName(name: string) {
  const db = getDb();
  const rows = await db.select().from(dorms).where(eq(dorms.name, name));
  return rows[0] || null;
}

export async function addDorm(name: string) {
  const db = getDb();
  return db.insert(dorms).values({ name, createdAt: new Date().toISOString() });
}

export async function deleteDormAndBeds(dormId: number) {
  const db = getDb();
  await db.delete(beds).where(eq(beds.dormId, dormId));
  await db.delete(dorms).where(eq(dorms.id, dormId));
}

// --- Beds ---

export async function getAllBeds() {
  const db = getDb();
  return db.select({
    id: beds.id,
    dormId: beds.dormId,
    bedId: beds.bedId,
    position: beds.position,
    type: beds.type,
    status: beds.status,
    guestName: beds.guestName,
    guestContact: beds.guestContact,
    checkinDate: beds.checkinDate,
    expectedCheckout: beds.expectedCheckout,
    stayingDays: beds.stayingDays,
    dormName: dorms.name,
  }).from(beds).innerJoin(dorms, eq(beds.dormId, dorms.id));
}

export async function getBedById(bedId: number) {
  const db = getDb();
  const rows = await db.select({
    id: beds.id,
    dormId: beds.dormId,
    bedId: beds.bedId,
    position: beds.position,
    type: beds.type,
    status: beds.status,
    guestName: beds.guestName,
    guestContact: beds.guestContact,
    checkinDate: beds.checkinDate,
    expectedCheckout: beds.expectedCheckout,
    stayingDays: beds.stayingDays,
    dormName: dorms.name,
  }).from(beds).innerJoin(dorms, eq(beds.dormId, dorms.id)).where(eq(beds.id, bedId));
  return rows[0] || null;
}

export async function updateBedStatus(bedId: number, data: {
  status: string;
  guestName?: string;
  guestContact?: string;
  checkinDate?: string;
  expectedCheckout?: string;
  stayingDays?: string;
}) {
  const db = getDb();
  return db.update(beds).set(data).where(eq(beds.id, bedId));
}

export async function addBed(data: { dormId: number; dormName: string; bedId: string; position: string; type: string }) {
  const db = getDb();
  return db.insert(beds).values({ ...data, status: "available", guestName: "", guestContact: "", checkinDate: "", expectedCheckout: "", stayingDays: "" });
}

export async function deleteBed(bedId: number) {
  const db = getDb();
  return db.delete(beds).where(eq(beds.id, bedId));
}

// --- Bed History ---

export async function logBedHistoryEntry(data: {
  bedIdLabel: string; dormName: string; action: string; guestName: string; guestContact: string;
}) {
  const db = getDb();
  return db.insert(bedHistory).values({ ...data, createdAt: new Date().toISOString() });
}

export async function getBedHistoryAll() {
  const db = getDb();
  return db.select().from(bedHistory).orderBy(desc(bedHistory.id));
}

export async function deleteBedHistoryEntry(id: number) {
  const db = getDb();
  return db.delete(bedHistory).where(eq(bedHistory.id, id));
}

// --- Settings ---

export async function getSetting(key: string): Promise<string | null> {
  const db = getDb();
  const rows = await db.select().from(settings).where(eq(settings.key, key));
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  const db = getDb();
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({
    target: settings.key,
    set: { value },
  });
}

// --- API Stats ---

export async function incrementStat(apiType: "vision" | "sheets" | "drive", count = 1) {
  const db = getDb();
  const month = getMonthKey();

  const existing = await db.select().from(apiStats).where(eq(apiStats.month, month));
  if (existing.length > 0) {
    const row = existing[0];
    const updated = {
      vision: row.vision + (apiType === "vision" ? count : 0),
      sheets: row.sheets + (apiType === "sheets" ? count : 0),
      drive: row.drive + (apiType === "drive" ? count : 0),
      total: 0,
    };
    updated.total = updated.vision + updated.sheets + updated.drive;
    await db.update(apiStats).set(updated).where(eq(apiStats.month, month));
  } else {
    const vision = apiType === "vision" ? count : 0;
    const sheets = apiType === "sheets" ? count : 0;
    const drive = apiType === "drive" ? count : 0;
    await db.insert(apiStats).values({ month, vision, sheets, drive, total: vision + sheets + drive });
  }
}

export async function getAllStats() {
  const db = getDb();
  return db.select().from(apiStats).orderBy(apiStats.month);
}

// --- Helpers ---

export function getMonthKey(date?: Date): string {
  const d = date && !isNaN(date.getTime()) ? date : new Date();
  const months = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  return `${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

// --- Users ---

export async function getAllUsers() {
  const db = getDb();
  return db.select().from(users).orderBy(users.id);
}

export async function getUserByUsername(username: string) {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return rows[0] || null;
}

export async function createUser(data: {
  username: string; passwordHash: string; displayName: string;
  role: string; permissions: string; createdBy?: string;
}) {
  const db = getDb();
  return db.insert(users).values({
    ...data,
    createdAt: new Date().toISOString(),
    createdBy: data.createdBy || "",
    isSystem: 0,
  });
}

export async function updateUser(userId: number, data: {
  displayName?: string; passwordHash?: string; role?: string; permissions?: string;
}) {
  const db = getDb();
  const updateData: any = {};
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.passwordHash !== undefined) updateData.passwordHash = data.passwordHash;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.permissions !== undefined) updateData.permissions = data.permissions;
  return db.update(users).set(updateData).where(eq(users.id, userId));
}

export async function deleteUser(userId: number) {
  const db = getDb();
  return db.delete(users).where(eq(users.id, userId));
}

// --- Audit Log ---

export async function addAuditEntry(data: {
  username: string; action: string; target?: string; details?: string; userId?: number; ipAddress?: string;
}) {
  const db = getDb();
  return db.insert(auditLog).values({
    timestamp: new Date().toISOString(),
    username: data.username,
    action: data.action,
    target: data.target || "",
    details: data.details || "",
    userId: data.userId,
    ipAddress: data.ipAddress || "",
  });
}

export async function getAuditEntries(limit = 500) {
  const db = getDb();
  return db.select().from(auditLog).orderBy(desc(auditLog.id)).limit(limit);
}

// --- System Logs ---

const LOG_LEVELS: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export async function addSystemLog(data: {
  level: string; source: string; message: string; details?: string; requestId?: string;
}) {
  try {
    const configuredLevel = await getSetting("log_level") || "info";
    const configuredPriority = LOG_LEVELS[configuredLevel] ?? 3;
    const messagePriority = LOG_LEVELS[data.level] ?? 0;

    if (messagePriority < configuredPriority) return;

    const db = getDb();
    return db.insert(systemLogs).values({
      timestamp: new Date().toISOString(),
      level: data.level,
      source: data.source,
      message: data.message,
      details: data.details || "",
      requestId: data.requestId || "",
    });
  } catch {
    // Fail silently — logging should never break the app
  }
}

export async function getSystemLogs(limit = 200) {
  const db = getDb();
  return db.select().from(systemLogs).orderBy(desc(systemLogs.id)).limit(limit);
}

// --- Bookings ---

export async function getAllBookings() {
  const db = getDb();
  return db.select().from(bookings).orderBy(desc(bookings.id));
}

export async function getUpcomingBookings() {
  const db = getDb();
  const today = new Date().toISOString().split("T")[0];
  return db.select().from(bookings)
    .where(and(
      eq(bookings.status, "confirmed"),
      sql`${bookings.checkinDate} >= ${today}`
    ))
    .orderBy(bookings.checkinDate);
}

export async function addBooking(data: {
  guestName: string; contact?: string; platform: string; bookingRef?: string;
  checkinDate: string; checkoutDate?: string; roomType?: string; persons?: number;
  paymentStatus?: string; specialRequests?: string; status?: string; source?: string; rawData?: string;
}) {
  const db = getDb();
  return db.insert(bookings).values({
    guestName: data.guestName,
    contact: data.contact || "",
    platform: data.platform,
    bookingRef: data.bookingRef || "",
    checkinDate: data.checkinDate,
    checkoutDate: data.checkoutDate || "",
    roomType: data.roomType || "",
    persons: data.persons || 1,
    paymentStatus: data.paymentStatus || "unknown",
    specialRequests: data.specialRequests || "",
    status: data.status || "confirmed",
    source: data.source || "manual",
    rawData: data.rawData || "",
    createdAt: new Date().toISOString(),
    syncedAt: "",
  });
}

export async function updateBookingStatus(id: number, status: string) {
  const db = getDb();
  return db.update(bookings).set({ status }).where(eq(bookings.id, id));
}

export async function deleteBooking(id: number) {
  const db = getDb();
  return db.delete(bookings).where(eq(bookings.id, id));
}

// --- Rate Scrapes ---

export async function createRateScrape(data: { city: string; startDate: string; endDate: string; propertyType: string }) {
  const db = getDb();
  const result = await db.insert(rateScrapes).values({
    city: data.city,
    startDate: data.startDate,
    endDate: data.endDate,
    propertyType: data.propertyType,
    status: "pending",
    results: "",
    createdAt: new Date().toISOString(),
    completedAt: "",
  }).returning();
  return result[0];
}

export async function getLatestRateScrape(city: string) {
  const db = getDb();
  const rows = await db.select().from(rateScrapes)
    .where(eq(rateScrapes.city, city))
    .orderBy(desc(rateScrapes.id))
    .limit(1);
  return rows[0] || null;
}

export async function getRateScrapeById(id: number) {
  const db = getDb();
  const rows = await db.select().from(rateScrapes).where(eq(rateScrapes.id, id)).limit(1);
  return rows[0] || null;
}

export async function updateRateScrape(id: number, data: { status?: string; results?: string; completedAt?: string }) {
  const db = getDb();
  return db.update(rateScrapes).set(data).where(eq(rateScrapes.id, id));
}

// --- Menu Categories ---

export async function getActiveMenuCategories() {
  const db = getDb();
  return db.select().from(menuCategories)
    .where(eq(menuCategories.isActive, 1))
    .orderBy(menuCategories.displayOrder);
}

export async function getAllMenuCategories() {
  const db = getDb();
  return db.select().from(menuCategories).orderBy(menuCategories.displayOrder);
}

export async function addMenuCategory(data: { name: string; nameKannada?: string; icon?: string; description?: string; displayOrder?: number }) {
  const db = getDb();
  return db.insert(menuCategories).values({
    name: data.name,
    nameKannada: data.nameKannada || "",
    icon: data.icon || "🍽️",
    description: data.description || "",
    displayOrder: data.displayOrder || 0,
    isActive: 1,
  });
}

export async function updateMenuCategory(id: number, data: Partial<typeof menuCategories.$inferInsert>) {
  const db = getDb();
  return db.update(menuCategories).set(data).where(eq(menuCategories.id, id));
}

export async function deleteMenuCategory(id: number) {
  const db = getDb();
  await db.delete(menuItems).where(eq(menuItems.categoryId, id));
  await db.delete(menuCategories).where(eq(menuCategories.id, id));
}

// --- Menu Items ---

export async function getAvailableMenuItems() {
  const db = getDb();
  return db.select({
    id: menuItems.id,
    categoryId: menuItems.categoryId,
    name: menuItems.name,
    nameKannada: menuItems.nameKannada,
    description: menuItems.description,
    price: menuItems.price,
    priceText: menuItems.priceText,
    tags: menuItems.tags,
    ingredients: menuItems.ingredients,
    imageUrl: menuItems.imageUrl,
    isAvailable: menuItems.isAvailable,
    displayOrder: menuItems.displayOrder,
    trackInventory: menuItems.trackInventory,
    stockQuantity: menuItems.stockQuantity,
    lowStockThreshold: menuItems.lowStockThreshold,
  }).from(menuItems)
    .innerJoin(menuCategories, eq(menuItems.categoryId, menuCategories.id))
    .where(and(eq(menuItems.isAvailable, 1), eq(menuCategories.isActive, 1)))
    .orderBy(menuItems.displayOrder);
}

export async function getMenuItemById(id: number) {
  const db = getDb();
  const rows = await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1);
  return rows[0] || null;
}

export async function getMenuWithCategories() {
  const db = getDb();
  const categories = await db.select().from(menuCategories)
    .where(eq(menuCategories.isActive, 1))
    .orderBy(menuCategories.displayOrder);
  const items = await db.select().from(menuItems)
    .innerJoin(menuCategories, eq(menuItems.categoryId, menuCategories.id))
    .where(and(eq(menuItems.isAvailable, 1), eq(menuCategories.isActive, 1)))
    .orderBy(menuItems.displayOrder);
  return { categories, items: items.map(r => r.menu_items) };
}

export async function getMenuItemsByCategory(categoryId: number) {
  const db = getDb();
  return db.select().from(menuItems)
    .where(eq(menuItems.categoryId, categoryId))
    .orderBy(menuItems.displayOrder);
}

export async function getAllMenuItems() {
  const db = getDb();
  return db.select().from(menuItems).orderBy(menuItems.categoryId, menuItems.displayOrder);
}

export async function addMenuItem(data: {
  categoryId: number; name: string; nameKannada?: string; description?: string;
  price: number; priceText?: string; tags?: string; ingredients?: string;
  imageUrl?: string; isAvailable?: number; displayOrder?: number;
  trackInventory?: number; stockQuantity?: number; lowStockThreshold?: number;
}) {
  const db = getDb();
  return db.insert(menuItems).values({
    categoryId: data.categoryId,
    name: data.name,
    nameKannada: data.nameKannada || "",
    description: data.description || "",
    price: data.price,
    priceText: data.priceText || "",
    tags: data.tags || "[]",
    ingredients: data.ingredients || "[]",
    imageUrl: data.imageUrl || "",
    isAvailable: data.isAvailable ?? 1,
    displayOrder: data.displayOrder || 0,
    trackInventory: data.trackInventory ?? 0,
    stockQuantity: data.stockQuantity ?? 0,
    lowStockThreshold: data.lowStockThreshold ?? 5,
  });
}

export async function updateMenuItem(id: number, data: Partial<typeof menuItems.$inferInsert>) {
  const db = getDb();
  return db.update(menuItems).set(data).where(eq(menuItems.id, id));
}

export async function deleteMenuItem(id: number) {
  const db = getDb();
  return db.delete(menuItems).where(eq(menuItems.id, id));
}

export async function toggleMenuItemAvailability(id: number, isAvailable: number) {
  const db = getDb();
  return db.update(menuItems).set({ isAvailable }).where(eq(menuItems.id, id));
}

// --- Food Orders ---

export async function createFoodOrder(data: {
  orderNumber: string; idempotencyKey?: string; guestType: string;
  checkinId?: number; guestName: string; guestPhone?: string;
  roomInfo?: string; tableNumber?: string; specialInstructions?: string;
  subtotal: number; tax: number; total: number;
  paymentStatus?: string; createdBy?: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();
  return db.insert(foodOrders).values({
    orderNumber: data.orderNumber,
    idempotencyKey: data.idempotencyKey || null,
    guestType: data.guestType,
    checkinId: data.checkinId,
    guestName: data.guestName,
    guestPhone: data.guestPhone || "",
    roomInfo: data.roomInfo || "",
    tableNumber: data.tableNumber || "",
    specialInstructions: data.specialInstructions || "",
    subtotal: data.subtotal,
    tax: data.tax,
    total: data.total,
    status: "placed",
    paymentStatus: data.paymentStatus || "pending",
    createdBy: data.createdBy || "guest",
    createdAt: now,
    updatedAt: now,
  }).returning();
}

export async function addFoodOrderItems(items: Array<{
  orderId: number; menuItemId: number; itemName: string;
  itemPrice: number; quantity: number; lineTotal: number;
}>) {
  const db = getDb();
  return db.insert(foodOrderItems).values(items);
}

export async function getFoodOrdersByStatus(status: string) {
  const db = getDb();
  return db.select().from(foodOrders)
    .where(eq(foodOrders.status, status))
    .orderBy(foodOrders.createdAt);
}

export async function getActiveFoodOrders() {
  const db = getDb();
  return db.select().from(foodOrders)
    .where(
      and(
        sql`${foodOrders.status} != 'served'`,
        sql`${foodOrders.status} != 'cancelled'`
      )
    )
    .orderBy(foodOrders.createdAt);
}

export async function getFoodOrderById(id: number) {
  const db = getDb();
  const rows = await db.select().from(foodOrders).where(eq(foodOrders.id, id)).limit(1);
  return rows[0] || null;
}

export async function getFoodOrderByNumber(orderNumber: string) {
  const db = getDb();
  const rows = await db.select().from(foodOrders).where(eq(foodOrders.orderNumber, orderNumber)).limit(1);
  return rows[0] || null;
}

export async function getFoodOrderByIdempotencyKey(key: string) {
  const db = getDb();
  if (!key) return null;
  const rows = await db.select().from(foodOrders).where(eq(foodOrders.idempotencyKey, key)).limit(1);
  return rows[0] || null;
}

export async function getFoodOrderItems(orderId: number) {
  const db = getDb();
  return db.select().from(foodOrderItems).where(eq(foodOrderItems.orderId, orderId));
}

export async function updateFoodOrderStatus(id: number, status: string, cancelledReason?: string) {
  const db = getDb();
  const data: any = { status, updatedAt: new Date().toISOString() };
  if (status === "cancelled") {
    data.cancelledAt = new Date().toISOString();
    if (cancelledReason) data.cancelledReason = cancelledReason;
  }
  return db.update(foodOrders).set(data).where(eq(foodOrders.id, id));
}

export async function updateFoodOrderPayment(id: number, data: {
  paymentStatus: string; paymentMethod?: string; paidBy?: string;
}) {
  const db = getDb();
  return db.update(foodOrders).set({
    paymentStatus: data.paymentStatus,
    paymentMethod: data.paymentMethod || "",
    paidBy: data.paidBy || "",
    updatedAt: new Date().toISOString(),
  }).where(eq(foodOrders.id, id));
}

export async function getGuestFoodTab(checkinId: number) {
  const db = getDb();
  return db.select().from(foodOrders)
    .where(and(
      eq(foodOrders.checkinId, checkinId),
      eq(foodOrders.paymentStatus, "on_tab"),
    ))
    .orderBy(foodOrders.createdAt);
}

export async function getGuestAllFoodOrders(checkinId: number) {
  const db = getDb();
  return db.select().from(foodOrders)
    .where(eq(foodOrders.checkinId, checkinId))
    .orderBy(desc(foodOrders.createdAt));
}

export async function getFoodOrderHistory(limit = 100, offset = 0) {
  const db = getDb();
  return db.select().from(foodOrders)
    .orderBy(desc(foodOrders.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getNextOrderNumber() {
  const db = getDb();
  const istDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const dayOfYear = Math.floor((istDate.getTime() - new Date(istDate.getFullYear(), 0, 0).getTime()) / 86400000);
  const prefix = `D${dayOfYear}`;

  const rows = await db.select({
    maxNum: sql<number>`COALESCE(MAX(CAST(SUBSTR(${foodOrders.orderNumber}, ${prefix.length + 2}) AS INTEGER)), 0)`
  }).from(foodOrders)
    .where(sql`${foodOrders.orderNumber} LIKE ${prefix + '-%'}`);

  const next = (rows[0]?.maxNum || 0) + 1;
  return `${prefix}-${String(next).padStart(2, "0")}`;
}

// --- Order Modifications ---

export async function addOrderModification(data: {
  orderId: number; action: string; itemId?: number;
  oldValue?: string; newValue?: string; reason?: string; modifiedBy: string;
}) {
  const db = getDb();
  return db.insert(orderModifications).values({
    orderId: data.orderId,
    action: data.action,
    itemId: data.itemId,
    oldValue: data.oldValue || "",
    newValue: data.newValue || "",
    reason: data.reason || "",
    modifiedBy: data.modifiedBy,
    createdAt: new Date().toISOString(),
  });
}

export async function getOrderModifications(orderId: number) {
  const db = getDb();
  return db.select().from(orderModifications)
    .where(eq(orderModifications.orderId, orderId))
    .orderBy(desc(orderModifications.id));
}

// --- Tab Helpers ---

export async function getGuestTabTotal(checkinId: number): Promise<number> {
  const db = getDb();
  const rows = await db.select({
    total: sql<number>`COALESCE(SUM(${foodOrders.total}), 0)`
  }).from(foodOrders)
    .where(and(
      eq(foodOrders.checkinId, checkinId),
      eq(foodOrders.paymentStatus, "on_tab"),
    ));
  return rows[0]?.total || 0;
}

export async function getFoodOrdersByCheckinIds(checkinIds: number[]) {
  const db = getDb();
  if (checkinIds.length === 0) return [];
  return db.select().from(foodOrders)
    .where(and(
      inArray(foodOrders.checkinId, checkinIds),
      eq(foodOrders.paymentStatus, "on_tab"),
    ))
    .orderBy(foodOrders.createdAt);
}

export async function updateFoodOrder(id: number, data: Partial<typeof foodOrders.$inferInsert>) {
  const db = getDb();
  return db.update(foodOrders).set({
    ...data,
    updatedAt: new Date().toISOString(),
  }).where(eq(foodOrders.id, id));
}

export async function deleteFoodOrderItem(id: number) {
  const db = getDb();
  return db.delete(foodOrderItems).where(eq(foodOrderItems.id, id));
}

// --- Active Checkins for Food Lookup ---

export async function getActiveCheckins() {
  const db = getDb();
  return db.select().from(checkins).where(eq(checkins.status, "active"));
}

// --- Inventory ---

export async function decrementStock(menuItemId: number, quantity: number) {
  const db = getDb();
  const item = await db.select().from(menuItems).where(eq(menuItems.id, menuItemId)).limit(1);
  if (!item[0] || !item[0].trackInventory) return;

  const newQty = Math.max(0, item[0].stockQuantity - quantity);
  const updates: any = { stockQuantity: newQty };

  if (newQty === 0) {
    updates.isAvailable = 0;
  }

  await db.update(menuItems).set(updates).where(eq(menuItems.id, menuItemId));
}

export async function addStock(menuItemId: number, quantity: number) {
  const db = getDb();
  const item = await db.select().from(menuItems).where(eq(menuItems.id, menuItemId)).limit(1);
  if (!item[0]) return;

  const newQty = item[0].stockQuantity + quantity;
  await db.update(menuItems).set({
    stockQuantity: newQty,
    isAvailable: 1,
  }).where(eq(menuItems.id, menuItemId));
}

export async function restoreStock(orderId: number) {
  const db = getDb();
  const items = await db.select().from(foodOrderItems)
    .where(and(eq(foodOrderItems.orderId, orderId), sql`${foodOrderItems.status} != 'voided'`));

  for (const item of items) {
    const menuItem = await db.select().from(menuItems).where(eq(menuItems.id, item.menuItemId)).limit(1);
    if (!menuItem[0] || !menuItem[0].trackInventory) continue;

    const newQty = menuItem[0].stockQuantity + item.quantity;
    await db.update(menuItems).set({
      stockQuantity: newQty,
      isAvailable: 1,
    }).where(eq(menuItems.id, item.menuItemId));
  }
}

export async function getLowStockItems() {
  const db = getDb();
  return db.select().from(menuItems)
    .where(and(
      eq(menuItems.trackInventory, 1),
      sql`${menuItems.stockQuantity} <= ${menuItems.lowStockThreshold}`
    ))
    .orderBy(menuItems.stockQuantity);
}

// --- Data Retention / Cleanup ---

export async function getOrdersForCleanup() {
  const db = getDb();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Hostel guests: checkin is checked_out AND checked_out_at > 7 days ago
  const hostelOrders = await db
    .select({ id: foodOrders.id })
    .from(foodOrders)
    .innerJoin(checkins, eq(foodOrders.checkinId, checkins.id))
    .where(
      and(
        eq(checkins.status, "checked_out"),
        sql`${checkins.checkedOutAt} != ''`,
        sql`${checkins.checkedOutAt} < ${sevenDaysAgo}`
      )
    );

  // Walk-in guests: created > 7 days ago AND served/cancelled
  const walkinOrders = await db
    .select({ id: foodOrders.id })
    .from(foodOrders)
    .where(
      and(
        eq(foodOrders.guestType, "walkin"),
        sql`${foodOrders.createdAt} < ${sevenDaysAgo}`,
        sql`(${foodOrders.status} = 'served' OR ${foodOrders.status} = 'cancelled')`
      )
    );

  const allIds = [...hostelOrders.map((r) => r.id), ...walkinOrders.map((r) => r.id)];
  return [...new Set(allIds)];
}

export async function deleteOrderItemsByOrderIds(orderIds: number[]) {
  if (orderIds.length === 0) return 0;
  const db = getDb();
  const result = await db.delete(foodOrderItems).where(inArray(foodOrderItems.orderId, orderIds));
  return (result as any).rowsAffected ?? (result as any).changes ?? orderIds.length;
}
