/** Menu de construction (bottom sheet) et panneau d'information de case. */

import { BUILDINGS, buildingDef } from '../game/buildings';
import type { BuildingDef, BuildingId } from '../game/buildings';
import { getTile } from '../game/state';
import type { DecorType, GameState } from '../game/state';
import { clearCost, cycleOutput, fountainMultiplier } from '../game/sim';

export interface BuildMenuCallbacks {
  onBuild(id: BuildingId, x: number, y: number): void;
  onUiClick(): void;
}

export class BuildMenu {
  private readonly sheet: HTMLDivElement;
  private tileX = 0;
  private tileY = 0;
  private _open = false;

  constructor(root: HTMLElement, private readonly cb: BuildMenuCallbacks) {
    this.sheet = document.createElement('div');
    this.sheet.className = 'sheet';
    root.appendChild(this.sheet);
  }

  get isOpen(): boolean {
    return this._open;
  }

  open(state: GameState, x: number, y: number): void {
    this.tileX = x;
    this.tileY = y;
    const tile = getTile(state, x, y);
    if (!tile) return;
    this.sheet.innerHTML = '';

    const grip = document.createElement('div');
    grip.className = 'sheet-grip';
    this.sheet.appendChild(grip);

    const title = document.createElement('div');
    title.className = 'sheet-title';
    const label = document.createElement('span');
    label.textContent =
      tile.terrain === 'sand' ? '🏖️ Construire sur le sable' : '🌱 Construire';
    const close = document.createElement('button');
    close.className = 'sheet-close';
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Fermer');
    close.addEventListener('click', () => {
      this.cb.onUiClick();
      this.close();
    });
    title.append(label, close);
    this.sheet.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'build-grid';
    for (const def of BUILDINGS) {
      grid.appendChild(this.makeCard(state, def, tile.terrain));
    }
    this.sheet.appendChild(grid);

    this._open = true;
    requestAnimationFrame(() => this.sheet.classList.add('open'));
  }

  private makeCard(
    state: GameState,
    def: BuildingDef,
    terrain: 'grass' | 'sand' | 'water',
  ): HTMLButtonElement {
    const card = document.createElement('button');
    card.className = 'build-card';

    const head = document.createElement('div');
    head.className = 'card-head';
    const icon = document.createElement('span');
    icon.className = 'card-icon';
    icon.textContent = def.icon;
    const name = document.createElement('span');
    name.textContent = def.name;
    head.append(icon, name);
    card.appendChild(head);

    const desc = document.createElement('div');
    desc.className = 'card-desc';
    desc.textContent = def.desc;
    card.appendChild(desc);

    const locked = state.level < def.unlockLevel;
    const wrongTerrain = terrain !== def.placement;
    const tooPoorCoins = state.coins < def.costCoins;
    const tooPoorWood = state.wood < def.costWood;

    const cost = document.createElement('div');
    cost.className = 'card-cost';
    const coinSpan = document.createElement('span');
    coinSpan.textContent = `🪙 ${def.costCoins}`;
    if (tooPoorCoins) coinSpan.className = 'cost-bad';
    cost.appendChild(coinSpan);
    if (def.costWood > 0) {
      const woodSpan = document.createElement('span');
      woodSpan.textContent = `🪵 ${def.costWood}`;
      if (tooPoorWood) woodSpan.className = 'cost-bad';
      cost.appendChild(woodSpan);
    }
    card.appendChild(cost);

    if (locked) {
      card.classList.add('locked');
      const lock = document.createElement('div');
      lock.className = 'card-lock';
      lock.textContent = `🔒 Niveau ${def.unlockLevel} requis`;
      card.appendChild(lock);
    } else if (wrongTerrain) {
      card.classList.add('disabled');
      const lock = document.createElement('div');
      lock.className = 'card-lock';
      lock.textContent =
        def.placement === 'sand' ? '🏖️ À placer sur le sable' : '🌱 À placer sur l’herbe';
      card.appendChild(lock);
    } else if (tooPoorCoins || tooPoorWood) {
      card.classList.add('disabled');
      const lock = document.createElement('div');
      lock.className = 'card-lock';
      lock.textContent = 'Ressources insuffisantes';
      card.appendChild(lock);
    }

    card.addEventListener('click', () => {
      if (locked || wrongTerrain || tooPoorCoins || tooPoorWood) return;
      this.cb.onBuild(def.id, this.tileX, this.tileY);
      this.close();
    });
    return card;
  }

  close(): void {
    this._open = false;
    this.sheet.classList.remove('open');
  }
}

/* ------------------------------------------------------------------ */
/* Panneau d'information (bâtiment existant ou décor à déblayer)       */
/* ------------------------------------------------------------------ */

export interface InfoPanelCallbacks {
  onDemolish(x: number, y: number): void;
  onClear(x: number, y: number): void;
  onUiClick(): void;
}

export class InfoPanel {
  private readonly sheet: HTMLDivElement;
  private _open = false;
  private tileX = 0;
  private tileY = 0;
  private mode: 'building' | 'decor' | null = null;
  private prodFill: HTMLDivElement | null = null;
  private prodLabel: HTMLDivElement | null = null;

  constructor(root: HTMLElement, private readonly cb: InfoPanelCallbacks) {
    this.sheet = document.createElement('div');
    this.sheet.className = 'sheet';
    root.appendChild(this.sheet);
  }

  get isOpen(): boolean {
    return this._open;
  }

  get tile(): { x: number; y: number } {
    return { x: this.tileX, y: this.tileY };
  }

