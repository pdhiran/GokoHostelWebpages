import { describe, it, expect } from "vitest";

type UserRole = "admin" | "manager" | "staff";

function checkPermission(
  role: UserRole,
  permissions: Record<string, boolean>,
  actionPermissions: Record<string, string | "admin_only">,
  action: string
): "allowed" | "forbidden" | "admin_required" {
  const requiredPerm = actionPermissions[action];
  if (requiredPerm === "admin_only") {
    return role === "admin" ? "allowed" : "admin_required";
  }
  if (requiredPerm && role !== "admin" && !permissions[requiredPerm]) {
    return "forbidden";
  }
  return "allowed";
}

const CHECKINS_PERMISSIONS: Record<string, string | "admin_only"> = {
  list: "canViewRecords", add: "canAddCheckin", addPast: "admin_only",
  update: "canEditRecords", delete: "canDeleteRecords",
  verifyCheckin: "canViewRecords", getFormCData: "canViewRecords",
  reExtractFormC: "admin_only", updateFormCData: "admin_only",
  getDashboard: "canViewDashboard", markVibeMatched: "canViewDashboard",
  checkoutBed: "canViewDashboard", checkoutGuest: "canViewDashboard", undoCheckout: "canViewDashboard",
  getBeds: "canViewBeds", assignBed: "canViewBeds", unassignBed: "canViewBeds",
  changeBed: "canViewBeds", markClean: "canMarkClean",
  getBedHistory: "canViewBeds", deleteBedHistory: "admin_only",
  initDorms: "admin_only", removeDorm: "admin_only", removeBed: "admin_only",
  getSetting: "admin_only", setSetting: "admin_only", getStats: "admin_only", healthCheck: "admin_only",
  getBookings: "canViewBookings", getUpcomingBookings: "canViewBookings",
  addBooking: "canAddBooking", updateBookingStatus: "canViewBookings", deleteBooking: "canDeleteBooking",
  getUsers: "admin_only", createUser: "admin_only", updateUser: "admin_only", deleteUser: "admin_only",
  getAuditLog: "admin_only", getSystemLogs: "admin_only", runBackup: "admin_only",
  getLatestRateScrape: "admin_only", getRateScrapeStatus: "admin_only",
  startRateScrape: "admin_only", updateRateScrapeResults: "admin_only",
  backfillManagerPermissions: "admin_only",
};

const FOOD_ORDERS_PERMISSIONS: Record<string, string | "admin_only"> = {
  listOrders: "canViewFoodOrders", getOrderDetails: "canViewFoodOrders",
  getOrderModifications: "canViewFoodOrders", getActiveGuests: "canViewFoodOrders",
  getGuestsWithTabs: "canViewFoodOrders", getGuestTab: "canViewFoodOrders",
  getGuestAllOrders: "canViewFoodOrders", getWalkinOrders: "canViewFoodOrders",
  getCombinedBill: "canViewFoodOrders", getMenu: "canViewFoodOrders",
  updateOrderStatus: "canViewFoodOrders", placeOrderForGuest: "canViewFoodOrders",
  voidItem: "canViewFoodOrders", updateItemQuantity: "canViewFoodOrders",
  reassignOrder: "canViewFoodOrders",
  markOrderPaid: "canMarkPaid", updatePaymentDetails: "canMarkPaid",
  applyDiscount: "canMarkPaid", removeDiscount: "canMarkPaid",
  cleanupOldOrders: "admin_only",
};

const EXPENSES_PERMISSIONS: Record<string, string | "admin_only"> = {
  listExpenses: "canViewExpenses", getMyExpenses: "canViewExpenses",
  addExpense: "canAddExpense", updateExpense: "canEditExpense", deleteExpense: "canDeleteExpense",
  getFoodRevenue: "canViewFoodBills",
  getDailyLedger: "canViewAccounts", getReconciliation: "canViewAccounts",
  addDailyIncome: "canAddIncome", deleteDailyIncome: "canAddIncome",
  saveReconciliation: "canManageAccounts", undoReconciliation: "canManageAccounts",
  adjustOpeningBalance: "canManageAccounts",
};

describe("RBAC: Admin always has access", () => {
  const role: UserRole = "admin";
  const permissions = {};

  it("admin can access all checkins actions", () => {
    for (const action of Object.keys(CHECKINS_PERMISSIONS)) {
      expect(checkPermission(role, permissions, CHECKINS_PERMISSIONS, action)).toBe("allowed");
    }
  });

  it("admin can access all food-orders actions", () => {
    for (const action of Object.keys(FOOD_ORDERS_PERMISSIONS)) {
      expect(checkPermission(role, permissions, FOOD_ORDERS_PERMISSIONS, action)).toBe("allowed");
    }
  });

  it("admin can access all expenses actions", () => {
    for (const action of Object.keys(EXPENSES_PERMISSIONS)) {
      expect(checkPermission(role, permissions, EXPENSES_PERMISSIONS, action)).toBe("allowed");
    }
  });
});

