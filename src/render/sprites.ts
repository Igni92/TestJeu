/**
 * Sprites procéduraux : bâtiments, arbres, rochers, bulles de collecte.
 * Tout est dessiné avec des chemins Canvas, aucune image.
 *
 * Convention : le contexte est déjà translaté/zoomé ; l'origine (0, 0)
 * est le centre du losange de la case au niveau du sol, en unités monde
 * (case de 64×32).
 */

import type { BuildingId } from '../game/buildings';

type Ctx = CanvasRenderingContext2D;

/* ------------------------------------------------------------------ */
/* Aides géométriques                                                  */
/* ------------------------------------------------------------------ */

function diamond(ctx: Ctx, cx: number, cy: number, w: number, d: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - d / 2);
  ctx.lineTo(cx + w / 2, cy);
  ctx.lineTo(cx, cy + d / 2);
  ctx.lineTo(cx - w / 2, cy);
  ctx.closePath();
}

/**
 * Boîte isométrique : losange supérieur (w × d) à la hauteur h,
 * faces gauche (sombre) et droite (moyenne).
 */
function isoBox(
  ctx: Ctx,
  w: number,
  d: number,
  h: number,
  top: string,
  left: string,
  right: string,
  yBase = 0,
): void {
  const hw = w / 2;
  const hd = d / 2;
  // Face gauche : W → S
  ctx.fillStyle = left;
  ctx.beginPath();
  ctx.moveTo(-hw, yBase);
  ctx.lineTo(0, yBase + hd);
  ctx.lineTo(0, yBase + hd - h);
  ctx.lineTo(-hw, yBase - h);
  ctx.closePath();
  ctx.fill();
  // Face droite : S → E
  ctx.fillStyle = right;
  ctx.beginPath();
  ctx.moveTo(0, yBase + hd);
  ctx.lineTo(hw, yBase);
  ctx.lineTo(hw, yBase - h);
  ctx.lineTo(0, yBase + hd - h);
  ctx.closePath();
  ctx.fill();
  // Dessus
  ctx.fillStyle = top;
  diamond(ctx, 0, yBase - h, w, d);
  ctx.fill();
}

