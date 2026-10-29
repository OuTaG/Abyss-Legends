// Ecran principal et navigation (GDD 13). Barre du bas, de gauche a droite : Boutique, Heros, Recif, Evenements, Pets.
// Le Recif est l'ecran par defaut : choix libre du niveau, record du niveau (affiche UNIQUEMENT ici), bouton de combat.
// L'onglet Heros regroupe heros, talents, perles, gardiens, equipement et montures.
import type { GameData } from '../data/build';
import { Difficulty, niveauInfo, niveauMax } from '../core/difficulty';
import { fmt, fromSave } from '../core/num';
import { QUALITES_CLES, energieActuelle, progres, secondesAvantPoint, type Profil } from '../core/profile';
import { badgeElement, esc, h, legendeElements } from './dom';
import { ICONES } from './icones';
import { COULEUR_RARETE, RARETES, iconeObjet, type RareteObjet } from './theme';
import { LANGUES, t } from '../i18n';

export type Onglet = 'boutique' | 'heros' | 'recif' | 'evenements' | 'pets';
export const ONGLETS: Onglet[] = ['boutique', 'heros', 'recif', 'evenements', 'pets'];
export type SousOngletHeros = 'heros' | 'talents' | 'perles' | 'gardiens' | 'equipement' | 'montures';
export const SOUS_ONGLETS_HEROS: SousOngletHeros[] = ['heros', 'talents', 'perles', 'gardiens', 'equipement', 'montures'];

export interface CtxMenu {
  data: GameData;
  diff: Difficulty;
  profil: () => Profil;
  save: () => void;
  maintenant: () => number;
  lancerPartie: () => void;
  rafraichir: () => void;
  ouvrirReglages: () => void;
}

let onglet: Onglet = 'recif';
let sousOnglet: SousOngletHeros = 'heros';
export const ongletCourant = (): Onglet => onglet;

/** Energie au format « 45/60 » (courant / plafond de regeneration ; peut depasser le plafond). */
export const texteEnergie = (courant: number, max: number): string => `${courant}/${max}`;

export function construireMenu(ctx: CtxMenu): HTMLElement {
  const { data } = ctx;
  const p = ctx.profil();
  const nrj = energieActuelle(p, data, ctx.maintenant());
  const root = h('div', 'ecran-principal' + (onglet === 'recif' ? ' transparent' : ''));

  // ---- barre du haut : portrait, ressources, energie, reglages
  const haut = h('div', 'barre-haut');
  haut.innerHTML = `
    <button class="portrait" data-onglet="heros" aria-label="${t('nav.heros')}">${ICONES.heros}</button>
    <div class="ressource"><i>${ICONES.or}</i><b>${fmt(fromSave(p.ressources.or))}</b></div>
    <div class="ressource"><i>${ICONES.gemmes}</i><b>${p.ressources.gemmes}</b></div>
    <div class="ressource energie" title="${t('menu.energie_aide')}"><i>${ICONES.energie}</i><b id="energie">${texteEnergie(nrj, data.energie.plafond_regeneration)}</b></div>
    <button class="rond" id="reglages" aria-label="${t('reglages.titre')}">${ICONES.reglages}</button>`;
  root.appendChild(haut);
  (haut.querySelector('#reglages') as HTMLElement).onclick = () => ctx.ouvrirReglages();
  (haut.querySelector('.portrait') as HTMLElement).onclick = () => { onglet = 'heros'; ctx.rafraichir(); };

  const contenu = h('div', 'contenu-onglet onglet-' + onglet);
  if (onglet === 'recif') contenu.appendChild(ongletRecif(ctx, nrj));
  else if (onglet === 'heros') contenu.appendChild(ongletHeros(ctx));
  else if (onglet === 'boutique') contenu.appendChild(ongletBoutique(ctx));
  else if (onglet === 'evenements') contenu.appendChild(ongletEvenements());
  else contenu.appendChild(ongletPets(ctx));
  root.appendChild(contenu);

  // ---- navigation du bas
  const nav = h('nav', 'nav-bas');
  for (const o of ONGLETS) {
    const b = h('button', 'nav-btn' + (o === onglet ? ' actif' : ''), `<i>${ICONES[o]}</i><span>${t('nav.' + o)}</span>`, { 'data-onglet': o });
    b.onclick = () => { onglet = o; ctx.rafraichir(); };
    nav.appendChild(b);
  }
  root.appendChild(nav);
  return root;
}

