import { generateProblem, type FractionProblem } from "../math/fraction";
import type { Hotbar } from "./hotbar";
import { renderTileIcon } from "./hotbar";
import type { BuildTimer } from "../game/build-timer";

export class MathModal {
  private readonly app: HTMLElement;
  private readonly hotbar: Hotbar;
  private readonly atlasCanvas: HTMLCanvasElement;
  private readonly buildTimer: BuildTimer;

  private modal: HTMLElement | null = null;
  private problemCard: HTMLElement | null = null;
  private answerArea: HTMLElement | null = null;
  private currentProblem: FractionProblem | null = null;

  // Active focused input for on-screen keypad
  private activeInput: HTMLInputElement | null = null;

  // Stats
  private totalSolved = 0;
  private streak = 0;

  private _isOpen = false;
  public onToggle?: (isOpen: boolean) => void;

  constructor(
    app: HTMLElement,
    hotbar: Hotbar,
    atlasCanvas: HTMLCanvasElement,
    buildTimer: BuildTimer,
  ) {
    this.app = app;
    this.hotbar = hotbar;
    this.atlasCanvas = atlasCanvas;
    this.buildTimer = buildTimer;

    this.createDom();
  }

  public get isOpen(): boolean {
    return this._isOpen;
  }

  private createDom(): void {
    const modal = document.createElement("div");
    modal.id = "math-modal";
    modal.className = "math-modal hidden";

    const win = document.createElement("div");
    win.className = "math-window";

    // Header
    const header = document.createElement("div");
    header.className = "math-header";

    const title = document.createElement("div");
    title.className = "math-title";
    title.innerHTML = `<span>✏️ つうぶんチャレンジ (正解でブロック×3！)</span>`;

    const closeBtn = document.createElement("button");
    closeBtn.className = "math-close-btn";
    closeBtn.textContent = "✕ けんちくへ";
    closeBtn.type = "button";
    closeBtn.addEventListener("click", () => {
      this.close();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    win.appendChild(header);

    // Score bar
    const scoreBar = document.createElement("div");
    scoreBar.className = "math-score-bar";
    scoreBar.id = "math-score-bar";
    scoreBar.innerHTML = `<span>クリア数: <b id="stat-solved">0</b>問</span> <span>れんぞく: <b id="stat-streak">0</b>問🔥</span>`;
    win.appendChild(scoreBar);

    // Problem Card Area
    const card = document.createElement("div");
    card.className = "math-problem-card";
    this.problemCard = card;
    win.appendChild(card);

    // Answer Area
    const answerArea = document.createElement("div");
    answerArea.className = "math-answer-area";
    this.answerArea = answerArea;
    win.appendChild(answerArea);

    // Keypad (NumPad for touch / mouse)
    const keypad = document.createElement("div");
    keypad.className = "math-keypad";

    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];
    keys.forEach((key) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "math-key-btn";
      btn.textContent = key;
      btn.addEventListener("click", () => {
        this.handleKeyPress(key);
      });
      keypad.appendChild(btn);
    });
    win.appendChild(keypad);

    modal.appendChild(win);
    this.app.appendChild(modal);
    this.modal = modal;
  }

  private handleKeyPress(key: string): void {
    if (!this.activeInput) return;

    if (key === "C") {
      this.activeInput.value = "";
    } else if (key === "⌫") {
      this.activeInput.value = this.activeInput.value.slice(0, -1);
    } else {
      if (this.activeInput.value.length < 3) {
        this.activeInput.value += key;
      }
    }
  }

  public nextProblem(): void {
    this.currentProblem = generateProblem();
    this.renderProblem();
  }

  private renderProblem(): void {
    if (!this.problemCard || !this.answerArea || !this.currentProblem) return;
    const p = this.currentProblem;

    // Render Original Problem (2 fractions to be tongbun-ed)
    this.problemCard.innerHTML = `
      <div class="math-step-badge">もんだい</div>
      <div class="math-instruction" style="margin-top: 4px; font-size: 14px;">つぎの 2つの 分数を通分（分母をそろえる）しよう！</div>
      <div class="math-fraction-expr">
        <div class="math-frac">
          <span class="m-num">${p.f1.num}</span>
          <span class="m-bar"></span>
          <span class="m-den">${p.f1.den}</span>
        </div>
        <span class="m-and">と</span>
        <div class="math-frac">
          <span class="m-num">${p.f2.num}</span>
          <span class="m-bar"></span>
          <span class="m-den">${p.f2.den}</span>
        </div>
      </div>
    `;

    // Render Tongbun Answer Inputs
    this.answerArea.innerHTML = `
      <div class="math-step-row">
        <div class="math-frac-input">
          <input type="text" id="in-tb-n1" class="math-box" inputmode="numeric" placeholder="分子" />
          <span class="m-bar"></span>
          <input type="text" id="in-tb-den1" class="math-box" inputmode="numeric" placeholder="分母" />
        </div>
        <span class="m-and">と</span>
        <div class="math-frac-input">
          <input type="text" id="in-tb-n2" class="math-box" inputmode="numeric" placeholder="分子" />
          <span class="m-bar"></span>
          <input type="text" id="in-tb-den2" class="math-box" inputmode="numeric" placeholder="分母" />
        </div>
      </div>
      <div class="math-action-row">
        <button type="button" id="btn-check-tb" class="math-action-btn ok-btn">通分できた！ 🎁</button>
      </div>
      <div id="math-msg" class="math-msg"></div>
    `;

    this.setupInputFocus(["in-tb-n1", "in-tb-den1", "in-tb-n2", "in-tb-den2"]);

    const checkBtn = this.answerArea.querySelector<HTMLButtonElement>("#btn-check-tb");
    checkBtn?.addEventListener("click", () => {
      this.checkTongbun();
    });
  }

