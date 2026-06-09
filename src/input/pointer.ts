/**
 * Entrées unifiées souris / tactile : pan, pincement (zoom), détection de tap.
 */

export interface PointerCallbacks {
  /** Glissement à un doigt / souris (deltas en pixels CSS). */
  onPan(dx: number, dy: number): void;
  /** Zoom par facteur autour d'un point écran (molette ou pincement). */
  onZoom(factor: number, cx: number, cy: number): void;
  /** Tap court sans déplacement. */
  onTap(x: number, y: number): void;
  /** Premier geste utilisateur (pour réveiller l'AudioContext). */
  onFirstGesture(): void;
}

const TAP_MAX_DIST = 10; // pixels CSS
const TAP_MAX_MS = 400;

interface TrackedPointer {
  id: number;
  x: number;
  y: number;
}

export class PointerInput {
  private readonly pointers = new Map<number, TrackedPointer>();
  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private moved = 0;
  private pinching = false;
  private lastPinchDist = 0;
  private gestureSeen = false;

  constructor(
    target: HTMLElement,
    private readonly cb: PointerCallbacks,
  ) {
    target.addEventListener('pointerdown', (e) => this.onDown(e));
    target.addEventListener('pointermove', (e) => this.onMove(e));
    target.addEventListener('pointerup', (e) => this.onUp(e));
    target.addEventListener('pointercancel', (e) => this.onCancel(e));
    target.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.firstGesture();
        const factor = Math.exp(-e.deltaY * 0.0016);
        this.cb.onZoom(factor, e.clientX, e.clientY);
      },
      { passive: false },
    );
  }

  private firstGesture(): void {
    if (this.gestureSeen) return;
    this.gestureSeen = true;
    this.cb.onFirstGesture();
  }

  private onDown(e: PointerEvent): void {
    this.firstGesture();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.startTime = performance.now();
      this.moved = 0;
      this.pinching = false;
    } else if (this.pointers.size === 2) {
      this.pinching = true;
      this.lastPinchDist = this.pinchDistance();
    }
  }

  private onMove(e: PointerEvent): void {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;

    if (this.pointers.size === 1) {
      this.moved += Math.hypot(dx, dy);
      // Petite zone morte pour distinguer tap et pan ; après un
      // pincement, le doigt restant reprend le pan immédiatement.
      if (this.moved > TAP_MAX_DIST || this.pinching) {
        this.cb.onPan(dx, dy);
      }
    } else if (this.pointers.size === 2) {
      // Pincement : zoom autour du point médian + pan du médian.
      const [a, b] = [...this.pointers.values()];
      if (!a || !b) return;
      const dist = this.pinchDistance();
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      if (this.lastPinchDist > 0 && dist > 0) {
        const factor = dist / this.lastPinchDist;
        this.cb.onZoom(factor, midX, midY);
      }
      this.lastPinchDist = dist;
      // Le déplacement du point médian fait défiler la carte
      // (chaque doigt contribue pour moitié).
      this.cb.onPan(dx / 2, dy / 2);
    }
  }

  private onUp(e: PointerEvent): void {
    const existed = this.pointers.delete(e.pointerId);
    if (!existed) return;
    if (this.pointers.size === 0) {
      const dt = performance.now() - this.startTime;
      const dist = Math.hypot(e.clientX - this.startX, e.clientY - this.startY);
      if (!this.pinching && dist <= TAP_MAX_DIST && this.moved <= TAP_MAX_DIST && dt <= TAP_MAX_MS) {
        this.cb.onTap(e.clientX, e.clientY);
      }
      this.pinching = false;
    } else if (this.pointers.size === 1) {
      // Fin du pincement : le doigt restant reprend le pan, sans tap.
      this.lastPinchDist = 0;
    }
  }

  private onCancel(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.lastPinchDist = 0;
    if (this.pointers.size === 0) this.pinching = false;
  }

  private pinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}
