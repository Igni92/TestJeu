/** Mon Île — point d'entrée : boucle de jeu, câblage entrées / UI / rendu. */

import { sfx } from './audio/sfx';
import type { ResourceBundle } from './game/buildings';
import {
  MAP_SIZE,
  getTile,
  loadGame,
  resetGame,
  saveGame,
} from './game/state';
import type { GameState } from './game/state';
import {
  build,
  canBuild,
  clearDecor,
  collect,
  demolish,
  isReady,
  simTick,
} from './game/sim';
import type { LevelUpInfo } from './game/sim';
import { Camera, tileToWorld, worldToTile } from './render/iso';
import type { Vec2 } from './render/iso';
import { Particles } from './render/particles';
import { ELEVATION, Renderer } from './render/renderer';
import { PointerInput } from './input/pointer';
import { BuildMenu, InfoPanel } from './ui/buildmenu';
import { Hud } from './ui/hud';
import { Toasts } from './ui/toast';
import { Tutorial } from './ui/tutorial';

/* ------------------------------------------------------------------ */
/* Initialisation                                                      */
/* ------------------------------------------------------------------ */

const canvasEl = document.getElementById('game-canvas');
const uiRootEl = document.getElementById('ui-root');
if (!(canvasEl instanceof HTMLCanvasElement) || !uiRootEl) {
  throw new Error('DOM incomplet');
}
const canvas: HTMLCanvasElement = canvasEl;
const uiRoot: HTMLElement = uiRootEl;

const loaded = loadGame();
let state: GameState = loaded.state;
sfx.setMuted(state.muted);

const renderer = new Renderer(canvas);
const cam = new Camera();
const particles = new Particles();
const toasts = new Toasts(uiRoot);

let selected: Vec2 | null = null;

// Centre de l'île.
const center = tileToWorld((MAP_SIZE - 1) / 2, (MAP_SIZE - 1) / 2);
cam.setViewport(window.innerWidth, window.innerHeight);
cam.snapTo(center.x, center.y, fitZoom());

function fitZoom(): number {
  // Zoom initial pour voir toute l'île avec un peu de marge.
  const islandW = MAP_SIZE * 64;
  const islandH = MAP_SIZE * 32 + 120;
  return Math.min(
    2,
    Math.max(0.6, Math.min(window.innerWidth / islandW, window.innerHeight / islandH) * 0.92),
  );
}

/* ------------------------------------------------------------------ */
/* Aides : toasts de niveau, particules de collecte                    */
/* ------------------------------------------------------------------ */

function announceLevelUps(ups: LevelUpInfo[]): void {
  for (const up of ups) {
    const names = up.unlocked.map((b) => `${b.name} débloqué${b.name.endsWith('e') ? 'e' : ''}`);
    const suffix = names.length > 0 ? ` ${names.join(', ')} !` : '';
    toasts.show(`✨ Niveau ${up.newLevel} !${suffix}`, { levelUp: true });
    sfx.levelUp();
  }
}

function buildingScreenPos(x: number, y: number): Vec2 {
  const w = tileToWorld(x, y);
  return cam.worldToScreen(w.x, w.y - ELEVATION - 18);
}

function flyResources(from: Vec2, gained: ResourceBundle): void {
  const kinds: Array<{ key: 'coins' | 'wood' | 'food'; icon: string }> = [
    { key: 'coins', icon: '🪙' },
    { key: 'wood', icon: '🪵' },
    { key: 'food', icon: '🍞' },
  ];
  for (const k of kinds) {
    const amount = gained[k.key] ?? 0;
    if (amount <= 0) continue;
    const target = hud.pillCenter(k.key);
    const count = Math.min(6, 2 + Math.floor(amount / 5));
    particles.flyToHud(from.x, from.y, target.x, target.y, k.icon, count, () =>
      hud.bumpPill(k.key),
    );
  }
}

/* ------------------------------------------------------------------ */
/* UI                                                                  */
/* ------------------------------------------------------------------ */

const hud = new Hud(uiRoot, {
  onToggleSound: (muted) => {
    state.muted = muted;
    sfx.setMuted(muted);
    if (!muted) sfx.click();
    saveGame(state);
  },
  onReset: () => {
    state = resetGame();
    sfx.setMuted(state.muted);
    selected = null;
    buildMenu.close();
    infoPanel.close();
    cam.snapTo(center.x, center.y, fitZoom());
    toasts.show('🏝️ Nouvelle île générée !');
    startTutorialIfNeeded();
  },
  onUiClick: () => sfx.click(),
});

const buildMenu = new BuildMenu(uiRoot, {
  onBuild: (id, x, y) => {
    const err = canBuild(state, id, x, y);
    if (err !== null) {
      sfx.error();
      toasts.show(err === 'cost' ? '💸 Ressources insuffisantes' : '❌ Construction impossible');
      return;
    }
    const ups = build(state, id, x, y) ?? [];
    sfx.build();
    const w = tileToWorld(x, y);
    particles.dust(w.x, w.y - ELEVATION);
    announceLevelUps(ups);
    saveGame(state);
    selected = null;
  },
  onUiClick: () => sfx.click(),
});