  private getInputValue(selector: string): number {
    const el = document.querySelector<HTMLInputElement>(selector);
    if (!el) return 0;
    const val = el.value.trim();
    return val === "" ? 0 : Number(val);
  }

  private checkTongbun(): void {
    if (!this.currentProblem) return;
    const p = this.currentProblem;

    const n1 = this.getInputValue("#in-tb-n1");
    const den1 = this.getInputValue("#in-tb-den1");
    const n2 = this.getInputValue("#in-tb-n2");
    const den2 = this.getInputValue("#in-tb-den2");
    const msg = document.querySelector("#math-msg");

    if (!n1 || !den1 || !n2 || !den2) {
      if (msg) msg.textContent = "ぜんぶのマスにすうじをいれてね！";
      return;
    }

    if (den1 !== den2) {
      if (msg) msg.textContent = "ふたつの分母がそろっていないよ！";
      return;
    }

    // 最小公倍数で通分できているか
    if (den1 === p.commonDen && n1 === p.ansNum1 && n2 === p.ansNum2) {
      this.handleSuccess();
    } else if (den1 !== p.commonDen) {
      if (msg) msg.textContent = `おしい！分母は最小公倍数の「${p.commonDen}」にそろえよう。`;
    } else {
      if (msg) msg.textContent = "おしい！分子の計算をもういちど確かめてみよう。";
    }
  }

  /** 正解時のご褒美付与・演出 */
  private handleSuccess(): void {
    if (!this.answerArea || !this.currentProblem) return;
    const p = this.currentProblem;

    this.totalSolved += 1;
    this.streak += 1;
    this.updateStats();

    // ユーザー指定: 「ブロックは１問正解で３個。種類はランダム。」
    const reward = this.hotbar.addRandomBlocks(3);

    // ユーザー指定: 「１問正解で２０秒増加。上限プレイタイム５分。」
    const timeReward = this.buildTimer.addReward();

    // 獲得ブロックのアイコンを作成
    const icon = renderTileIcon(this.atlasCanvas, reward.blockId, 48);

    const timeLabel = timeReward.isMax
      ? "MAX 05:00 (まんたん！)"
      : `のこり ${this.buildTimer.formattedTime}`;

    this.answerArea.innerHTML = `
      <div class="math-reward-card">
        <div class="math-reward-title">🎉 大せいかい！！</div>
        <div style="font-size: 14px; margin-bottom: 8px; color: #27ae60; font-weight: bold;">
          通分完了: <b>${p.ansNum1}/${p.commonDen}</b> と <b>${p.ansNum2}/${p.commonDen}</b>
        </div>
        <div class="math-reward-box">
          <div class="math-reward-icon-wrap" id="reward-icon-wrap"></div>
          <div class="math-reward-text">
            <b>${reward.label}</b> を <span class="badge-count">×3こ</span> ゲット！
          </div>
        </div>
        <div class="math-reward-time-row">
          ⏱️ けんちくタイム <b>+20びょう！</b>
          <span class="math-reward-total-time">(${timeLabel})</span>
        </div>
        <div class="math-reward-btns">
          <button type="button" id="btn-next-prob" class="math-action-btn next-btn">つぎのもんだい ➔</button>
          <button type="button" id="btn-go-build" class="math-action-btn build-btn">🔨 けんちくへ！ (${this.buildTimer.formattedTime})</button>
        </div>
      </div>
    `;

    const iconWrap = this.answerArea.querySelector("#reward-icon-wrap");
    iconWrap?.appendChild(icon);

    this.answerArea.querySelector("#btn-next-prob")?.addEventListener("click", () => {
      this.nextProblem();
    });

    this.answerArea.querySelector("#btn-go-build")?.addEventListener("click", () => {
      this.close();
    });
  }

  private updateStats(): void {
    const solvedEl = document.querySelector("#stat-solved");
    const streakEl = document.querySelector("#stat-streak");
    if (solvedEl) solvedEl.textContent = this.totalSolved.toString();
    if (streakEl) streakEl.textContent = this.streak.toString();
  }

  private setupInputFocus(ids: string[]): void {
    ids.forEach((id, idx) => {
      const el = document.querySelector<HTMLInputElement>(`#${id}`);
      if (el) {
        el.addEventListener("focus", () => {
          this.activeInput = el;
          el.select();
        });
        if (idx === 0) {
          el.focus();
          this.activeInput = el;
        }
      }
    });
  }

  public open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.modal?.classList.remove("hidden");
    this.nextProblem();
    this.onToggle?.(true);
  }

  public close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this.modal?.classList.add("hidden");
    this.onToggle?.(false);
  }

  public toggle(): void {
    if (this._isOpen) this.close();
    else this.open();
  }
}
