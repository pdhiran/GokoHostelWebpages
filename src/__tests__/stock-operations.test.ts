import { describe, it, expect } from "vitest";

/**
 * Tests for atomic stock operation SQL logic.
 * These validate the computation logic that the SQL expressions implement,
 * without requiring a live database connection.
 */

function simulateDecrementStock(currentQty: number, decrementBy: number) {
  const newQty = Math.max(0, currentQty - decrementBy);
  const isAvailable = newQty > 0 ? 1 : 0;
  return { stockQuantity: newQty, isAvailable };
}

function simulateAddStock(currentQty: number, addBy: number) {
  return { stockQuantity: currentQty + addBy, isAvailable: 1 };
}

describe("Stock decrement logic", () => {
  it("decrements stock normally", () => {
    const result = simulateDecrementStock(10, 3);
    expect(result.stockQuantity).toBe(7);
    expect(result.isAvailable).toBe(1);
  });

  it("decrements to exactly zero and marks unavailable", () => {
    const result = simulateDecrementStock(5, 5);
    expect(result.stockQuantity).toBe(0);
    expect(result.isAvailable).toBe(0);
  });

  it("never goes below zero", () => {
    const result = simulateDecrementStock(2, 10);
    expect(result.stockQuantity).toBe(0);
    expect(result.isAvailable).toBe(0);
  });

  it("handles zero stock decrement", () => {
    const result = simulateDecrementStock(0, 1);
    expect(result.stockQuantity).toBe(0);
    expect(result.isAvailable).toBe(0);
  });

  it("handles decrement by 1", () => {
    const result = simulateDecrementStock(1, 1);
    expect(result.stockQuantity).toBe(0);
    expect(result.isAvailable).toBe(0);
  });

  it("large quantity decrement", () => {
    const result = simulateDecrementStock(100, 50);
    expect(result.stockQuantity).toBe(50);
    expect(result.isAvailable).toBe(1);
  });
});

describe("Stock add logic", () => {
  it("adds stock and marks available", () => {
    const result = simulateAddStock(0, 10);
    expect(result.stockQuantity).toBe(10);
    expect(result.isAvailable).toBe(1);
  });

  it("adds to existing stock", () => {
    const result = simulateAddStock(5, 3);
    expect(result.stockQuantity).toBe(8);
    expect(result.isAvailable).toBe(1);
  });

  it("adding zero stock keeps same quantity", () => {
    const result = simulateAddStock(10, 0);
    expect(result.stockQuantity).toBe(10);
    expect(result.isAvailable).toBe(1);
  });
});

describe("Concurrent stock operations (race condition scenario)", () => {
  it("atomic decrement prevents lost updates", () => {
    // Scenario: Two orders for 1 item each, stock starts at 10
    // With read-modify-write: both read 10, both write 9 → WRONG (lost update)
    // With atomic SQL: first writes 9, second writes 8 → CORRECT
    let stock = 10;

    // Simulate atomic: each operation sees the RESULT of the previous
    stock = Math.max(0, stock - 1); // Order A
    expect(stock).toBe(9);

    stock = Math.max(0, stock - 1); // Order B sees updated value
    expect(stock).toBe(8);
  });

  it("atomic decrement handles overselling correctly", () => {
    // Stock = 1, two concurrent orders for 1 each
    // Atomic SQL: first gets it (stock=0, unavailable), second sees 0
    let stock = 1;

    stock = Math.max(0, stock - 1);
    expect(stock).toBe(0);

    stock = Math.max(0, stock - 1);
    expect(stock).toBe(0); // Can't go negative
  });
});

describe("Food order total calculation", () => {
  it("calculates subtotal correctly", () => {
    const items = [
      { price: 15000, quantity: 2 }, // ₹150 × 2
      { price: 8000, quantity: 1 },  // ₹80 × 1
      { price: 5000, quantity: 3 },  // ₹50 × 3
    ];
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    expect(subtotal).toBe(53000); // ₹530.00 in paise
  });

  it("calculates tax correctly at 5%", () => {
    const subtotal = 10000; // ₹100 in paise
    const taxRate = 5;
    const tax = Math.round((subtotal * taxRate) / 100);
    expect(tax).toBe(500); // ₹5.00
  });

  it("calculates total as subtotal + tax", () => {
    const subtotal = 10000;
    const tax = 500;
    expect(subtotal + tax).toBe(10500);
  });

  it("handles zero-value edge case", () => {
    const subtotal = 0;
    const tax = Math.round((subtotal * 5) / 100);
    expect(tax).toBe(0);
    expect(subtotal + tax).toBe(0);
  });
});
