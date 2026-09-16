import { BlockId, BLOCKS, INVENTORY_BLOCKS } from "../world/blocks";
import { Hotbar, renderTileIcon } from "./hotbar";

export class Inventory {
  private readonly app: HTMLElement;
  private readonly hotbar: Hotbar;
  private readonly atlasCanvas: HTMLCanvasElement;
  public readonly isInfinite: boolean;
  private modal: HTMLElement | null = null;
  private hotbarSlotsContainer: HTMLElement | null = null;
  private targetHotbarIndex = 0;
  private _isOpen = false;
  public onToggle?: (isOpen: boolean) => void;
  public onOpenMath?: () => void;

  constructor(
    app: HTMLElement,
    hotbar: Hotbar,
    atlasCanvas: HTMLCanvasElement,
    isInfinite = false,
  ) {
    this.app = app;
    this.hotbar = hotbar;
    this.atlasCanvas = atlasCanvas;
    this.isInfinite = isInfinite;
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
    title.textContent = this.isInfinite
      ? "持ち物 / Inventory [デバッグ無限モード]"
      : "持ち物 / Inventory";

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

    // Section 1: Acquired Blocks (無限モードでは全ブロックパレットを表示)
    const paletteTitle = document.createElement("div");
    paletteTitle.className = "inventory-section-title";
    paletteTitle.textContent = this.isInfinite
      ? "🎒 全ブロックパレット（クリックで選択中のクイックバーにセット）"
      : "🎒 獲得したブロック（問題を解いてゲットしたもちもの）";
    win.appendChild(paletteTitle);

    const acquiredGrid = document.createElement("div");
    acquiredGrid.className = "inventory-acquired-grid";
    this.acquiredContainer = acquiredGrid;
    win.appendChild(acquiredGrid);

    // Section 2: Hotbar (Quickbar)
    const hotbarTitle = document.createElement("div");
    hotbarTitle.className = "inventory-section-title";
    hotbarTitle.textContent = "クイックバー（手持ち 1〜9）";
    win.appendChild(hotbarTitle);

    const hotbarGrid = document.createElement("div");
    hotbarGrid.className = "inventory-hotbar-grid";
    this.hotbarSlotsContainer = hotbarGrid;
    win.appendChild(hotbarGrid);

    // Get more blocks button or infinite mode notice
    const getMoreWrap = document.createElement("div");
    getMoreWrap.style.textAlign = "center";
    getMoreWrap.style.margin = "12px 0 6px 0";

    if (this.isInfinite) {
      const infiniteNotice = document.createElement("div");
      infiniteNotice.style.fontSize = "13px";
      infiniteNotice.style.color = "#27ae60";
      infiniteNotice.style.fontWeight = "bold";
      infiniteNotice.textContent =
        "✨ デバッグモード: 全ブロック使い放題（個数制限・タイマーなし）";
      getMoreWrap.appendChild(infiniteNotice);
    } else {
      const getMoreBtn = document.createElement("button");
      getMoreBtn.type = "button";
      getMoreBtn.className = "math-action-btn ok-btn";
      getMoreBtn.style.padding = "8px 20px";
      getMoreBtn.style.fontSize = "14px";
      getMoreBtn.textContent = "✏️ つうぶん問題を解いてブロックゲット！";
      getMoreBtn.addEventListener("click", () => {
        this.onOpenMath?.();
        this.close();
      });
      getMoreWrap.appendChild(getMoreBtn);
    }
    win.appendChild(getMoreWrap);

    // Footer hints
    const footer = document.createElement("div");
    footer.className = "inventory-footer";
    footer.innerHTML = `<span>[E]キー または [Esc]キー でゲームに戻る</span>`;
    win.appendChild(footer);

    modal.appendChild(win);
    this.app.appendChild(modal);
    this.modal = modal;
  }

  private acquiredContainer: HTMLElement | null = null;

