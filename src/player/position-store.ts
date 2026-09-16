export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface PlayerTransform {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly pitch: number;
}

/**
 * プレイヤーの現在位置（座標と視線の向き）を保存・復元するストア
 * - ワールドのシード値ごとにキーを分離
 * - 不正値（NaN, Infinity, 範囲外）をサニタイズ
 * - KeyValueStorage 注入対応でテスト可能
 */
export class PlayerPositionStore {
  private readonly storage: KeyValueStorage | null;
  private readonly key: string;

  constructor(
    seed = 2026,
    storage: KeyValueStorage | null = typeof localStorage !== "undefined" ? localStorage : null,
  ) {
    this.storage = storage;
    this.key = PlayerPositionStore.storageKey(seed);
  }

  static storageKey(seed: number): string {
    return `minecraft-clone:player-position:${seed}`;
  }

  save(transform: PlayerTransform): void {
    if (!this.storage) return;
    if (!PlayerPositionStore.isValidTransform(transform)) return;

    try {
      this.storage.setItem(
        this.key,
        JSON.stringify({
          x: Math.round(transform.x * 1000) / 1000,
          y: Math.round(transform.y * 1000) / 1000,
          z: Math.round(transform.z * 1000) / 1000,
          yaw: Math.round(transform.yaw * 1000) / 1000,
          pitch: Math.round(transform.pitch * 1000) / 1000,
        }),
      );
    } catch {
      // Ignore storage write errors (e.g. quota exceeded)
    }
  }

  load(): PlayerTransform | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(this.key);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (PlayerPositionStore.isValidTransform(parsed)) {
        return {
          x: parsed.x,
          y: parsed.y,
          z: parsed.z,
          yaw: parsed.yaw,
          pitch: parsed.pitch,
        };
      }
    } catch {
      // Corrupt payload falls back to null
    }
    return null;
  }

  clear(): void {
    if (!this.storage) return;
    try {
      if (this.storage.removeItem) {
        this.storage.removeItem(this.key);
      } else {
        this.storage.setItem(this.key, "");
      }
    } catch {
      // Ignore
    }
  }

  static isValidTransform(obj: unknown): obj is PlayerTransform {
    if (!obj || typeof obj !== "object") return false;
    const t = obj as Partial<PlayerTransform>;
    return (
      typeof t.x === "number" &&
      Number.isFinite(t.x) &&
      typeof t.y === "number" &&
      Number.isFinite(t.y) &&
      t.y >= 0 &&
      t.y <= 256 &&
      typeof t.z === "number" &&
      Number.isFinite(t.z) &&
      typeof t.yaw === "number" &&
      Number.isFinite(t.yaw) &&
      typeof t.pitch === "number" &&
      Number.isFinite(t.pitch)
    );
  }
}
