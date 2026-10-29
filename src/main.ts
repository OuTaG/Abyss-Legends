import { Application } from 'pixi.js';
import { GAME_DATA } from './data';
import { Difficulty, niveauInfo, niveauMax } from './core/difficulty';
import { Run, type Milestone } from './core/run';
import { D, fmt } from './core/num';
import { depenserEnergie, energieActuelle, progres, reclamerPalier, terminerPartie, type Profil } from './core/profile';
import { CLE_STOCKAGE, charger, exporter, importer, sauvegarder } from './core/save';
import { DUREE_TRAVERSEE_S, Traversee, facteurTemps } from './core/rythme';
import { CHOIX_MINIBOSS, NB_CHOIX } from './core/sonar';
import { ELEMENT_COULEUR } from './core/elements';
import type { Element } from './core/types';
import { Ocean } from './ui/background';
import { CombatView } from './ui/combatView';
import { SonarView } from './ui/sonarView';
import { TraverseeView, FERMETURE_SONAR_S, type Revelation } from './ui/traverseeView';
import { MenuScene } from './ui/menuScene';
import { construireMenu, construireReglages, type CtxMenu } from './ui/menu';
import { prechargerRigs } from './ui/heros';
import { esc, h } from './ui/dom';
import { ICONES } from './ui/icones';
import { RARETE_MUTATION, appliquerTheme, num } from './ui/theme';
import { definirLangue, t } from './i18n';

const data = GAME_DATA;
const diff = new Difficulty(data);
const W = 390, H = 844;

let profil: Profil = charger(data, localStorage, Date.now());
let run: Run | null = null;
let phaseAffichee = '';
let partieEnregistree = false;
let hud: HudRefs | null = null;
let traversee: Traversee | null = null;
let horlogeTraversee = 0; // temps (reel x reglage de test) ecoule pendant la derniere traversee
let vitesse = 1; // combats x2 avec l'abonnement
let timeScale = 1; // reglage de test (Playwright)
let lastRecompense: ReturnType<typeof terminerPartie> | null = null;

const ui = document.getElementById('ui')!;
const stage = document.getElementById('stage')!;
const toastZone = h('div', 'toast-zone');

interface HudRefs {
  root: HTMLElement; titre: HTMLElement; sous: HTMLElement; piste: HTMLElement; curseur: HTMLElement; pieces: HTMLElement;
  niv: HTMLElement; xpFill: HTMLElement; vit: HTMLButtonElement;
  combat: HTMLElement; hpHeros: HTMLElement; hpHerosTxt: HTMLElement; hpMonture: HTMLElement; hpMontureTxt: HTMLElement;
  chips: HTMLElement; assist: HTMLElement; nbMut: number;
}

const app = new Application();
let ocean: Ocean, sonar: SonarView, combatView: CombatView, traverseeView: TraverseeView, menuScene: MenuScene;

function fit(): void {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  stage.style.transform = `scale(${s})`;
  stage.style.left = `${(window.innerWidth - W * s) / 2}px`;
  stage.style.top = `${(window.innerHeight - H * s) / 2}px`;
}

function save(): void { sauvegarder(profil, localStorage); }
const maintenant = (): number => Date.now();

function toast(msg: string): void {
  const el = h('div', 'toast', esc(msg));
  toastZone.appendChild(el);
  setTimeout(() => el.remove(), 2700);
}

function afficherScene(nom: 'menu' | 'sonar' | 'traversee' | 'combat' | 'aucune'): void {
  menuScene.visible = nom === 'menu';
  sonar.visible = nom === 'sonar';
  traverseeView.visible = nom === 'traversee';
  combatView.visible = nom === 'combat';
}

// ---------------------------------------------------------------------------------------------- ecran principal
const ctxMenu: CtxMenu = {
  data, diff,
  profil: () => profil,
  save,
  maintenant,
  lancerPartie: () => lancerPartie(),
  rafraichir: () => afficherMenu(),
  ouvrirReglages: () => ouvrirReglages(),
};

function afficherMenu(): void {
  run = null;
  hud = null;
  traversee = null;
  phaseAffichee = 'menu';
  afficherScene('menu');
  const hc = data.herosContent;
  menuScene.preparer(profil.parametres.heroId, hc.pets, hc.gardiens);
  ocean.appliquer(niveauPalette(profil.parametres.niveau));
  ui.replaceChildren(construireMenu(ctxMenu), toastZone);
}

