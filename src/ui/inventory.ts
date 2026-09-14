import { BlockId, BLOCKS, INVENTORY_BLOCKS } from "../world/blocks";
import { HOTBAR_SIZE, Hotbar, renderTileIcon } from "./hotbar";

export class Inventory {
  private readonly app: HTMLElement;
  private readonly hotbar: Hotbar;
  private readonly atlasCanvas: HTMLCanvasElement;
  private modal: HTMLElement | null = null;
  private hotbarSlotsContainer: HTMLElement | null = null;
  private targetHotbarIndex = 0;
  private _isOpen = false;
  public onToggle?: (isOpen: boolean) => void;

  constructor(app: HTMLElement, hotbar: Hotbar, atlasCanvas: HTMLCanvasElement) {
    this.app = app;
    this.hotbar = hotbar;
    this.atlasCanvas = atlasCanvas;
    this.targetHotbarIndex = hotbar.selectedSlotIndex;

    this.createDom();
    this.bindEvents();
  }

  public get isOpen(): boolean {
    return this._isOpen;
  }

  private createDom(): void {
    const modal = document.createElement("div");
    modal.id = "inventory-modal";
    modal.className = "inventory-modal hidden";

    const win = document.createElement("div");
    win.className = "inventory-window";

    // Header
    const header = document.createElement("div");
    header.className = "inventory-header";

    const title = document.createElement("span");
    title.className = "inventory-title";
    title.textContent = "持ち物 / Inventory";

    const closeBtn = document.createElement("button");
    closeBtn.className = "inventory-close-btn";
    closeBtn.textContent = "✕";
    closeBtn.type = "button";
    closeBtn.addEventListener("click", () => {
      this.close();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    win.appendChild(header);

    // Section 1: Palette
    const paletteTitle = document.createElement("div");
    paletteTitle.className = "inventory-section-title";
    paletteTitle.textContent = "ブロック一覧（クリックで手持ちにセット）";
    win.appendChild(paletteTitle);

    const paletteGrid = document.createElement("div");
    paletteGrid.className = "inventory-palette-grid";

    INVENTORY_BLOCKS.forEach((blockId) => {
      const def = BLOCKS[blockId];
      const slot = document.createElement("div");
      slot.className = "inv-slot";
      slot.setAttribute("data-tooltip", `${def.label} (${def.name})`);

      const icon = renderTileIcon(this.atlasCanvas, blockId, 36);
      slot.appendChild(icon);

      slot.addEventListener("click", () => {
        this.setBlockToHotbar(blockId);
      });

      paletteGrid.appendChild(slot);
    });
    win.appendChild(paletteGrid);

    // Section 2: Hotbar (Quickbar)
    const hotbarTitle = document.createElement("div");
    hotbarTitle.className = "inventory-section-title";
    hotbarTitle.textContent = "クイックバー（手持ち 1〜9）";
    win.appendChild(hotbarTitle);

    const hotbarGrid = document.createElement("div");
    hotbarGrid.className = "inventory-hotbar-grid";
    this.hotbarSlotsContainer = hotbarGrid;
    win.appendChild(hotbarGrid);

    // Footer hints
    const footer = document.createElement("div");
    footer.className = "inventory-footer";
    footer.innerHTML = `<span>[E]キー または [Esc]キー でゲームに戻る</span>`;
    win.appendChild(footer);

    modal.appendChild(win);
    this.app.appendChild(modal);
    this.modal = modal;
  }

  private refreshHotbarSlots(): void {
    if (!this.hotbarSlotsContainer) return;
    this.hotbarSlotsContainer.innerHTML = "";
    const slots = this.hotbar.getSlots();

    slots.forEach((blockId, i) => {
      const def = BLOCKS[blockId];
      const slot = document.createElement("div");
      slot.className = "inv-slot hotbar-inv-slot";
      if (i === this.targetHotbarIndex) {
        slot.classList.add("target-selected");
      }
      slot.setAttribute("data-tooltip", `[${(i + 1).toString()}] ${def.label}`);

      const keyLabel = document.createElement("span");
      keyLabel.className = "inv-key-label";
      keyLabel.textContent = (i + 1).toString();
      slot.appendChild(keyLabel);

      const icon = renderTileIcon(this.atlasCanvas, blockId, 36);
      slot.appendChild(icon);

      slot.addEventListener("click", () => {
        this.targetHotbarIndex = i;
        this.hotbar.select(i);
        this.refreshHotbarSlots();
      });

      this.hotbarSlotsContainer?.appendChild(slot);
    });
  }

  private setBlockToHotbar(blockId: BlockId): void {
    this.hotbar.setSlot(this.targetHotbarIndex, blockId);
    this.refreshHotbarSlots();

    // Advance to next slot automatically for easy continuous picking
    this.targetHotbarIndex = (this.targetHotbarIndex + 1) % HOTBAR_SIZE;
    this.refreshHotbarSlots();
  }

  private bindEvents(): void {
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyE") {
        e.preventDefault();
        this.toggle();
      } else if (e.code === "Escape" && this._isOpen) {
        e.preventDefault();
        this.close();
      }
    });

    // Close when clicking modal backdrop
    this.modal?.addEventListener("click", (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });
  }

  public open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.targetHotbarIndex = this.hotbar.selectedSlotIndex;
    this.refreshHotbarSlots();
    this.modal?.classList.remove("hidden");
    this.onToggle?.(true);
  }

  public close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this.modal?.classList.add("hidden");
    this.onToggle?.(false);
  }

  public toggle(): void {
    if (this._isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}
