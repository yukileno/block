import { parseTeleportCommand, type TeleportTarget } from "./teleport-parser";

export class TeleportModal {
  private readonly app: HTMLElement;
  private modal: HTMLElement | null = null;
  private commandInput: HTMLInputElement | null = null;
  private inputX: HTMLInputElement | null = null;
  private inputY: HTMLInputElement | null = null;
  private inputZ: HTMLInputElement | null = null;
  private errorMsg: HTMLElement | null = null;
  private _isOpen = false;

  public onTeleport?: (target: TeleportTarget | "spawn" | "top") => void;
  public onToggle?: (isOpen: boolean) => void;
  private getCurrentPos: () => { x: number; y: number; z: number };

  constructor(app: HTMLElement, getCurrentPos: () => { x: number; y: number; z: number }) {
    this.app = app;
    this.getCurrentPos = getCurrentPos;

    this.createDom();
    this.bindEvents();
  }

  public get isOpen(): boolean {
    return this._isOpen;
  }

  private createDom(): void {
    const modal = document.createElement("div");
    modal.id = "teleport-modal";
    modal.className = "teleport-modal hidden";

    const win = document.createElement("div");
    win.className = "teleport-window";

    // Header
    const header = document.createElement("div");
    header.className = "teleport-header";

    const title = document.createElement("span");
    title.className = "teleport-title";
    title.textContent = "📍 テレポート (座標いどう)";

    const closeBtn = document.createElement("button");
    closeBtn.className = "teleport-close-btn";
    closeBtn.textContent = "✕";
    closeBtn.type = "button";
    closeBtn.addEventListener("click", () => {
      this.close();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    win.appendChild(header);

    // Body
    const body = document.createElement("div");
    body.className = "teleport-body";

    // 1. Command Input Section
    const cmdSection = document.createElement("div");
    cmdSection.className = "teleport-section";

    const cmdLabel = document.createElement("label");
    cmdLabel.className = "teleport-section-title";
    cmdLabel.textContent = "⌨️ コマンドでいどう (/tp 座標)";
    cmdSection.appendChild(cmdLabel);

    const cmdRow = document.createElement("div");
    cmdRow.className = "teleport-cmd-row";

    const cmdInput = document.createElement("input");
    cmdInput.type = "text";
    cmdInput.className = "teleport-cmd-input";
    cmdInput.placeholder = "例: /tp 100 64 200 や 100 200";
    cmdInput.value = "/tp ";
    this.commandInput = cmdInput;

    const cmdRunBtn = document.createElement("button");
    cmdRunBtn.type = "button";
    cmdRunBtn.className = "teleport-action-btn primary";
    cmdRunBtn.textContent = "実行 🚀";
    cmdRunBtn.addEventListener("click", () => {
      this.executeCommand();
    });

    cmdRow.appendChild(cmdInput);
    cmdRow.appendChild(cmdRunBtn);
    cmdSection.appendChild(cmdRow);

    const cmdHint = document.createElement("div");
    cmdHint.className = "teleport-hint";
    cmdHint.innerHTML = `
      💡 <b>ヒント:</b><br />
      ・<code>/tp 100 64 200</code> (X Y Zを指定)<br />
      ・<code>/tp 100 200</code> (Yを省略すると地表に安全着地！)<br />
      ・<code>/spawn</code> (スタート地点へ戻る)<br />
      ・<code>/tp ~ ~10 ~</code> (上に10マス移動)
    `;
    cmdSection.appendChild(cmdHint);
    body.appendChild(cmdSection);

    // Divider
    const divider = document.createElement("div");
    divider.className = "teleport-divider";
    divider.textContent = "または 数値で指定";
    body.appendChild(divider);

    // 2. XYZ Inputs Section
    const xyzSection = document.createElement("div");
    xyzSection.className = "teleport-section";

    const xyzInputsRow = document.createElement("div");
    xyzInputsRow.className = "teleport-xyz-row";

    const createCoordBox = (label: string, placeholder: string) => {
      const box = document.createElement("div");
      box.className = "teleport-coord-box";
      const lbl = document.createElement("span");
      lbl.textContent = label;
      const inp = document.createElement("input");
      inp.type = "number";
      inp.placeholder = placeholder;
      box.appendChild(lbl);
      box.appendChild(inp);
      return { box, inp };
    };

    const xBox = createCoordBox("X", "0");
    const yBox = createCoordBox("Y", "地表");
    const zBox = createCoordBox("Z", "0");
    this.inputX = xBox.inp;
    this.inputY = yBox.inp;
    this.inputZ = zBox.inp;

    xyzInputsRow.appendChild(xBox.box);
    xyzInputsRow.appendChild(yBox.box);
    xyzInputsRow.appendChild(zBox.box);
    xyzSection.appendChild(xyzInputsRow);

    // Quick helper buttons
    const helperRow = document.createElement("div");
    helperRow.className = "teleport-helpers-row";

    const curPosBtn = document.createElement("button");
    curPosBtn.type = "button";
    curPosBtn.className = "teleport-sub-btn";
    curPosBtn.textContent = "📍 現在地をコピー";
    curPosBtn.addEventListener("click", () => {
      const p = this.getCurrentPos();
      this.inputX!.value = Math.floor(p.x).toString();
      this.inputY!.value = Math.floor(p.y).toString();
      this.inputZ!.value = Math.floor(p.z).toString();
    });

    const spawnBtn = document.createElement("button");
    spawnBtn.type = "button";
    spawnBtn.className = "teleport-sub-btn";
    spawnBtn.textContent = "🏠 スタート地点へ";
    spawnBtn.addEventListener("click", () => {
      this.onTeleport?.("spawn");
      this.close();
    });

    const xyzGoBtn = document.createElement("button");
    xyzGoBtn.type = "button";
    xyzGoBtn.className = "teleport-action-btn primary";
    xyzGoBtn.style.flex = "1";
    xyzGoBtn.textContent = "指定した座標へ移動 🚀";
    xyzGoBtn.addEventListener("click", () => {
      this.executeXyz();
    });

    helperRow.appendChild(curPosBtn);
    helperRow.appendChild(spawnBtn);
    xyzSection.appendChild(helperRow);
    xyzSection.appendChild(xyzGoBtn);
    body.appendChild(xyzSection);

    // Error message display
    const err = document.createElement("div");
    err.className = "teleport-error hidden";
    this.errorMsg = err;
    body.appendChild(err);

    win.appendChild(body);
    modal.appendChild(win);
    this.app.appendChild(modal);
    this.modal = modal;
  }

  private showError(msg: string): void {
    if (!this.errorMsg) return;
    this.errorMsg.textContent = `⚠️ ${msg}`;
    this.errorMsg.classList.remove("hidden");
  }

  private clearError(): void {
    if (!this.errorMsg) return;
    this.errorMsg.textContent = "";
    this.errorMsg.classList.add("hidden");
  }

  private executeCommand(): void {
    this.clearError();
    const cmd = this.commandInput?.value ?? "";
    const res = parseTeleportCommand(cmd, this.getCurrentPos());
    if (res.type === "error") {
      this.showError(res.message);
      return;
    }
    if (res.type === "spawn" || res.type === "top") {
      this.onTeleport?.(res.type);
    } else {
      this.onTeleport?.(res.target);
    }
    this.close();
  }

  private executeXyz(): void {
    this.clearError();
    const xVal = this.inputX?.value.trim() ?? "";
    const yVal = this.inputY?.value.trim() ?? "";
    const zVal = this.inputZ?.value.trim() ?? "";

    if (!xVal || !zVal) {
      this.showError("X座標とZ座標を入力してください");
      return;
    }

    const x = Number(xVal);
    const z = Number(zVal);
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      this.showError("数値が正しくありません");
      return;
    }

    let y: number | null = null;
    if (yVal) {
      const ny = Number(yVal);
      if (Number.isFinite(ny)) {
        y = ny;
      }
    }

    this.onTeleport?.({ x, y, z });
    this.close();
  }

  private bindEvents(): void {
    this.commandInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.executeCommand();
      }
    });

    [this.inputX, this.inputY, this.inputZ].forEach((inp) => {
      inp?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.executeXyz();
        }
      });
    });

    // Close on Escape or click outside
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this._isOpen) {
        e.preventDefault();
        this.close();
      }
    });

    this.modal?.addEventListener("click", (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });
  }

  public open(defaultCommand = "/tp "): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.clearError();

    const p = this.getCurrentPos();
    if (this.inputX) this.inputX.value = Math.floor(p.x).toString();
    if (this.inputY) this.inputY.value = Math.floor(p.y).toString();
    if (this.inputZ) this.inputZ.value = Math.floor(p.z).toString();

    if (this.commandInput) {
      this.commandInput.value = defaultCommand;
    }

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    this.modal?.classList.remove("hidden");
    this.onToggle?.(true);

    setTimeout(() => {
      this.commandInput?.focus();
      if (defaultCommand) {
        this.commandInput?.setSelectionRange(defaultCommand.length, defaultCommand.length);
      }
    }, 50);
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