function niveauPalette(niveau: number) {
  return niveauInfo(data, niveau).monde.palette;
}

function ouvrirReglages(): void {
  const fermer = () => afficherMenu();
  const m = construireReglages({
    ...ctxMenu,
    exporter: () => exporter(profil),
    importer: (s) => {
      try { profil = importer(data, s, maintenant()); save(); toast(t('reglages.importee')); return true; } catch { toast(t('reglages.invalide')); return false; }
    },
    effacer: () => { localStorage.removeItem(CLE_STOCKAGE); profil = charger(data, localStorage, maintenant()); appliquerLangue(); },
    changerLangue: (c) => { profil.parametres.langue = c; save(); appliquerLangue(); ouvrirReglages(); },
    fermer,
  });
  afficherMenu();
  ui.insertBefore(m, toastZone);
}

function appliquerLangue(): void {
  definirLangue(profil.parametres.langue, navigator.languages ?? [navigator.language]);
}

// ---------------------------------------------------------------------------------------------- partie
function lancerPartie(): void {
  if (!depenserEnergie(profil, data, maintenant())) return;
  const niveau = profil.parametres.niveau;
  const ratio = (data.prov.puissance_joueur.ratios as Record<string, number>)[profil.parametres.preset] ?? 1;
  partieEnregistree = false;
  traversee = null;
  run = new Run(data, diff, {
    niveau, heroId: profil.parametres.heroId, ratio, graine: Math.floor(Math.random() * 2 ** 31),
    onMilestone: surPalier(niveau),
  });
  progres(profil, niveau).record = Math.max(progres(profil, niveau).record, 1);
  save();
  demarrerAffichagePartie();
}

const surPalier = (niveau: number) => (ms: Milestone) => {
  const cles = reclamerPalier(profil, data, niveau, ms);
  if (cles.length) toast(t('partie.cles_gagnees', { cles: cles.map((c) => t('cles.' + c)).join(' + ') }));
  save();
};

function demarrerAffichagePartie(): void {
  construireHud();
  phaseAffichee = '';
  syncPhase();
}

/** Reprend la partie sauvegardee au dernier choix de Sonar (application fermee en cours de partie). */
function reprendrePartie(): boolean {
  const sv = profil.partieEnCours;
  if (!sv) return false;
  try {
    run = Run.restaurer(data, diff, sv, surPalier(sv.opts.niveau));
  } catch (e) {
    console.warn('Partie en cours illisible, abandonnee', e);
    profil.partieEnCours = null;
    save();
    return false;
  }
  partieEnregistree = false;
  traversee = null;
  demarrerAffichagePartie();
  return true;
}

function construireHud(): void {
  ui.replaceChildren();
  const r = run!;
  const root = h('div', 'hud-partie');
  const marques = [...CHOIX_MINIBOSS.map((c) => ({ c, i: ICONES.crane, k: 'crane' })), { c: NB_CHOIX, i: ICONES.couronne, k: 'couronne' }];
  root.innerHTML = `
    <div class="ligne">
      <div class="cadre titre-niveau"><div class="titre-serif" data-r="titre"></div><div class="sous" data-r="sous"></div></div>
      <button class="rond vitesse" data-r="vit"></button>
    </div>
    <div class="progression-30"><div class="piste"><i data-r="piste"></i></div>
      ${marques.map((m) => `<span class="marque ${m.k}" style="left:${(m.c / NB_CHOIX) * 100}%">${m.i}</span>`).join('')}
      <span class="curseur" data-r="curseur"></span></div>
    <div class="ligne">
      <div class="pill pieces"><i>${ICONES.or}</i><b data-r="pieces"></b></div>
      <div class="pill xp"><b data-r="niv"></b><div class="barre-xp"><i data-r="xp"></i></div></div>
    </div>`;
  const combat = h('div', 'panneau-combat');
  combat.innerHTML = `
    <div class="ligne"><span class="titre-serif or">${t('combat.automatique')}</span><span class="petit-texte">${t('combat.aucun_choix')}</span></div>
    <div class="fiches">
      <div class="fiche"><div class="ligne"><b>${esc(data.herosContent.affichage[r.opts.heroId] ?? r.opts.heroId)}</b><span data-r="hpHerosTxt"></span></div><div class="barre-vie"><i data-r="hpHeros"></i></div></div>
      <div class="fiche"><div class="ligne"><b>${esc(data.herosContent.monture.nom)}</b><span data-r="hpMontureTxt"></span></div><div class="barre-vie"><i data-r="hpMonture"></i></div></div>
    </div>
    <div class="chips" data-r="chips"></div>
    <div class="assists" data-r="assist"></div>`;
  ui.append(root, combat, toastZone);
  const q = (k: string) => (root.querySelector(`[data-r="${k}"]`) ?? combat.querySelector(`[data-r="${k}"]`)) as HTMLElement;
  const vit = q('vit') as HTMLButtonElement;
  vitesse = profil.parametres.abonne ? 2 : 1;
  vit.onclick = () => { vitesse = vitesse === 1 ? 2 : 1; majHud(); };
  hud = {
    root, titre: q('titre'), sous: q('sous'), piste: q('piste'), curseur: q('curseur'), pieces: q('pieces'), niv: q('niv'), xpFill: q('xp'), vit,
    combat, hpHeros: q('hpHeros'), hpHerosTxt: q('hpHerosTxt'), hpMonture: q('hpMonture'), hpMontureTxt: q('hpMontureTxt'), chips: q('chips'), assist: q('assist'), nbMut: -1,
  };
}

