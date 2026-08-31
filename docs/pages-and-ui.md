# Pages and admin UI

**Git-safe.** Routes a human hits, then the React files behind `/admin`. APIs: [api-map.md](api-map.md). Nav permissions: [auth-rbac.md](auth-rbac.md).

---

## Public marketing (`src/app/(marketing)/`)

All `dynamic = "force-static"`. Wrapped in SiteShell + GTM. Sitemap lists these only.

| Path | Content source | Hero video (typical) |
|------|----------------|----------------------|
| `/` | `src/content/home.ts` | loop A |
| `/stay` | `stay.ts` | hero B |
| `/story` | `story.ts` | default loop (omit prop) |
| `/events` | D1 CMS + seed; `EventsPageLive` | still / no `heroVideo=` |
| `/community-area` | D1 CMS + seed; `CommunityPageLive` | hero B |
| `/how-to-reach` | content | hero B |
| `/things-to-do` | content | `heroVideo={null}` still |
| `/faqs` | content | hero B |
| `/reviews` | content | default loop |
| `/booking-enquiry` | form → WhatsApp / email | default loop |

`robots.ts` **disallows:** `/self-checkin`, `/admin`, `/api/`, `/food-order`, `/kitchen`, `/my-bills`, `/review/`.

Book now: `BookingGateProvider` (`src/content/bookingGate.ts`) → Stayflexi URL in `src/lib/site.ts` (`hotel_id=30819`). Not Aiosell.

---

## Guest / staff ops pages

| Path | Role | Auth |
|------|------|------|
| `/self-checkin` | ID check-in | none |
| `/food-order` | Menu + cart | phone in localStorage |
| `/food-order/status` | Poll ~10s | phone |
| `/my-bills` | Food bills | phone |
| `/kitchen` | Queue, thermal print | `sessionStorage.kitchen_pw` |
| `/review/[token]` | Rating funnel | token |
| `/admin` | PMS SPA | password every API call |

---

## Admin top nav (`src/lib/adminNav.ts`)

Lazy-loaded in `src/app/admin/page.tsx`. Query `?section=` / `?tab=` via `useTabWithHistory`.

| `section` | Component | API | Perm (non-admin) |
|-----------|-----------|-----|------------------|
| `dashboard` | `AdminDashboard` | checkins `getDashboard` | `canViewDashboard` |
| `bookings` | `booking-dashboard/` | `/api/admin/bookings` | `canViewBookings` |
| `beds` | `AdminBeds` | checkins beds | `canViewBeds` |
| `timeline` | `AdminTimeline` | checkins `getBeds` | `canViewTimeline` |
| `inventory` | `InventoryRatePlan` | `/api/admin/inventory` | `canManageInventory` |
| `records` | `AdminRecords` | checkins list/add/… | `canViewRecords` |
| `foodOrders` | `AdminFoodOrders` | `/api/admin/food-orders` + kitchen | `canViewFoodOrders` |
| `expenditure` | `AdminExpenditure` | `/api/admin/expenses` | `canViewAccounts` |
| `splits` | `AdminSplits` | `/api/admin/splits` | `canViewSplits` — **omitted on Pi** |
| `reviews` | `AdminReviews` | `/api/admin/reviews` | `canViewReviews` |
| `management` | `AdminManagement` | mixed | `canViewManagement` |

`AdminBookings.tsx` is leftover Gmail-list UI. Live Bookings is the calendar dashboard.

---

## Management tabs (`AdminManagement.tsx`)

Most `adminOnly: true`. Website hidden when `NEXT_PUBLIC_GOKO_RUNTIME === "pi"`.

