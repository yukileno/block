import { describe, expect, it } from "vitest";
import { normalizeZenToHan, parseNumericInput } from "./normalize";

describe("normalizeZenToHan", () => {
  it("converts full-width digits to half-width digits", () => {
    expect(normalizeZenToHan("０１２３４５６７８９")).toBe("0123456789");
  });

  it("leaves half-width digits unchanged", () => {
    expect(normalizeZenToHan("12345")).toBe("12345");
  });

  it("removes non-digit characters", () => {
    expect(normalizeZenToHan("あ１２a3b４")).toBe("1234");
  });
});

describe("parseNumericInput", () => {
  it("correctly parses half-width integers", () => {
    expect(parseNumericInput("15")).toBe(15);
    expect(parseNumericInput("  42  ")).toBe(42);
  });

  it("correctly parses full-width integers (全角数字)", () => {
    expect(parseNumericInput("１５")).toBe(15);
    expect(parseNumericInput("  ２４  ")).toBe(24);
    expect(parseNumericInput("０")).toBe(0);
  });

  it("correctly parses mixed full-width and half-width integers", () => {
    expect(parseNumericInput("1２3")).toBe(123);
  });

  it("returns 0 for empty or non-numeric inputs", () => {
    expect(parseNumericInput("")).toBe(0);
    expect(parseNumericInput("   ")).toBe(0);
    expect(parseNumericInput("abc")).toBe(0);
  });
});
