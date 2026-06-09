/** Rendu : carte, eau animée, tri en profondeur, cycle jour/nuit. */

import { buildingDef } from '../game/buildings';
import { MAP_SIZE, tileIndex } from '../game/state';
import type { GameState, Tile } from '../game/state';
import { Camera, TILE_H, TILE_W, tileToWorld } from './iso';
import type { Vec2 } from './iso';
import type { Particles } from './particles';
import { drawBuilding, drawReadyBubble, drawRock, drawTree } from './sprites';

/** Élévation de l'île au-dessus de l'eau (unités monde). */
export const ELEVATION = 8;
/** Durée du cycle jour/nuit complet, en secondes (~3 min). */
export const DAY_LENGTH = 180;

export interface DayNight {
  /** 0 = plein jour, 1 = nuit noire. */
  night: number;
  /** Pic à l'aube et au crépuscule. */
  dusk: number;
}

export function dayNightFactors(time: number): DayNight {
  const t = (time % DAY_LENGTH) / DAY_LENGTH; // 0 = midi
  const phase = t * Math.PI * 2;
  const night = (1 - Math.cos(phase)) / 2;
  const dusk = Math.pow(Math.abs(Math.sin(phase)), 5);
  return { night, dusk };
}

interface RenderArgs {
  state: GameState;
  cam: Camera;
  time: number;
  particles: Particles;
  selected: Vec2 | null;
}