function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function shadow(ctx: Ctx, rx = 20, ry = 10, alpha = 0.18): void {
  ctx.fillStyle = `rgba(20, 35, 30, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(0, 1, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/* ------------------------------------------------------------------ */
/* Décorations                                                         */
/* ------------------------------------------------------------------ */

export function drawTree(ctx: Ctx, seed: number, time: number): void {
  const v = ((seed * 2654435761) >>> 0) / 4294967296; // 0..1 stable
  const scale = 0.85 + v * 0.35;
  const sway = Math.sin(time * 1.2 + seed * 1.7) * 0.9;
  shadow(ctx, 14 * scale, 7 * scale);
  ctx.save();
  ctx.scale(scale, scale);
  // Tronc
  ctx.fillStyle = '#6e4a2f';
  ctx.fillRect(-2.5, -16, 5, 16);
  ctx.fillStyle = '#5a3b24';
  ctx.fillRect(0, -16, 2.5, 16);
  // Feuillage : trois disques superposés
  const g1 = v > 0.5 ? '#3f9e5a' : '#46a85f';
  const g2 = v > 0.5 ? '#54b86d' : '#5cc276';
  const g3 = '#7ad48d';
  ellipse(ctx, sway * 0.4 - 6, -22, 11, 10, g1);
  ellipse(ctx, sway * 0.7 + 6, -24, 11, 10, g2);
  ellipse(ctx, sway, -32, 12, 11, g3);
  // Petites lumières de feuillage
  ellipse(ctx, sway + 4, -36, 4, 3.4, 'rgba(255,255,255,0.22)');
  ctx.restore();
}

export function drawRock(ctx: Ctx, seed: number): void {
  const v = ((seed * 1597334677) >>> 0) / 4294967296;
  const s = 0.85 + v * 0.3;
  shadow(ctx, 15 * s, 7 * s);
  ctx.save();
  ctx.scale(s, s);
  // Gros bloc
  ctx.fillStyle = '#8d96a3';
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.lineTo(-9, -12);
  ctx.lineTo(2, -15);
  ctx.lineTo(12, -6);
  ctx.lineTo(13, 1);
  ctx.lineTo(0, 6);
  ctx.closePath();
  ctx.fill();
  // Facette claire
  ctx.fillStyle = '#aeb7c4';
  ctx.beginPath();
  ctx.moveTo(-9, -12);
  ctx.lineTo(2, -15);
  ctx.lineTo(6, -7);
  ctx.lineTo(-5, -4);
  ctx.closePath();
  ctx.fill();
  // Facette sombre
  ctx.fillStyle = '#717a87';
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(13, 1);
  ctx.lineTo(12, -6);
  ctx.lineTo(4, -3);
  ctx.closePath();
  ctx.fill();
  // Petit caillou
  ellipse(ctx, -13 + v * 6, 4, 4, 2.6, '#9aa3b0');
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Bâtiments                                                           */
/* ------------------------------------------------------------------ */

function drawWindow(ctx: Ctx, x: number, y: number, w: number, h: number, night: number): void {
  const lit = night > 0.35;
  if (lit) {
    ctx.save();
    ctx.shadowColor = 'rgba(255, 196, 90, 0.9)';
    ctx.shadowBlur = 7;
    ctx.fillStyle = '#ffce73';
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = '#3d5a73';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x, y, w, h / 3);
  }
}

function drawMaison(ctx: Ctx, night: number): void {
  shadow(ctx, 24, 12, 0.2);
  // Corps
  isoBox(ctx, 42, 21, 20, '#f3e6cf', '#cdb592', '#e2cfae');
  // Toit : deux pans depuis les bords du dessus vers une crête
  const topY = -20;
  const ridge = -34;
  ctx.fillStyle = '#d96f59'; // pan gauche (plus sombre)
  ctx.beginPath();
  ctx.moveTo(-23, topY);
  ctx.lineTo(0, topY + 11.5);
  ctx.lineTo(0, ridge + 9);
  ctx.lineTo(-12, ridge);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ef8a70'; // pan droit
  ctx.beginPath();
  ctx.moveTo(0, topY + 11.5);
  ctx.lineTo(23, topY);
  ctx.lineTo(12, ridge);
  ctx.lineTo(0, ridge + 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b65a48'; // pignon arrière
  ctx.beginPath();
  ctx.moveTo(-23, topY);
  ctx.lineTo(-12, ridge);
  ctx.lineTo(12, ridge);
  ctx.lineTo(23, topY);
  ctx.closePath();
  ctx.fill();
  // Porte (face droite)
  ctx.fillStyle = '#7a5233';
  ctx.fillRect(7, -12, 7, 11);
  // Fenêtres
  drawWindow(ctx, -16, -15, 7, 6, night);
  drawWindow(ctx, 15, -16, 5, 5, night);
}

function drawFerme(ctx: Ctx, time: number): void {
  // Champ : losange de terre avec rangées
  ctx.fillStyle = '#8a6a42';
  diamond(ctx, 0, 0, 56, 28);
  ctx.fill();
  ctx.strokeStyle = '#6f5434';
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(-22 + i * 5.5, i * 2.75 - 5.5);
    ctx.lineTo(5.5 * i + 11, 2.75 * i + 11 - 5.5);
    ctx.stroke();
  }
  // Pousses (petits épis qui ondulent)
  const sway = Math.sin(time * 1.6) * 0.7;
  ctx.fillStyle = '#e8c95e';
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 3; j++) {
      const wx = -14 + i * 7 + j * 3 + sway;
      const wy = -4 + j * 5 + i * 1.4 - 4;
      ctx.fillRect(wx, wy - 4, 1.6, 4.5);
    }
  }
  // Cabanon au fond
  ctx.save();
  ctx.translate(-13, -10);
  ctx.scale(0.55, 0.55);
  isoBox(ctx, 26, 13, 13, '#e7d8bd', '#bca581', '#d6c19c');
  ctx.fillStyle = '#c0654f';
  ctx.beginPath();
  ctx.moveTo(-14, -13);
  ctx.lineTo(0, -6);
  ctx.lineTo(14, -13);
  ctx.lineTo(0, -25);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawScierie(ctx: Ctx, time: number): void {
  shadow(ctx, 25, 12, 0.2);
  // Cabane en bois
  isoBox(ctx, 40, 20, 17, '#c89a6b', '#8e6a44', '#ab8255');
  // Toit plat incliné
  ctx.fillStyle = '#7a5a3a';
  ctx.beginPath();
  ctx.moveTo(-22, -17);
  ctx.lineTo(0, -6 - 17 + 11);
  ctx.lineTo(22, -17);
  ctx.lineTo(0, -28);
  ctx.closePath();
  ctx.fill();
  // Lame de scie circulaire (tourne doucement)
  ctx.save();
  ctx.translate(14, -9);
  ctx.rotate(time * 1.5);
  ctx.fillStyle = '#aab4bf';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r1 = 7.5;
    const r2 = 5.5;
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(Math.cos(a + 0.3) * r2, Math.sin(a + 0.3) * r2);
  }
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, 0, 0, 2.2, 2.2, '#5f6973');
  ctx.restore();
  // Pile de rondins devant
  ctx.save();
  ctx.translate(-12, 3);
  const logs: Array<[number, number]> = [
    [-5, 0],
    [1, 0],
    [-2, -4.5],
  ];
  for (const [lx, ly] of logs) {
    ctx.fillStyle = '#8a623c';
    ctx.fillRect(lx - 4, ly - 2.5, 9, 5);
    ellipse(ctx, lx + 5, ly, 2.6, 2.6, '#d9b083');
    ellipse(ctx, lx + 5, ly, 1.2, 1.2, '#a87c4f');
  }
  ctx.restore();
}

function drawMarche(ctx: Ctx): void {
  shadow(ctx, 25, 12, 0.2);
  // Étal
  isoBox(ctx, 40, 20, 12, '#d9c49c', '#a98c5e', '#c4a877');
  // Marchandises sur l'étal
  ellipse(ctx, -8, -15, 4, 3, '#e3593f'); // tomates
  ellipse(ctx, -1, -17, 4, 3, '#f0a830'); // oranges
  ellipse(ctx, 7, -15, 4, 3, '#74b35b'); // salades
  // Poteaux
  ctx.fillStyle = '#7a5a3a';
  ctx.fillRect(-19, -30, 2.5, 19);
  ctx.fillRect(16.5, -30, 2.5, 19);
  // Auvent rayé
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-24, -28);
  ctx.lineTo(0, -16);
  ctx.lineTo(24, -28);
  ctx.lineTo(0, -40);
  ctx.closePath();
  ctx.clip();
  for (let i = -4; i < 5; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#e25d4a' : '#f6efe2';
    ctx.beginPath();
    ctx.moveTo(i * 6 - 3, -44);
    ctx.lineTo(i * 6 + 3, -44);
    ctx.lineTo(i * 6 + 9, -12);
    ctx.lineTo(i * 6 + 3, -12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawPecherie(ctx: Ctx, time: number): void {
  // Ponton sur pilotis
  ctx.fillStyle = '#8a623c';
  ctx.fillRect(-2, -7, 3, 10);
  ctx.fillRect(10, -2, 3, 7);
  ctx.fillStyle = '#a87c4f';
  ctx.beginPath();
  ctx.moveTo(-8, -8);
  ctx.lineTo(18, 5);
  ctx.lineTo(24, 2);
  ctx.lineTo(-2, -11);
  ctx.closePath();
  ctx.fill();
  // Cabane
  ctx.save();
  ctx.translate(-8, -4);
  shadow(ctx, 18, 9, 0.18);
  isoBox(ctx, 30, 15, 14, '#7fb6c4', '#4f7f8d', '#679dab');
  ctx.fillStyle = '#3e6571';
  ctx.beginPath();
  ctx.moveTo(-17, -14);
  ctx.lineTo(0, -5.5);
  ctx.lineTo(17, -14);
  ctx.lineTo(0, -24);
  ctx.closePath();
  ctx.fill();
  // Bouée sur le mur
  ellipse(ctx, 8, -9, 3.6, 3.6, '#f0f0f0');
  ellipse(ctx, 8, -9, 2, 2, '#4f7f8d');
  ctx.restore();
  // Canne à pêche + flotteur qui tangue
  const bob = Math.sin(time * 2.1) * 1.2;
  ctx.strokeStyle = '#5a3b24';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(16, -6);
  ctx.lineTo(26, -16);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(26, -16);
  ctx.lineTo(28, 4 + bob);
  ctx.stroke();
  ellipse(ctx, 28, 5 + bob, 2, 2, '#e25d4a');
}

function drawFontaine(ctx: Ctx, time: number): void {
  shadow(ctx, 22, 11, 0.16);
  // Bassin
  ellipse(ctx, 0, -2, 21, 10.5, '#b9c2cc');
  ellipse(ctx, 0, -4, 21, 10.5, '#dde3e9');
  ellipse(ctx, 0, -4, 16, 8, '#56b8d8');
  ellipse(ctx, 0, -4.6, 14, 6.8, '#7fd0e8');
  // Colonne centrale
  ctx.fillStyle = '#cfd6dd';
  ctx.fillRect(-2.5, -20, 5, 15);
  ellipse(ctx, 0, -20, 4.5, 2.4, '#e8edf2');
  // Jet d'eau animé
  const h = 8 + Math.sin(time * 3) * 2;
  ctx.strokeStyle = 'rgba(190, 235, 250, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.quadraticCurveTo(-5, -20 - h, -9, -8);
  ctx.moveTo(0, -20);
  ctx.quadraticCurveTo(5, -20 - h, 9, -8);
  ctx.moveTo(0, -20);
  ctx.lineTo(0, -20 - h);
  ctx.stroke();
  // Gouttes scintillantes
  const tw = (Math.sin(time * 5) + 1) / 2;
  ellipse(ctx, -7, -10 - tw * 3, 1.2, 1.2, 'rgba(255,255,255,0.85)');
  ellipse(ctx, 7, -12 - (1 - tw) * 3, 1.2, 1.2, 'rgba(255,255,255,0.85)');
}

export function drawBuilding(
  ctx: Ctx,
  id: BuildingId,
  time: number,
  night: number,
): void {
  switch (id) {
    case 'maison':
      drawMaison(ctx, night);
      break;
    case 'ferme':
      drawFerme(ctx, time);
      break;
    case 'scierie':
      drawScierie(ctx, time);
      break;
    case 'marche':
      drawMarche(ctx);
      break;
    case 'pecherie':
      drawPecherie(ctx, time);
      break;
    case 'fontaine':
      drawFontaine(ctx, time);
      break;
  }
}

/* ------------------------------------------------------------------ */
/* Bulle « production prête »                                          */
/* ------------------------------------------------------------------ */

export function drawReadyBubble(ctx: Ctx, icon: string, time: number, seed: number): void {
  const bob = Math.sin(time * 2.4 + seed) * 2.5;
  const y = -52 + bob;
  ctx.save();
  // Bulle
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeStyle = 'rgba(40, 60, 80, 0.25)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Pointe
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.moveTo(-4, y + 9);
  ctx.lineTo(4, y + 9);
  ctx.lineTo(0, y + 16);
  ctx.closePath();
  ctx.fill();
  // Icône
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, 0, y + 1);
  ctx.restore();
}
