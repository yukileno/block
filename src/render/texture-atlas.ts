import * as THREE from "three";
import {
  ALL_TILE_KINDS,
  ATLAS_PIXELS,
  ATLAS_TILE_SIZE,
  TileKind,
  tileGridPosition,
} from "./atlas-layout";
import { mulberry32 } from "../world/rng";

interface TileStyle {
  readonly base: readonly [number, number, number];
  readonly alpha: number;
  readonly speckleAmount: number;
}

const TILE_STYLES: Record<TileKind, TileStyle> = {
  [TileKind.GRASS_TOP]: { base: [86, 140, 58], alpha: 255, speckleAmount: 18 },
  [TileKind.GRASS_SIDE]: { base: [122, 84, 51], alpha: 255, speckleAmount: 14 },
  [TileKind.DIRT]: { base: [122, 84, 51], alpha: 255, speckleAmount: 16 },
  [TileKind.STONE]: { base: [130, 130, 134], alpha: 255, speckleAmount: 16 },
  [TileKind.SAND]: { base: [219, 196, 120], alpha: 255, speckleAmount: 10 },
  [TileKind.WATER]: { base: [59, 111, 209], alpha: 175, speckleAmount: 8 },
  [TileKind.WOOD_SIDE]: { base: [95, 66, 40], alpha: 255, speckleAmount: 6 },
  [TileKind.WOOD_TOP]: { base: [176, 138, 89], alpha: 255, speckleAmount: 6 },
  [TileKind.LEAVES]: { base: [58, 117, 45], alpha: 215, speckleAmount: 22 },
  [TileKind.BEDROCK]: { base: [40, 40, 44], alpha: 255, speckleAmount: 24 },
  [TileKind.SNOW]: { base: [235, 240, 245], alpha: 255, speckleAmount: 10 },
  [TileKind.COBBLESTONE]: { base: [110, 110, 115], alpha: 255, speckleAmount: 24 },
  [TileKind.PLANKS]: { base: [168, 130, 84], alpha: 255, speckleAmount: 8 },
  [TileKind.BRICK]: { base: [156, 70, 52], alpha: 255, speckleAmount: 10 },
  [TileKind.GLASS]: { base: [200, 230, 245], alpha: 100, speckleAmount: 4 },
  [TileKind.GRAVEL]: { base: [125, 120, 122], alpha: 255, speckleAmount: 30 },
  [TileKind.ICE]: { base: [145, 185, 235], alpha: 190, speckleAmount: 8 },
  [TileKind.CLAY]: { base: [160, 164, 175], alpha: 255, speckleAmount: 8 },
  [TileKind.IRON_BLOCK]: { base: [220, 220, 222], alpha: 255, speckleAmount: 6 },
  [TileKind.GOLD_BLOCK]: { base: [245, 205, 45], alpha: 255, speckleAmount: 8 },
  [TileKind.DIAMOND_BLOCK]: { base: [75, 225, 215], alpha: 255, speckleAmount: 8 },
  [TileKind.OBSIDIAN]: { base: [25, 18, 38], alpha: 255, speckleAmount: 20 },
  [TileKind.BOOKSHELF_SIDE]: { base: [168, 130, 84], alpha: 255, speckleAmount: 6 },
  [TileKind.GLOWSTONE]: { base: [235, 185, 100], alpha: 255, speckleAmount: 28 },
  [TileKind.WOOL_RED]: { base: [175, 42, 38], alpha: 255, speckleAmount: 12 },
  [TileKind.WOOL_BLUE]: { base: [48, 65, 168], alpha: 255, speckleAmount: 12 },
  [TileKind.WOOL_YELLOW]: { base: [230, 195, 45], alpha: 255, speckleAmount: 12 },
  [TileKind.WOOL_GREEN]: { base: [85, 130, 40], alpha: 255, speckleAmount: 12 },
};

function paintSpeckles(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  x: number,
  y: number,
  style: TileStyle,
): void {
  const [r, g, b] = style.base;
  for (let i = 0; i < style.speckleAmount; i++) {
    const px = x + Math.floor(rng() * ATLAS_TILE_SIZE);
    const py = y + Math.floor(rng() * ATLAS_TILE_SIZE);
    const delta = Math.floor((rng() - 0.5) * 40);
    ctx.fillStyle = `rgba(${clamp255(r + delta)}, ${clamp255(g + delta)}, ${clamp255(b + delta)}, ${(style.alpha / 255).toString()})`;
    ctx.fillRect(px, py, 1, 1);
  }
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, v));
}

/** Paints one tile at an explicit pixel offset — used both to fill the
 * atlas grid (for hotbar icons) and to fill each layer of the block
 * texture array (for chunk rendering). */
function paintTileAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  seed: number,
  tile: TileKind,
): void {
  const style = TILE_STYLES[tile];
  const [r, g, b] = style.base;

  ctx.fillStyle = `rgba(${r.toString()}, ${g.toString()}, ${b.toString()}, ${(style.alpha / 255).toString()})`;
  ctx.fillRect(x, y, ATLAS_TILE_SIZE, ATLAS_TILE_SIZE);

  const rng = mulberry32(seed + tile * 7919);
  paintSpeckles(ctx, rng, x, y, style);

  if (tile === TileKind.GRASS_SIDE) {
    ctx.fillStyle = "rgba(86, 140, 58, 1)";
    ctx.fillRect(x, y, ATLAS_TILE_SIZE, 4);
    const grassRng = mulberry32(seed + 101);
    for (let i = 0; i < 6; i++) {
      const px = x + Math.floor(grassRng() * ATLAS_TILE_SIZE);
      ctx.fillStyle = "rgba(70, 120, 46, 1)";
      ctx.fillRect(px, y + 3 + Math.floor(grassRng() * 2), 1, 1);
    }
  }

  if (tile === TileKind.WOOD_TOP) {
    ctx.strokeStyle = "rgba(120, 90, 55, 0.9)";
    ctx.lineWidth = 1;
    const cx = x + ATLAS_TILE_SIZE / 2;
    const cy = y + ATLAS_TILE_SIZE / 2;
    for (const radius of [2, 4, 6]) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (tile === TileKind.WOOD_SIDE) {
    const barkRng = mulberry32(seed + 202);
    ctx.strokeStyle = "rgba(60, 42, 26, 0.8)";
    for (let i = 0; i < 5; i++) {
      const px = x + Math.floor(barkRng() * ATLAS_TILE_SIZE);
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px, y + ATLAS_TILE_SIZE);
      ctx.stroke();
    }
  }

  // Planks: horizontal wood grain slats
  if (tile === TileKind.PLANKS) {
    ctx.fillStyle = "rgba(110, 80, 50, 0.6)";
    for (let py = 3; py < ATLAS_TILE_SIZE; py += 4) {
      ctx.fillRect(x, y + py, ATLAS_TILE_SIZE, 1);
    }
    // Staggered vertical seams
    ctx.fillRect(x + 7, y, 1, 4);
    ctx.fillRect(x + 13, y + 4, 1, 4);
    ctx.fillRect(x + 4, y + 8, 1, 4);
    ctx.fillRect(x + 10, y + 12, 1, 4);
  }

  // Brick: reddish terracotta with light mortar lines
  if (tile === TileKind.BRICK) {
    ctx.fillStyle = "rgba(215, 205, 195, 0.8)";
    for (let py = 3; py < ATLAS_TILE_SIZE; py += 4) {
      ctx.fillRect(x, y + py, ATLAS_TILE_SIZE, 1);
    }
    ctx.fillRect(x + 7, y, 1, 4);
    ctx.fillRect(x + 15, y, 1, 4);
    ctx.fillRect(x + 3, y + 4, 1, 4);
    ctx.fillRect(x + 11, y + 4, 1, 4);
    ctx.fillRect(x + 7, y + 8, 1, 4);
    ctx.fillRect(x + 15, y + 8, 1, 4);
    ctx.fillRect(x + 3, y + 12, 1, 4);
    ctx.fillRect(x + 11, y + 12, 1, 4);
  }

  // Cobblestone: irregular mortar cracking
  if (tile === TileKind.COBBLESTONE) {
    ctx.strokeStyle = "rgba(60, 60, 65, 0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 1, y + 5);
    ctx.lineTo(x + 6, y + 5);
    ctx.lineTo(x + 8, y + 10);
    ctx.lineTo(x + 3, y + 12);
    ctx.lineTo(x + 1, y + 5);
    ctx.moveTo(x + 8, y + 2);
    ctx.lineTo(x + 14, y + 3);
    ctx.lineTo(x + 12, y + 8);
    ctx.lineTo(x + 8, y + 5);
    ctx.moveTo(x + 9, y + 11);
    ctx.lineTo(x + 15, y + 11);
    ctx.lineTo(x + 14, y + 15);
    ctx.stroke();
  }

  // Glass: translucent with white rim and diagonal glare
  if (tile === TileKind.GLASS) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, ATLAS_TILE_SIZE - 1, ATLAS_TILE_SIZE - 1);
    // Highlights
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillRect(x + 2, y + 2, 2, 2);
    ctx.fillRect(x + 5, y + 3, 1, 1);
    ctx.fillRect(x + 3, y + 5, 1, 1);
    ctx.fillRect(x + 11, y + 11, 2, 2);
  }

  // Metal / Gem Blocks (Iron, Gold, Diamond): beveled border
  if (
    tile === TileKind.IRON_BLOCK ||
    tile === TileKind.GOLD_BLOCK ||
    tile === TileKind.DIAMOND_BLOCK
  ) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1.5, y + 1.5, ATLAS_TILE_SIZE - 3, ATLAS_TILE_SIZE - 3);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.strokeRect(x + 0.5, y + 0.5, ATLAS_TILE_SIZE - 1, ATLAS_TILE_SIZE - 1);
  }

  // Bookshelf: shelves with books
  if (tile === TileKind.BOOKSHELF_SIDE) {
    // Shelf divider
    ctx.fillStyle = "rgba(100, 70, 40, 1)";
    ctx.fillRect(x, y + 7, ATLAS_TILE_SIZE, 2);
    ctx.fillRect(x, y, ATLAS_TILE_SIZE, 1);
    ctx.fillRect(x, y + ATLAS_TILE_SIZE - 1, ATLAS_TILE_SIZE, 1);
    // Colorful books on top shelf
    const bookColors = ["#b03a2e", "#2e7d32", "#1565c0", "#e67e22", "#8e44ad", "#d35400"];
    for (let bi = 0; bi < 5; bi++) {
      ctx.fillStyle = bookColors[bi % bookColors.length] ?? "#b03a2e";
      ctx.fillRect(x + 1 + bi * 3, y + 1, 2, 6);
    }
    // Bottom shelf
    for (let bi = 0; bi < 5; bi++) {
      ctx.fillStyle = bookColors[(bi + 3) % bookColors.length] ?? "#2e7d32";
      ctx.fillRect(x + 1 + bi * 3, y + 9, 2, 6);
    }
  }

  // Glowstone: warm glowing clusters
  if (tile === TileKind.GLOWSTONE) {
    ctx.fillStyle = "rgba(255, 245, 160, 0.7)";
    ctx.fillRect(x + 3, y + 3, 4, 3);
    ctx.fillRect(x + 9, y + 8, 4, 4);
    ctx.fillRect(x + 4, y + 10, 3, 3);
    ctx.fillRect(x + 10, y + 2, 3, 3);
  }
}

