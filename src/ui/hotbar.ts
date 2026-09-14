import { BlockId, PLACEABLE_BLOCKS } from "../world/blocks";
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

/** The 9-slot block picker: click, number keys 1-9, or scroll to select. */
export class Hotbar {
  private readonly container: HTMLElement;
  private readonly atlasCanvas: HTMLCanvasElement;
  private selectedIndex = 0;
  private readonly slots: BlockId[];
  private readonly slotElements: HTMLElement[] = [];
  public onOpenInventory?: () => void;

  constructor(container: HTMLElement, atlasCanvas: HTMLCanvasElement) {
    this.container = container;
    this.atlasCanvas = atlasCanvas;
    this.slots = [...PLACEABLE_BLOCKS.slice(0, HOTBAR_SIZE)];
    while (this.slots.length < HOTBAR_SIZE) {
      this.slots.push(BlockId.GRASS);
    }

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

  private build(): void {
    this.container.innerHTML = "";
    this.slotElements.length = 0;

    this.slots.forEach((blockId, i) => {
      const slot = document.createElement("div");
      slot.className = "hotbar-slot";

      const key = document.createElement("span");
      key.className = "hotbar-key";
      key.textContent = (i + 1).toString();
      slot.appendChild(key);
      slot.appendChild(renderTileIcon(this.atlasCanvas, blockId));

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
    invButton.innerHTML = `<span style="font-size: 22px; display: flex; align-items: center; justify-content: center; height: 100%;">📦</span>`;
    invButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onOpenInventory?.();
    });
    this.container.appendChild(invButton);

    this.applySelectionStyle();
  }

  public setSlot(index: number, blockId: BlockId): void {
    if (index < 0 || index >= HOTBAR_SIZE) return;
    this.slots[index] = blockId;
    const slotEl = this.slotElements[index];
    if (slotEl) {
      // Replace canvas icon
      const oldCanvas = slotEl.querySelector("canvas");
      if (oldCanvas) slotEl.removeChild(oldCanvas);
      slotEl.appendChild(renderTileIcon(this.atlasCanvas, blockId));
    }
  }

  public getSlots(): readonly BlockId[] {
    return this.slots;
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
    return this.slots[this.selectedIndex] ?? BlockId.GRASS;
  }
}
