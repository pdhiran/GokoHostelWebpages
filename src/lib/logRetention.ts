export const LOG_RETENTION_DAYS = 30;
export const LOG_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export const DEFAULT_LOG_PAGE_SIZE = 50;
export const LOG_LIST_MAX = 100;
export const LOG_DOWNLOAD_MAX = 2000;

export function logRetentionSince(now = Date.now()): string {
  return new Date(now - LOG_RETENTION_DAYS * 86400000).toISOString();
}

/** Floor `since` at 30 days ago so callers cannot read past retention. */
export function clampLogSince(since?: string, now = Date.now()): string {
  const floor = logRetentionSince(now);
  if (!since) return floor;
  return since > floor ? since : floor;
}

export function clampLogPage(n: unknown): number {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v > 0 ? v : 1;
}

export function clampLogPageSize(n: unknown, max = LOG_LIST_MAX): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 1) return DEFAULT_LOG_PAGE_SIZE;
  return Math.min(v, max);
}

export function logListQuery(body: { page?: unknown; pageSize?: unknown; limit?: unknown; download?: unknown }) {
  const download = Boolean(body.download);
  const pageSize = clampLogPageSize(body.pageSize ?? body.limit, download ? LOG_DOWNLOAD_MAX : LOG_LIST_MAX);
  const page = clampLogPage(body.page);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function logPageCount(total: number, pageSize: number): number {
  const size = pageSize < 1 ? DEFAULT_LOG_PAGE_SIZE : pageSize;
  return Math.max(1, Math.ceil(Math.max(0, total) / size));
}

/** Keep offset inside the result set so page 99 of 1 page is not an empty list. */
export function clampLogOffset(total: number, pageSize: number, offset: number): number {
  const size = pageSize < 1 ? DEFAULT_LOG_PAGE_SIZE : pageSize;
  const off = Math.max(0, Math.floor(Number(offset) || 0));
  if (total <= 0) return 0;
  if (off < total) return off;
  return (logPageCount(total, size) - 1) * size;
}

export function logSafePage(total: number, pageSize: number, page: number): number {
  return Math.min(clampLogPage(page), logPageCount(total, pageSize));
}

/** Google-style window: `1 2 3 … last` near the start, `1 … n-1 n last` in the middle. */
export function logPagerItems(current: number, totalPages: number): Array<number | "ellipsis"> {
  const pages = Math.max(1, totalPages);
  const page = Math.min(Math.max(1, current), pages);
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);

  if (page <= 3) return [1, 2, 3, "ellipsis", pages];
  if (page >= pages - 2) return [1, "ellipsis", pages - 2, pages - 1, pages];

  return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", pages];
}
