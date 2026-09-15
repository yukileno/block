export const MAX_BUILD_TIME_SECONDS = 300; // 上限 5分 (300秒)
export const REWARD_TIME_SECONDS = 20; // 1問正解で +20秒
export const WARNING_TIME_SECONDS = 30; // 残り30秒で警告表示

const STORAGE_KEY = "maikura_build_timer_v1";

export interface RewardResult {
  readonly added: number;
  readonly total: number;
  readonly isMax: boolean;
}

/**
 * 建築モードの持ち時間タイマー
 * - 算数の問題を解くごとに +20秒チャージ
 * - 最大 5分 (300秒) まで蓄積可能
 * - 建築モードでプレイ中にカウントダウン
 * - 0秒になるとタイムアップ
 */
export class BuildTimer {
  private remaining: number;
  public onTimeUp?: () => void;

  constructor() {
    this.remaining = this.load();
  }

  private load(): number {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed >= 0) {
          return Math.min(parsed, MAX_BUILD_TIME_SECONDS);
        }
      }
    } catch {
      // ignore
    }
    // 初期状態は 0秒（まず問題を解いて時間をためる）
    return 0;
  }

  public save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, Math.floor(this.remaining).toString());
    } catch {
      // ignore
    }
  }

  /**
   * 1問正解時のご褒美時間を加算（+20秒、上限300秒）
   */
  public addReward(seconds = REWARD_TIME_SECONDS): RewardResult {
    const prev = this.remaining;
    this.remaining = Math.min(this.remaining + seconds, MAX_BUILD_TIME_SECONDS);
    const added = this.remaining - prev;
    this.save();
    return {
      added,
      total: Math.floor(this.remaining),
      isMax: this.remaining >= MAX_BUILD_TIME_SECONDS,
    };
  }

  /**
   * 建築モード中の経過時間 (秒) を消費する
   * @returns true: 時間切れ (タイムアップ) が発生した
   */
  public tick(dtSeconds: number): boolean {
    if (this.remaining <= 0) {
      return false;
    }

    this.remaining -= dtSeconds;

    if (this.remaining <= 0) {
      this.remaining = 0;
      this.save();
      this.onTimeUp?.();
      return true;
    }

    return false;
  }

  public get remainingSeconds(): number {
    return Math.max(0, Math.floor(this.remaining));
  }

  public hasTime(): boolean {
    return this.remaining > 0;
  }

  public get isMax(): boolean {
    return this.remaining >= MAX_BUILD_TIME_SECONDS;
  }

  public get isWarning(): boolean {
    return this.remaining > 0 && this.remaining <= WARNING_TIME_SECONDS;
  }

  /**
   * 表示用文字列 "MM:SS" (例: "03:45", "00:20")
   */
  public get formattedTime(): string {
    const sec = this.remainingSeconds;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
}
