import { describe, expect, it } from "vitest";
import { gcd, lcm, generateProblem } from "./fraction";

describe("fraction math logic (tongbun only)", () => {
  it("calculates gcd correctly", () => {
    expect(gcd(6, 9)).toBe(3);
    expect(gcd(12, 18)).toBe(6);
    expect(gcd(7, 13)).toBe(1);
  });

  it("calculates lcm correctly", () => {
    expect(lcm(2, 3)).toBe(6);
    expect(lcm(4, 6)).toBe(12);
    expect(lcm(3, 5)).toBe(15);
  });

  it("generates valid tongbun problems", () => {
    for (let i = 0; i < 50; i++) {
      const p = generateProblem();
      expect(p.f1.den).toBeGreaterThan(1);
      expect(p.f2.den).toBeGreaterThan(1);
      expect(p.f1.num).toBeGreaterThan(0);
      expect(p.f2.num).toBeGreaterThan(0);
      expect(p.commonDen).toBe(lcm(p.f1.den, p.f2.den));
      expect(p.ansNum1).toBe(p.f1.num * (p.commonDen / p.f1.den));
      expect(p.ansNum2).toBe(p.f2.num * (p.commonDen / p.f2.den));
      expect(p.ansNum1 / p.commonDen).toBeCloseTo(p.f1.num / p.f1.den);
      expect(p.ansNum2 / p.commonDen).toBeCloseTo(p.f2.num / p.f2.den);
    }
  });
});
