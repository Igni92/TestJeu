/** Tutoriel de premier lancement : 4 étapes en français. */

export interface TutorialCallbacks {
  onDone(): void;
  onUiClick(): void;
}

interface Step {
  emoji: string;
  title: string;
  text: string;
}

const STEPS: Step[] = [
  {
    emoji: '🏝️',
    title: 'Bienvenue sur votre île !',
    text: 'Construisez un petit village paisible : récoltez des ressources, agrandissez votre population et débloquez de nouveaux bâtiments.',
  },
  {
    emoji: '🤚',
    title: 'Déplacez la caméra',
    text: 'Glissez un doigt (ou la souris) pour déplacer la vue. Pincez avec deux doigts ou utilisez la molette pour zoomer.',
  },
  {
    emoji: '🏗️',
    title: 'Construisez',
    text: 'Touchez une case d’herbe libre pour ouvrir le menu de construction. Commencez par une Ferme et une Maison ! Touchez un arbre ou un rocher pour le déblayer.',
  },
  {
    emoji: '🌾',
    title: 'Récoltez',
    text: 'Quand une bulle apparaît au-dessus d’un bâtiment, touchez-le pour récolter sa production et gagner de l’expérience. Bon jeu !',
  },
];

export class Tutorial {
  private readonly backdrop: HTMLDivElement;
  private step = 0;

  constructor(root: HTMLElement, private readonly cb: TutorialCallbacks) {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';
    root.appendChild(this.backdrop);
    this.renderStep();
    requestAnimationFrame(() => this.backdrop.classList.add('show'));
  }

  private renderStep(): void {
    const step = STEPS[this.step];
    if (!step) return;
    this.backdrop.innerHTML = '';
    const modal = document.createElement('div');
    modal.className = 'modal tuto-card';

    const emoji = document.createElement('div');
    emoji.className = 'tuto-emoji';
    emoji.textContent = step.emoji;
    const title = document.createElement('h2');
    title.textContent = step.title;
    const text = document.createElement('p');
    text.textContent = step.text;

    const dots = document.createElement('div');
    dots.className = 'tuto-dots';
    STEPS.forEach((_, i) => {
      const dot = document.createElement('div');
      dot.className = 'tuto-dot' + (i === this.step ? ' active' : '');
      dots.appendChild(dot);
    });

    const isLast = this.step === STEPS.length - 1;
    const row = document.createElement('div');
    row.className = 'btn-row';
    if (!isLast) {
      const skip = document.createElement('button');
      skip.className = 'btn btn-ghost';
      skip.textContent = 'Passer';
      skip.addEventListener('click', () => this.finish());
      row.appendChild(skip);
    }
    const next = document.createElement('button');
    next.className = 'btn btn-primary';
    next.textContent = isLast ? 'C’est parti !' : 'Suivant';
    next.addEventListener('click', () => {
      this.cb.onUiClick();
      if (isLast) this.finish();
      else {
        this.step += 1;
        this.renderStep();
      }
    });
    row.appendChild(next);

    modal.append(emoji, title, text, dots, row);
    this.backdrop.appendChild(modal);
  }

  private finish(): void {
    this.backdrop.classList.remove('show');
    window.setTimeout(() => this.backdrop.remove(), 250);
    this.cb.onDone();
  }
}
