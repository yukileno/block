import { generateProblem, type FractionProblem } from "../math/fraction";
import type { Hotbar } from "./hotbar";
import { renderTileIcon } from "./hotbar";

export class MathModal {
  private readonly app: HTMLElement;
  private readonly hotbar: Hotbar;
  private readonly atlasCanvas: HTMLCanvasElement;

  private modal: HTMLElement | null = null;
  private problemCard: HTMLElement | null = null;
  private answerArea: HTMLElement | null = null;
  private currentProblem: FractionProblem | null = null;

  // Step state: "step1_tongbun" -> "step2_calc" -> "reward"
  private currentStep: "step1" | "step2" | "reward" = "step1";

  // Focused input element
  private activeInput: HTMLInputElement | null = null;

  // Stats
  private totalSolved = 0;
  private streak = 0;

  private _isOpen = false;
  public onToggle?: (isOpen: boolean) => void;

  constructor(app: HTMLElement, hotbar: Hotbar, atlasCanvas: HTMLCanvasElement) {
    this.app = app;
    this.hotbar = hotbar;
    this.atlasCanvas = atlasCanvas;

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
    title.innerHTML = `<span>✏️ つうぶんチャレンジ (ブロックゲット！)</span>`;

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

    // Answer & Steps Area
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
    this.currentStep = "step1";
    this.renderProblem();
  }

  private renderProblem(): void {
    if (!this.problemCard || !this.answerArea || !this.currentProblem) return;
    const p = this.currentProblem;

    // Render Original Problem
    this.problemCard.innerHTML = `
      <div class="math-step-badge">もんだい</div>
      <div class="math-fraction-expr">
        <div class="math-frac">
          <span class="m-num">${p.f1.num}</span>
          <span class="m-bar"></span>
          <span class="m-den">${p.f1.den}</span>
        </div>
        <span class="m-op">${p.op}</span>
        <div class="math-frac">
          <span class="m-num">${p.f2.num}</span>
          <span class="m-bar"></span>
          <span class="m-den">${p.f2.den}</span>
        </div>
        <span class="m-op">=</span>
        <span class="m-q">?</span>
      </div>
    `;

    if (this.currentStep === "step1") {
      this.renderStep1();
    } else if (this.currentStep === "step2") {
      this.renderStep2();
    }
  }

  /** Step 1: 通分（分母を揃える） */
  private renderStep1(): void {
    if (!this.answerArea || !this.currentProblem) return;
    const p = this.currentProblem;

    this.answerArea.innerHTML = `
      <div class="math-instruction">ステップ 1: ぶんぼをそろえよう！（つうぶん）</div>
      <div class="math-step-row">
        <div class="math-frac-input">
          <input type="text" id="in-step1-n1" class="math-box" inputmode="numeric" placeholder="?" />
          <span class="m-bar"></span>
          <input type="text" id="in-step1-den1" class="math-box" inputmode="numeric" placeholder="分母" />
        </div>
        <span class="m-op">${p.op}</span>
        <div class="math-frac-input">
          <input type="text" id="in-step1-n2" class="math-box" inputmode="numeric" placeholder="?" />
          <span class="m-bar"></span>
          <input type="text" id="in-step1-den2" class="math-box" inputmode="numeric" placeholder="分母" />
        </div>
      </div>
      <div class="math-action-row">
        <button type="button" id="btn-check-step1" class="math-action-btn">通分できた！ ➔</button>
      </div>
      <div id="math-msg" class="math-msg"></div>
    `;

    this.setupInputFocus(["in-step1-n1", "in-step1-den1", "in-step1-n2", "in-step1-den2"]);

    const checkBtn = this.answerArea.querySelector<HTMLButtonElement>("#btn-check-step1");
    checkBtn?.addEventListener("click", () => {
      this.checkStep1();
    });
  }

  private getInputValue(selector: string): number {
    const el = document.querySelector<HTMLInputElement>(selector);
    if (!el) return 0;
    const val = el.value.trim();
    return val === "" ? 0 : Number(val);
  }

