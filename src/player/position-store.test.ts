import { describe, expect, it } from "vitest";
import { type KeyValueStorage, PlayerPositionStore } from "./position-store";

function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

describe("PlayerPositionStore", () => {
  it("returns null when empty", () => {
    const storage = memoryStorage();
    const store = new PlayerPositionStore(2026, storage);
    expect(store.load()).toBeNull();
  });

  it("saves and loads player transform", () => {
    const storage = memoryStorage();
    const store = new PlayerPositionStore(2026, storage);
    store.save({
      x: 12.345,
      y: 64.5,
      z: -78.9,
      yaw: 1.57,
      pitch: -0.25,
    });

    const loaded = store.load();
    expect(loaded).not.toBeNull();
    expect(loaded?.x).toBeCloseTo(12.345);
    expect(loaded?.y).toBeCloseTo(64.5);
    expect(loaded?.z).toBeCloseTo(-78.9);
    expect(loaded?.yaw).toBeCloseTo(1.57);
    expect(loaded?.pitch).toBeCloseTo(-0.25);
  });

  it("isolates position by seed", () => {
    const storage = memoryStorage();
    const worldA = new PlayerPositionStore(100, storage);
    const worldB = new PlayerPositionStore(200, storage);

    worldA.save({ x: 10, y: 50, z: 10, yaw: 0, pitch: 0 });
    worldB.save({ x: 20, y: 60, z: 20, yaw: 1, pitch: 0.5 });

    expect(worldA.load()?.x).toBe(10);
    expect(worldB.load()?.x).toBe(20);
  });

  it("ignores corrupted json and returns null", () => {
    const storage = memoryStorage();
    storage.setItem(PlayerPositionStore.storageKey(2026), "not-json-content");
    const store = new PlayerPositionStore(2026, storage);
    expect(store.load()).toBeNull();
  });

  it("ignores invalid transform data with NaN or out-of-range coordinates", () => {
    const storage = memoryStorage();
    storage.setItem(
      PlayerPositionStore.storageKey(2026),
      JSON.stringify({ x: "invalid", y: 64, z: 10, yaw: 0, pitch: 0 }),
    );
    const store = new PlayerPositionStore(2026, storage);
    expect(store.load()).toBeNull();

    storage.setItem(
      PlayerPositionStore.storageKey(2026),
      JSON.stringify({ x: 10, y: -5, z: 10, yaw: 0, pitch: 0 }),
    );
    expect(store.load()).toBeNull();
  });

  it("clears saved position", () => {
    const storage = memoryStorage();
    const store = new PlayerPositionStore(2026, storage);
    store.save({ x: 10, y: 64, z: 10, yaw: 0, pitch: 0 });
    expect(store.load()).not.toBeNull();

    store.clear();
    expect(store.load()).toBeNull();
  });
});
