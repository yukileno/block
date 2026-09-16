export interface TeleportTarget {
  readonly x: number;
  readonly y: number | null; // null means auto ground height
  readonly z: number;
}

export type ParseResult =
  | { type: "target"; target: TeleportTarget }
  | { type: "spawn" }
  | { type: "top" }
  | { type: "error"; message: string };

/** Convert full-width characters (e.g. １２３) to half-width */
export function normalizeCommandInput(input: string): string {
  return input
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, " ") // full-width space
    .replace(/〜/g, "~")
    .replace(/ー/g, "-")
    .replace(/−/g, "-")
    .trim();
}

/**
 * Parses teleport command string.
 * Supports:
 * - "/tp 100 64 200" or "tp 100 64 200" or "100 64 200"
 * - "/tp 100 200" or "100 200" (y is auto ground)
 * - relative coordinates like "~ ~10 ~"
 * - "/spawn"
 * - "/top"
 */
export function parseTeleportCommand(
  rawInput: string,
  currentPos: { x: number; y: number; z: number },
): ParseResult {
  const text = normalizeCommandInput(rawInput);
  if (!text) {
    return { type: "error", message: "コマンドまたは座標を入力してください" };
  }

  // Check simple keywords
  const lower = text.toLowerCase();
  if (lower === "/spawn" || lower === "spawn") {
    return { type: "spawn" };
  }
  if (lower === "/top" || lower === "top") {
    return { type: "top" };
  }

  // Strip leading /tp or tp if present
  let argsText = text;
  if (lower.startsWith("/tp ")) {
    argsText = text.slice(4).trim();
  } else if (lower.startsWith("tp ")) {
    argsText = text.slice(3).trim();
  } else if (lower.startsWith("/")) {
    argsText = text.slice(1).trim();
  }

  const parts = argsText.split(/\s+/).filter((p) => p.length > 0);

  if (parts.length === 2) {
    // X, Z format (Y is ground height)
    const x = parseCoordPart(parts[0], currentPos.x);
    const z = parseCoordPart(parts[1], currentPos.z);
    if (x === null || z === null) {
      return { type: "error", message: "座標の数値が正しくありません (例: /tp 100 200)" };
    }
    return {
      type: "target",
      target: { x, y: null, z },
    };
  }

  if (parts.length === 3) {
    // X, Y, Z format
    const x = parseCoordPart(parts[0], currentPos.x);
    const y = parseCoordPart(parts[1], currentPos.y);
    const z = parseCoordPart(parts[2], currentPos.z);
    if (x === null || y === null || z === null) {
      return { type: "error", message: "座標の数値が正しくありません (例: /tp 100 64 200)" };
    }
    return {
      type: "target",
      target: { x, y, z },
    };
  }

  return {
    type: "error",
    message: "座標は「X Y Z」または「X Z」の形式で入力してください (例: /tp 100 64 200)",
  };
}

function parseCoordPart(part: string | undefined, currentVal: number): number | null {
  if (!part) return null;

  if (part.startsWith("~")) {
    const offsetStr = part.slice(1);
    if (offsetStr === "") {
      return currentVal;
    }
    const offset = Number(offsetStr);
    if (!Number.isFinite(offset)) return null;
    return currentVal + offset;
  }

  const val = Number(part);
  if (!Number.isFinite(val)) return null;
  return val;
}
