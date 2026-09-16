import { describe, expect, it } from "vitest";
import { normalizeCommandInput, parseTeleportCommand } from "./teleport-parser";

describe("normalizeCommandInput", () => {
  it("converts full-width numbers and spaces", () => {
    expect(normalizeCommandInput("\u3000１００\u3000６４\u3000２００\u3000")).toBe("100 64 200");
  });
});

describe("parseTeleportCommand", () => {
  const currentPos = { x: 10, y: 60, z: 20 };

  it("parses absolute coordinates with /tp prefix", () => {
    const res = parseTeleportCommand("/tp 100 64 200", currentPos);
    expect(res).toEqual({
      type: "target",
      target: { x: 100, y: 64, z: 200 },
    });
  });

  it("parses space-separated coordinates without /tp", () => {
    const res = parseTeleportCommand("150 72 -50", currentPos);
    expect(res).toEqual({
      type: "target",
      target: { x: 150, y: 72, z: -50 },
    });
  });

  it("parses X and Z with ground Y auto", () => {
    const res = parseTeleportCommand("/tp 300 -100", currentPos);
    expect(res).toEqual({
      type: "target",
      target: { x: 300, y: null, z: -100 },
    });
  });

  it("parses relative coordinates with tilde", () => {
    const res = parseTeleportCommand("/tp ~ ~10 ~-5", currentPos);
    expect(res).toEqual({
      type: "target",
      target: { x: 10, y: 70, z: 15 },
    });
  });

  it("recognizes /spawn", () => {
    const res = parseTeleportCommand("/spawn", currentPos);
    expect(res).toEqual({ type: "spawn" });
  });

  it("recognizes /top", () => {
    const res = parseTeleportCommand("/top", currentPos);
    expect(res).toEqual({ type: "top" });
  });

  it("returns error on invalid input", () => {
    const res = parseTeleportCommand("hello world", currentPos);
    expect(res.type).toBe("error");
  });
});
