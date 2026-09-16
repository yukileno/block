const REPORT_INTERVAL_MS = 250;

export interface HudInfo {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly chunks: number;
  readonly seed: number;
  /** Extra trailing detail, e.g. "cpu renderer" when WebGL is unavailable. */
  readonly note?: string;
}

/** The little monospace status line: fps, position, chunk count, seed. */
export class Hud {
  private readonly el: HTMLDivElement;
  private frames = 0;
  private lastReport = 0;
  public onClick?: () => void;

  constructor(parent: HTMLElement) {
    this.el = document.createElement("div");
    this.el.id = "fps";
    this.el.title = "クリックして座標テレポート (/tp)";
    this.el.addEventListener("click", () => {
      this.onClick?.();
    });
    parent.appendChild(this.el);
  }

  frame(nowMs: number, info: HudInfo): void {
    this.frames++;
    if (nowMs - this.lastReport < REPORT_INTERVAL_MS) return;
    const fps = Math.round((this.frames * 1000) / (nowMs - this.lastReport));
    this.frames = 0;
    this.lastReport = nowMs;
    const x = Math.floor(info.x);
    const y = Math.floor(info.y);
    const z = Math.floor(info.z);
    this.el.innerHTML = `<span style="color:#2ecc71; margin-right:4px;">📍 座標:</span><b>X: ${x}  Y: ${y}  Z: ${z}</b> <span style="opacity:0.75; font-size:11px; margin-left:6px;">(${fps} fps)</span>`;
  }
}