function chipsMutations(r: Run): HTMLElement[] {
  return Object.entries(r.mutations).map(([id, k]) => {
    const def = data.mutations.mutations.find((x) => x.id === id)!;
    return h('span', 'chip rar-' + (RARETE_MUTATION[def.rarete] ?? 'commun'), esc(def.nom) + (k > 1 ? ` ×${k}` : ''));
  });
}

function majHud(): void {
  if (!run || !hud) return;
  const r = run;
  const enCombat = r.phase === 'combat' && !!r.combat && !traversee;
  hud.root.classList.toggle('cache', !!traversee);
  hud.titre.textContent = `${r.info.monde.nom.toUpperCase()} — ${t('menu.niveau_n', { n: r.opts.niveau })}`;
  hud.sous.textContent = t('partie.monde_choix', { m: r.info.monde.id, n: Math.min(r.step, NB_CHOIX), max: NB_CHOIX });
  const prog = (Math.min(r.step, NB_CHOIX) / NB_CHOIX) * 100;
  hud.piste.style.width = `${prog}%`;
  hud.curseur.style.left = `${prog}%`;
  hud.pieces.textContent = String(r.pieces);
  hud.niv.textContent = t('partie.niv', { n: r.niveauHeros });
  hud.xpFill.style.width = `${Math.max(0, Math.min(100, r.xpFraction() * 100))}%`;
  hud.vit.style.display = profil.parametres.abonne && enCombat ? '' : 'none';
  hud.vit.innerHTML = `<b>×${vitesse}</b>`;
  hud.vit.classList.toggle('vit-on', vitesse === 2);
  hud.combat.style.display = enCombat ? '' : 'none';
  if (enCombat) {
    const c = r.combat!;
    const fr = (a: typeof c.hero) => (a.maxHp.gt(0) ? Math.max(0, Math.min(100, a.hp.div(a.maxHp).toNumber() * 100)) : 0);
    hud.hpHeros.style.width = `${fr(c.hero)}%`;
    hud.hpHerosTxt.textContent = `${fmt(c.hero.hp)}/${fmt(c.hero.maxHp)}${c.shield.gt(0) ? ` (+${fmt(c.shield)})` : ''}`;
    hud.hpMonture.style.width = `${fr(c.mount)}%`;
    hud.hpMontureTxt.textContent = c.mount.alive ? `${fmt(c.mount.hp)}/${fmt(c.mount.maxHp)}` : t('combat.monture_ko');
    hud.assist.innerHTML = data.herosContent.assistants.map((a, i) => {
      const need = Math.max(1, a.intervalle_tours - (r.stats().assistReduce ?? 0));
      return `<span class="assist">${esc(data.herosContent.affichage[a.hero] ?? a.hero)} : ${c.assistCounters[i]} / ${need}</span>`;
    }).join(' ');
    const n = Object.values(r.mutations).reduce((a, b) => a + b, 0);
    if (n !== hud.nbMut) { hud.nbMut = n; hud.chips.replaceChildren(...chipsMutations(r)); }
  } else hud.nbMut = -1;
}

