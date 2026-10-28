// Grands nombres : mantisse + exposant (break_infinity.js). Toute valeur de stats/dégâts/puissance passe par Decimal.
import Decimal from 'break_infinity.js';

export { Decimal };
export type Num = Decimal;

export const D = (v: number | string | Decimal): Decimal => new Decimal(v);
export const ZERO = D(0);

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

/** Format court pour mobile : 1 234 -> 1.23K, 4.5e12 -> 4.50T, au-delà de 1e36 -> 1.23e45. */
export function fmt(v: number | Decimal, digits = 2): string {
  const d = v instanceof Decimal ? v : new Decimal(v);
  if (d.lt(0)) return '-' + fmt(d.neg(), digits);
  if (d.lt(1000)) {
    const n = d.toNumber();
    if (n >= 100 || Number.isInteger(n)) return Math.round(n).toString();
    return n.toFixed(n >= 10 ? 1 : digits);
  }
  const e = Math.floor(d.log10());
  const idx = Math.floor(e / 3);
  if (idx < SUFFIXES.length) {
    const m = d.div(Decimal.pow10(idx * 3)).toNumber();
    return m.toFixed(m >= 100 ? 0 : m >= 10 ? 1 : digits) + SUFFIXES[idx];
  }
  const m = d.div(Decimal.pow10(e)).toNumber();
  return m.toFixed(digits) + 'e' + e;
}

export const toSave = (d: Decimal): string => d.toString();
export const fromSave = (s: string | number | undefined, fallback = 0): Decimal =>
  s === undefined ? new Decimal(fallback) : new Decimal(s);