  private refreshAcquiredBlocks(): void {
    if (!this.acquiredContainer) return;
    this.acquiredContainer.innerHTML = "";

    // 無限モードの場合は全種類のブロックを無制限で表示
    if (this.isInfinite) {
      INVENTORY_BLOCKS.forEach((blockId) => {
        const def = BLOCKS[blockId];
        const card = document.createElement("div");
        card.className = "acquired-block-card";

        const icon = renderTileIcon(this.atlasCanvas, blockId, 40);
        card.appendChild(icon);

        const info = document.createElement("div");
        info.className = "acquired-block-info";

        const name = document.createElement("div");
        name.className = "acquired-block-name";
        name.textContent = def.label;
        info.appendChild(name);

        const countBadge = document.createElement("div");
        countBadge.className = "acquired-block-count";
        countBadge.textContent = "∞";
        info.appendChild(countBadge);

        card.appendChild(info);

        card.addEventListener("click", () => {
          this.setBlockToHotbar(blockId, 999);
        });

        this.acquiredContainer?.appendChild(card);
      });
      return;
    }

    // ホットバーのスロットから獲得したブロックを集計
    const allSlots = this.hotbar.getAllSlotsData();
    const acquiredMap = new Map<BlockId, number>();

    allSlots.forEach((slot) => {
      if (slot.blockId !== null && slot.count > 0) {
        const prev = acquiredMap.get(slot.blockId) ?? 0;
        acquiredMap.set(slot.blockId, prev + slot.count);
      }
    });

    if (acquiredMap.size === 0) {
      // ブロックをまだ持っていないときの案内
      const emptyNotice = document.createElement("div");
      emptyNotice.className = "empty-inventory-notice";
      emptyNotice.innerHTML = `
        <div style="font-size: 32px; margin-bottom: 4px;">📦</div>
        <div style="font-weight: 900; font-size: 15px; color: #2c3e50;">まだブロックを持っていません</div>
        <div style="font-size: 12px; color: #555; margin-top: 4px;">
          下の「✏️ つうぶん問題を解いてブロックゲット！」を押して、<br />
          問題を1問解くごとにランダムなブロックが <b>3個</b> 手に入ります！
        </div>
      `;
      this.acquiredContainer.appendChild(emptyNotice);
      return;
    }

    // 獲得したブロックのみを表示
    acquiredMap.forEach((count, blockId) => {
      const def = BLOCKS[blockId];
      const card = document.createElement("div");
      card.className = "acquired-block-card";

      const icon = renderTileIcon(this.atlasCanvas, blockId, 40);
      card.appendChild(icon);

      const info = document.createElement("div");
      info.className = "acquired-block-info";

      const name = document.createElement("div");
      name.className = "acquired-block-name";
      name.textContent = def.label;
      info.appendChild(name);

      const countBadge = document.createElement("div");
      countBadge.className = "acquired-block-count";
      countBadge.textContent = `×${count.toString()}こ`;
      info.appendChild(countBadge);

      card.appendChild(info);

      card.addEventListener("click", () => {
        this.setBlockToHotbar(blockId, count);
      });

      this.acquiredContainer?.appendChild(card);
    });
  }

  private refreshHotbarSlots(): void {
    if (!this.hotbarSlotsContainer) return;
    this.hotbarSlotsContainer.innerHTML = "";
    const allSlots = this.hotbar.getAllSlotsData();

    allSlots.forEach((slotData, i) => {
      const slot = document.createElement("div");
      slot.className = "inv-slot hotbar-inv-slot";
      if (i === this.targetHotbarIndex) {
        slot.classList.add("target-selected");
      }

      const keyLabel = document.createElement("span");
      keyLabel.className = "inv-key-label";
      keyLabel.textContent = (i + 1).toString();
      slot.appendChild(keyLabel);

      if (slotData.blockId !== null && (this.isInfinite || slotData.count > 0)) {
        const def = BLOCKS[slotData.blockId];
        const countText = this.isInfinite ? "∞" : `×${slotData.count.toString()}`;
        slot.setAttribute("data-tooltip", `[${(i + 1).toString()}] ${def.label} (${countText})`);

        const icon = renderTileIcon(this.atlasCanvas, slotData.blockId, 36);
        slot.appendChild(icon);

        const countLabel = document.createElement("span");
        countLabel.className = "inv-count-label";
        countLabel.textContent = countText;
        slot.appendChild(countLabel);
      } else {
        slot.setAttribute("data-tooltip", `[${(i + 1).toString()}] からっぽ`);
      }

      slot.addEventListener("click", () => {
        this.targetHotbarIndex = i;
        this.hotbar.select(i);
        this.refreshHotbarSlots();
      });

      this.hotbarSlotsContainer?.appendChild(slot);
    });
  }

  private setBlockToHotbar(blockId: BlockId, count: number): void {
    this.hotbar.setSlot(this.targetHotbarIndex, blockId, count);
    this.refreshHotbarSlots();
    this.refreshAcquiredBlocks();
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
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.targetHotbarIndex = this.hotbar.selectedSlotIndex;
    this.refreshHotbarSlots();
    this.refreshAcquiredBlocks();
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
