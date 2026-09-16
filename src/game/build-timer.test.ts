import { describe, expect, it } from "vitest";
import {
  BuildTimer,
  MAX_BUILD_TIME_SECONDS,
  REWARD_TIME_SECONDS,
  type KeyValueStorage,
} from "./build-timer";

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
}

describe("BuildTimer", () => {
  it("initializes with 0 seconds", () => {
    const storage = memoryStorage();
    const timer = new BuildTimer(storage);
    expect(timer.remainingSeconds).toBe(0);
    expect(timer.hasTime()).toBe(false);
    expect(timer.formattedTime).toBe("00:00");
  });

  it("adds 20 seconds on reward", () => {
    const storage = memoryStorage();
    const timer = new BuildTimer(storage);
    const res = timer.addReward();
    expect(res.added).toBe(REWARD_TIME_SECONDS);
    expect(res.total).toBe(20);
    expect(timer.remainingSeconds).toBe(20);
    expect(timer.hasTime()).toBe(true);
    expect(timer.formattedTime).toBe("00:20");
    expect(storage.getItem("maikura_build_timer_v1")).toBe("20");
  });

  it("caps at 5 minutes (300 seconds)", () => {
    const storage = memoryStorage();
    const timer = new BuildTimer(storage);
    for (let i = 0; i < 20; i++) {
      timer.addReward(20);
    }
    expect(timer.remainingSeconds).toBe(MAX_BUILD_TIME_SECONDS);
    expect(timer.isMax).toBe(true);
    expect(timer.formattedTime).toBe("05:00");

    const extra = timer.addReward(20);
    expect(extra.added).toBe(0);
    expect(timer.remainingSeconds).toBe(MAX_BUILD_TIME_SECONDS);
  });

  it("ticks down and triggers onTimeUp when depleted", () => {
    const storage = memoryStorage();
    const timer = new BuildTimer(storage);
    timer.addReward(10);
    expect(timer.remainingSeconds).toBe(10);

    let timeUpCalled = false;
    timer.onTimeUp = () => {
      timeUpCalled = true;
    };

    const finished1 = timer.tick(5);
    expect(finished1).toBe(false);
    expect(timer.remainingSeconds).toBe(5);
    expect(timeUpCalled).toBe(false);

    const finished2 = timer.tick(6);
    expect(finished2).toBe(true);
    expect(timer.remainingSeconds).toBe(0);
    expect(timeUpCalled).toBe(true);
    expect(timer.hasTime()).toBe(false);
  });

  it("detects warning threshold correctly", () => {
    const storage = memoryStorage();
    const timer = new BuildTimer(storage);
    timer.addReward(30);
    expect(timer.isWarning).toBe(true);
    timer.addReward(20);
    expect(timer.isWarning).toBe(false);
  });

  it("supports isInfinite mode with unlimited time and no countdown", () => {
    const storage = memoryStorage();
    const timer = new BuildTimer(storage, true);
    expect(timer.isInfinite).toBe(true);
    expect(timer.hasTime()).toBe(true);
    expect(timer.isMax).toBe(true);
    expect(timer.isWarning).toBe(false);
    expect(timer.formattedTime).toBe("∞ 無制限");
    expect(timer.tick(100)).toBe(false);
    expect(timer.hasTime()).toBe(true);
  });
});
