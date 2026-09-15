import { BlockId, BLOCKS, PLACEABLE_BLOCKS } from "../world/blocks";
import { ATLAS_TILE_SIZE, tileForBlockFace, tileGridPosition } from "../render/atlas-layout";

export const ICON_SIZE = 40;

export function renderTileIcon(
  atlasCanvas: HTMLCanvasElement,
  blockId: BlockId,
  size = ICON_SIZE,
): HTMLCanvasElement {
  const icon = document.createElement("canvas");
  icon.width = size;
  icon.height = size;
  const ctx = icon.getContext("2d");
  if (!ctx) throw new Error("2D canvas context is unavailable");
  ctx.imageSmoothingEnabled = false;

  const { col, row } = tileGridPosition(tileForBlockFace(blockId, "east"));
  ctx.drawImage(
    atlasCanvas,
    col * ATLAS_TILE_SIZE,
    row * ATLAS_TILE_SIZE,
    ATLAS_TILE_SIZE,
    ATLAS_TILE_SIZE,
    0,
    0,
    size,
    size,
  );
  icon.style.width = "100%";
  icon.style.height = "100%";
  return icon;
}

export const HOTBAR_SIZE = 9;

export interface HotbarSlotData {
  blockId: BlockId;
  count: number;
}

const STORAGE_KEY = "maikura_hotbar_v1";

/** The 9-slot block picker with item counts: click, number keys 1-9, or scroll to select. */
export class Hotbar {
  private readonly container: HTMLElement;
  private readonly atlasCanvas: HTMLCanvasElement;
  private selectedIndex = 0;
  private readonly slots: HotbarSlotData[];
  private readonly slotElements: HTMLElement[] = [];
  public onOpenInventory?: () => void;

  constructor(container: HTMLElement, atlasCanvas: HTMLCanvasElement) {
    this.container = container;
    this.atlasCanvas = atlasCanvas;
    this.slots = this.loadSlots();

    this.build();

    window.addEventListener("keydown", (e) => {
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= HOTBAR_SIZE) {
        this.select(n - 1);
      }
    });