  openBuilding(state: GameState, x: number, y: number): void {
    const tile = getTile(state, x, y);
    const b = tile?.building;
    if (!b) return;
    const def = buildingDef(b.id);
    this.tileX = x;
    this.tileY = y;
    this.mode = 'building';
    this.sheet.innerHTML = '';
    this.appendHeader(def.icon, def.name, def.desc);

    if (def.cycle > 0) {
      const out = cycleOutput(state, x, y);
      const parts: string[] = [];
      if (out.coins) parts.push(`🪙 ${out.coins}`);
      if (out.wood) parts.push(`🪵 ${out.wood}`);
      if (out.food) parts.push(`🍞 ${out.food}`);
      const bonus = fountainMultiplier(state, x, y);
      const bonusTxt = bonus > 1 ? ` · ⛲ +${Math.round((bonus - 1) * 100)} %` : '';

      const bar = document.createElement('div');
      bar.className = 'prod-bar';
      this.prodFill = document.createElement('div');
      this.prodFill.className = 'prod-fill';
      bar.appendChild(this.prodFill);
      this.sheet.appendChild(bar);

      this.prodLabel = document.createElement('div');
      this.prodLabel.className = 'prod-label';
      this.sheet.appendChild(this.prodLabel);

      const yieldInfo = document.createElement('div');
      yieldInfo.className = 'prod-label';
      yieldInfo.textContent = `Production par cycle : ${parts.join('  ')}${bonusTxt}`;
      this.sheet.appendChild(yieldInfo);
    } else if (def.id === 'fontaine') {
      const info = document.createElement('div');
      info.className = 'prod-label';
      info.textContent = '+20 % de production aux bâtiments adjacents.';
      this.sheet.appendChild(info);
    }

    if (def.popCap > 0) {
      const info = document.createElement('div');
      info.className = 'prod-label';
      info.textContent = `Capacité : +${def.popCap} habitants`;
      this.sheet.appendChild(info);
    }

    const refundCoins = Math.floor(def.costCoins * 0.5);
    const refundWood = Math.floor(def.costWood * 0.5);
    const row = document.createElement('div');
    row.className = 'btn-row';
    const demolish = document.createElement('button');
    demolish.className = 'btn btn-danger';
    demolish.textContent = `Démolir (+🪙 ${refundCoins}${refundWood > 0 ? ` +🪵 ${refundWood}` : ''})`;
    demolish.addEventListener('click', () => {
      this.cb.onDemolish(this.tileX, this.tileY);
      this.close();
    });
    row.appendChild(demolish);
    this.sheet.appendChild(row);

    this._open = true;
    this.update(state);
    requestAnimationFrame(() => this.sheet.classList.add('open'));
  }

  openDecor(state: GameState, x: number, y: number, decor: DecorType): void {
    const tile = getTile(state, x, y);
    if (!tile) return;
    this.tileX = x;
    this.tileY = y;
    this.mode = 'decor';
    this.sheet.innerHTML = '';
    const isTree = decor === 'tree';
    this.appendHeader(
      isTree ? '🌳' : '🪨',
      isTree ? 'Arbre' : 'Rocher',
      isTree
        ? 'Déblayer cet arbre libère la case et rapporte du bois.'
        : 'Déblayer ce rocher libère la case ; la pierre se revend en pièces.',
    );

    const cost = clearCost(tile);
    const gain = isTree ? '+🪵 15' : '+🪙 22';
    const row = document.createElement('div');
    row.className = 'btn-row';
    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn btn-primary';
    clearBtn.textContent = `Déblayer (−🪙 ${cost} · ${gain})`;
    if (state.coins < cost) {
      clearBtn.disabled = true;
      clearBtn.style.opacity = '0.5';
    }
    clearBtn.addEventListener('click', () => {
      this.cb.onClear(this.tileX, this.tileY);
      this.close();
    });
    row.appendChild(clearBtn);
    this.sheet.appendChild(row);

    this._open = true;
    requestAnimationFrame(() => this.sheet.classList.add('open'));
  }

  private appendHeader(icon: string, name: string, desc: string): void {
    const grip = document.createElement('div');
    grip.className = 'sheet-grip';
    this.sheet.appendChild(grip);

    const row = document.createElement('div');
    row.className = 'info-row';
    const iconEl = document.createElement('div');
    iconEl.className = 'info-icon';
    iconEl.textContent = icon;
    const text = document.createElement('div');
    const nameEl = document.createElement('div');
    nameEl.className = 'info-name';
    nameEl.textContent = name;
    const descEl = document.createElement('div');
    descEl.className = 'info-desc';
    descEl.textContent = desc;
    text.append(nameEl, descEl);
    const close = document.createElement('button');
    close.className = 'sheet-close';
    close.style.marginLeft = 'auto';
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Fermer');
    close.addEventListener('click', () => {
      this.cb.onUiClick();
      this.close();
    });
    row.append(iconEl, text, close);
    this.sheet.appendChild(row);
  }

  /** Met à jour la barre de progression (appelé à chaque frame si ouvert). */
  update(state: GameState): void {
    if (!this._open || this.mode !== 'building' || !this.prodFill || !this.prodLabel) return;
    const tile = getTile(state, this.tileX, this.tileY);
    const b = tile?.building;
    if (!b) {
      this.close();
      return;
    }
    const def = buildingDef(b.id);
    if (def.cycle <= 0) return;
    const ratio = Math.min(1, b.progress / def.cycle);
    this.prodFill.style.width = `${(ratio * 100).toFixed(1)}%`;
    this.prodLabel.textContent =
      ratio >= 1
        ? '✅ Production prête — touchez le bâtiment pour récolter !'
        : `Production en cours… ${Math.ceil(def.cycle - b.progress)} s restantes`;
  }

  close(): void {
    this._open = false;
    this.mode = null;
    this.prodFill = null;
    this.prodLabel = null;
    this.sheet.classList.remove('open');
  }
}