export interface BlockTextureAtlas {
  readonly texture: THREE.Texture;
  readonly canvas: HTMLCanvasElement;
}

/** Draws every block face texture procedurally onto one small canvas —
 * no external art assets, and the whole atlas is reproducible from a seed. */
export function createTextureAtlas(seed = 1): BlockTextureAtlas {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_PIXELS;
  canvas.height = ATLAS_PIXELS;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context is unavailable");

  ctx.imageSmoothingEnabled = false;
  for (const tile of ALL_TILE_KINDS) {
    const { col, row } = tileGridPosition(tile);
    paintTileAt(ctx, col * ATLAS_TILE_SIZE, row * ATLAS_TILE_SIZE, seed, tile);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  // The mesher's tile UVs use canvas conventions (v grows downward from the
  // top of the atlas). Three.js flips texture uploads by default, which
  // would shift every tile row: grass would sample an empty atlas region
  // (discarded by alphaTest — see-through terrain) and leaves would sample
  // sand. Caught by scripts/visual-check.mjs, invisible to unit tests.
  texture.flipY = false;
  texture.needsUpdate = true;

  return { texture, canvas };
}

/** Builds a WebGL2 texture array — one 16x16 layer per tile kind, indexed
 * by TileKind. Greedy-meshed quads span many blocks, so the chunk shader
 * samples this with a repeating UV (`fract`) and a per-vertex layer, which
 * an atlas can't do without bleeding into neighboring tiles. */
export function createBlockTextureArray(seed = 1): THREE.DataArrayTexture {
  const size = ATLAS_TILE_SIZE;
  const depth = ALL_TILE_KINDS.length;
  const data = new Uint8Array(size * size * depth * 4);

  const tileCanvas = document.createElement("canvas");
  tileCanvas.width = size;
  tileCanvas.height = size;
  const ctx = tileCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas context is unavailable");
  ctx.imageSmoothingEnabled = false;

  for (const tile of ALL_TILE_KINDS) {
    ctx.clearRect(0, 0, size, size);
    paintTileAt(ctx, 0, 0, seed, tile);
    const { data: pixels } = ctx.getImageData(0, 0, size, size);
    data.set(pixels, tile * size * size * 4);
  }

  const texture = new THREE.DataArrayTexture(data, size, size, depth);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