function ongletRecif(ctx: CtxMenu, nrj: number): HTMLElement {
  const { data, diff } = ctx;
  const p = ctx.profil();
  const niveau = p.parametres.niveau;
  const info = niveauInfo(data, niveau);
  const pr = progres(p, niveau);
  const cout = data.energie.cout_tentative;
  const sec = secondesAvantPoint(p, data, ctx.maintenant());
  const c = h('div', 'recif');
  const record = pr.termine ? t('menu.record_termine') : pr.record ? t('menu.record_choix', { n: pr.record }) : t('menu.record_aucun');
  c.innerHTML = `
    <div class="raccourcis gauche"><button class="raccourci" disabled>${ICONES.coffre}<span>${t('menu.recolter')}</span></button></div>
    <div class="bloc-bas">
      <div class="cadre record">
        <i>${ICONES.couronne}</i>
        <div><div class="sur-titre">${t('menu.record_titre')}</div>
        <div class="titre-serif" id="record">${t('menu.niveau_n', { n: niveau })} · ${record}</div></div>
        <div class="mini-barre"><i style="width:${pr.termine ? 100 : (pr.record / 30) * 100}%"></i></div>
      </div>
      <div class="niv-select">
        <button class="cadre fleche" id="prev" aria-label="-">${ICONES.gauche}</button>
        <div class="cadre centre">
          <div class="titre-serif">${esc(info.monde.nom).toUpperCase()}</div>
          <div class="petit-texte">${t('menu.niveau_sur', { n: niveau, max: niveauMax(data) })} · ${t('menu.choisi_librement')}</div>
          <div class="petit-texte">${t('menu.boss')} : <b>${esc(info.boss.nom)}</b> ${badgeElement(info.boss.element)} · ${t('menu.puissance')} ${fmt(diff.puissance(niveau))}</div>
        </div>
        <button class="cadre fleche" id="next" aria-label="+">${ICONES.droite}</button>
      </div>
      <button class="btn-principal" id="go" ${nrj >= cout ? '' : 'disabled'}>
        <span class="titre-serif">${nrj >= cout ? t('menu.combattre') : t('menu.plus_energie')}</span>
        <small>${ICONES.energie} −${cout} ${t('menu.energie')}${sec ? ' · ' + t('menu.prochain_point', { m: Math.floor(sec / 60), s: sec % 60 }) : ''}</small>
      </button>
    </div>`;
  const changer = (d: number) => {
    p.parametres.niveau = Math.min(niveauMax(data), Math.max(1, p.parametres.niveau + d));
    ctx.save();
    ctx.rafraichir();
  };
  (c.querySelector('#prev') as HTMLElement).onclick = () => changer(-1);
  (c.querySelector('#next') as HTMLElement).onclick = () => changer(1);
  (c.querySelector('#go') as HTMLElement).onclick = () => ctx.lancerPartie();
  return c;
}

function panneau(titre: string, html: string): HTMLElement {
  const d = h('div', 'panneau');
  d.innerHTML = `<h3>${titre}</h3>${html}`;
  return d;
}
const bientot = (cle: string) => `<div class="placeholder">${t(cle)}<div class="petit-texte">${t('commun.bientot')}</div></div>`;

