import { describe, expect, it } from "vitest";
import { gcd, lcm, reduceFraction, generateProblem } from "./fraction";

describe("fraction math logic", () => {
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

  it("reduces fractions properly", () => {
    expect(reduceFraction(4, 6)).toEqual({ num: 2, den: 3 });
    expect(reduceFraction(3, 12)).toEqual({ num: 1, den: 4 });
    expect(reduceFraction(5, 7)).toEqual({ num: 5, den: 7 });
  });

  it("generates valid fraction problems", () => {
    for (let i = 0; i < 50; i++) {
      const p = generateProblem();
      expect(p.f1.den).toBeGreaterThan(1);
      expect(p.f2.den).toBeGreaterThan(1);
      expect(p.f1.num).toBeGreaterThan(0);
      expect(p.f2.num).toBeGreaterThan(0);
      expect(p.commonDen).toBe(lcm(p.f1.den, p.f2.den));
      expect(p.step1Num1).toBe(p.f1.num * (p.commonDen / p.f1.den));
      expect(p.step1Num2).toBe(p.f2.num * (p.commonDen / p.f2.den));

      if (p.op === "+") {
        expect(p.ansNum).toBe(p.step1Num1 + p.step1Num2);
      } else {
        expect(p.ansNum).toBe(p.step1Num1 - p.step1Num2);
        expect(p.ansNum).toBeGreaterThan(0);
      }
      expect(p.ansDen).toBe(p.commonDen);
      expect(p.reducedNum / p.reducedDen).toBeCloseTo(p.ansNum / p.ansDen);
    }
  });
});