// ---------------------------------------------------------------------------------------------- phases
function cleModal(): string {
  if (!run) return '';
  return [run.phase, run.step, run.offre.map((o) => o.id).join(','), run.rencontre?.etat ?? '', run.nbMutations, run.shop ? run.shop.slots.map((s) => s.achete).join('') : '', run.nbCombats].join('|');
}

function syncPhase(): void {
  if (!run || traversee) return;
  const cle = cleModal();
  if (cle === phaseAffichee) return;
  phaseAffichee = cle;
  document.querySelectorAll('.modal, .sonar-ui').forEach((e) => e.remove());
  ocean.appliquer(run.info.monde.palette);
  majHud();
  switch (run.phase) {
    case 'sonar':
      // sauvegarde de la partie a chaque tour (GDD 4.1)
      profil.partieEnCours = run.sauvegarde();
      save();
      afficherSonar();
      break;
    case 'combat':
      afficherScene('combat');
      combatView.demarrer(run);
      break;
    case 'mutation':
      if (!combatView.visible) afficherScene('aucune'); // apres un combat, la scene du combat reste en fond
      afficherMutation();
      break;
    case 'shop': afficherScene('aucune'); afficherShop(); break;
    case 'rencontre': afficherScene('aucune'); afficherRencontre(); break;
    case 'victoire':
    case 'defaite': afficherFin(); break;
  }
}

/** Ecran du Sonar : 3 echos identiques (la vue ne connait que leur nombre), boutons Gauche / Devant / Droite. */
function afficherSonar(): void {
  const r = run!;
  afficherScene('sonar');
  sonar.afficher(r.echos.length, (i) => choisirEcho(i));
  const bas = h('div', 'sonar-ui');
  const dirs = [['gauche', ICONES.gauche], ['devant', ICONES.devant], ['droite', ICONES.droite]];
  bas.innerHTML = `
    <div class="sonar-message">${t('sonar.message')}</div>
    <div class="sonar-boutons">${dirs.map(([k, ic], i) => `<button class="btn-direction" data-echo="${i}">${ic}<span>${t('sonar.' + k)}</span></button>`).join('')}</div>
    <div class="sonar-etat"><div class="pv-mini"><span>${t('partie.pv')}</span><div class="barre-vie"><i style="width:${Math.max(0, Math.min(100, r.hp.div(r.maxHp()).toNumber() * 100))}%"></i></div><b>${fmt(r.hp)}/${fmt(r.maxHp())}</b></div>
    <div class="chips"></div></div>`;
  bas.querySelector('.chips')!.replaceChildren(...chipsMutations(r));
  bas.querySelectorAll<HTMLButtonElement>('.btn-direction').forEach((b) => { b.onclick = () => sonar.choisir(Number(b.dataset.echo)); });
  ui.insertBefore(bas, toastZone);
}

/** Le joueur a choisi un echo : la logique resout le choix, puis la traversee de l'eau (2,5 s) mene a la rencontre. */
function choisirEcho(i: number): void {
  const r = run!;
  if (r.phase !== 'sonar' || traversee) return;
  // le choix est sauvegarde avant d'etre joue : rouvrir l'application ne permet pas de choisir un autre echo
  if (profil.partieEnCours) { profil.partieEnCours.choix = i; save(); }
  r.chooseEcho(i);
  traversee = new Traversee(DUREE_TRAVERSEE_S);
  horlogeTraversee = 0;
  document.querySelectorAll('.sonar-ui').forEach((e) => e.remove());
  traverseeView.demarrer(r.opts.heroId, r.info.monde.palette, revelation(r), DUREE_TRAVERSEE_S);
  majHud();
}

function revelation(r: Run): Revelation {
  const coul = (e: Element | null) => (e ? num(ELEMENT_COULEUR[e]) : 0x9fb4c0);
  if (r.phase === 'combat' && r.combat) {
    const e = r.combat.enemies[0];
    const noms = [...new Set(r.combat.enemies.map((x) => x.nom))];
    return { titre: noms.slice(0, 2).join(' · ').toUpperCase(), sous: (e.element ?? t('commun.neutre')).toUpperCase(), couleur: coul(e.element) };
  }
  if (r.phase === 'shop') return { titre: t('rencontre.marchand').toUpperCase(), sous: '', couleur: 0xf0a838 };
  if (r.phase === 'rencontre' && r.rencontre) return { titre: r.rencontre.titre.toUpperCase(), sous: '', couleur: 0x7af4ff };
  return { titre: '', sous: '', couleur: 0x7af4ff };
}