function ongletHeros(ctx: CtxMenu): HTMLElement {
  const { data } = ctx;
  const p = ctx.profil();
  const hc = data.herosContent;
  const c = h('div', 'page');
  c.appendChild(h('h2', 'titre-page', t('nav.heros')));
  const sous = h('div', 'sous-nav');
  for (const s of SOUS_ONGLETS_HEROS) {
    const b = h('button', 'chip-nav' + (s === sousOnglet ? ' actif' : ''), t('heros.onglet.' + s), { 'data-sous': s });
    b.onclick = () => { sousOnglet = s; ctx.rafraichir(); };
    sous.appendChild(b);
  }
  c.appendChild(sous);
  if (sousOnglet === 'heros') {
    const liste = h('div', 'liste-heros');
    for (const x of data.heros.heros) {
      const actif = x.nom === p.parametres.heroId;
      const rar: RareteObjet = x.nom.startsWith('Legendaire') ? 'legendaire' : x.nom.startsWith('Epique') ? 'epique' : 'commun';
      const b = h('button', 'carte-heros' + (actif ? ' actif' : ''), `${iconeObjet(rar, null, ICONES.heros)}<div><b>${esc(hc.affichage[x.nom] ?? x.nom)}</b><div class="petit-texte">${badgeElement(x.element)} ${x.element ?? t('commun.neutre')}</div></div>${actif ? `<span class="tag-actif">${t('heros.actif')}</span>` : ''}`);
      b.onclick = () => { p.parametres.heroId = x.nom; ctx.save(); ctx.rafraichir(); };
      liste.appendChild(b);
    }
    c.appendChild(panneau(t('heros.choisir'), ''));
    c.lastElementChild!.appendChild(liste);
    c.appendChild(panneau(t('heros.equipe'), `<div class="grille2">
      <div>${t('heros.onglet.montures')}</div><div>${esc(hc.monture.nom)}</div>
      <div>${t('nav.pets')}</div><div>${hc.pets.map((x) => `${esc(x.nom)} ${badgeElement(x.element)}`).join('<br>')}</div>
      <div>${t('heros.onglet.gardiens')}</div><div>${hc.gardiens.map((x) => `${esc(x.nom)} ${badgeElement(x.element)}`).join('<br>')}</div>
      <div>${t('heros.assistants')}</div><div>${hc.assistants.map((a) => `${esc(hc.affichage[a.hero] ?? a.hero)} · ${t('heros.tous_les', { n: a.intervalle_tours })}`).join('<br>')}</div></div>`));
  } else if (sousOnglet === 'equipement') {
    const slots = ['arme', 'casque', 'armure', 'palmes', 'montre', 'bouteilles'];
    c.appendChild(panneau(t('heros.onglet.equipement'), `<div class="grille-slots">${slots.map((s) => `<div class="slot">${iconeObjet('commun', null, s === 'arme' ? ICONES.arme : '')}<span>${t('equipement.' + s)}</span></div>`).join('')}</div>
      <div class="petit-texte">${t('equipement.visibles')}</div>`));
    c.appendChild(panneau(t('raretes.titre'), `<div class="grille-raretes">${RARETES.map((r) => `<div class="slot">${iconeObjet(r, null, ICONES.arme, t('raretes.' + r))}<span style="color:${COULEUR_RARETE[r]}">${t('raretes.' + r)}</span></div>`).join('')}
      <div class="slot">${iconeObjet('mythique', 'S', ICONES.arme)}<span>${t('raretes.rang_s')}</span></div>
      <div class="slot">${iconeObjet('mythique', 'SS', ICONES.arme)}<span>${t('raretes.rang_ss')}</span></div></div>`));
  } else if (sousOnglet === 'gardiens') {
    c.appendChild(panneau(t('heros.onglet.gardiens'), hc.gardiens.map((x) => `<div class="ligne-item">${iconeObjet('rare', null, '')}<div><b>${esc(x.nom)}</b> ${badgeElement(x.element)}<div class="petit-texte">${t('gardiens.intouchables')}</div></div></div>`).join('') + bientot('gardiens.progression')));
  } else if (sousOnglet === 'montures') {
    c.appendChild(panneau(t('heros.onglet.montures'), `<div class="ligne-item">${iconeObjet('original', null, '')}<div><b>${esc(hc.monture.nom)}</b> ${badgeElement(hc.monture.element)}<div class="petit-texte">${t('montures.touchable')}</div></div></div>` + bientot('montures.expeditions')));
  } else if (sousOnglet === 'perles') {
    c.appendChild(panneau(t('heros.onglet.perles'), `<div class="grille-raretes">${RARETES.slice(0, 5).map((r) => `<div class="slot">${iconeObjet(r, null, '')}<span>${t('raretes.' + r)}</span></div>`).join('')}</div>` + bientot('perles.description')));
  } else {
    c.appendChild(panneau(t('heros.onglet.talents'), bientot('talents.description')));
  }
  return c;
}

function ongletBoutique(ctx: CtxMenu): HTMLElement {
  const p = ctx.profil();
  const info = niveauInfo(ctx.data, p.parametres.niveau);
  const r = p.ressources;
  const c = h('div', 'page');
  c.appendChild(h('h2', 'titre-page', t('nav.boutique')));
  c.appendChild(panneau(t('boutique.offres'), bientot('boutique.description')));
  c.appendChild(panneau(t('boutique.inventaire'), `
    <div>${QUALITES_CLES.map((q) => `<span class="cle ${q}">${t('cles.' + q)} ×${p.cles[q]}</span>`).join('')}</div>
    <div class="grille2" style="margin-top:6px">
      <div>${t('ressources.or')}</div><div>${fmt(fromSave(r.or))}</div><div>${t('ressources.gemmes')}</div><div>${r.gemmes}</div>
      <div>${t('ressources.xp_heros')}</div><div>${fmt(fromSave(r.xpHeros))}</div><div>${t('ressources.nourriture')}</div><div>${fmt(fromSave(r.nourriture))}</div>
      <div>${t('ressources.permanente')}</div><div>${fmt(fromSave(r.ressourcePermanente))}</div>
      <div>${t('ressources.monde', { n: info.monde.id })}</div><div>${fmt(fromSave(r.ressourceMonde[String(info.monde.id)]))}</div></div>
    <div class="petit-texte" style="margin-top:4px">${t('boutique.cles_aide')}</div>`));
  return c;
}

function ongletEvenements(): HTMLElement {
  const c = h('div', 'page');
  c.appendChild(h('h2', 'titre-page', t('nav.evenements')));
  const items = ['maree_haute', 'tirage_abysses', 'tournoi_elements', 'fosse', 'defis', 'arene', 'expedition'];
  c.appendChild(panneau(t('evenements.titre'), items.map((k) => `<div class="ligne-item">${ICONES.evenements}<div><b>${t('evenements.' + k)}</b><div class="petit-texte">${t('commun.bientot')}</div></div></div>`).join('')));
  return c;
}

