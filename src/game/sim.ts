/** Simulation : production, population, XP et niveaux, actions de jeu. */

import {
  BUILDINGS,
  BUILD_XP,
  CLEAR_ROCK_COINS,
  CLEAR_ROCK_COST,
  CLEAR_ROCK_XP,
  CLEAR_TREE_COST,
  CLEAR_TREE_WOOD,
  CLEAR_TREE_XP,
  DEMOLISH_REFUND,
  FOUNTAIN_BONUS,
  FOUNTAIN_BONUS_MAX,
  MARKET_COINS_PER_POP,
  buildingDef,
} from './buildings';
import type { BuildingDef, BuildingId, ResourceBundle } from './buildings';
import { MAP_SIZE, getTile, tileIndex } from './state';
import type { GameState, Tile } from './state';

export const MAX_LEVEL = 20;

/** XP nécessaire pour passer du niveau `level` au suivant. */
export function xpForNextLevel(level: number): number {
  // 30, 79, 140, 210, 287, … : niveau 2 vers ~2 min, niveau 4 vers ~9 min.
  return Math.round(30 * Math.pow(level, 1.4));
}

export interface LevelUpInfo {
  newLevel: number;
  unlocked: BuildingDef[];
}

/** Ajoute de l'XP et renvoie les niveaux gagnés (avec bâtiments débloqués). */
export function grantXp(state: GameState, amount: number): LevelUpInfo[] {
  const ups: LevelUpInfo[] = [];
  state.xp += amount;
  while (state.level < MAX_LEVEL && state.xp >= xpForNextLevel(state.level)) {
    state.xp -= xpForNextLevel(state.level);
    state.level += 1;
    ups.push({
      newLevel: state.level,
      unlocked: BUILDINGS.filter((b) => b.unlockLevel === state.level),
    });
  }
  return ups;
}

/* ------------------------------------------------------------------ */
/* Boucle de simulation                                                */
/* ------------------------------------------------------------------ */

export function populationCapacity(state: GameState): number {
  let cap = 0;
  for (const tile of state.tiles) {
    if (tile.building) cap += buildingDef(tile.building.id).popCap;
  }
  return cap;
}

const POP_GROWTH_PER_SEC = 1 / 8; // 1 habitant toutes les 8 s si nourri
const FOOD_PER_POP_PER_SEC = 1 / 45; // 1 nourriture / 45 s / habitant

/** Avance la simulation d'un pas de temps fixe (en secondes). */
export function simTick(state: GameState, dt: number): void {
  // Production des bâtiments.
  for (const tile of state.tiles) {
    const b = tile.building;
    if (!b) continue;
    const def = buildingDef(b.id);
    if (def.cycle <= 0) continue;
    b.progress = Math.min(def.cycle, b.progress + dt);
  }

  // Population : croît vers la capacité si nourriture > 0, consomme.
  const cap = populationCapacity(state);
  if (state.food > 0 && state.population < cap) {
    state.population = Math.min(cap, state.population + POP_GROWTH_PER_SEC * dt);
  } else if (state.population > cap) {
    state.population = Math.max(cap, state.population - POP_GROWTH_PER_SEC * dt);
  }
  if (state.population > 0) {
    state.food = Math.max(0, state.food - state.population * FOOD_PER_POP_PER_SEC * dt);
  }
}

/* ------------------------------------------------------------------ */
/* Production / collecte                                               */
/* ------------------------------------------------------------------ */

