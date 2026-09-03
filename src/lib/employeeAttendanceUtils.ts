export type AttendanceStatus = "present" | "half_day_leave" | "full_day_leave";

export function attendanceUnits(status: string): number {
  return status === "full_day_leave" ? 2 : status === "half_day_leave" ? 1 : 0;
}

export function daysInMonth(month: string): number {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value, 0)).getUTCDate();
}

export function monthEnd(month: string): string {
  return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}

export function calendarMonthDates(month: string): Array<string | null> {
  const [year, value] = month.split("-").map(Number);
  const dates: Array<string | null> = Array(new Date(Date.UTC(year, value - 1, 1)).getUTCDay()).fill(null);
  for (let day = 1; day <= daysInMonth(month); day++) dates.push(`${month}-${String(day).padStart(2, "0")}`);
  while (dates.length % 7) dates.push(null);
  return dates;
}

export function addMonth(month: string, amount = 1): string {
  const [year, value] = month.split("-").map(Number);
  const result = new Date(Date.UTC(year, value - 1 + amount, 1));
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthlyEquivalent(salary: number, frequency: string): number {
  if (frequency === "weekly") return Math.round((salary * 52) / 12);
  return salary;
}

export function grossForEmploymentPeriod(salary: number, frequency: string, calendarDays: number, employedDays: number): number {
  if (frequency === "daily") return salary * employedDays;
  return Math.round((monthlyEquivalent(salary, frequency) / calendarDays) * employedDays);
}

export function fullMonthSalary(salary: number, frequency: string, calendarDays: number): number {
  return frequency === "daily" ? salary * calendarDays : monthlyEquivalent(salary, frequency);
}