    window.addEventListener("wheel", (e) => {
      const direction = e.deltaY > 0 ? 1 : -1;
      this.select((this.selectedIndex + direction + HOTBAR_SIZE) % HOTBAR_SIZE);
    });
  }

  private loadSlots(): HotbarSlotData[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as HotbarSlotData[];
        if (Array.isArray(parsed) && parsed.length === HOTBAR_SIZE) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    // Default starting blocks (3 of each for testing)
    const defaults: HotbarSlotData[] = [
      { blockId: BlockId.GRASS, count: 3 },
      { blockId: BlockId.PLANKS, count: 3 },
      { blockId: BlockId.COBBLESTONE, count: 3 },
      { blockId: BlockId.BRICK, count: 3 },
      { blockId: BlockId.GLASS, count: 3 },
      { blockId: BlockId.WOOD, count: 3 },
      { blockId: BlockId.DIRT, count: 3 },
      { blockId: BlockId.GOLD_BLOCK, count: 0 },
      { blockId: BlockId.DIAMOND_BLOCK, count: 0 },
    ];
    return defaults;
  }

  private saveSlots(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.slots));
    } catch {
      // ignore
    }
  }

  private build(): void {
    this.container.innerHTML = "";
    this.slotElements.length = 0;

    this.slots.forEach((slotData, i) => {
      const slot = document.createElement("div");
      slot.className = "hotbar-slot";

      const key = document.createElement("span");
      key.className = "hotbar-key";
      key.textContent = (i + 1).toString();
      slot.appendChild(key);

      const icon = renderTileIcon(this.atlasCanvas, slotData.blockId);
      if (slotData.count <= 0) {
        icon.style.opacity = "0.25";
      }
      slot.appendChild(icon);

      const countBadge = document.createElement("span");
      countBadge.className = "hotbar-count";
      countBadge.textContent = slotData.count > 0 ? slotData.count.toString() : "";
      slot.appendChild(countBadge);

      slot.addEventListener("click", () => {
        this.select(i);
      });
      this.container.appendChild(slot);
      this.slotElements.push(slot);
    });

    // Inventory button at the right end of the hotbar
    const invButton = document.createElement("div");
    invButton.className = "hotbar-slot hotbar-inv-btn";
    invButton.title = "持ち物 (E)";
    invButton.innerHTML = `<span style="font-size: 20px; display: flex; align-items: center; justify-content: center; height: 100%;">📦</span>`;
    invButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onOpenInventory?.();
    });
    this.container.appendChild(invButton);

    this.applySelectionStyle();
  }

  private refreshSlotElement(index: number): void {
    const slotEl = this.slotElements[index];
    const data = this.slots[index];
    if (!slotEl || !data) return;

    // Update canvas icon
    const oldCanvas = slotEl.querySelector("canvas");
    if (oldCanvas) slotEl.removeChild(oldCanvas);
    const newIcon = renderTileIcon(this.atlasCanvas, data.blockId);
    if (data.count <= 0) {
      newIcon.style.opacity = "0.25";
    }
    slotEl.appendChild(newIcon);

    // Update count badge
    let countBadge = slotEl.querySelector<HTMLElement>(".hotbar-count");
    if (!countBadge) {
      countBadge = document.createElement("span");
      countBadge.className = "hotbar-count";
      slotEl.appendChild(countBadge);
    }
    countBadge.textContent = data.count > 0 ? data.count.toString() : "";
  }

  /** Add random blocks (default 3) to inventory / hotbar. Returns info of acquired block. */
  public addRandomBlocks(
    amount = 3,
    candidateBlocks: readonly BlockId[] = PLACEABLE_BLOCKS,
  ): { blockId: BlockId; label: string; count: number } {
    const randomIndex = Math.floor(Math.random() * candidateBlocks.length);
    const chosenBlockId = candidateBlocks[randomIndex] ?? BlockId.GRASS;

    // Check if block already in hotbar
    const existingIndex = this.slots.findIndex((s) => s.blockId === chosenBlockId);
    if (existingIndex >= 0) {
      const slot = this.slots[existingIndex];
      if (slot) {
        slot.count += amount;
        this.refreshSlotElement(existingIndex);
        this.saveSlots();
        return {
          blockId: chosenBlockId,
          label: BLOCKS[chosenBlockId].label,
          count: amount,
        };
      }
    }

    // Look for an empty/0-count slot
    const emptyIndex = this.slots.findIndex((s) => s.count <= 0);
    const targetIdx = emptyIndex >= 0 ? emptyIndex : this.selectedIndex;
    this.slots[targetIdx] = { blockId: chosenBlockId, count: amount };
    this.refreshSlotElement(targetIdx);
    this.saveSlots();

    return {
      blockId: chosenBlockId,
      label: BLOCKS[chosenBlockId].label,
      count: amount,
    };
  }

  /** Consumes 1 block from the currently selected slot. Returns false if no blocks left. */
  public consumeSelectedBlock(): boolean {
    const current = this.slots[this.selectedIndex];
    if (!current || current.count <= 0) {
      return false;
    }
    current.count -= 1;
    this.refreshSlotElement(this.selectedIndex);
    this.saveSlots();
    return true;
  }

  public hasSelectedBlock(): boolean {
    const current = this.slots[this.selectedIndex];
    return current !== undefined && current.count > 0;
  }

  public setSlot(index: number, blockId: BlockId): void {
    if (index < 0 || index >= HOTBAR_SIZE) return;
    const existing = this.slots[index];
    const prevCount = existing ? existing.count : 0;
    this.slots[index] = { blockId, count: prevCount };
    this.refreshSlotElement(index);
    this.saveSlots();
  }

  public getSlots(): readonly BlockId[] {
    return this.slots.map((s) => s.blockId);
  }

  public getSlotData(index: number): HotbarSlotData | undefined {
    return this.slots[index];
  }

  public get selectedSlotIndex(): number {
    return this.selectedIndex;
  }

  public select(index: number): void {
    if (index < 0 || index >= HOTBAR_SIZE) return;
    this.selectedIndex = index;
    this.applySelectionStyle();
  }

  private applySelectionStyle(): void {
    this.slotElements.forEach((el, i) => {
      el.classList.toggle("selected", i === this.selectedIndex);
    });
  }

  get selectedBlock(): BlockId {
    const s = this.slots[this.selectedIndex];
    return s ? s.blockId : BlockId.GRASS;
  }
}