function modal(): HTMLElement {
  const m = h('div', 'modal');
  ui.insertBefore(m, toastZone);
  return m;
}

function afficherMutation(): void {
  const r = run!;
  const m = modal();
  const b = r.butin;
  const titre = r.offreSource === 'combat' ? (b?.kind === 'miniboss' ? t('mutation.miniboss_vaincu') : t('mutation.victoire')) : r.offreSource === 'shop' ? t('mutation.achat') : t('mutation.offerte');
  m.appendChild(h('h2', '', titre));
  if (b && r.offreSource === 'combat') m.appendChild(h('div', 'recompense', `+${b.xp} XP · +${b.pieces} ${t('partie.pieces')}${b.niveaux ? ` · <b>${t('partie.niv', { n: r.niveauHeros })} !</b>` : ''}`));
  m.appendChild(h('div', 'sous', t('mutation.consigne')));
  r.offre.forEach((mu, i) => {
    const k = r.mutations[mu.id] ?? 0;
    const rar = data.mutations.raretes[mu.rarete];
    const cls = RARETE_MUTATION[mu.rarete] ?? 'commun';
    const c = h('button', 'carte rar-' + cls, `<span class="pile">${k ? t('mutation.possedee', { k, k1: k + 1 }) : t('mutation.nouvelle')}</span><div class="rar">${rar.nom}${mu.element ? ' · ' + mu.element : ''}</div><div class="nom">${esc(mu.nom)}</div><div class="desc">${esc(mu.description)}</div>`);
    c.onclick = () => { r.pickMutation(i); syncPhase(); };
    m.appendChild(c);
  });
}

function afficherShop(): void {
  const r = run!;
  const m = modal();
  m.appendChild(h('h2', '', t('rencontre.marchand')));
  m.appendChild(h('div', 'sous', t('shop.pieces', { n: r.pieces })));
  r.shop!.slots.forEach((s, i) => {
    const prix = Math.round(s.article.prix * (1 + 0.5 * s.achete));
    const epuise = s.achete >= s.article.max;
    const c = h('button', 'carte', `<span class="pile">${epuise ? t('shop.epuise') : prix + ' ' + t('partie.pieces')}</span><div class="nom">${esc(s.article.nom)}</div><div class="desc">${esc(s.article.description)}</div>`);
    if (epuise || r.pieces < prix) c.setAttribute('disabled', '');
    c.onclick = () => { if (r.acheter(i)) { phaseAffichee = ''; syncPhase(); majHud(); } };
    m.appendChild(c);
  });
  const q = h('button', 'btn', t('shop.quitter'));
  q.onclick = () => { r.quitterShop(); syncPhase(); };
  m.appendChild(q);
}

function afficherRencontre(): void {
  const r = run!;
  const re = r.rencontre!;
  const m = modal();
  m.appendChild(h('h2', '', esc(re.titre)));
  m.appendChild(h('div', 'sous', esc(re.texte)));
  if (re.etat === 'resultat' && re.resultat?.length) m.appendChild(h('div', 'recompense', re.resultat.map(esc).join('<br>')));
  re.options.forEach((o, i) => {
    const c = h('button', 'carte', `<div class="nom">${esc(o.label)}</div>`);
    if (o.disabled) c.setAttribute('disabled', '');
    c.onclick = () => { r.choisirRencontre(i); phaseAffichee = ''; syncPhase(); };
    m.appendChild(c);
  });
}