const WATER_MARGIN = 7; // cases d'eau dessinées autour de la grille

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;
  cssW = 1;
  cssH = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D non disponible');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    this.dpr = Math.min(2.5, window.devicePixelRatio || 1);
    this.cssW = window.innerWidth;
    this.cssH = window.innerHeight;
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
  }

  render(args: RenderArgs): void {
    const { state, cam, time, particles, selected } = args;
    const ctx = this.ctx;
    cam.setViewport(this.cssW, this.cssH);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const dn = dayNightFactors(time);

    this.drawWaterBackground(ctx, dn);
    this.drawWaterTiles(ctx, cam, time);
    this.drawLandTiles(ctx, cam, state, selected);
    this.drawObjects(ctx, cam, state, time, dn);
    particles.drawWorld(ctx, cam);
    this.drawDayNightOverlay(ctx, dn);
    particles.drawFly(ctx);
  }

  /* ---------------------------------------------------------------- */

  private drawWaterBackground(ctx: CanvasRenderingContext2D, dn: DayNight): void {
    const g = ctx.createLinearGradient(0, 0, 0, this.cssH);
    const darken = dn.night * 0.45;
    g.addColorStop(0, shadeColor(31, 142, 165, darken));
    g.addColorStop(1, shadeColor(20, 98, 124, darken));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.cssW, this.cssH);
  }

  private drawWaterTiles(ctx: CanvasRenderingContext2D, cam: Camera, time: number): void {
    const halfW = (TILE_W / 2) * cam.zoom;
    const halfH = (TILE_H / 2) * cam.zoom;
    for (let y = -WATER_MARGIN; y < MAP_SIZE + WATER_MARGIN; y++) {
      for (let x = -WATER_MARGIN; x < MAP_SIZE + WATER_MARGIN; x++) {
        const w = tileToWorld(x, y);
        const s = cam.worldToScreen(w.x, w.y);
        if (
          s.x + halfW < 0 ||
          s.x - halfW > this.cssW ||
          s.y + halfH < 0 ||
          s.y - halfH > this.cssH
        ) {
          continue;
        }
        // Chatoiement : variation douce de luminosité qui se déplace.
        const ph = x * 0.9 + y * 1.35;
        const shimmer = Math.sin(time * 1.4 + ph) * 0.5 + Math.sin(time * 0.7 - x * 0.6) * 0.5;
        const a = 0.05 + 0.05 * shimmer;
        diamondPath(ctx, s.x, s.y, halfW, halfH);
        ctx.fillStyle = `rgba(220, 250, 255, ${Math.max(0, a).toFixed(3)})`;
        ctx.fill();
        // Reflets ponctuels (petits traits clairs qui passent).
        if (shimmer > 0.82) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = Math.max(0.8, cam.zoom);
          ctx.beginPath();
          ctx.moveTo(s.x - halfW * 0.4, s.y + halfH * 0.15);
          ctx.lineTo(s.x + halfW * 0.25, s.y - halfH * 0.2);
          ctx.stroke();
        }
      }
    }
  }

  private drawLandTiles(
    ctx: CanvasRenderingContext2D,
    cam: Camera,
    state: GameState,
    selected: Vec2 | null,
  ): void {
    const z = cam.zoom;
    const halfW = (TILE_W / 2) * z;
    const halfH = (TILE_H / 2) * z;
    const elev = ELEVATION * z;

    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const tile = state.tiles[tileIndex(x, y)];
        if (!tile || tile.terrain === 'water') continue;
        const w = tileToWorld(x, y);
        const s = cam.worldToScreen(w.x, w.y);
        if (
          s.x + halfW < 0 ||
          s.x - halfW > this.cssW ||
          s.y + halfH < -elev ||
          s.y - halfH - elev > this.cssH
        ) {
          continue;
        }
        const topY = s.y - elev;
        const grass = tile.terrain === 'grass';
        const alt = (x + y) % 2 === 0;

        // Faces latérales (gauche plus sombre, droite moyenne).
        ctx.fillStyle = grass ? '#7a5f3e' : '#b08e58';
        ctx.beginPath();
        ctx.moveTo(s.x - halfW, topY);
        ctx.lineTo(s.x, topY + halfH);
        ctx.lineTo(s.x, s.y + halfH);
        ctx.lineTo(s.x - halfW, s.y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = grass ? '#94744c' : '#c9a368';
        ctx.beginPath();
        ctx.moveTo(s.x, topY + halfH);
        ctx.lineTo(s.x + halfW, topY);
        ctx.lineTo(s.x + halfW, s.y);
        ctx.lineTo(s.x, s.y + halfH);
        ctx.closePath();
        ctx.fill();

        // Dessus.
        if (grass) {
          ctx.fillStyle = alt ? '#74c573' : '#6cbd6c';
        } else {
          ctx.fillStyle = alt ? '#ecd9a0' : '#e5d096';
        }
        diamondPath(ctx, s.x, topY, halfW, halfH);
        ctx.fill();
        // Liseré doux entre les cases.
        ctx.strokeStyle = grass ? 'rgba(40, 90, 45, 0.16)' : 'rgba(150, 120, 60, 0.18)';
        ctx.lineWidth = Math.max(0.6, z * 0.7);
        ctx.stroke();
      }
    }

    // Surbrillance de la case sélectionnée.
    if (selected) {
      const w = tileToWorld(selected.x, selected.y);
      const s = cam.worldToScreen(w.x, w.y);
      const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 240);
      diamondPath(ctx, s.x, s.y - elev, halfW, halfH);
      ctx.strokeStyle = `rgba(255, 255, 255, ${(0.55 + 0.3 * pulse).toFixed(3)})`;
      ctx.lineWidth = Math.max(1.5, 2.2 * z);
      ctx.stroke();
      diamondPath(ctx, s.x, s.y - elev, halfW, halfH);
      ctx.fillStyle = `rgba(255, 255, 255, ${(0.1 * pulse).toFixed(3)})`;
      ctx.fill();
    }
  }

  private drawObjects(
    ctx: CanvasRenderingContext2D,
    cam: Camera,
    state: GameState,
    time: number,
    dn: DayNight,
  ): void {
    const z = cam.zoom;
    const elev = ELEVATION * z;
    // Algorithme du peintre : tri par profondeur (x + y croissant).
    interface Obj {
      x: number;
      y: number;
      depth: number;
      tile: Tile;
    }
    const objs: Obj[] = [];
    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const tile = state.tiles[tileIndex(x, y)];
        if (!tile || (!tile.decor && !tile.building)) continue;
        objs.push({ x, y, depth: x + y, tile });
      }
    }
    objs.sort((a, b) => a.depth - b.depth || a.x - b.x);

    const margin = 90 * z;
    for (const o of objs) {
      const w = tileToWorld(o.x, o.y);
      const s = cam.worldToScreen(w.x, w.y);
      if (
        s.x + margin < 0 ||
        s.x - margin > this.cssW ||
        s.y + margin < 0 ||
        s.y - margin > this.cssH
      ) {
        continue;
      }
      ctx.save();
      ctx.translate(s.x, s.y - elev);
      ctx.scale(z, z);
      const seed = o.x * 31 + o.y * 17 + 7;
      if (o.tile.decor === 'tree') drawTree(ctx, seed, time);
      else if (o.tile.decor === 'rock') drawRock(ctx, seed);
      const b = o.tile.building;
      if (b) {
        // Animation d'apparition (« drop » avec rebond).
        const age = (Date.now() - b.builtAt) / 1000;
        if (age < 0.45) {
          const t = Math.min(1, age / 0.45);
          const sc = 0.4 + 0.6 * easeOutBack(t);
          ctx.scale(sc, sc);
        }
        drawBuilding(ctx, b.id, time + seed * 0.13, dn.night);
        const def = buildingDef(b.id);
        if (def.cycle > 0 && b.progress >= def.cycle) {
          drawReadyBubble(ctx, bubbleIcon(b.id), time, seed);
        }
      }
      ctx.restore();
    }
  }

  private drawDayNightOverlay(ctx: CanvasRenderingContext2D, dn: DayNight): void {
    if (dn.dusk > 0.02) {
      ctx.fillStyle = `rgba(255, 138, 64, ${(dn.dusk * 0.14).toFixed(3)})`;
      ctx.fillRect(0, 0, this.cssW, this.cssH);
    }
    if (dn.night > 0.02) {
      ctx.fillStyle = `rgba(14, 22, 64, ${(dn.night * 0.4).toFixed(3)})`;
      ctx.fillRect(0, 0, this.cssW, this.cssH);
    }
  }
}

/* ------------------------------------------------------------------ */

function diamondPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - halfH);
  ctx.lineTo(cx + halfW, cy);
  ctx.lineTo(cx, cy + halfH);
  ctx.lineTo(cx - halfW, cy);
  ctx.closePath();
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function shadeColor(r: number, g: number, b: number, darken: number): string {
  const f = 1 - darken;
  return `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;
}

function bubbleIcon(id: string): string {
  switch (id) {
    case 'maison':
      return '🪙';
    case 'ferme':
      return '🌾';
    case 'scierie':
      return '🪵';
    case 'marche':
      return '🪙';
    case 'pecherie':
      return '🐟';
    default:
      return '✨';
  }
}
