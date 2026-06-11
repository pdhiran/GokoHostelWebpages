import { NextRequest, NextResponse } from "next/server";
import {
  addExpense,
  getExpensesByMonth,
  getExpensesByUser,
  updateExpense,
  deleteExpense,
  getExpenseMonths,
  getMonthKey,
  addAuditEntry,
  addSystemLog,
  getUserByUsername,
} from "@/db/queries";
import { getDb } from "@/db";
import { foodOrders, checkins } from "@/db/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { driveUploadFile, driveGetOrCreateFolder, driveDeleteFile } from "@/lib/googleApiFetch";

type UserRole = "admin" | "manager" | "staff";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "goko-salt-2026");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

async function authenticateUser(password: string, username?: string): Promise<{ role: UserRole; displayName: string } | null> {
  if (!password) return null;

  if (!username) {
    if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) return { role: "admin", displayName: "Admin" };
    if (process.env.MANAGER_PASSWORD && password === process.env.MANAGER_PASSWORD) return { role: "manager", displayName: "Manager" };
    return null;
  }

  if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD && username === "admin") return { role: "admin", displayName: "Admin" };
  if (process.env.MANAGER_PASSWORD && password === process.env.MANAGER_PASSWORD && username === "manager") return { role: "manager", displayName: "Manager" };

  try {
    const user = await getUserByUsername(username);
    if (!user) return null;
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return null;
    return { role: (user.role as UserRole) || "manager", displayName: user.displayName || username };
  } catch {
    return null;
  }
}

