import { describe, it, expect } from "vitest";
import {
  clampLogOffset,
  clampLogPage,
  clampLogPageSize,
  clampLogSince,
  DEFAULT_LOG_PAGE_SIZE,
  LOG_DOWNLOAD_MAX,
  LOG_LIST_MAX,
  LOG_RETENTION_DAYS,
  logListQuery,
  logPageCount,
  logPagerItems,
  logRetentionSince,
  logSafePage,
} from "@/lib/logRetention";

describe("log retention", () => {
  it("floors since at 30 days ago", () => {
    const now = Date.parse("2026-08-31T12:00:00.000Z");
    const floor = logRetentionSince(now);
    expect(floor).toBe("2026-08-01T12:00:00.000Z");
    expect(LOG_RETENTION_DAYS).toBe(30);
    expect(clampLogSince(undefined, now)).toBe(floor);
    expect(clampLogSince("2026-07-01T00:00:00.000Z", now)).toBe(floor);
    expect(clampLogSince("2026-08-20T00:00:00.000Z", now)).toBe("2026-08-20T00:00:00.000Z");
  });
});

describe("log pagination helpers", () => {
  it("defaults page size to 50 and clamps list vs download max", () => {
    expect(clampLogPageSize(undefined)).toBe(DEFAULT_LOG_PAGE_SIZE);
    expect(clampLogPageSize(20)).toBe(20);
    expect(clampLogPageSize(200)).toBe(LOG_LIST_MAX);
    expect(clampLogPageSize(5000, LOG_DOWNLOAD_MAX)).toBe(LOG_DOWNLOAD_MAX);
    expect(clampLogPage(0)).toBe(1);
    expect(clampLogPage(3)).toBe(3);
  });

  it("computes offset from page and pageSize", () => {
    expect(logListQuery({ page: 3, pageSize: 50 })).toEqual({ page: 3, pageSize: 50, offset: 100 });
    expect(logListQuery({ limit: 200 })).toEqual({ page: 1, pageSize: LOG_LIST_MAX, offset: 0 });
    expect(logListQuery({ pageSize: 5000, download: true })).toEqual({
      page: 1, pageSize: LOG_DOWNLOAD_MAX, offset: 0,
    });
  });

  it("page count is at least 1", () => {
    expect(logPageCount(0, 50)).toBe(1);
    expect(logPageCount(143, 50)).toBe(3);
    expect(logPageCount(50, 50)).toBe(1);
  });

  it("clamps offset onto the last page instead of past the end", () => {
    expect(clampLogOffset(10, 50, 100)).toBe(0);
    expect(clampLogOffset(120, 50, 100)).toBe(100);
    expect(clampLogOffset(0, 50, 50)).toBe(0);
    expect(logSafePage(10, 50, 3)).toBe(1);
    expect(logSafePage(120, 50, 3)).toBe(3);
  });

  it("pager is 1 2 3 … last near the start", () => {
    expect(logPagerItems(1, 10)).toEqual([1, 2, 3, "ellipsis", 10]);
    expect(logPagerItems(2, 10)).toEqual([1, 2, 3, "ellipsis", 10]);
    expect(logPagerItems(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
    expect(logPagerItems(10, 10)).toEqual([1, "ellipsis", 8, 9, 10]);
    expect(logPagerItems(1, 3)).toEqual([1, 2, 3]);
  });
});