| `tab` | UI | Notes |
|-------|-----|--------|
| `dorms` | `AdminSetup` | init/remove dorms/beds |
| `users` | `ManagementUsers` | permission checkboxes |
| `backup` | `ManagementBackup` | |
| `audit` | `ManagementAudit` | |
| `logs` | `ManagementLogs` | PMS + system; import `pmsLogSummary` not `pmsLog` |
| `health` | `ManagementHealth` | |
| `history` | `AdminBedHistory` | visible to non-admin |
| `rates` | `AdminCheckRates` | competitor scrape; visible |
| `menu` | `AdminMenuManagement` | `/api/admin/food` **admin role** |
| `website` | `AdminWebsite` | CMS; Cloudflare only |
| `foodSettings` | `AdminFoodSettings` | |
| `bulkUpload` | `AdminBulkImport` | check-in XLSX |
| `qrGenerator` | `qr-generator/` | `canUseQRGenerator` |
| `accountSettings` | `AccountSettings` | `canManageAccounts` |
| `serverSync` | `ServerSync` | `/api/sync` |
| `channelManager` | `ChannelManager` | Aiosell config |
| `salesChannels` | `ManagementSalesChannels` | |
| `bedConfig` | `ManagementBedConfig` | |

---

## Booking dashboard files

`src/components/admin/booking-dashboard/`

| File | Role |
|------|------|
| `index.tsx` | Calendar shell |
| `BookingCalendarGrid.tsx` | Bars by dorm/night |
| `BookingDetailPanel.tsx` | Check-in/out, pay, cancel |
| `CreateBookingModal.tsx` | Walk-in / engine |
| `UnassignedBookings.tsx` | OTA leftover chips, Reject |
| `BookingSearchBar.tsx` / `DateRangeSelector.tsx` / `BookingMobileDayView.tsx` / `BookingTableView.tsx` / `BookingTile.tsx` | chrome |
| `CheckInPopup.tsx` | Collect payment vs prepaid |
| `utils.ts` / `types.ts` | date math, types |

Calendar POSTs use `fetchWithRetry("/api/admin/bookings", …)` — not `useAdminApi`.

---

## Other admin helpers

| File | Role |
|------|------|
| `useAdminApi.ts` | **Only** `POST /api/admin/checkins` |
| `types.ts` | `parseBedRow`, `CHECKIN_COLUMNS`, `hasPermission` |
| `PwaInstallBanner.tsx` | registers `/sw.js` scope `/` |
| `SyncStatusBar.tsx` | Pi/CF badge |
| `FoodBillGenerator.tsx` | jsPDF dynamic import |
| `DailyLedger.tsx` / `DailyReconcile.tsx` / `AdminAddExpense.tsx` | Accounts tabs |

---

## `src/lib/` (where logic lives)

| Cluster | Files |
|---------|--------|
| Auth / nav | `auth.ts`, `actionPermissions.ts`, `adminNav.ts` |
| Runtime | `runtime.ts`, `dbRetry.ts`, `sqliteWriteCount.ts` |
| Google / ID | `googleApiFetch.ts`, `validateIdDocument.ts`, `parsePassportData.ts`, `parseDob.ts`, `checkinSchema.ts`, `checkinLookup.ts`, `phoneUtils.ts` |
| PMS / Aiosell | `inventoryAvailability.ts`, `aiosell.ts`, `aiosellSync.ts`, `channelMapping.ts`, `channelAutoAssign.ts`, `bookingPricing.ts`, `pmsLog.ts`, `pmsLogSummary.ts`, `logRetention.ts`, `logExport.ts` |
| Sync | `syncEngine.ts` |
| CMS | `siteContent.ts`, `siteCopy.ts`, `mediaR2.ts`, `mediaKeys.ts`, `processSiteImage.ts`, `cropRect.ts` |
| Food | `kitchenHours.ts`, `foodLookup.ts`, `orderStatus.ts`, `thermalPrint.ts` |
| Splits | `splits.ts` |
| Other | `otaEmailParser.ts`, `pushNotify.ts`, `site.ts`, `seo.ts`, `format.ts`, `utils.ts`, `stayGallery.ts`, `animations.ts` |

Do not import `pmsLog.ts` from client components (it loads `queries.ts`).
