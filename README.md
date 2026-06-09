# 🏝️ Mon Île

**Mon Île** est un city-builder isométrique relaxant, pensé d'abord pour le mobile (tactile) mais
parfaitement jouable sur ordinateur. Vous développez un petit village paisible sur une île
entourée d'une eau scintillante : récoltez des ressources, agrandissez votre population,
débloquez de nouveaux bâtiments et regardez les fenêtres de vos maisons s'illuminer à la
tombée de la nuit.

Tout est **100 % procédural** : aucun fichier image ni audio. Les graphismes sont dessinés en
Canvas 2D (losanges isométriques 2:1, algorithme du peintre, cycle jour/nuit d'environ 3 minutes)
et les sons sont synthétisés en WebAudio. **Aucune dépendance d'exécution npm** (hors
`@capacitor/core` pour l'emballage natif).

## 🖼️ Aperçu conceptuel

```
            ~ ~ ~ eau scintillante ~ ~ ~
        ~  🌊   ◇sable◇sable◇sable   🌊  ~
      ~   ◇sable◇herbe◇herbe◇herbe◇sable   ~
     ~   ◇sable◇ 🌳 ◇ 🏠 ◇ ⛲ ◇ 🌾 ◇sable   ~
      ~   ◇sable◇ 🪨 ◇ 🛒 ◇ 🪚 ◇sable   ~
        ~  🐟(pêcherie sur le sable) ~
            ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
   HUD : 🪙 pièces · 🪵 bois · 🍞 nourriture · 👥 population · ⭐ niveau/XP
```

- Glissez pour déplacer la caméra, pincez (ou molette) pour zoomer.
- Touchez une case libre → menu de construction ; touchez un bâtiment prêt → récolte
  avec particules qui volent vers le HUD ; touchez un arbre/rocher → déblaiement.
- Sauvegarde automatique (toutes les 5 s + mise en arrière-plan) et **progression
  hors-ligne** : la production continue pendant votre absence (plafonnée à un cycle plein).

## 🚀 Tester en local

```bash
npm install
npm run dev        # serveur de développement Vite (accessible sur le réseau local)
```

Puis ouvrez l'URL affichée (par défaut `http://localhost:5173`). Sur mobile, utilisez
l'adresse IP locale affichée par Vite.

## 📦 Build web

```bash
npm run build      # vérification TypeScript stricte + build Vite → dist/
npm run preview    # sert le build de production pour vérification
```

## 🤖 Déploiement Play Store (Android)

1. Construire le web puis synchroniser le projet natif :
   ```bash
   npm run build
   npx cap sync android
   ```
2. Ouvrir le projet dans Android Studio :
   ```bash
   npx cap open android
   ```
3. Dans Android Studio : **Build → Generate Signed Bundle / APK → Android App Bundle**,
   créer (ou réutiliser) votre keystore, et générer l'**AAB signé** en variante `release`.
4. Sur la [console Google Play](https://play.google.com/console) : créer l'application
   (`com.monile.game`), téléverser l'AAB dans une release (test interne puis production),
   remplir la fiche (titre « Mon Île », captures, classification du contenu) et publier.

## 🍎 Déploiement App Store (iOS)

> Nécessite un Mac avec Xcode et CocoaPods (`sudo gem install cocoapods`).

1. Construire et synchroniser :
   ```bash
   npm run build
   npx cap sync ios     # lance aussi `pod install`
   ```
2. Ouvrir le projet dans Xcode :
   ```bash
   npx cap open ios
   ```
3. Dans Xcode : sélectionner votre équipe de signature (Signing & Capabilities),
   choisir « Any iOS Device », puis **Product → Archive**.
4. Depuis l'Organizer : **Distribute App → App Store Connect**, puis sur
   [App Store Connect](https://appstoreconnect.apple.com) créer l'app (`com.monile.game`),
   associer le build, remplir la fiche et soumettre à la révision.

> Note : le dossier `ios/` a été généré dans un environnement Linux ; `pod install` et le
> nettoyage `xcodebuild` ont été ignorés (avertissement normal). Le premier
> `npx cap sync ios` sur un Mac installera les pods automatiquement.

## 🗂️ Structure du code

```
src/
├── main.ts              # bootstrap, boucle requestAnimationFrame, pas de temps fixe (10 Hz)
├── game/
│   ├── state.ts         # types, GameState, génération de l'île, sauvegarde/chargement
│   │                    #   (localStorage versionné) et progression hors-ligne
│   ├── buildings.ts     # définitions et équilibrage des bâtiments
│   └── sim.ts           # production, population, XP/niveaux, construire/démolir/déblayer
├── render/
│   ├── iso.ts           # maths isométriques (conversions exactes) et caméra (pan/zoom lissés)
│   ├── renderer.ts      # carte, eau animée, tri en profondeur, cycle jour/nuit
│   ├── sprites.ts       # bâtiments/arbres/rochers dessinés en chemins Canvas
│   └── particles.ts     # poussière de chantier + ressources volant vers le HUD
├── ui/
│   ├── hud.ts           # barre de ressources, niveau/XP, réglages (son, réinitialisation)
│   ├── buildmenu.ts     # menu de construction (bottom sheet) + panneau d'info / démolition
│   ├── toast.ts         # notifications (« Niveau 2 ! Scierie débloquée »)
│   └── tutorial.ts      # tutoriel de premier lancement (4 étapes)
├── input/
│   └── pointer.ts       # pointeurs unifiés : pan, pincement, détection tap vs glissement
└── audio/
    └── sfx.ts           # effets sonores synthétisés (WebAudio), sourdine persistée
```

## ⚖️ Équilibrage

Ressources de départ : **120 🪙 · 40 🪵 · 10 🍞**.

| Bâtiment   | Coût            | Production / cycle        | Cycle | Niveau | Particularité |
| ---------- | --------------- | ------------------------- | ----- | ------ | ------------- |
| Maison     | 50 🪙 + 20 🪵    | 6 🪙 (loyer)              | 45 s  | 1      | +4 habitants |
| Ferme      | 30 🪙 + 10 🪵    | 8 🍞                      | 40 s  | 1      | — |
| Scierie    | 60 🪙           | 7 🪵                      | 50 s  | 2      | — |
| Marché     | 100 🪙 + 30 🪵   | 12 🪙 + 0,8 🪙/habitant   | 60 s  | 2      | dépend de la population |
| Pêcherie   | 80 🪙 + 25 🪵    | 9 🍞 + 12 🪙              | 70 s  | 3      | uniquement sur le sable |
| Fontaine   | 120 🪙          | —                         | —     | 4      | +20 % aux bâtiments adjacents (max +60 %) |

- **Déblaiement** : arbre −5 🪙 → +15 🪵 (+4 XP) ; rocher −10 🪙 → +22 🪙 (+6 XP).
- **XP** : +10 par construction ; à la récolte : maison +5, ferme +6, scierie +7, marché +10,
  pêcherie +12.
- **Niveaux** : XP requise = `round(30 × niveau^1,4)` → 30, 79, 140, 210… (niveau 2 vers
  2 minutes, niveau 4 vers 9–10 minutes de jeu actif).
- **Population** : +1 habitant / 8 s tant que nourriture > 0 (jusqu'à la capacité) ;
  consommation 1 🍞 / 45 s / habitant.
- **Démolition** : remboursement de 50 % du coût.

Bon jeu ! 🌴