function afficherFin(): void {
  const r = run!;
  const victoire = r.phase === 'victoire';
  if (!partieEnregistree) {
    partieEnregistree = true;
    profil.partieEnCours = null;
    lastRecompense = terminerPartie(profil, data, r.opts.niveau, r.step, victoire);
    save();
  }
  const rec = lastRecompense!;
  const m = modal();
  if (victoire) {
    m.appendChild(h('h2', '', t('fin.victoire')));
    m.appendChild(h('div', 'sous', t('fin.boss_vaincu', { nom: esc(r.info.boss.nom) })));
    m.appendChild(h('div', 'recompense', t('fin.gains', { or: fmt(rec.or), xp: fmt(rec.xpHeros), nourriture: fmt(rec.nourriture) }) + (rec.gemmes ? ` · ${rec.gemmes} ${t('ressources.gemmes')}` : '')));
    m.appendChild(h('div', 'recompense', t('fin.bilan', { c: r.nbCombats, m: r.nbMutations, n: r.niveauHeros })));
  } else {
    // GDD 4.1 : l'ecran de defaite affiche simplement « Defaite » et « Tour X »
    m.classList.add('defaite');
    m.appendChild(h('h2', '', t('fin.defaite_titre')));
    m.appendChild(h('div', 'tour', t('fin.tour', { n: r.step })));
  }
  if (victoire && r.opts.niveau === profil.parametres.niveau && profil.parametres.niveau < niveauMax(data)) {
    const nx = h('button', 'btn', t('fin.suivant'));
    nx.onclick = () => { profil.parametres.niveau++; save(); afficherMenu(); };
    m.appendChild(nx);
  }
  const rej = h('button', 'btn', t('fin.rejouer'));
  if (energieActuelle(profil, data, maintenant()) < data.energie.cout_tentative) rej.setAttribute('disabled', '');
  rej.onclick = () => lancerPartie();
  const menu = h('button', 'btn sec', t('fin.menu'));
  menu.onclick = () => afficherMenu();
  m.append(rej, menu);
}

// ---------------------------------------------------------------------------------------------- boucle
function frame(dtReel: number): void {
  const dt = dtReel * timeScale;
  ocean.tick(dt);
  if (!run) { menuScene.maj(dt); return; }
  for (const msg of run.toasts.splice(0)) toast(msg);
  if (traversee) {
    // la traversee avance en temps reel : l'abonnement (x2) ne l'accelere pas
    horlogeTraversee += dt;
    traversee.avancer(dt, vitesse);
    traverseeView.maj(dt); // meme horloge que la minuterie (la revelation tombe a la fin)
    if (traversee.t < FERMETURE_SONAR_S) {
      afficherScene('sonar');
      sonar.fermeture(traversee.t / FERMETURE_SONAR_S);
      sonar.maj(dt);
    } else afficherScene('traversee');
    if (traversee.finie) {
      traversee = null;
      phaseAffichee = '';
      syncPhase();
    }
    majHud();
    return;
  }
  if (run.phase === 'combat') {
    const dtCombat = dt * facteurTemps('combat', vitesse);
    run.update(dtCombat);
    combatView.maj(dt, facteurTemps('combat', vitesse));
  }
  if (run.phase === 'sonar') sonar.maj(dt);
  majHud();
  syncPhase();
}

async function init(): Promise<void> {
  appliquerTheme();
  appliquerLangue();
  fit();
  window.addEventListener('resize', fit);
  await app.init({ width: W, height: H, background: '#06243f', antialias: true, resolution: Math.min(3, (window.devicePixelRatio || 1) * 1.5), autoDensity: true, preference: 'webgl' });
  document.getElementById('canvas-host')!.appendChild(app.canvas);
  await prechargerRigs();
  ocean = new Ocean(W, H);
  menuScene = new MenuScene();
  sonar = new SonarView();
  traverseeView = new TraverseeView();
  combatView = new CombatView();
  app.stage.addChild(ocean, menuScene, combatView, traverseeView, sonar);
  afficherScene('aucune');
  app.ticker.add((tk) => frame(tk.deltaMS / 1000));
  setInterval(save, 10000);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  if (!reprendrePartie()) afficherMenu();
  // acces de test (Playwright / console)
  (window as any).__abyss = {
    data,
    get run() { return run; },
    get profil() { return profil; },
    get timeScale() { return timeScale; },
    set timeScale(v: number) { timeScale = v; },
    get enTraversee() { return !!traversee; },
    get traversee() { return traversee; },
    get horlogeTraversee() { return horlogeTraversee; },
    get vitesse() { return vitesse; },
    menu: afficherMenu,
    lancer: lancerPartie,
    sauver: save,
    sonar: () => sonar,
    combatView: () => combatView,
    scenes: () => ({ menu: menuScene.visible, sonar: sonar.visible, traversee: traverseeView.visible, combat: combatView.visible }),
    zero: D(0),
  };
}
init();
