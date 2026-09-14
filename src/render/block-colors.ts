import { BlockId } from "../world/blocks";

/** Flat per-block colors for the CPU raycaster — the same palette the
 * procedural texture atlas is built from, without needing a canvas. Grass
 * is the one block whose top and sides differ. */
export interface BlockColor {
  readonly top: readonly [number, number, number];
  readonly side: readonly [number, number, number];
}

const uniform = (r: number, g: number, b: number): BlockColor => ({
  top: [r, g, b],
  side: [r, g, b],
});

export const BLOCK_COLORS: Readonly<Record<BlockId, BlockColor>> = {
  [BlockId.AIR]: uniform(0, 0, 0), // never drawn — rays pass through air
  [BlockId.GRASS]: { top: [86, 140, 58], side: [122, 84, 51] },
  [BlockId.DIRT]: uniform(122, 84, 51),
  [BlockId.STONE]: uniform(130, 130, 134),
  [BlockId.SAND]: uniform(219, 196, 120),
  [BlockId.WATER]: uniform(59, 111, 209),
  [BlockId.WOOD]: uniform(95, 66, 40),
  [BlockId.LEAVES]: uniform(58, 117, 45),
  [BlockId.BEDROCK]: uniform(40, 40, 44),
  [BlockId.SNOW]: uniform(235, 240, 245),
  [BlockId.COBBLESTONE]: uniform(110, 110, 115),
  [BlockId.PLANKS]: uniform(168, 130, 84),
  [BlockId.BRICK]: uniform(156, 70, 52),
  [BlockId.GLASS]: uniform(200, 230, 245),
  [BlockId.GRAVEL]: uniform(125, 120, 122),
  [BlockId.ICE]: uniform(145, 185, 235),
  [BlockId.CLAY]: uniform(160, 164, 175),
  [BlockId.IRON_BLOCK]: uniform(220, 220, 222),
  [BlockId.GOLD_BLOCK]: uniform(245, 205, 45),
  [BlockId.DIAMOND_BLOCK]: uniform(75, 225, 215),
  [BlockId.OBSIDIAN]: uniform(25, 18, 38),
  [BlockId.BOOKSHELF]: { top: [168, 130, 84], side: [140, 100, 60] },
  [BlockId.GLOWSTONE]: uniform(235, 185, 100),
  [BlockId.WOOL_RED]: uniform(175, 42, 38),
  [BlockId.WOOL_BLUE]: uniform(48, 65, 168),
  [BlockId.WOOL_YELLOW]: uniform(230, 195, 45),
  [BlockId.WOOL_GREEN]: uniform(85, 130, 40),
};
