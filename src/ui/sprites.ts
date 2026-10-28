// Graphismes provisoires dessines en formes simples (a remplacer par Spine). Chaque forme est centree en (0,0), regard vers le bas.
import { Graphics } from 'pixi.js';

function mix(hex: number, f: number): number {
  const r = Math.max(0, Math.min(255, Math.round(((hex >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((hex >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((hex & 255) * f)));
  return (r << 16) | (g << 8) | b;
}
export const hex = (s: string): number => parseInt(s.replace('#', ''), 16);
export const fonce = (c: number, f = 0.55): number => mix(c, f);
export const clair = (c: number, f = 1.35): number => mix(c, f);

function yeux(g: Graphics, x: number, y: number, ecart: number, r = 3.2): void {
  g.circle(x - ecart, y, r).fill(0xffffff).circle(x + ecart, y, r).fill(0xffffff);
  g.circle(x - ecart, y + 0.8, r * 0.5).fill(0x101820).circle(x + ecart, y + 0.8, r * 0.5).fill(0x101820);
}

/** Dessine une creature de la forme donnee dans g (taille de base ~60 px de large). */
export function dessinerCreature(g: Graphics, forme: string, couleur: number): void {
  const bord = fonce(couleur);
  const clr = clair(couleur);
  g.clear();
  switch (forme) {
    case 'poisson':
      g.poly([-18, -4, -34, -16, -34, 16, -18, 4]).fill(bord);
      g.ellipse(0, 0, 24, 15).fill(couleur).stroke({ width: 2, color: bord });
      g.ellipse(2, 4, 16, 6).fill(clr);
      g.poly([-6, -14, 6, -24, 12, -13]).fill(bord);
      yeux(g, 14, -3, 0, 3);
      break;
    case 'poisson_long':
      g.poly([-34, 0, -52, -14, -52, 14]).fill(bord);
      g.ellipse(0, 0, 38, 14).fill(couleur).stroke({ width: 2, color: bord });
      g.ellipse(4, 5, 28, 5).fill(clr);
      g.poly([-12, -13, 4, -25, 12, -13]).fill(bord);
      g.poly([30, -2, 46, 0, 30, 4]).fill(0xffffff);
      yeux(g, 22, -4, 0, 3);
      break;
    case 'anguille': {
      const pts = [-44, 8, -30, -6, -14, 8, 2, -6, 18, 8, 34, -2];
      for (let i = 0; i < pts.length; i += 2) g.circle(pts[i], pts[i + 1], 11 - i * 0.35).fill(i % 4 ? couleur : clr).stroke({ width: 1.5, color: bord });
      g.circle(38, 0, 13).fill(couleur).stroke({ width: 2, color: bord });
      yeux(g, 38, -3, 5, 2.8);
      g.poly([46, 4, 56, 6, 46, 10]).fill(0xffffff);
      break;
    }
    case 'blob':
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        g.poly([Math.cos(a - 0.2) * 26, Math.sin(a - 0.2) * 24, Math.cos(a) * 38, Math.sin(a) * 34, Math.cos(a + 0.2) * 26, Math.sin(a + 0.2) * 24]).fill(bord);
      }
      g.circle(0, 0, 28).fill(couleur).stroke({ width: 2, color: bord });
      g.circle(-8, 8, 8).fill(clr);
      yeux(g, 0, -6, 9, 4.2);
      g.roundRect(-10, 8, 20, 6, 3).fill(bord);
      break;
    case 'meduse':
      for (let i = -3; i <= 3; i++) g.moveTo(i * 8, 4).bezierCurveTo(i * 8 + 6, 16, i * 8 - 6, 26, i * 8, 38).stroke({ width: 3, color: clr });
      g.arc(0, 4, 34, Math.PI, 0).fill(couleur).stroke({ width: 2, color: bord });
      g.arc(0, 4, 20, Math.PI, 0).fill({ color: clr, alpha: 0.6 });
      yeux(g, 0, -8, 9, 3.4);
      break;
    case 'crabe':
      g.circle(-30, -14, 11).fill(couleur).stroke({ width: 2, color: bord }).circle(30, -14, 11).fill(couleur).stroke({ width: 2, color: bord });
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) g.moveTo(s * 18, 8 + i * 5).lineTo(s * (34 + i * 3), 14 + i * 9).stroke({ width: 3, color: bord });
      g.ellipse(0, 4, 28, 20).fill(couleur).stroke({ width: 2.5, color: bord });
      g.ellipse(0, 10, 20, 8).fill(clr);
      yeux(g, 0, -10, 8, 3.4);
      break;
    case 'raie':
      g.poly([0, 16, -46, -8, -30, 12, 0, 22, 30, 12, 46, -8]).fill(couleur).stroke({ width: 2, color: bord });
      g.poly([0, 0, -28, -2, 0, 16, 28, -2]).fill(clr);
      g.moveTo(0, 22).lineTo(0, 54).stroke({ width: 4, color: bord });
      yeux(g, 0, -2, 10, 3);
      break;
    case 'crevette':
      for (let i = 0; i < 5; i++) g.circle(-22 + i * 11, 6 - Math.sin(i * 0.9) * 10, 11 - i * 0.6).fill(i % 2 ? couleur : clr).stroke({ width: 1.5, color: bord });
      g.poly([-34, 14, -48, 24, -30, 20]).fill(bord);
      g.circle(28, -6, 12).fill(couleur).stroke({ width: 2, color: bord });
      g.roundRect(26, -4, 24, 14, 6).fill(clr).stroke({ width: 2, color: bord });
      yeux(g, 28, -10, 5, 2.6);
      break;
    case 'requin':
      g.poly([-52, 0, -70, -22, -62, 0, -70, 22]).fill(bord);
      g.poly([-8, -22, 8, -52, 22, -22]).fill(bord);
      g.ellipse(0, 0, 58, 24).fill(couleur).stroke({ width: 2.5, color: bord });
      g.ellipse(6, 9, 44, 11).fill(0xeaf4f6);
      g.poly([30, 6, 38, 14, 42, 6, 50, 14, 52, 4]).fill(0xffffff);
      yeux(g, 34, -8, 0, 3.6);
      break;
    case 'croco':
      g.poly([-70, 0, -50, -10, -50, 10]).fill(bord);
      g.roundRect(-52, -14, 82, 28, 12).fill(couleur).stroke({ width: 2.5, color: bord });
      g.roundRect(28, -8, 40, 18, 6).fill(clr).stroke({ width: 2, color: bord });
      for (let i = 0; i < 5; i++) g.poly([-40 + i * 16, -14, -34 + i * 16, -22, -28 + i * 16, -14]).fill(bord);
      for (let i = 0; i < 4; i++) g.poly([34 + i * 8, 10, 38 + i * 8, 15, 42 + i * 8, 10]).fill(0xffffff);
      yeux(g, 22, -10, 0, 3.4);
      break;
    default:
      g.circle(0, 0, 24).fill(couleur).stroke({ width: 2, color: bord });
      yeux(g, 0, -4, 8);
  }
}

/** Silhouette plate (pour le Sonar) : memes formes, une seule couleur. */
export function dessinerSilhouette(g: Graphics, forme: string, couleur: number): void {
  dessinerCreature(g, forme, couleur);
}

export function dessinerHeros(g: Graphics, couleur: number): void {
  g.clear();
  // bouteilles
  g.roundRect(-20, -6, 10, 26, 4).fill(0x9aa7b0).roundRect(10, -6, 10, 26, 4).fill(0x9aa7b0);
  // corps
  g.roundRect(-15, -4, 30, 34, 9).fill(couleur).stroke({ width: 2.5, color: fonce(couleur) });
  g.roundRect(-15, 14, 30, 6, 2).fill(fonce(couleur, 0.7));
  // bras
  g.roundRect(-24, 2, 10, 20, 5).fill(couleur).roundRect(14, 2, 10, 20, 5).fill(couleur);
  // casque
  g.circle(0, -18, 15).fill(0xd8e3ea).stroke({ width: 2.5, color: 0x6c8190 });
  g.circle(0, -18, 10.5).fill(0x2b6e98);
  g.ellipse(-3, -21, 4, 3).fill({ color: 0xffffff, alpha: 0.6 });
  // harpon
  g.moveTo(26, -10).lineTo(26, 40).stroke({ width: 3, color: 0x8a6a45 });
  g.poly([26, -22, 21, -8, 31, -8]).fill(0xd0d8dd);
  // palmes
  g.poly([-14, 30, -26, 46, -4, 46]).fill(fonce(couleur)).poly([14, 30, 4, 46, 26, 46]).fill(fonce(couleur));
}

export function dessinerMonture(g: Graphics): void {
  g.clear();
  g.ellipse(0, 6, 46, 14).fill(0x3fb08f).stroke({ width: 2, color: 0x1c6b57 });
  g.poly([36, 4, 52, -10, 54, 8]).fill(0x3fb08f);
  g.circle(46, -10, 7).fill(0x3fb08f).stroke({ width: 2, color: 0x1c6b57 });
  g.poly([-44, 6, -60, -4, -56, 18]).fill(0x2a8a70);
  g.circle(49, -12, 1.8).fill(0x101820);
}

export function dessinerPet(g: Graphics, couleur: number, type: number): void {
  g.clear();
  if (type === 0) {
    // etoile
    const pts: number[] = [];
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 6 : 15; const a = -Math.PI / 2 + (i * Math.PI) / 5; pts.push(Math.cos(a) * r, Math.sin(a) * r); }
    g.poly(pts).fill(couleur).stroke({ width: 2, color: fonce(couleur) });
  } else if (type === 1) {
    g.circle(0, -2, 12).fill(couleur).stroke({ width: 2, color: fonce(couleur) });
    for (let i = -2; i <= 2; i++) g.moveTo(i * 4.5, 8).lineTo(i * 5.5, 18).stroke({ width: 3, color: couleur });
    g.circle(-4, -3, 2.2).fill(0xffffff).circle(4, -3, 2.2).fill(0xffffff);
  } else {
    g.ellipse(0, 0, 14, 9).fill(couleur).stroke({ width: 2, color: fonce(couleur) });
    g.poly([-12, 0, -20, -7, -20, 7]).fill(fonce(couleur));
    g.moveTo(4, -9).lineTo(8, -17).stroke({ width: 2, color: 0xfff2a0 });
    g.circle(8, -18, 3.5).fill(0xfff2a0);
    g.circle(7, -1, 2).fill(0x101820);
  }
}

export function dessinerGardien(g: Graphics, couleur: number): void {
  g.clear();
  g.circle(0, 0, 17).fill({ color: couleur, alpha: 0.28 });
  g.circle(0, 0, 11).fill({ color: couleur, alpha: 0.9 }).stroke({ width: 2, color: 0xffffff });
  g.circle(-4, -2, 2).fill(0x101820).circle(4, -2, 2).fill(0x101820);
  g.poly([0, -11, -4, -19, 4, -19]).fill(0xffffff);
}