function extractDriveFileId(link: string): string | null {
  const match = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, action, username, ...rest } = body;

    const auth = await authenticateUser(password, username);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, displayName } = auth;
    const actorName = username || displayName;

    switch (action) {
      case "addExpense": {
        const { amount, category, customCategory, purpose, billImage, billMimeType } = rest;
        if (!amount || !category || !purpose) {
          return NextResponse.json({ error: "amount, category, and purpose are required" }, { status: 400 });
        }
        if (typeof amount !== "number" || amount <= 0) {
          return NextResponse.json({ error: "amount must be a positive integer (in paise)" }, { status: 400 });
        }

        const month = getMonthKey();
        let billImageLink = "";

        if (billImage) {
          try {
            const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
            if (!rootFolderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID not set");

            const billsFolderId = await driveGetOrCreateFolder(rootFolderId, "Goko Bills");
            const monthFolderId = await driveGetOrCreateFolder(billsFolderId, month);

            const binaryStr = atob(billImage);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }

            const mime = billMimeType || "image/jpeg";
            const fileName = `bill_${Date.now()}.jpg`;
            billImageLink = await driveUploadFile(fileName, mime, bytes.buffer, monthFolderId);
          } catch (err: any) {
            await addSystemLog({ level: "error", source: "expenses", message: "Bill upload failed", details: err?.message || String(err) });
          }
        }

        await addExpense({
          amount,
          category,
          customCategory: customCategory || "",
          purpose,
          billImageLink,
          createdBy: actorName,
          createdMonth: month,
        });

        await addAuditEntry({
          username: actorName,
          action: "expense_added",
          target: category,
          details: `₹${(amount / 100).toFixed(0)} for ${purpose}`,
        });

        return NextResponse.json({ success: true, role });
      }

      case "listExpenses": {
        const { month } = rest;
        const targetMonth = month || getMonthKey();
        const expenses = await getExpensesByMonth(targetMonth);
        const months = await getExpenseMonths();
        return NextResponse.json({ role, expenses, months, currentMonth: targetMonth });
      }

      case "getMyExpenses": {
        const expenses = await getExpensesByUser(actorName, 7);
        return NextResponse.json({ role, expenses });
      }

      case "updateExpense": {
        if (role !== "admin") {
          return NextResponse.json({ error: "Admin only" }, { status: 403 });
        }
        const { id, amount, category, customCategory, purpose, billImage: updateBillImage, billMimeType: updateBillMime } = rest;
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

        const updateData: any = { updatedBy: actorName };
        if (amount !== undefined) updateData.amount = amount;
        if (category !== undefined) updateData.category = category;
        if (customCategory !== undefined) updateData.customCategory = customCategory;
        if (purpose !== undefined) updateData.purpose = purpose;

        if (updateBillImage) {
          try {
            const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
            if (!rootFolderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID not set");

            const month = getMonthKey();
            const billsFolderId = await driveGetOrCreateFolder(rootFolderId, "Goko Bills");
            const monthFolderId = await driveGetOrCreateFolder(billsFolderId, month);

            const binaryStr = atob(updateBillImage);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }

            const mime = updateBillMime || "image/jpeg";
            const fileName = `bill_${Date.now()}.jpg`;
            updateData.billImageLink = await driveUploadFile(fileName, mime, bytes.buffer, monthFolderId);
          } catch (err: any) {
            await addSystemLog({ level: "error", source: "expenses", message: "Bill upload failed on update", details: err?.message || String(err) });
          }
        }

        await updateExpense(id, updateData);

        await addAuditEntry({
          username: actorName,
          action: "expense_updated",
          target: `expense:${id}`,
          details: `Updated expense #${id}`,
        });

        return NextResponse.json({ success: true, role });
      }

      case "deleteExpense": {
        if (role !== "admin") {
          return NextResponse.json({ error: "Admin only" }, { status: 403 });
        }
        const { id, billImageLink } = rest;
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

        if (billImageLink) {
          const fileId = extractDriveFileId(billImageLink);
          if (fileId) {
            try {
              await driveDeleteFile(fileId);
            } catch (err: any) {
              await addSystemLog({ level: "warn", source: "expenses", message: "Bill image delete failed", details: err?.message || String(err) });
            }
          }
        }

        await deleteExpense(id);

        await addAuditEntry({
          username: actorName,
          action: "expense_deleted",
          target: `expense:${id}`,
          details: `Deleted expense #${id}`,
        });

        return NextResponse.json({ success: true, role });
      }

      case "getFoodRevenue": {
        const { fromDate, toDate } = rest;
        if (!fromDate || !toDate) {
          return NextResponse.json({ error: "fromDate and toDate required" }, { status: 400 });
        }

        const db = getDb();
        const orders = await db.select().from(foodOrders)
          .where(and(
            sql`${foodOrders.status} != 'cancelled'`,
            sql`${foodOrders.createdAt} >= ${fromDate}`,
            sql`${foodOrders.createdAt} <= ${toDate + "T23:59:59"}`,
          ))
          .orderBy(desc(foodOrders.createdAt));

        let totalRevenue = 0;
        let cashPayments = 0;
        let onlinePayments = 0;
        let unpaidTabs = 0;
        let orderCount = orders.length;
        let cashOrders = 0;
        let onlineOrders = 0;
        let unpaidOrders = 0;

        const guestMap = new Map<string, {
          guestName: string; guestPhone: string; roomInfo: string; checkinId: number | null;
          totalSpent: number; cashPaid: number; onlinePaid: number; unpaid: number; orderCount: number;
        }>();

        for (const order of orders) {
          totalRevenue += order.total;

          if (order.paymentStatus === "paid") {
            if (order.paymentMethod === "cash") {
              cashPayments += order.total;
              cashOrders += 1;
            } else {
              onlinePayments += order.total;
              onlineOrders += 1;
            }
          } else if (order.paymentStatus === "on_tab" || order.paymentStatus === "pending") {
            unpaidTabs += order.total;
            unpaidOrders += 1;
          }

          // Group hostel guests by checkinId, walk-ins by name+phone
          const key = order.checkinId
            ? `checkin:${order.checkinId}`
            : `walkin:${(order.guestName || "").toLowerCase().trim()}:${(order.guestPhone || "").trim()}`;

          const existing = guestMap.get(key);
          if (existing) {
            existing.totalSpent += order.total;
            existing.orderCount += 1;
            if (order.paymentStatus === "paid" && order.paymentMethod === "cash") existing.cashPaid += order.total;
            else if (order.paymentStatus === "paid") existing.onlinePaid += order.total;
            else existing.unpaid += order.total;
            // Update contact/room if available and currently missing
            if (!existing.guestPhone && order.guestPhone) existing.guestPhone = order.guestPhone;
            if (!existing.roomInfo && order.roomInfo) existing.roomInfo = order.roomInfo;
          } else {
            guestMap.set(key, {
              guestName: order.guestName,
              guestPhone: order.guestPhone,
              roomInfo: order.roomInfo || "",
              checkinId: order.checkinId,
              totalSpent: order.total,
              cashPaid: order.paymentStatus === "paid" && order.paymentMethod === "cash" ? order.total : 0,
              onlinePaid: order.paymentStatus === "paid" && order.paymentMethod !== "cash" ? order.total : 0,
              unpaid: order.paymentStatus !== "paid" ? order.total : 0,
              orderCount: 1,
            });
          }
        }

        // Fetch phone numbers from checkins for hostel guests missing contact
        const checkinIds = Array.from(guestMap.entries())
          .filter(([k, v]) => k.startsWith("checkin:") && !v.guestPhone)
          .map(([k]) => parseInt(k.replace("checkin:", ""), 10))
          .filter((id) => !isNaN(id));

        if (checkinIds.length > 0) {
          const checkinRows = await db.select({ id: checkins.id, contact: checkins.contact })
            .from(checkins)
            .where(inArray(checkins.id, checkinIds));
          for (const row of checkinRows) {
            const entry = guestMap.get(`checkin:${row.id}`);
            if (entry && !entry.guestPhone && row.contact) {
              entry.guestPhone = row.contact;
            }
          }
        }

        const guestBreakdown = Array.from(guestMap.values())
          .sort((a, b) => b.totalSpent - a.totalSpent);

        return NextResponse.json({
          role,
          summary: { totalRevenue, cashPayments, onlinePayments, unpaidTabs, orderCount, cashOrders, onlineOrders, unpaidOrders },
          guestBreakdown,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Admin expenses API error:", error?.message || error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
