/** Définitions et équilibrage des bâtiments. */

export type BuildingId =
  | 'maison'
  | 'ferme'
  | 'scierie'
  | 'marche'
  | 'pecherie'
  | 'fontaine';

export interface ResourceBundle {
  coins?: number;
  wood?: number;
  food?: number;
}

export interface BuildingDef {
  id: BuildingId;
  name: string;
  icon: string;
  desc: string;
  costCoins: number;
  costWood: number;
  unlockLevel: number;
  /** Terrain de placement autorisé. */
  placement: 'grass' | 'sand';
  /** Durée d'un cycle de production en secondes (0 = pas de production). */
  cycle: number;
  /** Production de base par cycle. */
  produces: ResourceBundle;
  /** Le marché produit plus avec la population. */
  scalesWithPop: boolean;
  /** Capacité de population ajoutée. */
  popCap: number;
  /** XP gagnée à la collecte. */
  xpOnCollect: number;
}

export const BUILDINGS: readonly BuildingDef[] = [
  {
    id: 'maison',
    name: 'Maison',
    icon: '🏠',
    desc: '+4 habitants de capacité et un petit loyer. Les fenêtres brillent la nuit.',
    costCoins: 50,
    costWood: 20,
    unlockLevel: 1,
    placement: 'grass',
    cycle: 45,
    produces: { coins: 6 },
    scalesWithPop: false,
    popCap: 4,
    xpOnCollect: 5,
  },
  {
    id: 'ferme',
    name: 'Ferme',
    icon: '🌾',
    desc: 'Produit de la nourriture pour vos habitants.',
    costCoins: 30,
    costWood: 10,
    unlockLevel: 1,
    placement: 'grass',
    cycle: 40,
    produces: { food: 8 },
    scalesWithPop: false,
    popCap: 0,
    xpOnCollect: 6,
  },
  {
    id: 'scierie',
    name: 'Scierie',
    icon: '🪚',
    desc: 'Produit du bois pour vos constructions.',
    costCoins: 60,
    costWood: 0,
    unlockLevel: 2,
    placement: 'grass',
    cycle: 50,
    produces: { wood: 7 },
    scalesWithPop: false,
    popCap: 0,
    xpOnCollect: 7,
  },
  {
    id: 'marche',
    name: 'Marché',
    icon: '🛒',
    desc: 'Produit des pièces. Plus il y a d’habitants, plus il rapporte.',
    costCoins: 100,
    costWood: 30,
    unlockLevel: 2,
    placement: 'grass',
    cycle: 60,
    produces: { coins: 12 },
    scalesWithPop: true,
    popCap: 0,
    xpOnCollect: 10,
  },
  {
    id: 'pecherie',
    name: 'Pêcherie',
    icon: '🐟',
    desc: 'À construire sur le sable. Poissons frais : nourriture et pièces.',
    costCoins: 80,
    costWood: 25,
    unlockLevel: 3,
    placement: 'sand',
    cycle: 70,
    produces: { food: 9, coins: 12 },
    scalesWithPop: false,
    popCap: 0,
    xpOnCollect: 12,
  },
  {
    id: 'fontaine',
    name: 'Fontaine',
    icon: '⛲',
    desc: 'Décoration : +20 % de production aux bâtiments adjacents.',
    costCoins: 120,
    costWood: 0,
    unlockLevel: 4,
    placement: 'grass',
    cycle: 0,
    produces: {},
    scalesWithPop: false,
    popCap: 0,
    xpOnCollect: 0,
  },
] as const;

export function buildingDef(id: BuildingId): BuildingDef {
  const def = BUILDINGS.find((b) => b.id === id);
  if (!def) throw new Error(`Bâtiment inconnu : ${id}`);
  return def;
}

/** Bonus de production par fontaine adjacente (orthogonale). */
export const FOUNTAIN_BONUS = 0.2;
/** Bonus maximum cumulé des fontaines. */
export const FOUNTAIN_BONUS_MAX = 0.6;
/** Pièces produites en plus par habitant au marché. */
export const MARKET_COINS_PER_POP = 0.8;

/** Coûts / gains de déblaiement. */
export const CLEAR_TREE_COST = 5;
export const CLEAR_TREE_WOOD = 15;
export const CLEAR_TREE_XP = 4;
export const CLEAR_ROCK_COST = 10;
export const CLEAR_ROCK_COINS = 22;
export const CLEAR_ROCK_XP = 6;

/** XP gagnée à la construction. */
export const BUILD_XP = 10;
/** Remboursement à la démolition. */
export const DEMOLISH_REFUND = 0.5;