function ongletPets(ctx: CtxMenu): HTMLElement {
  const hc = ctx.data.herosContent;
  const c = h('div', 'page');
  c.appendChild(h('h2', 'titre-page', t('nav.pets')));
  c.appendChild(panneau(t('pets.actifs'), hc.pets.map((x) => `<div class="ligne-item">${iconeObjet('rare', null, ICONES.pets)}<div><b>${esc(x.nom)}</b> ${badgeElement(x.element)}<div class="petit-texte">${t('pets.intouchables')}</div></div></div>`).join('') + bientot('pets.oeufs')));
  return c;
}

/** Contenu de la fenetre de reglages (langue, options de test, sauvegarde). */
export function construireReglages(ctx: CtxMenu & { exporter: () => string; importer: (s: string) => boolean; effacer: () => void; changerLangue: (c: string) => void; fermer: () => void }): HTMLElement {
  const { data } = ctx;
  const p = ctx.profil();
  const m = h('div', 'modal reglages');
  const ratio = (data.prov.puissance_joueur.ratios as Record<string, number>)[p.parametres.preset] ?? 1;
  m.innerHTML = `<h2>${t('reglages.titre')}</h2>
  <div class="panneau">
    <label class="opt">${t('reglages.langue')}
      <select id="langue"><option value="auto" ${p.parametres.langue === 'auto' ? 'selected' : ''}>${t('reglages.langue_auto')}</option>${LANGUES.map((l) => `<option value="${l.code}" ${l.code === p.parametres.langue ? 'selected' : ''}>${l.nom}</option>`).join('')}</select></label>
    <div class="test-langues"><span lang="ja">日本語</span> <span lang="ko">한국어</span> <span lang="zh-Hant">繁體中文</span></div>
  </div>
  <div class="panneau">
    <h3>${t('reglages.test')}</h3>
    <label class="opt">${t('reglages.abonnement')} <input type="checkbox" id="abo" ${p.parametres.abonne ? 'checked' : ''}></label>
    <label class="opt">${t('reglages.puissance')}
      <select id="preset">${Object.entries(data.prov.puissance_joueur.ratios).map(([k, v]) => `<option value="${k}" ${k === p.parametres.preset ? 'selected' : ''}>${k} (×${v})</option>`).join('')}</select></label>
    <div class="petit-texte">${t('reglages.puissance_effective', { r: ratio })}</div>
    <div class="ligne" style="margin-top:8px;flex-wrap:wrap"><button class="btn petit sec" id="nrj">${t('reglages.recharger')}</button>
    <button class="btn petit sec" id="exp">${t('reglages.exporter')}</button><button class="btn petit sec" id="imp">${t('reglages.importer')}</button><button class="btn petit sec" id="raz">${t('reglages.effacer')}</button></div>
    <textarea id="txt" placeholder="${t('reglages.zone_sauvegarde')}" style="display:none;margin-top:6px"></textarea>
  </div>
  <div class="panneau"><h3>${t('reglages.elements')}</h3>${legendeElements(data.heros.elements.fort_contre as Record<string, string>)}</div>
  <button class="btn" id="fermer">${t('commun.fermer')}</button>`;
  const q = <T extends HTMLElement>(s: string) => m.querySelector(s) as T;
  q<HTMLSelectElement>('#langue').onchange = (e) => ctx.changerLangue((e.target as HTMLSelectElement).value);
  q<HTMLInputElement>('#abo').onchange = (e) => { p.parametres.abonne = (e.target as HTMLInputElement).checked; ctx.save(); };
  q<HTMLSelectElement>('#preset').onchange = (e) => { p.parametres.preset = (e.target as HTMLSelectElement).value; ctx.save(); };
  q('#nrj').onclick = () => { p.energie = { valeur: data.energie.plafond_regeneration, majLe: ctx.maintenant() }; ctx.save(); ctx.fermer(); };
  const txt = q<HTMLTextAreaElement>('#txt');
  q('#exp').onclick = () => { txt.style.display = 'block'; txt.value = ctx.exporter(); txt.select(); };
  q('#imp').onclick = () => {
    if (txt.style.display === 'none' || !txt.value.trim()) { txt.style.display = 'block'; txt.value = ''; txt.placeholder = t('reglages.coller'); return; }
    if (ctx.importer(txt.value)) ctx.fermer();
  };
  q('#raz').onclick = () => { if (confirm(t('reglages.confirmer_effacer'))) { ctx.effacer(); ctx.fermer(); } };
  q('#fermer').onclick = () => ctx.fermer();
  return m;
}
