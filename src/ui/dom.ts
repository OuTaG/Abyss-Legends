// Petits utilitaires DOM pour les ecrans par-dessus le canvas (menus, cartes, HUD).
import { ELEMENT_ABBR, ELEMENT_COULEUR } from '../core/elements';
import type { Element } from '../core/types';

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = '', attrs: Record<string, string> = {}): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

export const badgeElement = (el: Element | null | string): string =>
  el
    ? `<span class="elem" style="background:${ELEMENT_COULEUR[el as Element]}">${ELEMENT_ABBR[el as Element]}</span>`
    : '<span class="elem" style="background:#b8c4cc">NEU</span>';

export const esc = (s: string): string => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

export function legendeElements(fortContre: Record<string, string>): string {
  const ordre = ['Courant', 'Encre', 'Lumen', 'Pression', 'Corail'];
  return `<div class="legende">${ordre.map((e) => `${badgeElement(e)}<span class="fl">&gt;</span>`).join('')}${badgeElement('Courant')}</div>
  <div class="petit-texte" style="text-align:center;margin-top:3px">Chaque élément bat le suivant (x1,2) et subit l'autre sens (x0,85) : ${ordre.map((e) => `${e} bat ${fortContre[e]}`).join(', ')}.</div>`;
}
