import { and, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@/db";
import { employeeAttendance, employeeCompensationHistory, employeeLeavePolicy, employees, salaryPayments } from "@/db/schema";
import { todayIST } from "@/lib/utils";
import { addMonth, attendanceUnits, daysInMonth, fullMonthSalary, grossForEmploymentPeriod, monthEnd } from "@/lib/employeeAttendanceUtils";

export type PayrollSummary = {
  employeeId: number;
  employeeName: string;
  month: string;
  calendarDays: number;
  employedDays: number;
  isProjected: boolean;
  openingLeaveUnits: number;
  creditedLeaveUnits: number;
  paidLeaveUnits: number;
  unpaidLeaveUnits: number;
  closingLeaveUnits: number;
  fullDayLeave: number;
  halfDayLeave: number;
  grossAmount: number;
  attendanceDeduction: number;
  netPayable: number;
  salaryPaid: number;
  remainingPayable: number;
  adjustmentDue: number;
};

export async function calculateEmployeePayroll(employeeId: number, month: string): Promise<PayrollSummary | null> {
  const db = getDb();
  const [employee] = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
  if (!employee) return null;

  const startDate = employee.attendanceStartDate || "2026-09-01";
  const startMonth = startDate.slice(0, 7);
  const targetEnd = monthEnd(month);
  const [attendanceRows, policies, compensation, payments] = await Promise.all([
    db.select().from(employeeAttendance).where(and(
      eq(employeeAttendance.employeeId, employeeId),
      gte(employeeAttendance.date, startDate),
      lte(employeeAttendance.date, targetEnd),
      isNull(employeeAttendance.deletedAt),
    )),
    db.select().from(employeeLeavePolicy).where(and(
      lte(employeeLeavePolicy.effectiveMonth, month),
      or(isNull(employeeLeavePolicy.employeeId), eq(employeeLeavePolicy.employeeId, employeeId)),
      isNull(employeeLeavePolicy.deletedAt),
    )),
    db.select().from(employeeCompensationHistory).where(and(
      eq(employeeCompensationHistory.employeeId, employeeId),
      lte(employeeCompensationHistory.effectiveMonth, month),
      isNull(employeeCompensationHistory.deletedAt),
    )),
    db.select().from(salaryPayments).where(and(
      eq(salaryPayments.employeeId, employeeId),
      eq(salaryPayments.month, month),
      inArray(salaryPayments.payType, ["salary", "advance"]),
    )),
  ]);

  const policyFor = (cursor: string) => {
    const eligible = policies.filter((policy) => policy.effectiveMonth <= cursor);
    const employeePolicy = eligible.filter((policy) => policy.employeeId === employeeId).sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0];
    const globalPolicy = eligible.filter((policy) => policy.employeeId == null).sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0];
    return employeePolicy || globalPolicy || { monthlyCreditUnits: 4, carryCapUnits: 24 };
  };

  let balance = 0;
  let target = { opening: 0, credit: 0, paid: 0, unpaid: 0, closing: 0, full: 0, half: 0 };
  if (month >= startMonth) {
    for (let cursor = startMonth; cursor <= month; cursor = addMonth(cursor)) {
      const policy = policyFor(cursor);
      const opening = balance;
      const requestedCredit = Number(policy.monthlyCreditUnits) || 0;
      balance = Math.min(Number(policy.carryCapUnits) || 24, balance + requestedCredit);
      const credit = balance - opening;
      let paid = 0;
      let unpaid = 0;
      let full = 0;
      let half = 0;
      const rows = attendanceRows.filter((row) => row.date.slice(0, 7) === cursor).sort((a, b) => a.date.localeCompare(b.date));
      for (const row of rows) {
        const units = attendanceUnits(row.status);
        if (units === 0) continue;
        if (units === 2) full++;
        if (units === 1) half++;
        const covered = Math.min(balance, units);
        balance -= covered;
        paid += covered;
        unpaid += units - covered;
      }
      if (cursor === month) target = { opening, credit, paid, unpaid, closing: balance, full, half };
    }
  }

  const comp = compensation.sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0];
  const salary = comp?.salary ?? employee.salary;
  const frequency = comp?.salaryFrequency ?? employee.salaryFrequency;
  const calendarDays = daysInMonth(month);
  const monthStart = `${month}-01`;
  const activeStart = startDate > monthStart ? startDate : monthStart;
  const activeEnd = employee.employmentEndDate && employee.employmentEndDate < targetEnd
    ? employee.employmentEndDate
    : targetEnd;
  const employedDays = activeStart <= activeEnd
    ? Math.round((Date.parse(`${activeEnd}T00:00:00Z`) - Date.parse(`${activeStart}T00:00:00Z`)) / 86_400_000) + 1
    : 0;
  const fullMonthGross = fullMonthSalary(salary, frequency, calendarDays);
  const grossAmount = grossForEmploymentPeriod(salary, frequency, calendarDays, employedDays);
  const attendanceDeduction = Math.round((fullMonthGross / calendarDays) * (target.unpaid / 2));
  const netPayable = Math.max(0, grossAmount - attendanceDeduction);
  const salaryPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const adjustmentDue = netPayable - salaryPaid;

  return {
    employeeId,
    employeeName: employee.name,
    month,
    calendarDays,
    employedDays,
    isProjected: month >= todayIST().slice(0, 7),
    openingLeaveUnits: target.opening,
    creditedLeaveUnits: target.credit,
    paidLeaveUnits: target.paid,
    unpaidLeaveUnits: target.unpaid,
    closingLeaveUnits: target.closing,
    fullDayLeave: target.full,
    halfDayLeave: target.half,
    grossAmount,
    attendanceDeduction,
    netPayable,
    salaryPaid,
    remainingPayable: Math.max(0, adjustmentDue),
    adjustmentDue,
  };
}