describe("RBAC: Staff with no permissions is blocked", () => {
  const role: UserRole = "staff";
  const permissions = {};

  it("staff without permissions cannot list records", () => {
    expect(checkPermission(role, permissions, CHECKINS_PERMISSIONS, "list")).toBe("forbidden");
  });

  it("staff without permissions cannot view dashboard", () => {
    expect(checkPermission(role, permissions, CHECKINS_PERMISSIONS, "getDashboard")).toBe("forbidden");
  });

  it("staff cannot access admin-only actions", () => {
    const adminOnlyActions = Object.entries(CHECKINS_PERMISSIONS)
      .filter(([, v]) => v === "admin_only")
      .map(([k]) => k);

    expect(adminOnlyActions.length).toBeGreaterThan(0);
    for (const action of adminOnlyActions) {
      expect(checkPermission(role, permissions, CHECKINS_PERMISSIONS, action)).toBe("admin_required");
    }
  });

  it("staff cannot mark orders paid without canMarkPaid", () => {
    expect(checkPermission(role, permissions, FOOD_ORDERS_PERMISSIONS, "markOrderPaid")).toBe("forbidden");
    expect(checkPermission(role, permissions, FOOD_ORDERS_PERMISSIONS, "applyDiscount")).toBe("forbidden");
  });

  it("staff cannot manage accounts without canManageAccounts", () => {
    expect(checkPermission(role, permissions, EXPENSES_PERMISSIONS, "saveReconciliation")).toBe("forbidden");
  });
});

describe("RBAC: Staff with specific permissions", () => {
  const role: UserRole = "staff";

  it("staff with canViewRecords can list but not add", () => {
    const permissions = { canViewRecords: true };
    expect(checkPermission(role, permissions, CHECKINS_PERMISSIONS, "list")).toBe("allowed");
    expect(checkPermission(role, permissions, CHECKINS_PERMISSIONS, "verifyCheckin")).toBe("allowed");
    expect(checkPermission(role, permissions, CHECKINS_PERMISSIONS, "add")).toBe("forbidden");
  });

  it("staff with canViewDashboard can access dashboard actions", () => {
    const permissions = { canViewDashboard: true };
    expect(checkPermission(role, permissions, CHECKINS_PERMISSIONS, "getDashboard")).toBe("allowed");
    expect(checkPermission(role, permissions, CHECKINS_PERMISSIONS, "checkoutBed")).toBe("allowed");
    expect(checkPermission(role, permissions, CHECKINS_PERMISSIONS, "markVibeMatched")).toBe("allowed");
  });

  it("staff with canMarkPaid can handle payments but not view orders without canViewFoodOrders", () => {
    const permissions = { canMarkPaid: true };
    expect(checkPermission(role, permissions, FOOD_ORDERS_PERMISSIONS, "markOrderPaid")).toBe("allowed");
    expect(checkPermission(role, permissions, FOOD_ORDERS_PERMISSIONS, "applyDiscount")).toBe("allowed");
    expect(checkPermission(role, permissions, FOOD_ORDERS_PERMISSIONS, "listOrders")).toBe("forbidden");
  });

  it("staff with both food permissions can view and pay", () => {
    const permissions = { canViewFoodOrders: true, canMarkPaid: true };
    expect(checkPermission(role, permissions, FOOD_ORDERS_PERMISSIONS, "listOrders")).toBe("allowed");
    expect(checkPermission(role, permissions, FOOD_ORDERS_PERMISSIONS, "markOrderPaid")).toBe("allowed");
  });

  it("staff can never access admin-only regardless of permissions", () => {
    const permissions = { canViewRecords: true, canAddCheckin: true, canEditRecords: true };
    expect(checkPermission(role, permissions, CHECKINS_PERMISSIONS, "createUser")).toBe("admin_required");
    expect(checkPermission(role, permissions, CHECKINS_PERMISSIONS, "getSetting")).toBe("admin_required");
    expect(checkPermission(role, permissions, CHECKINS_PERMISSIONS, "deleteUser")).toBe("admin_required");
  });
});

describe("RBAC: Manager with empty permissions (env password)", () => {
  const role: UserRole = "manager";
  const permissions = {};

  it("manager with env password (empty permissions) is blocked from permission-gated actions", () => {
    expect(checkPermission(role, permissions, CHECKINS_PERMISSIONS, "list")).toBe("forbidden");
    expect(checkPermission(role, permissions, FOOD_ORDERS_PERMISSIONS, "listOrders")).toBe("forbidden");
  });

  it("manager is blocked from admin-only actions", () => {
    expect(checkPermission(role, permissions, CHECKINS_PERMISSIONS, "createUser")).toBe("admin_required");
  });
});

describe("RBAC: Unknown actions pass through", () => {
  it("unknown action is allowed (no entry in permission map)", () => {
    const result = checkPermission("staff", {}, CHECKINS_PERMISSIONS, "changeMyPassword");
    expect(result).toBe("allowed");
  });
});

describe("RBAC: All admin-only actions are accounted for", () => {
  it("sensitive settings actions are admin-only", () => {
    expect(CHECKINS_PERMISSIONS["getSetting"]).toBe("admin_only");
    expect(CHECKINS_PERMISSIONS["setSetting"]).toBe("admin_only");
  });

  it("user management actions are admin-only", () => {
    expect(CHECKINS_PERMISSIONS["getUsers"]).toBe("admin_only");
    expect(CHECKINS_PERMISSIONS["createUser"]).toBe("admin_only");
    expect(CHECKINS_PERMISSIONS["updateUser"]).toBe("admin_only");
    expect(CHECKINS_PERMISSIONS["deleteUser"]).toBe("admin_only");
  });

  it("cleanup is admin-only", () => {
    expect(FOOD_ORDERS_PERMISSIONS["cleanupOldOrders"]).toBe("admin_only");
  });
});
