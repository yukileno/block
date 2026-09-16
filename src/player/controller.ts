import * as THREE from "three";
import { BlockId, isSolid } from "../world/blocks";
import { CHUNK_HEIGHT } from "../world/coords";
import type { World } from "../world/world";
import {
  findGroundHeight,
  PLAYER_EYE_HEIGHT,
  type PlayerPhysicsState,
  stepPhysics,
} from "./physics";

const MOUSE_SENSITIVITY = 0.0022;
const DRAG_SENSITIVITY = 0.0035;
const MAX_PITCH = Math.PI / 2 - 0.01;
/** How long to wait for pointerlockchange before deciding the browser
 * refused (silently, as some do) and falling back to drag-look. */
const POINTER_LOCK_WATCHDOG_MS = 600;

const KEY_BINDINGS: Record<string, "forward" | "back" | "left" | "right" | "jump" | "sprint"> = {
  KeyW: "forward",
  KeyS: "back",
  KeyA: "left",
  KeyD: "right",
  Space: "jump",
  ShiftLeft: "sprint",
  ShiftRight: "sprint",
};

export type ControlMode = "idle" | "pointer" | "drag";

/** Glues browser events to the pure player-physics simulation. Pointer-lock
 * and key tracking live here because they're inherently browser glue; the
 * actual physics is pure and tested separately. */