/** Bonus multiplicateur (>1) dû aux fontaines adjacentes. */
export function fountainMultiplier(state: GameState, x: number, y: number): number {
  let bonus = 0;
  for (const [ox, oy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const t = getTile(state, x + ox, y + oy);
    if (t?.building?.id === 'fontaine') bonus += FOUNTAIN_BONUS;
  }
  return 1 + Math.min(FOUNTAIN_BONUS_MAX, bonus);
}

/** Production réelle d'un cycle complet pour le bâtiment en (x, y). */
export function cycleOutput(state: GameState, x: number, y: number): ResourceBundle {
  const tile = getTile(state, x, y);
  const b = tile?.building;
  if (!b) return {};
  const def = buildingDef(b.id);
  const mult = fountainMultiplier(state, x, y);
  const out: ResourceBundle = {};
  let coins = def.produces.coins ?? 0;
  if (def.scalesWithPop) {
    coins += Math.floor(state.population) * MARKET_COINS_PER_POP;
  }
  if (coins > 0) out.coins = Math.round(coins * mult);
  if (def.produces.wood) out.wood = Math.round(def.produces.wood * mult);
  if (def.produces.food) out.food = Math.round(def.produces.food * mult);
  return out;
}

export function isReady(tile: Tile): boolean {
  const b = tile.building;
  if (!b) return false;
  const def = buildingDef(b.id);
  return def.cycle > 0 && b.progress >= def.cycle;
}

export interface CollectResult {
  gained: ResourceBundle;
  xp: number;
  levelUps: LevelUpInfo[];
}

/** Collecte la production prête du bâtiment en (x, y). */
export function collect(state: GameState, x: number, y: number): CollectResult | null {
  const tile = getTile(state, x, y);
  if (!tile || !tile.building || !isReady(tile)) return null;
  const def = buildingDef(tile.building.id);
  const gained = cycleOutput(state, x, y);
  state.coins += gained.coins ?? 0;
  state.wood += gained.wood ?? 0;
  state.food += gained.food ?? 0;
  tile.building.progress = 0;
  const levelUps = grantXp(state, def.xpOnCollect);
  return { gained, xp: def.xpOnCollect, levelUps };
}

/* ------------------------------------------------------------------ */
/* Construction / démolition / déblaiement                             */
/* ------------------------------------------------------------------ */

export type BuildError =
  | 'occupied'
  | 'terrain'
  | 'locked'
  | 'cost';

export function canBuild(
  state: GameState,
  id: BuildingId,
  x: number,
  y: number,
): BuildError | null {
  const tile = getTile(state, x, y);
  const def = buildingDef(id);
  if (!tile || tile.terrain === 'water' || tile.building || tile.decor) return 'occupied';
  if (tile.terrain !== def.placement) return 'terrain';
  if (state.level < def.unlockLevel) return 'locked';
  if (state.coins < def.costCoins || state.wood < def.costWood) return 'cost';
  return null;
}

export function build(
  state: GameState,
  id: BuildingId,
  x: number,
  y: number,
): LevelUpInfo[] | null {
  if (canBuild(state, id, x, y) !== null) return null;
  const tile = getTile(state, x, y);
  if (!tile) return null;
  const def = buildingDef(id);
  state.coins -= def.costCoins;
  state.wood -= def.costWood;
  tile.building = { id, progress: 0, builtAt: Date.now() };
  return grantXp(state, BUILD_XP);
}

export interface DemolishResult {
  refundCoins: number;
  refundWood: number;
}

export function demolish(state: GameState, x: number, y: number): DemolishResult | null {
  const tile = getTile(state, x, y);
  if (!tile || !tile.building) return null;
  const def = buildingDef(tile.building.id);
  const refundCoins = Math.floor(def.costCoins * DEMOLISH_REFUND);
  const refundWood = Math.floor(def.costWood * DEMOLISH_REFUND);
  state.coins += refundCoins;
  state.wood += refundWood;
  tile.building = null;
  return { refundCoins, refundWood };
}

export interface ClearResult {
  cost: number;
  gained: ResourceBundle;
  levelUps: LevelUpInfo[];
}

/** Déblaie un arbre ou un rocher (coûte quelques pièces, rapporte des ressources). */
export function clearDecor(state: GameState, x: number, y: number): ClearResult | null {
  const tile = getTile(state, x, y);
  if (!tile || !tile.decor) return null;
  if (tile.decor === 'tree') {
    if (state.coins < CLEAR_TREE_COST) return null;
    state.coins -= CLEAR_TREE_COST;
    state.wood += CLEAR_TREE_WOOD;
    tile.decor = null;
    return {
      cost: CLEAR_TREE_COST,
      gained: { wood: CLEAR_TREE_WOOD },
      levelUps: grantXp(state, CLEAR_TREE_XP),
    };
  }
  if (state.coins < CLEAR_ROCK_COST) return null;
  state.coins -= CLEAR_ROCK_COST;
  state.coins += CLEAR_ROCK_COINS;
  tile.decor = null;
  return {
    cost: CLEAR_ROCK_COST,
    gained: { coins: CLEAR_ROCK_COINS },
    levelUps: grantXp(state, CLEAR_ROCK_XP),
  };
}

/** Coût de déblaiement d'une décoration. */
export function clearCost(tile: Tile): number {
  return tile.decor === 'tree' ? CLEAR_TREE_COST : CLEAR_ROCK_COST;
}

/** Indique si une fontaine adjacente booste la case (pour l'info-bulle). */
export function hasFountainBonus(state: GameState, x: number, y: number): boolean {
  return fountainMultiplier(state, x, y) > 1;
}

/** Renvoie les coordonnées de toutes les cases avec bâtiment prêt. */
export function readyTiles(state: GameState): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const tile = state.tiles[tileIndex(x, y)];
      if (tile && isReady(tile)) out.push({ x, y });
    }
  }
  return out;
}
