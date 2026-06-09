/** Types de l'état du jeu, sauvegarde/chargement, progression hors-ligne. */

import type { BuildingId } from './buildings';
import { buildingDef } from './buildings';

export const MAP_SIZE = 14;
export const SAVE_KEY = 'mon-ile-save';
export const SAVE_VERSION = 1;

export type TerrainType = 'water' | 'sand' | 'grass';
export type DecorType = 'tree' | 'rock';

export interface PlacedBuilding {
  id: BuildingId;
  /** Secondes de production accumulées (plafonnées au cycle). */
  progress: number;
  /** Horodatage de construction (pour l'animation d'apparition). */
  builtAt: number;
}

export interface Tile {
  terrain: TerrainType;
  decor: DecorType | null;
  building: PlacedBuilding | null;
}

export interface GameState {
  version: number;
  coins: number;
  wood: number;
  food: number;
  /** Population réelle (flottante pour une croissance douce). */
  population: number;
  level: number;
  xp: number;
  tiles: Tile[];
  lastSaved: number;
  tutorialDone: boolean;
  muted: boolean;
}

export function tileIndex(x: number, y: number): number {
  return y * MAP_SIZE + x;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < MAP_SIZE && y >= 0 && y < MAP_SIZE;
}

export function getTile(state: GameState, x: number, y: number): Tile | null {
  if (!inBounds(x, y)) return null;
  return state.tiles[tileIndex(x, y)] ?? null;
}

/* ------------------------------------------------------------------ */
/* Génération de l'île                                                 */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateIsland(seed: number): Tile[] {
  const rng = mulberry32(seed);
  const c = (MAP_SIZE - 1) / 2;
  // Bruit angulaire doux pour une côte irrégulière mais convexe.
  const wobble: number[] = [];
  for (let i = 0; i < 12; i++) wobble.push(0.82 + rng() * 0.18);

  const land: boolean[] = new Array(MAP_SIZE * MAP_SIZE).fill(false);
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const dx = (x - c) / c;
      const dy = (y - c) / c;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) + Math.PI; // [0, 2π]
      const seg = angle / ((Math.PI * 2) / wobble.length);
      const i0 = Math.floor(seg) % wobble.length;
      const i1 = (i0 + 1) % wobble.length;
      const frac = seg - Math.floor(seg);
      const w0 = wobble[i0] ?? 1;
      const w1 = wobble[i1] ?? 1;
      const radius = w0 + (w1 - w0) * frac;
      land[tileIndex(x, y)] = dist <= radius * 1.02;
    }
  }

  const tiles: Tile[] = [];
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const idx = tileIndex(x, y);
      if (!land[idx]) {
        tiles.push({ terrain: 'water', decor: null, building: null });
        continue;
      }
      // Sable si une case voisine (orthogonale) est de l'eau / hors carte.
      let coast = false;
      for (const [ox, oy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + ox;
        const ny = y + oy;
        if (!inBounds(nx, ny) || !land[tileIndex(nx, ny)]) {
          coast = true;
          break;
        }
      }
      tiles.push({
        terrain: coast ? 'sand' : 'grass',
        decor: null,
        building: null,
      });
    }
  }

  // Décorations : arbres et rochers sur l'herbe, centre laissé libre.
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const tile = tiles[tileIndex(x, y)];
      if (!tile || tile.terrain !== 'grass') continue;
      const nearCenter = Math.abs(x - c) <= 1.5 && Math.abs(y - c) <= 1.5;
      if (nearCenter) continue;
      const r = rng();
      if (r < 0.2) tile.decor = 'tree';
      else if (r < 0.28) tile.decor = 'rock';
    }
  }

  return tiles;
}

/* ------------------------------------------------------------------ */
/* Nouvel état / sauvegarde / chargement                               */
/* ------------------------------------------------------------------ */

export function newGameState(): GameState {
  return {
    version: SAVE_VERSION,
    coins: 120,
    wood: 40,
    food: 10,
    population: 0,
    level: 1,
    xp: 0,
    tiles: generateIsland((Math.random() * 0xffffffff) >>> 0),
    lastSaved: Date.now(),
    tutorialDone: false,
    muted: false,
  };
}

export function saveGame(state: GameState): void {
  try {
    state.lastSaved = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Stockage indisponible (navigation privée…) : on ignore.
  }
}

export interface LoadResult {
  state: GameState;
  /** Secondes écoulées hors-ligne (0 pour une nouvelle partie). */
  offlineSeconds: number;
  isNew: boolean;
}

function isValidSave(data: unknown): data is GameState {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    d['version'] === SAVE_VERSION &&
    typeof d['coins'] === 'number' &&
    typeof d['wood'] === 'number' &&
    typeof d['food'] === 'number' &&
    typeof d['population'] === 'number' &&
    typeof d['level'] === 'number' &&
    typeof d['xp'] === 'number' &&
    Array.isArray(d['tiles']) &&
    (d['tiles'] as unknown[]).length === MAP_SIZE * MAP_SIZE &&
    typeof d['lastSaved'] === 'number'
  );
}

/** Pré-remplit la production des bâtiments selon le temps écoulé hors-ligne. */
export function applyOfflineProgress(state: GameState, elapsedSec: number): void {
  if (elapsedSec <= 0) return;
  for (const tile of state.tiles) {
    const b = tile.building;
    if (!b) continue;
    const def = buildingDef(b.id);
    if (def.cycle <= 0) continue;
    b.progress = Math.min(def.cycle, b.progress + elapsedSec);
  }
}

export function loadGame(): LoadResult {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    raw = null;
  }
  if (raw) {
    try {
      const data: unknown = JSON.parse(raw);
      if (isValidSave(data)) {
        const state = data;
        const offlineSeconds = Math.max(0, (Date.now() - state.lastSaved) / 1000);
        applyOfflineProgress(state, offlineSeconds);
        return { state, offlineSeconds, isNew: false };
      }
    } catch {
      // Sauvegarde corrompue ou version incompatible : nouvelle partie.
    }
  }
  return { state: newGameState(), offlineSeconds: 0, isNew: true };
}

export function resetGame(): GameState {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
  return newGameState();
}
