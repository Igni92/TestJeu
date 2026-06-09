/** Particules : poussière de construction (monde) et ressources volantes (écran). */

import type { Camera } from './iso';

interface WorldParticle {
  wx: number;
  wy: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface FlyParticle {
  /** Position écran courante. */
  sx: number;
  sy: number;
  /** Point de départ. */
  x0: number;
  y0: number;
  /** Cible écran (pilule du HUD). */
  tx: number;
  ty: number;
  /** Point de contrôle de la courbe. */
  cx: number;
  cy: number;
  t: number;
  speed: number;
  icon: string;
  onArrive: (() => void) | null;
}

export class Particles {
  private world: WorldParticle[] = [];
  private fly: FlyParticle[] = [];

  /** Nuage de poussière à la construction / démolition. */
  dust(wx: number, wy: number, color = '#cbb89a', count = 14): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 14 + Math.random() * 36;
      this.world.push({
        wx,
        wy: wy - 2,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.5 - 14,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.4,
        size: 2.5 + Math.random() * 3.5,
        color,
      });
    }
  }

  /** Petites étincelles de collecte autour du bâtiment. */
  sparkle(wx: number, wy: number, color = '#ffe2a8'): void {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 26 + Math.random() * 40;
      this.world.push({
        wx,
        wy: wy - 20,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.3,
        size: 1.8 + Math.random() * 2,
        color,
      });
    }
  }

  /** Ressource qui vole vers le HUD (coordonnées écran CSS). */
  flyToHud(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    icon: string,
    count: number,
    onArrive: (() => void) | null,
  ): void {
    for (let i = 0; i < count; i++) {
      const jx = (Math.random() - 0.5) * 40;
      const jy = (Math.random() - 0.5) * 30;
      const midX = (fromX + toX) / 2 + (Math.random() - 0.5) * 120;
      const midY = Math.min(fromY, toY) - 60 - Math.random() * 60;
      this.fly.push({
        sx: fromX + jx,
        sy: fromY + jy,
        x0: fromX + jx,
        y0: fromY + jy,
        tx: toX,
        ty: toY,
        cx: midX,
        cy: midY,
        t: -i * 0.06, // départs échelonnés
        speed: 1 / (0.55 + Math.random() * 0.2),
        icon,
        onArrive: i === count - 1 ? onArrive : null,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.world.length - 1; i >= 0; i--) {
      const p = this.world[i];
      if (!p) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.world.splice(i, 1);
        continue;
      }
      p.wx += p.vx * dt;
      p.wy += p.vy * dt;
      p.vy += 60 * dt; // gravité légère
      p.vx *= 1 - 2.2 * dt;
    }
    for (let i = this.fly.length - 1; i >= 0; i--) {
      const p = this.fly[i];
      if (!p) continue;
      p.t += dt * p.speed;
      if (p.t >= 1) {
        p.onArrive?.();
        this.fly.splice(i, 1);
        continue;
      }
      if (p.t < 0) continue;
      // Courbe de Bézier quadratique avec accélération douce.
      const e = p.t * p.t * (3 - 2 * p.t);
      const u = 1 - e;
      p.sx = u * u * p.x0 + 2 * u * e * p.cx + e * e * p.tx;
      p.sy = u * u * p.y0 + 2 * u * e * p.cy + e * e * p.ty;
    }
  }

  /** Dessine les particules monde (le contexte est en espace écran CSS). */
  drawWorld(ctx: CanvasRenderingContext2D, cam: Camera): void {
    for (const p of this.world) {
      const s = cam.worldToScreen(p.wx, p.wy);
      const a = 1 - p.life / p.maxLife;
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, p.size * cam.zoom * a + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Dessine les ressources volantes (espace écran CSS). */
  drawFly(ctx: CanvasRenderingContext2D): void {
    ctx.font = '17px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of this.fly) {
      if (p.t < 0) continue;
      ctx.globalAlpha = Math.min(1, p.t * 8);
      ctx.fillText(p.icon, p.sx, p.sy);
    }
    ctx.globalAlpha = 1;
  }

  get hasAny(): boolean {
    return this.world.length > 0 || this.fly.length > 0;
  }
}
