import "./style.css";
import * as THREE from "three";
import { ChunkMeshManager } from "./render/chunk-mesh-manager";
import { createChunkMaterial, updateChunkMaterial } from "./render/chunk-material";
import { Clouds } from "./render/clouds";
import { CpuRenderer } from "./render/cpu-renderer";
import { createGameScene } from "./render/scene";
import { DAY_LENGTH_SECONDS, STARTUP_PHASE, skyStateAt } from "./render/sky";
import { createBlockTextureArray, createTextureAtlas } from "./render/texture-atlas";
import { PlayerController } from "./player/controller";
import { PlayerPositionStore } from "./player/position-store";
import { BlockInteraction } from "./player/interaction";
import { Hotbar } from "./ui/hotbar";
import { Hud } from "./ui/hud";
import { Inventory } from "./ui/inventory";
import { MathModal } from "./ui/math-modal";
import { TeleportModal } from "./ui/teleport-modal";
import { BuildTimer } from "./game/build-timer";
import { isTouchDevice, TouchControls } from "./ui/touch-controls";
import { EditStore } from "./world/edit-store";
import { findPleasantSpawn } from "./world/spawn";
import { isSolid } from "./world/blocks";
import { CHUNK_HEIGHT } from "./world/coords";
import { findGroundHeight } from "./player/physics";
import {
  type ChunkGenerator,
  ChunkStreamer,
  createSyncGenerator,
  createWorkerGenerator,
} from "./world/streamer";
import { World } from "./world/world";

const DEFAULT_SEED = 2026;
const STREAM_RADIUS_WEBGL = 9; // greedy meshing makes the extra draw distance affordable
const STREAM_RADIUS_CPU = 4; // rays reach ~52 blocks; a tighter ring is plenty
const WARMUP_RADIUS_CHUNKS = 2;
const MESH_BUDGET_PER_FRAME = 3;

// Read-only debug handle for the visual-check harness (scripts/visual-check.mjs):
// lets an automated browser assert on game state instead of guessing from pixels.
declare global {
  interface Window {
    __mc?: {
      position: () => { x: number; y: number; z: number };
      blockAt: (x: number, y: number, z: number) => number;
      target: () => { x: number; y: number; z: number } | null;
      pitch: () => number;
      mode: () => string;
      renderer: () => "webgl" | "cpu";
      touch: () => boolean;
      loadedChunks: () => number;
      meshedChunks: () => number;
      pendingChunks: () => number;
      seed: number;
    };
  }
}

/** A dead "Click to play" button is the worst failure mode a browser game
 * can have. If anything at all goes wrong during boot — and the WebGL and
 * worker paths already have their own fallbacks — say so, visibly, in the
 * overlay the player is already looking at. */
function showFatalError(error: unknown): void {
  const content = document.querySelector("#overlay-content");
  if (!content) return;
  const message = error instanceof Error ? error.message : String(error);
  content.innerHTML = "";
  const title = document.createElement("h1");
  title.textContent = "the game couldn't start";
  const detail = document.createElement("p");
  detail.textContent = message;
  const hint = document.createElement("p");
  hint.textContent =
    "Try a hard refresh (Ctrl+Shift+R) or another browser (Chrome/Firefox). " +
    "If it keeps happening, please open an issue with this exact message.";
  content.append(title, detail, hint);
}

/** What the game loop needs from a renderer — satisfied by the Three.js
 * scene when WebGL exists, and by the CPU raycaster when it doesn't. */
interface GameView {
  readonly kind: "webgl" | "cpu";
  readonly camera: THREE.PerspectiveCamera;
  readonly domElement: HTMLElement;
  render(elapsedSeconds: number): void;
  resize(width: number, height: number): void;
  applySky(state: ReturnType<typeof skyStateAt>): void;
  /** Optional adaptive quality hook (WebGL scales its pixel ratio; the CPU
   * renderer already adapts its own internal resolution). */
  tickAdaptive?(frameMs: number): void;
  /** A short label for the HUD describing the current quality target. */
  qualityNote(): string;
}

function isInfiniteMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return (
    window.location.pathname.endsWith("debug.html") ||
    window.location.pathname.includes("debug") ||
    params.has("debug") ||
    params.get("mode") === "infinite"
  );
}

function boot(): void {
  const infiniteMode = isInfiniteMode();
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) throw new Error("#app not found");
  const hotbarContainer = document.querySelector<HTMLDivElement>("#hotbar");
  if (!hotbarContainer) throw new Error("#hotbar not found");

  // A shareable world: ?seed=1234 loads the same terrain for everyone.
  const seedParam = new URLSearchParams(window.location.search).get("seed");
  const parsedSeed = seedParam === null ? NaN : Number.parseInt(seedParam, 10);
  const SEED = Number.isFinite(parsedSeed) ? parsedSeed : DEFAULT_SEED;

  const world = new World(SEED);
  const atlas = createTextureAtlas(SEED);

  // The renderer: WebGL when the browser can, an in-house CPU raycaster
  // when it can't. Same world, same physics, same controls either way.
  let view: GameView;
  let chunkMeshes: ChunkMeshManager | null = null;
  let clouds: Clouds | null = null;
  let highlight: THREE.LineSegments | null = null;
  let cpuView: CpuRenderer | null = null;
  try {
    const gameScene = createGameScene(app);
    const chunkMaterial = createChunkMaterial(createBlockTextureArray(SEED));
    view = {
      kind: "webgl",
      camera: gameScene.camera,
      domElement: gameScene.renderer.domElement,
      render: () => {
        gameScene.render();
      },
      resize: gameScene.resize,
      applySky: (state) => {
        gameScene.applySky(state);
        updateChunkMaterial(chunkMaterial, state);
      },
      tickAdaptive: gameScene.tickAdaptive,
      qualityNote: () => `${Math.round(gameScene.pixelRatio() * 100)}% scale`,
    };
    chunkMeshes = new ChunkMeshManager(gameScene.scene, world, chunkMaterial);
    clouds = new Clouds(gameScene.scene, SEED);
    highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
      new THREE.LineBasicMaterial({ color: 0x000000 }),
    );
    highlight.visible = false;
    gameScene.scene.add(highlight);
  } catch (webglError) {
    console.warn("WebGL unavailable, switching to the CPU raycaster:", webglError);
    const cpu = new CpuRenderer(app, world, SEED);
    cpuView = cpu;
    view = {
      kind: "cpu",
      camera: cpu.camera,
      domElement: cpu.domElement,
      render: (elapsed) => {
        cpu.render(elapsed);
      },
      resize: (w, h) => {
        cpu.resize(w, h);
      },
      applySky: (state) => {
        cpu.applySky(state);
      },
      qualityNote: () => `cpu ${cpu.internalWidth.toString()}p`,
    };
  }

  const editStore = new EditStore(window.localStorage, SEED);
  const positionStore = new PlayerPositionStore(SEED);
  const streamer = new ChunkStreamer(world, {
    radius: view.kind === "webgl" ? STREAM_RADIUS_WEBGL : STREAM_RADIUS_CPU,
    editStore,
    onUnload: (cx, cz) => {
      chunkMeshes?.removeChunkMesh(cx, cz);
    },
  });
  const receive = (cx: number, cz: number, buffer: Uint8Array): void => {
    streamer.receive(cx, cz, buffer);
  };
  let generator: ChunkGenerator;
  try {
    if (typeof Worker === "undefined") throw new Error("workers unavailable");
    generator = createWorkerGenerator(SEED, receive);
  } catch {
    // No module workers? Generate on the main thread — slower on chunk
    // arrival, but the game works everywhere.
    generator = createSyncGenerator(SEED, receive);
  }
  streamer.attachGenerator(generator);

  const spawn = findPleasantSpawn(SEED);
  const savedTransform = positionStore.load();
  const startX = savedTransform?.x ?? spawn.x;
  const startZ = savedTransform?.z ?? spawn.z;
  // Ground under the player's feet before the first frame; the rest streams in.
  streamer.warmUp(startX, startZ, WARMUP_RADIUS_CHUNKS);

  const buildTimer = new BuildTimer(infiniteMode);
  const player = new PlayerController(
    view.camera,
    view.domElement,
    world,
    spawn.x,
    spawn.z,
    savedTransform,
  );

  const savePlayerPosition = (): void => {
    if (player.position.y >= 0 && player.position.y <= 256) {
      positionStore.save(player.transform);
    }
  };

  window.addEventListener("beforeunload", () => {
    savePlayerPosition();
  });
  window.addEventListener("pagehide", () => {
    savePlayerPosition();
  });
  player.onEnterIdle = () => {
    savePlayerPosition();
  };

  const hotbar = new Hotbar(hotbarContainer, atlas.canvas, infiniteMode);
  const inventory = new Inventory(app, hotbar, atlas.canvas, infiniteMode);
  const mathModal = new MathModal(app, hotbar, atlas.canvas, buildTimer);
  const teleportModal = new TeleportModal(app, () => ({
    x: player.position.x,
    y: player.position.y,
    z: player.position.z,
  }));

  inventory.onToggle = (isOpen) => {
    player.setInventoryOpen(isOpen || mathModal.isOpen || teleportModal.isOpen);
    if (isOpen) {
      savePlayerPosition();
    }
  };
  mathModal.onToggle = (isOpen) => {
    player.setInventoryOpen(isOpen || inventory.isOpen || teleportModal.isOpen);
    if (isOpen) {
      savePlayerPosition();
    }
    const mathBtn = document.querySelector("#btn-mode-math");
    const buildBtn = document.querySelector("#btn-mode-build");
    if (mathBtn && buildBtn) {
      mathBtn.classList.toggle("active", isOpen);
      buildBtn.classList.toggle("active", !isOpen);
    }
    if (!isOpen && !player.isActive && buildTimer.hasTime()) {
      showControlsGuide();
    }
  };
  teleportModal.onToggle = (isOpen) => {
    player.setInventoryOpen(isOpen || inventory.isOpen || mathModal.isOpen);
    if (isOpen) {
      savePlayerPosition();
    }
  };

  teleportModal.onTeleport = (target) => {
    if (target === "spawn") {
      player.respawn(spawn.x, spawn.z);
      savePlayerPosition();
      showToast(`📍 スタート地点 (${spawn.x}, ${spawn.z}) にテレポートしました！`);
      if (!player.isActive) player.requestControl();
      return;
    }
    if (target === "top") {
      const cur = player.position;
      const groundY = findGroundHeight(
        Math.floor(cur.x),
        Math.floor(cur.z),
        CHUNK_HEIGHT - 1,
        (bx, by, bz) => isSolid(world.getBlock(bx, by, bz)),
      );
      player.teleport(cur.x, groundY, cur.z);
      savePlayerPosition();
      showToast(`📍 地表 (Y: ${groundY}) にテレポートしました！`);
      if (!player.isActive) player.requestControl();
      return;
    }
    const { x, z } = target;
    const y =
      target.y ??
      findGroundHeight(Math.floor(x), Math.floor(z), CHUNK_HEIGHT - 1, (bx, by, bz) =>
        isSolid(world.getBlock(bx, by, bz)),
      );
    streamer.warmUp(x, z, WARMUP_RADIUS_CHUNKS);
    player.teleport(x, y, z);
    savePlayerPosition();
    showToast(`📍 (${Math.floor(x)}, ${Math.floor(y)}, ${Math.floor(z)}) にテレポートしました！`);
    if (!player.isActive) player.requestControl();
  };

  hotbar.onOpenInventory = () => {
    mathModal.close();
    teleportModal.close();
    inventory.open();
  };
  inventory.onOpenMath = () => {
    teleportModal.close();
    mathModal.open();
  };

  // Overlay Screens & Navigation
  const overlay = document.querySelector<HTMLDivElement>("#overlay");
  const screenModeSelect = document.querySelector<HTMLDivElement>("#screen-mode-select");
  const screenControlsGuide = document.querySelector<HTMLDivElement>("#screen-controls-guide");

  function showModeSelect(): void {
    screenControlsGuide?.classList.add("hidden");
    screenModeSelect?.classList.remove("hidden");
    overlay?.classList.remove("hidden");
  }

  function showControlsGuide(): void {
    screenModeSelect?.classList.add("hidden");
    screenControlsGuide?.classList.remove("hidden");
    overlay?.classList.remove("hidden");
  }

  function showTimeUpModal(): void {
    let modal = document.querySelector<HTMLDivElement>("#timeup-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "timeup-modal";
      modal.className = "timeup-modal";
      modal.innerHTML = `
        <div class="timeup-card">
          <div class="timeup-icon">⏰</div>
          <div class="timeup-title">けんちく時間切れ！</div>
          <div class="timeup-desc">
            たくさん建築したね！<br />
            つぎの建築タイムをゲットするために、<br />
            <b>つうぶん問題を解こう！</b>
          </div>
          <div class="timeup-hint">
            💡 1問正解ごとに <b>+20びょう</b> チャージ！（最大5分）
          </div>
          <div class="timeup-actions">
            <button type="button" id="btn-timeup-math" class="math-action-btn ok-btn" style="padding: 12px 28px; font-size: 16px;">
              ✏️ もんだいを解く！
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector("#btn-timeup-math")?.addEventListener("click", () => {
        modal?.classList.remove("show");
        mathModal.open();
      });
    }
    modal.classList.add("show");
  }

  function handleTimeUp(): void {
    player.exitControl();
    savePlayerPosition();
    showTimeUpModal();
  }

  function tryEnterBuild(): void {
    if (!buildTimer.hasTime()) {
      showToast("けんちく時間が 0秒 だよ！ ✏️まずは問題を解いて時間をチャージしよう！(+20秒)");
      inventory.close();
      mathModal.open();
      return;
    }
    showControlsGuide();
  }

  // 1. Initial Mode Selection buttons
  document.querySelector("#btn-start-math")?.addEventListener("click", () => {
    overlay?.classList.add("hidden");
    inventory.close();
    mathModal.open();
  });

  document.querySelector("#btn-start-build")?.addEventListener("click", () => {
    tryEnterBuild();
  });

  // 2. Controls Guide buttons
  document.querySelector("#btn-guide-back")?.addEventListener("click", () => {
    showModeSelect();
  });

  document.querySelector("#btn-enter-world")?.addEventListener("click", () => {
    if (!buildTimer.hasTime()) {
      showToast("けんちく時間が 0秒 だよ！ ✏️まずは問題を解いて時間をチャージしよう！(+20秒)");
      showModeSelect();
      mathModal.open();
      return;
    }
    player.requestControl();
  });

  // When player exits pointer lock / goes idle, show controls guide (pause screen)
  player.onEnterIdle = () => {
    savePlayerPosition();
    if (!mathModal.isOpen && !inventory.isOpen && buildTimer.hasTime()) {
      showControlsGuide();
    }
  };

  // Top Mode Switcher Bar
  const modeSwitcher = document.createElement("div");
  modeSwitcher.id = "mode-switcher";
  modeSwitcher.className = "mode-switcher";
  const debugBadge = infiniteMode
    ? `<span class="mode-debug-badge" style="background:#e67e22; color:#fff; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold; letter-spacing:0.5px;">🛠️ デバッグ無限</span>`
    : "";
  const navLink = infiniteMode
    ? `<a href="./index.html" class="mode-btn" style="text-decoration:none; display:flex; align-items:center; background:#34495e; color:#fff; font-size:12px;" title="通常モード（子ども用）へ移動">🌐 通常版へ</a>`
    : `<a href="./debug.html" class="mode-btn" style="text-decoration:none; display:flex; align-items:center; background:#7f8c8d; color:#fff; font-size:12px;" title="建築無限モードへ移動">🛠️ デバッグ版</a>`;

  modeSwitcher.innerHTML = `
    ${debugBadge}
    <button type="button" id="btn-mode-math" class="mode-btn mode-btn-math">✏️ もんだい (ブロック獲得)</button>
    <button type="button" id="btn-mode-build" class="mode-btn mode-btn-build active">🔨 けんちく</button>
    <div id="mode-timer-badge" class="mode-timer-badge" title="${infiniteMode ? "けんちく時間 (デバッグ無限モード)" : "けんちく残り時間 (1問正解で+20秒、最大5分)"}">⏱️ 00:00</div>
    <button type="button" id="btn-mode-teleport" class="mode-btn mode-btn-tp" title="指定した座標へいどう (/tp)">📍 テレポート</button>
    <button type="button" id="btn-mode-help" class="mode-btn mode-btn-help" title="動かし方を見る">❓ そうさ方法</button>
    ${navLink}
  `;
  app.appendChild(modeSwitcher);

  // デバッグ無限モード時は初期モード選択をスキップして直接操作ガイドを表示
  if (infiniteMode) {
    showControlsGuide();
  }

  function updateTimerBadge(): void {
    const timerBadge = document.querySelector<HTMLDivElement>("#mode-timer-badge");
    if (!timerBadge) return;
    const timeStr = buildTimer.isMax ? "MAX 05:00" : buildTimer.formattedTime;
    timerBadge.textContent = `⏱️ ${timeStr}`;
    timerBadge.classList.toggle("warning", buildTimer.isWarning);
    timerBadge.classList.toggle("max", buildTimer.isMax);
    timerBadge.classList.toggle("empty", !buildTimer.hasTime());
  }

  document.querySelector("#btn-mode-math")?.addEventListener("click", (e) => {
    e.stopPropagation();
    mathModal.open();
    inventory.close();
    teleportModal.close();
  });

  document.querySelector("#btn-mode-teleport")?.addEventListener("click", (e) => {
    e.stopPropagation();
    inventory.close();
    mathModal.close();
    teleportModal.open("/tp ");
  });

  document.querySelector("#btn-mode-build")?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!buildTimer.hasTime()) {
      showToast("けんちく時間が 0秒 だよ！ ✏️まずは問題を解いて時間をチャージしよう！(+20秒)");
      mathModal.open();
      return;
    }
    mathModal.close();
    teleportModal.close();
    if (!player.isActive) {
      player.requestControl();
    }
  });

  document.querySelector("#btn-mode-help")?.addEventListener("click", (e) => {
    e.stopPropagation();
    mathModal.close();
    inventory.close();
    teleportModal.close();
    player.exitControl();
    showControlsGuide();
  });
  const interaction = new BlockInteraction(
    view.camera,
    view.domElement,
    world,
    chunkMeshes ?? { updateChunk: () => undefined },
    hotbar,
    player,
  );
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function showToast(msg: string): void {
    let toast = document.querySelector<HTMLDivElement>("#game-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "game-toast";
      toast.className = "game-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2500);
  }

  interaction.onNoBlocksAvailable = () => {
    showToast("ブロックを持っていないよ！ ✏️もんだいを解いてゲットしよう！");
  };

  interaction.onEdit = (x, y, z, id) => {
    editStore.record(x, y, z, id);
  };

  // On-screen controls for touch devices and Chromebooks — joystick, action buttons.
  const touchControls = new TouchControls(app, {
    isActive: () => player.isActive,
    onInput: (input) => {
      player.setExternalInput(input);
    },
    onLook: (dx, dy) => {
      player.lookBy(dx, dy);
    },
    onBreak: () => {
      interaction.breakTargetedBlock();
    },
    onPlace: () => {
      interaction.placeTargetedBlock();
    },
  });
  let touchVisible = false;

  const hud = new Hud(app);
  hud.onClick = () => {
    inventory.close();
    mathModal.close();
    teleportModal.open("/tp ");
  };

  // Keyboard shortcuts for command / teleport: Slash (/) or KeyT (t)
  window.addEventListener("keydown", (e) => {
    if (teleportModal.isOpen || inventory.isOpen || mathModal.isOpen) return;
    if (!player.isActive) return;
    if (e.code === "Slash" || e.key === "/" || e.key === "／") {
      e.preventDefault();
      inventory.close();
      mathModal.close();
      teleportModal.open("/tp ");
    } else if (e.code === "KeyT") {
      e.preventDefault();
      inventory.close();
      mathModal.close();
      teleportModal.open("/tp ");
    }
  });

  window.addEventListener("resize", () => {
    view.resize(window.innerWidth, window.innerHeight);
  });

  window.__mc = {
    position: () => ({ ...player.position }),
    blockAt: (x, y, z) => world.getBlock(x, y, z),
    target: () => {
      const hit = interaction.raycastFromCamera();
      return hit ? { x: hit.blockX, y: hit.blockY, z: hit.blockZ } : null;
    },
    pitch: () => player.eyePitch,
    mode: () => player.mode,
    renderer: () => view.kind,
    touch: () => isTouchDevice(),
    loadedChunks: () => world.loadedChunkCount,
    meshedChunks: () => chunkMeshes?.meshedChunkCount ?? world.loadedChunkCount,
    pendingChunks: () => streamer.pendingCount,
    seed: SEED,
  };

  const startedAt = performance.now();
  let lastTime = startedAt;
  let lastPositionSaveTime = 0;
  const frame = (time: number): void => {
    const frameDelta = time - lastTime;
    const dt = Math.min(frameDelta / 1000, 0.1); // clamp to avoid a huge step after a tab switch
    lastTime = time;
    const elapsed = (time - startedAt) / 1000 + STARTUP_PHASE * DAY_LENGTH_SECONDS;

    // Adaptive quality: feed the real frame cadence so the renderer can
    // trade resolution for a fluid frame rate on weaker (mobile) hardware.
    view.tickAdaptive?.(frameDelta);

    if (player.isActive !== touchVisible) {
      touchVisible = player.isActive;
      touchControls.setVisible(touchVisible);
    }

    streamer.update(player.position.x, player.position.z);
    player.update(dt);

    // 奈落落下安全ネット (Void Safety Net)
    if (player.position.y < -20) {
      player.respawn(spawn.x, spawn.z);
      savePlayerPosition();
    }

    // プレイヤー位置の定期保存（1秒間隔）
    lastPositionSaveTime += dt;
    if (lastPositionSaveTime >= 1.0) {
      lastPositionSaveTime = 0;
      if (player.isActive) {
        savePlayerPosition();
      }
    }

    for (const { cx, cz } of streamer.drainDirty(MESH_BUDGET_PER_FRAME)) {
      chunkMeshes?.updateChunk(cx, cz);
    }

    view.applySky(skyStateAt(elapsed));
    clouds?.update(player.position.x, player.position.z, elapsed);

    const hit = interaction.raycastFromCamera();
    if (highlight) {
      highlight.visible = hit !== null;
      if (hit) {
        highlight.position.set(hit.blockX + 0.5, hit.blockY + 0.5, hit.blockZ + 0.5);
      }
    }
    cpuView?.setHighlight(hit ? { x: hit.blockX, y: hit.blockY, z: hit.blockZ } : null);

    hud.frame(time, {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      chunks: world.loadedChunkCount,
      seed: SEED,
      note: view.qualityNote(),
    });

    // 建築モードプレイ中（アクティブかつモーダル非表示）に持ち時間を消費
    if (player.isActive && !mathModal.isOpen && !inventory.isOpen) {
      const isTimeUp = buildTimer.tick(dt);
      if (isTimeUp) {
        handleTimeUp();
      }
    }
    updateTimerBadge();

    view.render(elapsed);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

try {
  boot();
} catch (error) {
  console.error(error);
  showFatalError(error);
}
