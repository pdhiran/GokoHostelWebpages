import { describe, expect, it } from "vitest";
import { foodImageSrc, sanitizeFoodImageUrl } from "@/lib/foodImage";

describe("food image URLs", () => {
  it("resolves legacy seed filenames from the bundled food folder", () => {
    expect(foodImageSrc("images/butter-naan.jpg")).toBe("/images/food/butter-naan.jpg");
    expect(foodImageSrc("butter-naan.jpg")).toBe("/images/food/butter-naan.jpg");
  });

  it("preserves uploaded menu media URLs", () => {
    const url = "/api/media/menu/2026-09-02-photo.jpg";
    expect(sanitizeFoodImageUrl(url)).toBe(url);
    expect(foodImageSrc(url)).toBe(url);
  });

  it("rejects non-menu media and unsafe paths", () => {
    expect(sanitizeFoodImageUrl("/api/media/events/photo.jpg")).toBe("");
    expect(sanitizeFoodImageUrl("../secret.jpg")).toBe("");
    expect(sanitizeFoodImageUrl("https://example.com/photo.jpg")).toBe("");
  });
});
