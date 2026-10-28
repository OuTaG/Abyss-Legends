import { Container, Graphics } from 'pixi.js';
import { hex } from './sprites';

function lerp(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

/** Fond marin a la palette du monde : degrade, rayons de lumiere, bulles qui montent, fond sableux. */
export class Ocean extends Container {
  private bulles: { g: Graphics; vx: number; vy: number; ph: number }[] = [];
  private rayons = new Graphics();
  private t = 0;
  constructor(public W = 390, public H = 844) {
    super();
    this.addChild(new Graphics(), this.rayons);
    for (let i = 0; i < 22; i++) {
      const g = new Graphics();
      const r = 2 + Math.random() * 5;
      g.circle(0, 0, r).stroke({ width: 1.2, color: 0xcff6ff, alpha: 0.5 });
      g.position.set(Math.random() * W, Math.random() * H);
      this.addChild(g);
      this.bulles.push({ g, vx: (Math.random() - 0.5) * 6, vy: -(10 + Math.random() * 25), ph: Math.random() * 6 });
    }
  }
  appliquer(palette: { fondHaut: string; fondBas: string; rayons: string }, sol = true): void {
    const bg = this.children[0] as Graphics;
    bg.clear();
    const n = 42, h = this.H / n;
    for (let i = 0; i < n; i++) bg.rect(0, i * h, this.W, h + 1).fill(lerp(hex(palette.fondHaut), hex(palette.fondBas), i / (n - 1)));
    if (sol) {
      bg.poly([0, this.H, 0, this.H - 60, 70, this.H - 76, 160, this.H - 52, 260, this.H - 80, 340, this.H - 58, this.W, this.H - 70, this.W, this.H]).fill({ color: 0x0b1f2e, alpha: 0.85 });
      bg.ellipse(40, this.H - 52, 26, 14).fill({ color: 0x1b4a52, alpha: 0.9 }).ellipse(330, this.H - 56, 30, 16).fill({ color: 0x1b4a52, alpha: 0.9 });
    }
    this.rayons.clear();
    const c = hex(palette.rayons);
    for (const [x, w, a] of [[60, 70, 0.07], [170, 90, 0.05], [300, 60, 0.08]] as number[][]) {
      this.rayons.poly([x, 0, x + w, 0, x + w * 2.4 - 40, this.H * 0.8, x - 60, this.H * 0.8]).fill({ color: c, alpha: a });
    }
  }
  tick(dt: number): void {
    this.t += dt;
    for (const b of this.bulles) {
      b.g.y += b.vy * dt;
      b.g.x += (b.vx + Math.sin(this.t * 1.5 + b.ph) * 8) * dt;
      if (b.g.y < -10) { b.g.y = this.H + 10; b.g.x = Math.random() * this.W; }
    }
    this.rayons.alpha = 0.75 + Math.sin(this.t * 0.6) * 0.25;
  }
}
