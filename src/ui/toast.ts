/** Notifications « toast » empilées en haut de l'écran. */

export class Toasts {
  private readonly container: HTMLDivElement;

  constructor(root: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    root.appendChild(this.container);
  }

  show(message: string, options?: { levelUp?: boolean; duration?: number }): void {
    const el = document.createElement('div');
    el.className = 'toast' + (options?.levelUp ? ' levelup' : '');
    el.textContent = message;
    this.container.appendChild(el);
    // Limiter la pile à 3 toasts.
    while (this.container.children.length > 3) {
      this.container.firstElementChild?.remove();
    }
    requestAnimationFrame(() => el.classList.add('show'));
    const duration = options?.duration ?? (options?.levelUp ? 3500 : 2200);
    window.setTimeout(() => {
      el.classList.remove('show');
      window.setTimeout(() => el.remove(), 300);
    }, duration);
  }
}
