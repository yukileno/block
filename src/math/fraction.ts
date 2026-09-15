/**
 * 算数・分数通分エンジン (小5算数対応)
 */

export interface Fraction {
  readonly num: number; // 分子
  readonly den: number; // 分母
}

export type Operation = "+" | "-";

export interface FractionProblem {
  readonly id: string;
  readonly f1: Fraction;
  readonly f2: Fraction;
  readonly op: Operation;
  // 通分後の分数
  readonly commonDen: number; // 共通分母 (最小公倍数)
  readonly step1Num1: number; // 通分後1つ目の分子
  readonly step1Num2: number; // 通分後2つ目の分子
  // 最終的な答え
  readonly ansNum: number; // 計算結果の分子 (約分前)
  readonly ansDen: number; // 計算結果の分母 (約分前)
  readonly reducedNum: number; // 約分後の分子
  readonly reducedDen: number; // 約分後の分母
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

// 分数を約分する
export function reduceFraction(num: number, den: number): Fraction {
  const g = gcd(num, den);
  return { num: num / g, den: den / g };
}

// ランダムな整数 [min, max]
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// よく使われる分母ペアのリスト（小5算数の通分で定番のもの）
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
];

/**
 * 通分が必要な分数のたし算・ひき算問題を1問生成する
 */
export function generateProblem(): FractionProblem {
  const pairIndex = randInt(0, DENOM_PAIRS.length - 1);
  const pair = DENOM_PAIRS[pairIndex] ?? [2, 3];
  let [d1, d2] = pair;

  // 50%の確率で分母の順番をシャッフル
  if (Math.random() > 0.5) {
    const tmp = d1;
    d1 = d2;
    d2 = tmp;
  }

  // たし算かひき算か (75%たし算, 25%ひき算)
  const op: Operation = Math.random() < 0.75 ? "+" : "-";

  // 分子 (1 〜 分母-1) の真分数
  let n1 = randInt(1, d1 - 1);
  let n2 = randInt(1, d2 - 1);

  const commonDen = lcm(d1, d2);
  let step1Num1 = n1 * (commonDen / d1);
  let step1Num2 = n2 * (commonDen / d2);

  // ひき算で結果が0以下になる場合は調整
  if (op === "-") {
    if (step1Num1 <= step1Num2) {
      // n1の方を大きくする
      const tmpN = n1;
      n1 = n2;
      n2 = tmpN;
      const tmpD = d1;
      d1 = d2;
      d2 = tmpD;
      step1Num1 = n1 * (commonDen / d1);
      step1Num2 = n2 * (commonDen / d2);
      if (step1Num1 <= step1Num2) {
        n1 = d1 - 1;
        n2 = 1;
        step1Num1 = n1 * (commonDen / d1);
        step1Num2 = n2 * (commonDen / d2);
      }
    }
  }

  const ansNum = op === "+" ? step1Num1 + step1Num2 : step1Num1 - step1Num2;
  const ansDen = commonDen;
  const reduced = reduceFraction(ansNum, ansDen);

  return {
    id: Math.random().toString(36).substring(2, 9),
    f1: { num: n1, den: d1 },
    f2: { num: n2, den: d2 },
    op,
    commonDen,
    step1Num1,
    step1Num2,
    ansNum,
    ansDen,
    reducedNum: reduced.num,
    reducedDen: reduced.den,
  };
}
