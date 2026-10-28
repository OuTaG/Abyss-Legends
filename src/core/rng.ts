// Générateur pseudo-aléatoire déterministe (mulberry32) : même graine = même Sonar, même combat.
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  /** Dérive un générateur indépendant (ex. une étape du Sonar) à partir d'une graine et d'une clé. */
  static derive(seed: number, ...keys: number[]): Rng {
    let h = (seed ^ 0x9e3779b9) >>> 0;
    for (const k of keys) {
      h = Math.imul(h ^ (k + 0x7f4a7c15), 0x85ebca6b) >>> 0;
      h ^= h >>> 13;
      h = Math.imul(h, 0xc2b2ae35) >>> 0;
      h ^= h >>> 16;
    }
    return new Rng(h);
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** Entier dans [min, max] inclus. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  /** Tirage pondéré : renvoie l'index. */
  weighted(weights: readonly number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return 0;
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return weights.length - 1;
  }
  shuffle<T>(arr: readonly T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