const infoPanel = new InfoPanel(uiRoot, {
  onDemolish: (x, y) => {
    const tile = getTile(state, x, y);
    if (!tile?.building) return;
    const result = demolish(state, x, y);
    if (!result) return;
    sfx.demolish();
    const w = tileToWorld(x, y);
    particles.dust(w.x, w.y - ELEVATION, '#b0a18c', 18);
    const parts: string[] = [];
    if (result.refundCoins > 0) parts.push(`🪙 ${result.refundCoins}`);
    if (result.refundWood > 0) parts.push(`🪵 ${result.refundWood}`);
    toasts.show(`🧹 Démoli — remboursé : ${parts.join(' ')}`);
    saveGame(state);
    selected = null;
  },
  onClear: (x, y) => {
    const tile = getTile(state, x, y);
    if (!tile?.decor) return;
    const wasTree = tile.decor === 'tree';
    const result = clearDecor(state, x, y);
    if (!result) {
      sfx.error();
      toasts.show('💸 Pas assez de pièces');
      return;
    }
    sfx.pop();
    const w = tileToWorld(x, y);
    particles.dust(w.x, w.y - ELEVATION, wasTree ? '#6fae6f' : '#9aa3b0', 16);
    flyResources(buildingScreenPos(x, y), result.gained);
    announceLevelUps(result.levelUps);
    saveGame(state);
    selected = null;
  },
  onUiClick: () => sfx.click(),
});

function startTutorialIfNeeded(): void {
  if (state.tutorialDone) return;
  new Tutorial(uiRoot, {
    onDone: () => {
      state.tutorialDone = true;
      saveGame(state);
    },
    onUiClick: () => sfx.click(),
  });
}

startTutorialIfNeeded();

if (loaded.offlineSeconds > 90) {
  const minutes = Math.floor(loaded.offlineSeconds / 60);
  const txt =
    minutes >= 60
      ? `${Math.floor(minutes / 60)} h ${minutes % 60} min`
      : `${minutes} min`;
  toasts.show(`👋 Bon retour ! Vos bâtiments ont produit pendant ${txt}.`, { duration: 3500 });
}

/* ------------------------------------------------------------------ */
/* Entrées                                                             */
/* ------------------------------------------------------------------ */

function handleTap(sx: number, sy: number): void {
  const sheetWasOpen = buildMenu.isOpen || infoPanel.isOpen;
  buildMenu.close();
  infoPanel.close();

  // Sélection sur le plan surélevé de l'île.
  const w = cam.screenToWorld(sx, sy);
  const t = worldToTile(w.x, w.y + ELEVATION);
  const tile = getTile(state, t.x, t.y);

  if (!tile || tile.terrain === 'water') {
    selected = null;
    if (!sheetWasOpen) sfx.click();
    return;
  }

  if (tile.building) {
    if (isReady(tile)) {
      const from = buildingScreenPos(t.x, t.y);
      const result = collect(state, t.x, t.y);
      if (result) {
        sfx.collect();
        const wpos = tileToWorld(t.x, t.y);
        particles.sparkle(wpos.x, wpos.y - ELEVATION);
        flyResources(from, result.gained);
        announceLevelUps(result.levelUps);
        saveGame(state);
      }
      selected = null;
    } else {
      selected = { x: t.x, y: t.y };
      sfx.click();
      infoPanel.openBuilding(state, t.x, t.y);
    }
    return;
  }

  if (tile.decor) {
    selected = { x: t.x, y: t.y };
    sfx.click();
    infoPanel.openDecor(state, t.x, t.y, tile.decor);
    return;
  }

  // Case libre : menu de construction.
  selected = { x: t.x, y: t.y };
  sfx.click();
  buildMenu.open(state, t.x, t.y);
}

new PointerInput(canvas, {
  onPan: (dx, dy) => cam.panBy(dx, dy),
  onZoom: (factor, cx, cy) => cam.zoomAt(factor, cx, cy),
  onTap: (x, y) => handleTap(x, y),
  onFirstGesture: () => sfx.resume(),
});

// Zoom clavier optionnel (bureau).
window.addEventListener('keydown', (e) => {
  if (e.key === '+' || e.key === '=') cam.zoomTowards(1.25);
  else if (e.key === '-' || e.key === '_') cam.zoomTowards(0.8);
});

/* ------------------------------------------------------------------ */
/* Sauvegarde automatique                                              */
/* ------------------------------------------------------------------ */

window.setInterval(() => saveGame(state), 5000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveGame(state);
});
window.addEventListener('pagehide', () => saveGame(state));

/* ------------------------------------------------------------------ */
/* Boucle de jeu : pas de temps fixe + rendu à chaque frame            */
/* ------------------------------------------------------------------ */

const SIM_DT = 0.1; // simulation à 10 Hz
let accumulator = 0;
let lastFrame = performance.now();

function frame(now: number): void {
  const frameDt = Math.min(0.25, (now - lastFrame) / 1000);
  lastFrame = now;

  accumulator += frameDt;
  while (accumulator >= SIM_DT) {
    simTick(state, SIM_DT);
    accumulator -= SIM_DT;
  }

  cam.update(frameDt);
  particles.update(frameDt);

  // Si les panneaux sont fermés, plus de case sélectionnée.
  if (selected && !buildMenu.isOpen && !infoPanel.isOpen) selected = null;

  hud.update(state);
  infoPanel.update(state);
  renderer.render({
    state,
    cam,
    time: now / 1000,
    particles,
    selected,
  });

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
