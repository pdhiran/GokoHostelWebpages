import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { accounts, vendors, employees, users, salaryPayments, expenses } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "goko-salt-2026");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authenticate(password: string, username?: string): Promise<boolean> {
  if (!password) return false;
  if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) return true;
  if (process.env.MANAGER_PASSWORD && password === process.env.MANAGER_PASSWORD) return true;
  if (username) {
    try {
      const db = getDb();
      const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (user) {
        const computed = await hashPassword(password);
        if (computed === user.passwordHash) return true;
      }
    } catch { /* ignore */ }
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password, username, action, ...rest } = body;

    if (!await authenticate(password, username)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();

    switch (action) {
      // --- Accounts ---
      case "listAccounts": {
        const items = await db.select().from(accounts).orderBy(desc(accounts.createdAt));
        return NextResponse.json({ accounts: items });
      }
      case "addAccount": {
        const { name, nickname, bankName, accountType, accountNumber, ifscCode, openingBalance, isDefault } = rest;
        if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
        if (isDefault === "1" || isDefault === 1) {
          await db.update(accounts).set({ isDefault: 0 });
        }
        await db.insert(accounts).values({
          name,
          nickname: nickname || "",
          bankName: bankName || "",
          accountType: accountType || "savings",
          accountNumber: accountNumber || "",
          ifscCode: ifscCode || "",
          isDefault: isDefault === "1" || isDefault === 1 ? 1 : 0,
          openingBalance: openingBalance || 0,
          createdAt: new Date().toISOString(),
        });
        return NextResponse.json({ success: true });
      }
      case "updateAccount": {
        const { id, name, nickname, bankName, accountType, accountNumber, ifscCode, openingBalance, isDefault } = rest;
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
        if (isDefault === "1" || isDefault === 1) {
          await db.update(accounts).set({ isDefault: 0 });
        }
        await db.update(accounts).set({
          ...(name && { name }),
          nickname: nickname ?? undefined,
          bankName: bankName ?? undefined,
          accountType: accountType ?? undefined,
          accountNumber: accountNumber ?? undefined,
          ifscCode: ifscCode ?? undefined,
          isDefault: isDefault === "1" || isDefault === 1 ? 1 : 0,
          openingBalance: openingBalance ?? undefined,
        }).where(eq(accounts.id, id));
        return NextResponse.json({ success: true });
      }
      case "deleteAccount": {
        const { id } = rest;
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
        await db.delete(accounts).where(eq(accounts.id, id));
        return NextResponse.json({ success: true });
      }

      // --- Vendors ---
      case "listVendors": {
        const items = await db.select().from(vendors).orderBy(vendors.name);
        return NextResponse.json({ vendors: items });
      }
      case "addVendor": {
        const { name, category, contactPhone, notes } = rest;
        if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
        await db.insert(vendors).values({
          name,
          category: category || "",
          contactPhone: contactPhone || "",
          notes: notes || "",
          createdAt: new Date().toISOString(),
        });
        return NextResponse.json({ success: true });
      }
      case "updateVendor": {
        const { id, name, category, contactPhone, notes } = rest;
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
        await db.update(vendors).set({
          ...(name && { name }),
          category: category ?? undefined,
          contactPhone: contactPhone ?? undefined,
          notes: notes ?? undefined,
        }).where(eq(vendors.id, id));
        return NextResponse.json({ success: true });
      }
      case "deleteVendor": {
        const { id } = rest;
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
        await db.delete(vendors).where(eq(vendors.id, id));
        return NextResponse.json({ success: true });
      }

      // --- Employees ---
      case "listEmployees": {
        const items = await db.select().from(employees).orderBy(employees.name);
        return NextResponse.json({ employees: items });
      }
      case "addEmployee": {
        const { name, role: empRole, phone, salary, salaryFrequency, bankAccount } = rest;
        if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
        await db.insert(employees).values({
          name,
          role: empRole || "",
          phone: phone || "",
          salary: salary || 0,
          salaryFrequency: salaryFrequency || "monthly",
          bankAccount: bankAccount || "",
          createdAt: new Date().toISOString(),
        });
        return NextResponse.json({ success: true });
      }
      case "updateEmployee": {
        const { id, name, role: empRole, phone, salary, salaryFrequency, bankAccount } = rest;
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
        await db.update(employees).set({
          ...(name && { name }),
          role: empRole ?? undefined,
          phone: phone ?? undefined,
          salary: salary ?? undefined,
          salaryFrequency: salaryFrequency ?? undefined,
          bankAccount: bankAccount ?? undefined,
        }).where(eq(employees.id, id));
        return NextResponse.json({ success: true });
      }
      case "deleteEmployee": {
        const { id } = rest;
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
        await db.delete(employees).where(eq(employees.id, id));
        return NextResponse.json({ success: true });
      }

      // --- Salary Payments ---
      case "paySalary": {
        const { employeeId, amount, month, accountId, paymentMethod, payType, notes } = rest;
        if (!employeeId || !amount || !month) {
          return NextResponse.json({ error: "employeeId, amount, and month required" }, { status: 400 });
        }

        const [emp] = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
        if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

        const now = new Date().toISOString();
        const actorName = username || "admin";
        const type = payType || "salary";
        const typeLabel = type === "salary" ? "Salary" : type === "bonus" ? "Bonus" : type === "advance" ? "Advance" : type === "loan" ? "Loan" : type === "reimbursement" ? "Reimbursement" : "Payment";

        await db.insert(salaryPayments).values({
          employeeId,
          amount,
          month,
          accountId: accountId || null,
          paymentMethod: paymentMethod || "cash",
          paidAt: now,
          notes: `[${typeLabel}] ${notes || ""}`.trim(),
          createdBy: actorName,
        });

        // Use selected month for expense record (e.g. "2026-06" -> "JUNE-2026")
        const [yr, mo] = month.split("-");
        const monthNames = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
        const monthKey = `${monthNames[parseInt(mo, 10) - 1]}-${yr}`;
        await db.insert(expenses).values({
          amount,
          category: "Salary",
          customCategory: "",
          purpose: `${typeLabel} for ${emp.name} (${month})${notes ? " - " + notes : ""}`,
          billImageLink: "",
          vendorId: null,
          accountId: accountId || null,
          paymentMethod: paymentMethod || "cash",
          mainCategory: "stay_expense",
          subCategory: "Salary",
          createdBy: actorName,
          createdAt: now,
          updatedAt: now,
          createdMonth: monthKey,
        });

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