export class PlayerController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly domElement: HTMLElement;
  private readonly overlay: HTMLElement | null;
  private readonly world: World;

  private state: PlayerPhysicsState;
  private yaw = 0;
  private pitch = 0;
  private readonly pressed = new Set<string>();
  private controlMode: ControlMode = "idle";
  private dragging = false;
  private lockWatchdog: ReturnType<typeof setTimeout> | undefined;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    world: World,
    spawnX = 8,
    spawnZ = 8,
    initialTransform?: Partial<PlayerTransform> | null,
  ) {
    this.camera = camera;
    this.camera.rotation.order = "YXZ";
    this.domElement = domElement;
    this.overlay = document.querySelector("#overlay");
    this.world = world;

    const targetX = initialTransform?.x ?? spawnX;
    const targetZ = initialTransform?.z ?? spawnZ;
    this.yaw = initialTransform?.yaw ?? 0;
    this.pitch = initialTransform?.pitch ?? 0;

    let targetY: number;
    if (typeof initialTransform?.y === "number" && Number.isFinite(initialTransform.y)) {
      const iy = initialTransform.y;
      // 埋まりチェック: その場所の足元と頭が solid かどうか
      const isStuck =
        isSolid(this.world.getBlock(Math.floor(targetX), Math.floor(iy), Math.floor(targetZ))) ||
        isSolid(
          this.world.getBlock(Math.floor(targetX), Math.floor(iy + 1), Math.floor(targetZ)),
        );
      if (isStuck || iy < 0 || iy >= CHUNK_HEIGHT) {
        targetY = findGroundHeight(
          Math.floor(targetX),
          Math.floor(targetZ),
          CHUNK_HEIGHT - 1,
          (x, y, z) => isSolid(this.world.getBlock(x, y, z)),
        );
      } else {
        targetY = iy;
      }
    } else {
      targetY = findGroundHeight(
        Math.floor(targetX),
        Math.floor(targetZ),
        CHUNK_HEIGHT - 1,
        (x, y, z) => isSolid(this.world.getBlock(x, y, z)),
      );
    }

    this.state = {
      position: { x: targetX, y: targetY, z: targetZ },
      velocity: { x: 0, y: 0, z: 0 },
      onGround: false,
    };

    this.bindEvents();
    this.syncCamera();
  }

  private _isInventoryOpen = false;

  public setInventoryOpen(open: boolean): void {
    this._isInventoryOpen = open;
    if (open) {
      this.pressed.clear();
      this.dragging = false;
      if (this.lockWatchdog) clearTimeout(this.lockWatchdog);
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    } else {
      if (this.controlMode === "pointer") {
        this.requestControl();
      }
    }
  }

  public get isInventoryOpen(): boolean {
    return this._isInventoryOpen;
  }

  public onEnterIdle?: () => void;

  private enterMode(mode: ControlMode): void {
    this.controlMode = mode;
    this.overlay?.classList.toggle("hidden", mode !== "idle");
    if (mode === "idle") {
      this.pressed.clear();
      this.onEnterIdle?.();
    }
  }

  private bindEvents(): void {
    document.addEventListener("pointerlockchange", () => {
      const locked = document.pointerLockElement === this.domElement;
      if (locked) {
        if (this.lockWatchdog) clearTimeout(this.lockWatchdog);
        if (this._isInventoryOpen) {
          document.exitPointerLock();
          return;
        }
        this.enterMode("pointer");
      } else if (this.controlMode === "pointer" && !this._isInventoryOpen) {
        this.enterMode("idle");
      }
    });

    document.addEventListener("mousemove", (e) => {
      if (this._isInventoryOpen) return;
      if (this.controlMode === "pointer") {
        this.applyLook(e.movementX, e.movementY, MOUSE_SENSITIVITY);
      } else if (this.controlMode === "drag" && this.dragging) {
        this.applyLook(e.movementX, e.movementY, DRAG_SENSITIVITY);
      }
    });

    this.domElement.addEventListener("mousedown", (e) => {
      if (this._isInventoryOpen) return;
      if (this.controlMode === "drag" && e.button === 0) this.dragging = true;
    });
    document.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.dragging = false;
    });

    document.addEventListener("keydown", (e) => {
      if (this._isInventoryOpen) return;
      if (e.code === "Escape" && this.controlMode === "drag") {
        this.enterMode("idle");
        return;
      }
      if (this.controlMode === "idle") return;
      this.pressed.add(e.code);
      if (e.code === "Space" || e.code.startsWith("Arrow")) {
        e.preventDefault();
      }
    });
    document.addEventListener("keyup", (e) => {
      this.pressed.delete(e.code);
    });
    window.addEventListener("blur", () => {
      this.pressed.clear();
      this.dragging = false;
    });

    this.domElement.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });
  }

  /** Exits pointer lock and returns to idle mode. */
  public exitControl(): void {
    if (this.lockWatchdog) clearTimeout(this.lockWatchdog);
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.enterMode("idle");
  }

  /** Ask for pointer lock; if the browser quietly never grants it, fall
   * back to drag-look so the game starts regardless. Touch-first devices
   * skip the pointer-lock dance entirely — there is no pointer to lock. */
  public requestControl(): void {
    if (this._isInventoryOpen) return;
    if (window.matchMedia("(pointer: coarse)").matches) {
      this.enterMode("drag");
      return;
    }
    if (this.lockWatchdog) clearTimeout(this.lockWatchdog);
    this.lockWatchdog = setTimeout(() => {
      if (this.controlMode === "idle") this.enterMode("drag");
    }, POINTER_LOCK_WATCHDOG_MS);

    try {
      // Returns a promise in Chromium, undefined elsewhere; a rejection
      // means the watchdog path takes over immediately.
      const result: unknown = this.domElement.requestPointerLock();
      if (result instanceof Promise) {
        result.catch(() => {
          if (this.lockWatchdog) clearTimeout(this.lockWatchdog);
          if (this.controlMode === "idle") this.enterMode("drag");
        });
      }
    } catch {
      if (this.lockWatchdog) clearTimeout(this.lockWatchdog);
      this.enterMode("drag");
    }
  }

  private applyLook(movementX: number, movementY: number, sensitivity: number): void {
    this.yaw -= movementX * sensitivity;
    this.pitch -= movementY * sensitivity;
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
  }

  /** Camera rotation from an external source (the touch controls' look
   * surface), in pixels of drag. */
  lookBy(pixelsX: number, pixelsY: number): void {
    if (this.controlMode === "idle") return;
    this.applyLook(pixelsX, pixelsY, DRAG_SENSITIVITY);
  }

  /** Movement from an external source (the touch controls' joystick),
   * merged with whatever the keyboard says every frame. */
  setExternalInput(
    input: { forward: number; right: number; jump: boolean; sprint: boolean } | null,
  ): void {
    this.external = input;
  }

  private external: { forward: number; right: number; jump: boolean; sprint: boolean } | null =
    null;

  private currentInput(): { forward: number; right: number; jump: boolean; sprint: boolean } {
    let forward = 0;
    let right = 0;
    let jump = false;
    let sprint = false;
    for (const code of this.pressed) {
      const action = KEY_BINDINGS[code];
      if (action === "forward") forward += 1;
      else if (action === "back") forward -= 1;
      else if (action === "right") right += 1;
      else if (action === "left") right -= 1;
      else if (action === "jump") jump = true;
      else if (action === "sprint") sprint = true;
    }
    if (this.external) {
      forward = Math.max(-1, Math.min(1, forward + this.external.forward));
      right = Math.max(-1, Math.min(1, right + this.external.right));
      jump = jump || this.external.jump;
      sprint = sprint || this.external.sprint;
    }
    return { forward, right, jump, sprint };
  }

  private syncCamera(): void {
    this.camera.position.set(
      this.state.position.x,
      this.state.position.y + PLAYER_EYE_HEIGHT,
      this.state.position.z,
    );
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.y = this.yaw;
  }

  update(dt: number): void {
    if (this.controlMode !== "idle" && !this._isInventoryOpen) {
      const { forward, right, jump, sprint } = this.currentInput();
      this.state = stepPhysics(
        this.state,
        { forward, right, jump, sprint, yaw: this.yaw },
        dt,
        (x, y, z) => isSolid(this.world.getBlock(x, y, z)),
        (x, y, z) => this.world.getBlock(x, y, z) === BlockId.WATER,
      );
    }
    this.syncCamera();
  }

  get mode(): ControlMode {
    return this.controlMode;
  }

  get isActive(): boolean {
    return this.controlMode !== "idle";
  }

  get isLocked(): boolean {
    return this.controlMode === "pointer";
  }

  get position(): PlayerPhysicsState["position"] {
    return this.state.position;
  }

  get transform(): PlayerTransform {
    return {
      x: this.state.position.x,
      y: this.state.position.y,
      z: this.state.position.z,
      yaw: this.yaw,
      pitch: this.pitch,
    };
  }

  get eyeYaw(): number {
    return this.yaw;
  }

  get eyePitch(): number {
    return this.pitch;
  }

  teleport(x: number, y: number, z: number, yaw?: number, pitch?: number): void {
    this.state = {
      position: { x, y, z },
      velocity: { x: 0, y: 0, z: 0 },
      onGround: false,
    };
    if (typeof yaw === "number") this.yaw = yaw;
    if (typeof pitch === "number") this.pitch = pitch;
    this.syncCamera();
  }

  respawn(spawnX = 8, spawnZ = 8): void {
    const groundY = findGroundHeight(
      Math.floor(spawnX),
      Math.floor(spawnZ),
      CHUNK_HEIGHT - 1,
      (x, y, z) => isSolid(this.world.getBlock(x, y, z)),
    );
    this.teleport(spawnX, groundY, spawnZ, 0, 0);
  }
}
