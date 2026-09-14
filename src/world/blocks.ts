/** Numeric block ids, stored one byte each in a chunk's Uint8Array. */
export const BlockId = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WATER: 5,
  WOOD: 6,
  LEAVES: 7,
  BEDROCK: 8,
  SNOW: 9,
  COBBLESTONE: 10,
  PLANKS: 11,
  BRICK: 12,
  GLASS: 13,
  GRAVEL: 14,
  ICE: 15,
  CLAY: 16,
  IRON_BLOCK: 17,
  GOLD_BLOCK: 18,
  DIAMOND_BLOCK: 19,
  OBSIDIAN: 20,
  BOOKSHELF: 21,
  GLOWSTONE: 22,
  WOOL_RED: 23,
  WOOL_BLUE: 24,
  WOOL_YELLOW: 25,
  WOOL_GREEN: 26,
} as const;

export type BlockId = (typeof BlockId)[keyof typeof BlockId];

export interface BlockDef {
  readonly id: BlockId;
  readonly name: string;
  readonly label: string;
  /** Has collision and stops the player. */
  readonly solid: boolean;
  /** Doesn't occlude a neighboring block's face in the mesher (air, water, leaves). */
  readonly transparent: boolean;
  /** Can be broken and picked up into the hotbar. */
  readonly breakable: boolean;
}

function block(
  id: BlockId,
  name: string,
  label: string,
  overrides: Partial<BlockDef> = {},
): BlockDef {
  return { id, name, label, solid: true, transparent: false, breakable: true, ...overrides };
}

export const BLOCKS: Readonly<Record<BlockId, BlockDef>> = {
  [BlockId.AIR]: block(BlockId.AIR, "air", "空気", {
    solid: false,
    transparent: true,
    breakable: false,
  }),
  [BlockId.GRASS]: block(BlockId.GRASS, "grass", "草ブロック"),
  [BlockId.DIRT]: block(BlockId.DIRT, "dirt", "土"),
  [BlockId.STONE]: block(BlockId.STONE, "stone", "焼き石"),
  [BlockId.SAND]: block(BlockId.SAND, "sand", "砂"),
  [BlockId.WATER]: block(BlockId.WATER, "water", "水", {
    solid: false,
    transparent: true,
    breakable: false,
  }),
  [BlockId.WOOD]: block(BlockId.WOOD, "wood", "原木"),
  [BlockId.LEAVES]: block(BlockId.LEAVES, "leaves", "葉っぱ", { transparent: true }),
  [BlockId.BEDROCK]: block(BlockId.BEDROCK, "bedrock", "岩盤", { breakable: false }),
  [BlockId.SNOW]: block(BlockId.SNOW, "snow", "雪ブロック"),
  [BlockId.COBBLESTONE]: block(BlockId.COBBLESTONE, "cobblestone", "丸石"),
  [BlockId.PLANKS]: block(BlockId.PLANKS, "planks", "木板"),
  [BlockId.BRICK]: block(BlockId.BRICK, "brick", "レンガ"),
  [BlockId.GLASS]: block(BlockId.GLASS, "glass", "ガラス", { transparent: true }),
  [BlockId.GRAVEL]: block(BlockId.GRAVEL, "gravel", "砂利"),
  [BlockId.ICE]: block(BlockId.ICE, "ice", "氷", { transparent: true }),
  [BlockId.CLAY]: block(BlockId.CLAY, "clay", "粘土"),
  [BlockId.IRON_BLOCK]: block(BlockId.IRON_BLOCK, "iron_block", "鉄ブロック"),
  [BlockId.GOLD_BLOCK]: block(BlockId.GOLD_BLOCK, "gold_block", "金ブロック"),
  [BlockId.DIAMOND_BLOCK]: block(BlockId.DIAMOND_BLOCK, "diamond_block", "ダイヤブロック"),
  [BlockId.OBSIDIAN]: block(BlockId.OBSIDIAN, "obsidian", "黒曜石"),
  [BlockId.BOOKSHELF]: block(BlockId.BOOKSHELF, "bookshelf", "本棚"),
  [BlockId.GLOWSTONE]: block(BlockId.GLOWSTONE, "glowstone", "グロウストーン"),
  [BlockId.WOOL_RED]: block(BlockId.WOOL_RED, "wool_red", "赤の羊毛"),
  [BlockId.WOOL_BLUE]: block(BlockId.WOOL_BLUE, "wool_blue", "青の羊毛"),
  [BlockId.WOOL_YELLOW]: block(BlockId.WOOL_YELLOW, "wool_yellow", "黄の羊毛"),
  [BlockId.WOOL_GREEN]: block(BlockId.WOOL_GREEN, "wool_green", "緑の羊毛"),
};

export function isSolid(id: BlockId): boolean {
  return BLOCKS[id].solid;
}

export function isTransparent(id: BlockId): boolean {
  return BLOCKS[id].transparent;
}

/** Initial 9 blocks on the hotbar. */
export const PLACEABLE_BLOCKS: readonly BlockId[] = [
  BlockId.GRASS,
  BlockId.DIRT,
  BlockId.COBBLESTONE,
  BlockId.PLANKS,
  BlockId.WOOD,
  BlockId.BRICK,
  BlockId.GLASS,
  BlockId.GOLD_BLOCK,
  BlockId.DIAMOND_BLOCK,
];

/** All blocks selectable in the creative inventory. */
export const INVENTORY_BLOCKS: readonly BlockId[] = [
  BlockId.GRASS,
  BlockId.DIRT,
  BlockId.STONE,
  BlockId.COBBLESTONE,
  BlockId.PLANKS,
  BlockId.WOOD,
  BlockId.LEAVES,
  BlockId.BRICK,
  BlockId.GLASS,
  BlockId.BOOKSHELF,
  BlockId.SAND,
  BlockId.GRAVEL,
  BlockId.CLAY,
  BlockId.SNOW,
  BlockId.ICE,
  BlockId.IRON_BLOCK,
  BlockId.GOLD_BLOCK,
  BlockId.DIAMOND_BLOCK,
  BlockId.GLOWSTONE,
  BlockId.OBSIDIAN,
  BlockId.WOOL_RED,
  BlockId.WOOL_BLUE,
  BlockId.WOOL_YELLOW,
  BlockId.WOOL_GREEN,
];
