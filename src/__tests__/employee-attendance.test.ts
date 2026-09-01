import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { attendanceUnits, daysInMonth, monthEnd, addMonth, grossForEmploymentPeriod } from "@/lib/employeeAttendance";

describe("employee attendance calendar rules", () => {
  it("treats every calendar day as a working day and uses half-day units", () => {
    expect(daysInMonth("2024-02")).toBe(29);
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2026-09")).toBe(30);
    expect(monthEnd("2026-09")).toBe("2026-09-30");
    expect(attendanceUnits("present")).toBe(0);
    expect(attendanceUnits("half_day_leave")).toBe(1);
    expect(attendanceUnits("full_day_leave")).toBe(2);
  });

  it("rolls leave-accrual months across year boundaries", () => {
    expect(addMonth("2026-12")).toBe("2027-01");
    expect(addMonth("2027-01", -1)).toBe("2026-12");
  });

  it("prorates salary for employees who join or leave during a month", () => {
    expect(grossForEmploymentPeriod(30_000, "monthly", 30, 15)).toBe(15_000);
    expect(grossForEmploymentPeriod(1_000, "daily", 30, 15)).toBe(15_000);
    expect(grossForEmploymentPeriod(7_000, "weekly", 30, 30)).toBe(30_333);
    expect(grossForEmploymentPeriod(30_000, "monthly", 30, 0)).toBe(0);
  });

  it("keeps corrections explicit and audits only real changes", () => {
    const route = readFileSync("src/app/api/admin/attendance/route.ts", "utf8");
    expect(route).toContain('new Set<AttendanceStatus>(["present", "half_day_leave", "full_day_leave"])');
    expect(route).toContain("if (oldStatus === status && oldComment === comment) continue");
    expect(route).toContain('status === "present" ? "Restored Present"');
    expect(route).toContain("Attendance ranges are limited to 62 days");
  });

  it("enforces manager-only API access and dashboard visibility", () => {
    const route = readFileSync("src/app/api/admin/attendance/route.ts", "utf8");
    const dashboard = readFileSync("src/components/admin/AdminDashboard.tsx", "utf8");
    expect(route).toContain('auth.role !== "manager" || !auth.permissions.canManageAttendance');
    expect(dashboard).toContain('role === "manager" && !!permissions?.canManageAttendance');
    expect(dashboard).toContain('managementTab: "attendance"');
  });
});
