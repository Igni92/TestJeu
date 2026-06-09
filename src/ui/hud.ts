/** Barre de ressources (HUD), niveau/XP et menu réglages. */

import type { GameState } from '../game/state';
import { populationCapacity, xpForNextLevel } from '../game/sim';

export type ResourceKind = 'coins' | 'wood' | 'food' | 'pop';

export interface HudCallbacks {
  onToggleSound(muted: boolean): void;
  onReset(): void;
  onUiClick(): void;
}

interface Pill {
  el: HTMLDivElement;
  value: HTMLSpanElement;
}

export class Hud {
  private readonly pills = new Map<ResourceKind, Pill>();
  private readonly levelBadge: HTMLDivElement;
  private readonly xpFill: HTMLDivElement;
  private modal: HTMLDivElement | null = null;
  private readonly root: HTMLElement;

  constructor(root: HTMLElement, private readonly cb: HudCallbacks) {
    this.root = root;
    const bar = document.createElement('div');
    bar.className = 'hud-top';

    const defs: Array<{ kind: ResourceKind; icon: string; title: string }> = [
      { kind: 'coins', icon: '🪙', title: 'Pièces' },
      { kind: 'wood', icon: '🪵', title: 'Bois' },
      { kind: 'food', icon: '🍞', title: 'Nourriture' },
      { kind: 'pop', icon: '👥', title: 'Population' },
    ];
    for (const d of defs) {
      const pill = document.createElement('div');
      pill.className = 'res-pill';
      pill.title = d.title;
      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.textContent = d.icon;
      const value = document.createElement('span');
      value.textContent = '0';
      pill.append(icon, value);
      bar.appendChild(pill);
      this.pills.set(d.kind, { el: pill, value });
    }

    const levelPill = document.createElement('div');
    levelPill.className = 'level-pill';
    levelPill.title = 'Niveau et expérience';
    this.levelBadge = document.createElement('div');
    this.levelBadge.className = 'level-badge';
    this.levelBadge.textContent = '1';
    const xpBar = document.createElement('div');
    xpBar.className = 'xp-bar';
    this.xpFill = document.createElement('div');
    this.xpFill.className = 'xp-fill';
    xpBar.appendChild(this.xpFill);
    levelPill.append(this.levelBadge, xpBar);
    bar.appendChild(levelPill);

    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'icon-btn';
    settingsBtn.textContent = '⚙️';
    settingsBtn.setAttribute('aria-label', 'Réglages');
    settingsBtn.addEventListener('click', () => {
      this.cb.onUiClick();
      this.openSettings();
    });
    bar.appendChild(settingsBtn);

    root.appendChild(bar);
  }

  private currentState: GameState | null = null;

  update(state: GameState): void {
    this.currentState = state;
    this.setPill('coins', Math.floor(state.coins).toString());
    this.setPill('wood', Math.floor(state.wood).toString());
    this.setPill('food', Math.floor(state.food).toString());
    const cap = populationCapacity(state);
    this.setPill('pop', `${Math.floor(state.population)}/${cap}`);
    this.levelBadge.textContent = String(state.level);
    const need = xpForNextLevel(state.level);
    this.xpFill.style.width = `${Math.min(100, (state.xp / need) * 100).toFixed(1)}%`;
  }

  private setPill(kind: ResourceKind, text: string): void {
    const pill = this.pills.get(kind);
    if (pill && pill.value.textContent !== text) {
      pill.value.textContent = text;
    }
  }

  /** Centre écran (CSS px) d'une pilule — cible des particules volantes. */
  pillCenter(kind: ResourceKind): { x: number; y: number } {
    const pill = this.pills.get(kind);
    if (!pill) return { x: 40, y: 30 };
    const r = pill.el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  /** Petit rebond visuel quand une ressource arrive. */
  bumpPill(kind: ResourceKind): void {
    const pill = this.pills.get(kind);
    if (!pill) return;
    pill.el.classList.remove('bump');
    void pill.el.offsetWidth; // relance la transition
    pill.el.classList.add('bump');
    window.setTimeout(() => pill.el.classList.remove('bump'), 180);
  }

  /* ------------------------- Réglages ----------------------------- */

  private openSettings(): void {
    this.closeModal();
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const modal = document.createElement('div');
    modal.className = 'modal';

    const title = document.createElement('h2');
    title.textContent = 'Réglages';
    modal.appendChild(title);

    // Son
    const soundRow = document.createElement('div');
    soundRow.className = 'settings-row';
    const soundLabel = document.createElement('span');
    soundLabel.textContent = '🔊 Son';
    const toggle = document.createElement('button');
    const muted = this.currentState?.muted ?? false;
    toggle.className = 'toggle' + (muted ? '' : ' on');
    toggle.setAttribute('aria-label', 'Activer ou couper le son');
    toggle.addEventListener('click', () => {
      const nowMuted = toggle.classList.contains('on');
      toggle.classList.toggle('on', !nowMuted);
      this.cb.onToggleSound(nowMuted);
    });
    soundRow.append(soundLabel, toggle);
    modal.appendChild(soundRow);

    // Réinitialiser
    const resetRow = document.createElement('div');
    resetRow.className = 'settings-row';
    const resetLabel = document.createElement('span');
    resetLabel.textContent = '🗑️ Réinitialiser la partie';
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-danger';
    resetBtn.textContent = 'Réinitialiser';
    resetBtn.addEventListener('click', () => {
      this.cb.onUiClick();
      this.openConfirmReset();
    });
    resetRow.append(resetLabel, resetBtn);
    modal.appendChild(resetRow);

    const credits = document.createElement('div');
    credits.className = 'credits';
    credits.innerHTML =
      'Mon Île — un petit jeu relaxant.<br />' +
      'Graphismes et sons 100 % procéduraux (Canvas + WebAudio).<br />' +
      'Fait avec ❤️ en TypeScript.';
    modal.appendChild(credits);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-primary';
    closeBtn.style.width = '100%';
    closeBtn.style.marginTop = '16px';
    closeBtn.textContent = 'Fermer';
    closeBtn.addEventListener('click', () => {
      this.cb.onUiClick();
      this.closeModal();
    });
    modal.appendChild(closeBtn);

    backdrop.appendChild(modal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.closeModal();
    });
    this.root.appendChild(backdrop);
    this.modal = backdrop;
    requestAnimationFrame(() => backdrop.classList.add('show'));
  }

  private openConfirmReset(): void {
    this.closeModal();
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const modal = document.createElement('div');
    modal.className = 'modal';
    const title = document.createElement('h2');
    title.textContent = 'Tout recommencer ?';
    const p = document.createElement('p');
    p.textContent =
      'Votre île, vos bâtiments et votre progression seront définitivement effacés.';
    const row = document.createElement('div');
    row.className = 'btn-row';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-ghost';
    cancel.textContent = 'Annuler';
    cancel.addEventListener('click', () => {
      this.cb.onUiClick();
      this.closeModal();
    });
    const confirm = document.createElement('button');
    confirm.className = 'btn btn-danger';
    confirm.textContent = 'Effacer';
    confirm.addEventListener('click', () => {
      this.closeModal();
      this.cb.onReset();
    });
    row.append(cancel, confirm);
    modal.append(title, p, row);
    backdrop.appendChild(modal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.closeModal();
    });
    this.root.appendChild(backdrop);
    this.modal = backdrop;
    requestAnimationFrame(() => backdrop.classList.add('show'));
  }

  private closeModal(): void {
    this.modal?.remove();
    this.modal = null;
  }
}
