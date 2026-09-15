/**
 * 算数・分数通分エンジン (小5算数対応)
 * 「通分（分母をそろえる）」に特化
 */

export interface Fraction {
  readonly num: number; // 分子
  readonly den: number; // 分母
}

export interface FractionProblem {
  readonly id: string;
  readonly f1: Fraction;
  readonly f2: Fraction;
  readonly commonDen: number; // 共通分母 (最小公倍数)
  readonly ansNum1: number; // 通分後の1つ目の分子
  readonly ansNum2: number; // 通分後の2つ目の分子
}

// 最大公約数 (GCD)
export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

// 最小公倍数 (LCM)
export function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

// ランダムな整数 [min, max]
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 小5で頻出の通分ペア
const DENOM_PAIRS: readonly [number, number][] = [
  [2, 3], // 公倍数 6
  [2, 4], // 公倍数 4 (片方倍)
  [2, 5], // 公倍数 10
  [3, 4], // 公倍数 12
  [3, 6], // 公倍数 6 (片方倍)
  [4, 6], // 公倍数 12
  [4, 8], // 公倍数 8 (片方倍)
  [3, 5], // 公倍数 15
  [5, 10], // 公倍数 10 (片方倍)
  [6, 8], // 公倍数 24
  [2, 6], // 公倍数 6 (片方倍)
  [3, 9], // 公倍数 9 (片方倍)
  [4, 5], // 公倍数 20
  [6, 9], // 公倍数 18
  [8, 12], // 公倍数 24
];

/**
 * 通分問題を1問生成する
 */
export function generateProblem(): FractionProblem {
  const pairIndex = randInt(0, DENOM_PAIRS.length - 1);
  const pair = DENOM_PAIRS[pairIndex] ?? [2, 3];
  let [d1, d2] = pair;

  if (Math.random() > 0.5) {
    const tmp = d1;
    d1 = d2;
    d2 = tmp;
  }

  // 分子 (1 〜 分母-1)
  const n1 = randInt(1, d1 - 1);
  const n2 = randInt(1, d2 - 1);

  const commonDen = lcm(d1, d2);
  const ansNum1 = n1 * (commonDen / d1);
  const ansNum2 = n2 * (commonDen / d2);

  return {
    id: Math.random().toString(36).substring(2, 9),
    f1: { num: n1, den: d1 },
    f2: { num: n2, den: d2 },
    commonDen,
    ansNum1,
    ansNum2,
  };
}
