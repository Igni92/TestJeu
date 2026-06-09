/** Mathématiques isométriques et caméra. */

export const TILE_W = 64; // largeur d'un losange en unités monde
export const TILE_H = 32; // hauteur (ratio 2:1)

export const ZOOM_MIN = 0.55;
export const ZOOM_MAX = 2.6;

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Centre de la case (tx, ty) en coordonnées « monde » (espace écran 2D
 * non zoomé, avant caméra). Les cases sont des losanges 2:1.
 */
export function tileToWorld(tx: number, ty: number): Vec2 {
  return {
    x: ((tx - ty) * TILE_W) / 2,
    y: ((tx + ty) * TILE_H) / 2,
  };
}

/**
 * Inverse exact de tileToWorld : coordonnées de case continues.
 * tileToWorld(a, b) → worldToTileF → (a, b) exactement.
 */
export function worldToTileF(wx: number, wy: number): Vec2 {
  const hx = wx / (TILE_W / 2);
  const hy = wy / (TILE_H / 2);
  return {
    x: (hx + hy) / 2,
    y: (hy - hx) / 2,
  };
}

/** Case entière sous un point monde (les centres sont sur les entiers). */
export function worldToTile(wx: number, wy: number): Vec2 {
  const f = worldToTileF(wx, wy);
  return { x: Math.round(f.x), y: Math.round(f.y) };
}

/**
 * Caméra : position en coordonnées monde + zoom, avec interpolation douce.
 * screen = (world − cam) × zoom + centreÉcran
 */
export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  private tx = 0;
  private ty = 0;
  private tzoom = 1;

  viewW = 1;
  viewH = 1;

  setViewport(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
  }

  /** Place instantanément la caméra (et sa cible). */
  snapTo(wx: number, wy: number, zoom?: number): void {
    this.x = this.tx = wx;
    this.y = this.ty = wy;
    if (zoom !== undefined) this.zoom = this.tzoom = clampZoom(zoom);
  }

  /** Vise une position (interpolée en douceur). */
  moveTo(wx: number, wy: number): void {
    this.tx = wx;
    this.ty = wy;
  }

  /** Pan immédiat (suivi du doigt) : dx, dy en pixels écran. */
  panBy(dxScreen: number, dyScreen: number): void {
    const dx = dxScreen / this.zoom;
    const dy = dyScreen / this.zoom;
    this.x -= dx;
    this.y -= dy;
    this.tx = this.x;
    this.ty = this.y;
  }

  /**
   * Zoom par facteur autour d'un point écran (le point monde sous le
   * curseur/les doigts reste fixe). Immédiat pour rester sous le doigt.
   */
  zoomAt(factor: number, sx: number, sy: number): void {
    const before = this.screenToWorld(sx, sy);
    this.zoom = clampZoom(this.zoom * factor);
    this.tzoom = this.zoom;
    const after = this.screenToWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.tx = this.x;
    this.ty = this.y;
  }

  /** Zoom doux (clavier) vers le centre. */
  zoomTowards(factor: number): void {
    this.tzoom = clampZoom(this.tzoom * factor);
  }

  /** Interpolation douce vers la cible (le centre écran reste fixe). */
  update(dt: number): void {
    const k = 1 - Math.pow(0.0001, dt); // ~atteint la cible en ~1 s
    this.x += (this.tx - this.x) * k;
    this.y += (this.ty - this.y) * k;
    this.zoom += (this.tzoom - this.zoom) * k;
  }

  worldToScreen(wx: number, wy: number): Vec2 {
    return {
      x: (wx - this.x) * this.zoom + this.viewW / 2,
      y: (wy - this.y) * this.zoom + this.viewH / 2,
    };
  }

  /** Inverse exact de worldToScreen. */
  screenToWorld(sx: number, sy: number): Vec2 {
    return {
      x: (sx - this.viewW / 2) / this.zoom + this.x,
      y: (sy - this.viewH / 2) / this.zoom + this.y,
    };
  }

  /** Case entière sous un point écran. */
  screenToTile(sx: number, sy: number): Vec2 {
    const w = this.screenToWorld(sx, sy);
    return worldToTile(w.x, w.y);
  }
}

export function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}