  private checkStep1(): void {
    if (!this.currentProblem) return;
    const p = this.currentProblem;

    const n1 = this.getInputValue("#in-step1-n1");
    const den1 = this.getInputValue("#in-step1-den1");
    const n2 = this.getInputValue("#in-step1-n2");
    const den2 = this.getInputValue("#in-step1-den2");
    const msg = document.querySelector("#math-msg");

    if (!n1 || !den1 || !n2 || !den2) {
      if (msg) msg.textContent = "ぜんぶのマスにすうじをいれてね！";
      return;
    }

    // 分母が共通分母で、分子が正しく計算されているか
    if (den1 === p.commonDen && den2 === p.commonDen && n1 === p.step1Num1 && n2 === p.step1Num2) {
      this.currentStep = "step2";
      this.renderStep2();
    } else if (den1 !== den2) {
      if (msg) msg.textContent = "ふたつの分母がそろっていないよ！";
    } else {
      if (msg) msg.textContent = "おしい！分子の計算をもういちど確かめてみよう。";
    }
  }

  /** Step 2: 答えの計算 */
  private renderStep2(): void {
    if (!this.answerArea || !this.currentProblem) return;
    const p = this.currentProblem;

    this.answerArea.innerHTML = `
      <div class="math-instruction">ステップ 2: さいごのけいさん！</div>
      <div class="math-tongbun-done">
        つうぶん完了: <b>${p.step1Num1}/${p.commonDen} ${p.op} ${p.step1Num2}/${p.commonDen}</b>
      </div>
      <div class="math-step-row">
        <span class="m-op">=</span>
        <div class="math-frac-input">
          <input type="text" id="in-ans-n" class="math-box" inputmode="numeric" placeholder="分子" />
          <span class="m-bar"></span>
          <input type="text" id="in-ans-den" class="math-box" inputmode="numeric" value="${p.commonDen}" />
        </div>
      </div>
      <div class="math-action-row">
        <button type="button" id="btn-check-step2" class="math-action-btn ok-btn">こたえ合わせ！ 🎁</button>
      </div>
      <div id="math-msg" class="math-msg"></div>
    `;

    this.setupInputFocus(["in-ans-n", "in-ans-den"]);

    const checkBtn = this.answerArea.querySelector<HTMLButtonElement>("#btn-check-step2");
    checkBtn?.addEventListener("click", () => {
      this.checkStep2();
    });
  }

  private checkStep2(): void {
    if (!this.currentProblem) return;
    const p = this.currentProblem;

    const ansN = this.getInputValue("#in-ans-n");
    const ansDen = this.getInputValue("#in-ans-den");
    const msg = document.querySelector("#math-msg");

    if (!ansN || !ansDen) {
      if (msg) msg.textContent = "こたえをいれてね！";
      return;
    }

    // 正解判定 (通分そのままの形、または約分後の形どちらも正解)
    const isCorrectUnreduced = ansN === p.ansNum && ansDen === p.ansDen;
    const isCorrectReduced = ansN === p.reducedNum && ansDen === p.reducedDen;

    if (isCorrectUnreduced || isCorrectReduced) {
      this.handleSuccess();
    } else {
      if (msg) msg.textContent = "おしい！分子のたし算・ひき算を確かめてね。";
    }
  }

  /** 正解時のご褒美付与・演出 */
  private handleSuccess(): void {
    if (!this.answerArea || !this.currentProblem) return;
    this.currentStep = "reward";

    this.totalSolved += 1;
    this.streak += 1;
    this.updateStats();

    // ユーザー指定: 「ブロックは１問正解で３個。種類はランダム。」
    const reward = this.hotbar.addRandomBlocks(3);

    // 獲得ブロックのアイコンを作成
    const icon = renderTileIcon(this.atlasCanvas, reward.blockId, 48);

    this.answerArea.innerHTML = `
      <div class="math-reward-card">
        <div class="math-reward-title">🎉 大せいかい！！</div>
        <div class="math-reward-box">
          <div class="math-reward-icon-wrap" id="reward-icon-wrap"></div>
          <div class="math-reward-text">
            <b>${reward.label}</b> を <span class="badge-count">×3こ</span> ゲット！
          </div>
        </div>
        <div class="math-reward-btns">
          <button type="button" id="btn-next-prob" class="math-action-btn next-btn">つぎのもんだい ➔</button>
          <button type="button" id="btn-go-build" class="math-action-btn build-btn">🔨 けんちくへ！</button>
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
