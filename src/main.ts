import { Application } from 'pixi.js';
import { GAME_DATA } from './data';
import { Difficulty, niveauInfo, niveauMax } from './core/difficulty';
import { Run, type Milestone } from './core/run';
import { D, fmt, fromSave } from './core/num';
import {
  QUALITES_CLES, depenserEnergie, energieActuelle, progres, reclamerPalier, secondesAvantPoint, terminerPartie, type Profil,
} from './core/profile';
import { charger, exporter, importer, sauvegarder } from './core/save';
import { Ocean } from './ui/background';
import { CombatView } from './ui/combatView';
import { SonarView } from './ui/sonarView';
import { badgeElement, esc, h, legendeElements } from './ui/dom';
import { ELEMENT_COULEUR } from './core/elements';

const data = GAME_DATA;
const diff = new Difficulty(data);
const W = 390, H = 844;

let profil: Profil = charger(data, localStorage, Date.now());
let run: Run | null = null;
let phaseAffichee = '';
let partieEnregistree = false;
let hud: HudRefs | null = null;
let timeScale = 1; // reglage de test (Playwright)

const ui = document.getElementById('ui')!;
const stage = document.getElementById('stage')!;
const toastZone = h('div', 'toast-zone');

interface HudRefs {
  root: HTMLElement; choix: HTMLElement; pieces: HTMLElement; hpFill: HTMLElement; hpShield: HTMLElement; hpTxt: HTMLElement;
  xpFill: HTMLElement; xpTxt: HTMLElement; chips: HTMLElement; vit: HTMLButtonElement; assist: HTMLElement; nbMut: number;
}

const app = new Application();
let ocean: Ocean, sonar: SonarView, combatView: CombatView;

function fit(): void {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  stage.style.transform = `scale(${s})`;
  stage.style.left = `${(window.innerWidth - W * s) / 2}px`;
  stage.style.top = `${(window.innerHeight - H * s) / 2}px`;
}

function save(): void { sauvegarder(profil, localStorage); }
const maintenant = (): number => Date.now();

function toast(msg: string): void {
  const t = h('div', 'toast', esc(msg));
  toastZone.appendChild(t);
  setTimeout(() => t.remove(), 2700);
}

// ---------------------------------------------------------------------------------------------- ecran principal
function afficherMenu(): void {
  run = null;
  hud = null;
  phaseAffichee = 'menu';
  sonar.visible = false;
  combatView.visible = false;
  const niveau = profil.parametres.niveau;
  const info = niveauInfo(data, niveau);
  ocean.appliquer(info.monde.palette);
  ui.replaceChildren();
  const m = h('div', 'menu');
  const pr = progres(profil, niveau);
  const nrj = energieActuelle(profil, data, maintenant());
  const ratio = (data.prov.puissance_joueur.ratios as Record<string, number>)[profil.parametres.preset] ?? 1;

  m.appendChild(h('h1', '', 'Abyss Legends'));
  m.appendChild(h('div', 'tag', 'Prototype jouable · un niveau complet du monde ' + info.monde.id));

  const pNiv = h('div', 'panneau');
  pNiv.innerHTML = `<h3>Niveau</h3>
    <div class="niv-select"><button class="btn petit sec" id="prev">&lt;</button>
    <div class="centre"><div class="petit-texte">Monde ${info.monde.id} · ${esc(info.monde.nom)}</div><div class="gros">Niveau ${niveau}</div>
    <div>Boss : <b>${esc(info.boss.nom)}</b> ${badgeElement(info.boss.element)}${info.boss8 ? ' <span class="petit-texte">(boss n°8, meilleures clés)</span>' : ''}</div></div>
    <button class="btn petit sec" id="next">&gt;</button></div>
    <div class="grille2" style="margin-top:8px">
      <div>Puissance recommandée</div><div><b>${fmt(diff.puissance(niveau))}</b></div>
      <div>Record du niveau</div><div><b id="record">${pr.termine ? 'Terminé' : pr.record ? `choix ${pr.record} / 30` : '—'}</b>${pr.termine ? ' (30 / 30)' : ''}</div>
      <div>Clés déjà gagnées</div><div>${[pr.cles.c10, pr.cles.c20, pr.cles.fin].map((x, i) => `<span class="petit-texte">${['10', '20', 'fin'][i]}${x ? ' ✓' : ' ·'}</span>`).join(' ')}</div>
    </div>`;
  m.appendChild(pNiv);

  const pEn = h('div', 'panneau');
  const sec = secondesAvantPoint(profil, data, maintenant());
  pEn.innerHTML = `<div class="ligne"><div><b>Énergie ${nrj} / ${data.energie.plafond_regeneration}</b><div class="petit-texte">Coût d'une partie : ${data.energie.cout_tentative}${sec ? ` · prochain point dans ${Math.floor(sec / 60)} min ${sec % 60} s` : ''}</div></div></div>`;
  m.appendChild(pEn);

  const go = h('button', 'btn gros-btn', nrj >= data.energie.cout_tentative ? 'PLONGER' : 'Plus d\'énergie', { id: 'go' });
  if (nrj < data.energie.cout_tentative) go.setAttribute('disabled', '');
  go.onclick = () => lancerPartie();
  m.appendChild(go);

  // heros et equipe
  const pHero = h('div', 'panneau');
  const hc = data.herosContent;
  const heros = data.heros.heros;
  const sel = h('select', '', heros.map((x) => `<option value="${x.nom}" ${x.nom === profil.parametres.heroId ? 'selected' : ''}>${hc.affichage[x.nom] ?? x.nom}${x.element ? ' (' + x.element + ')' : ' (neutre)'}</option>`).join(''), { id: 'hero' });
  sel.onchange = () => { profil.parametres.heroId = sel.value; save(); afficherMenu(); };
  const hero = heros.find((x) => x.nom === profil.parametres.heroId)!;
  pHero.innerHTML = `<h3>Équipe (valeurs de départ fixes)</h3>`;
  const l1 = h('div', 'ligne'); l1.innerHTML = '<div>Héros</div>'; l1.appendChild(sel);
  pHero.appendChild(l1);
  pHero.insertAdjacentHTML('beforeend', `<div class="grille2" style="margin-top:6px">
    <div>Élément</div><div>${badgeElement(hero.element)} ${hero.element ?? 'neutre'}</div>
    <div>Monture</div><div>${hc.monture.nom}</div>
    <div>Pets</div><div>${hc.pets.map((p) => `${p.nom} ${badgeElement(p.element)}`).join('<br>')}</div>
    <div>Gardiens</div><div>${hc.gardiens.map((p) => `${p.nom} ${badgeElement(p.element)}`).join('<br>')}</div>
    <div>Assistants</div><div>${hc.assistants.map((a) => `${(hc.affichage[a.hero] ?? a.hero)} · tous les ${a.intervalle_tours} tours`).join('<br>')}</div></div>`);
  m.appendChild(pHero);

  const pInv = h('div', 'panneau');
  const r = profil.ressources;
  pInv.innerHTML = `<h3>Inventaire</h3>
    <div>${QUALITES_CLES.map((q) => `<span class="cle ${q}">${q} ×${profil.cles[q]}</span>`).join('')}</div>
    <div class="grille2" style="margin-top:6px">
      <div>Or</div><div>${fmt(fromSave(r.or))}</div><div>Gemmes</div><div>${r.gemmes}</div>
      <div>XP de héros</div><div>${fmt(fromSave(r.xpHeros))}</div><div>Nourriture</div><div>${fmt(fromSave(r.nourriture))}</div>
      <div>Ressource permanente</div><div>${fmt(fromSave(r.ressourcePermanente))}</div>
      <div>Ressource du monde ${info.monde.id}</div><div>${fmt(fromSave(r.ressourceMonde[String(info.monde.id)]))}</div></div>
    <div class="petit-texte" style="margin-top:4px">Les clés ouvrent les coffres d'épave (non inclus dans ce prototype).</div>`;
  m.appendChild(pInv);

  const pEl = h('div', 'panneau');
  pEl.innerHTML = '<h3>Éléments</h3>' + legendeElements(data.heros.elements.fort_contre as Record<string, string>);
  m.appendChild(pEl);

  const pOpt = h('div', 'panneau');
  pOpt.innerHTML = `<h3>Options de test</h3>
    <label class="opt">Abonnement : combats ×2 <input type="checkbox" id="abo" ${profil.parametres.abonne ? 'checked' : ''}></label>
    <label class="opt">Puissance du joueur
      <select id="preset">${Object.entries(data.prov.puissance_joueur.ratios).map(([k, v]) => `<option value="${k}" ${k === profil.parametres.preset ? 'selected' : ''}>${k} (×${v})</option>`).join('')}</select></label>
    <div class="ligne" style="margin-top:6px"><button class="btn petit sec" id="nrj">Recharger l'énergie</button>
    <button class="btn petit sec" id="exp">Exporter</button><button class="btn petit sec" id="imp">Importer</button><button class="btn petit sec" id="raz">Effacer</button></div>
    <textarea id="txt" placeholder="Sauvegarde exportée / à importer" style="display:none;margin-top:6px"></textarea>
    <div class="petit-texte" style="margin-top:6px">Puissance du joueur effective : ×${ratio} par rapport au niveau calibré.</div>`;
  m.appendChild(pOpt);
  ui.appendChild(m);
  ui.appendChild(toastZone);

  (m.querySelector('#prev') as HTMLElement).onclick = () => changerNiveau(-1);
  (m.querySelector('#next') as HTMLElement).onclick = () => changerNiveau(1);
  (m.querySelector('#abo') as HTMLInputElement).onchange = (e) => { profil.parametres.abonne = (e.target as HTMLInputElement).checked; save(); };
  (m.querySelector('#preset') as HTMLSelectElement).onchange = (e) => { profil.parametres.preset = (e.target as HTMLSelectElement).value; save(); afficherMenu(); };
  (m.querySelector('#nrj') as HTMLElement).onclick = () => { profil.energie = { valeur: data.energie.plafond_regeneration, majLe: maintenant() }; save(); afficherMenu(); };
  const txt = m.querySelector('#txt') as HTMLTextAreaElement;
  (m.querySelector('#exp') as HTMLElement).onclick = () => { txt.style.display = 'block'; txt.value = exporter(profil); txt.select(); };
  (m.querySelector('#imp') as HTMLElement).onclick = () => {
    if (txt.style.display === 'none' || !txt.value.trim()) { txt.style.display = 'block'; txt.value = ''; txt.placeholder = 'Collez la sauvegarde puis recliquez sur Importer'; return; }
    try { profil = importer(data, txt.value, maintenant()); save(); afficherMenu(); toast('Sauvegarde importée'); } catch { toast('Sauvegarde invalide'); }
  };
  (m.querySelector('#raz') as HTMLElement).onclick = () => {
    if (confirm('Effacer toute la sauvegarde ?')) { localStorage.removeItem('abyss-legends-save'); profil = charger(data, localStorage, maintenant()); afficherMenu(); }
  };
}

function changerNiveau(d: number): void {
  const max = niveauMax(data);
  profil.parametres.niveau = Math.min(max, Math.max(1, profil.parametres.niveau + d));
  save();
  afficherMenu();
}

// ---------------------------------------------------------------------------------------------- partie
function lancerPartie(): void {
  if (!depenserEnergie(profil, data, maintenant())) return;
  const niveau = profil.parametres.niveau;
  const ratio = (data.prov.puissance_joueur.ratios as Record<string, number>)[profil.parametres.preset] ?? 1;
  partieEnregistree = false;
  run = new Run(data, diff, {
    niveau, heroId: profil.parametres.heroId, ratio, graine: Math.floor(Math.random() * 2 ** 31),
    onMilestone: (ms: Milestone) => {
      const cles = reclamerPalier(profil, data, niveau, ms);
      if (cles.length) toast(`Clé${cles.length > 1 ? 's' : ''} gagnée${cles.length > 1 ? 's' : ''} : ${cles.join(' + ')} (première fois)`);
      save();
    },
  });
  progres(profil, niveau).record = Math.max(progres(profil, niveau).record, 1);
  save();
  construireHud();
  phaseAffichee = '';
  syncPhase();
}

function construireHud(): void {
  ui.replaceChildren();
  const root = h('div', 'hud');
  root.style.zIndex = '5';
  const l1 = h('div', 'ligne');
  const choix = h('div', 'titre-choix');
  const pieces = h('div', 'pieces');
  const vit = h('button', 'btn petit', '×1') as HTMLButtonElement;
  vit.style.display = profil.parametres.abonne ? '' : 'none';
  vit.onclick = () => { vitesse = vitesse === 1 ? 2 : 1; vit.textContent = '×' + vitesse; vit.classList.toggle('vit-on', vitesse === 2); };
  vitesse = profil.parametres.abonne ? 2 : 1;
  vit.textContent = '×' + vitesse;
  vit.classList.toggle('vit-on', vitesse === 2);
  l1.append(choix, pieces, vit);
  const hp = h('div', 'barre');
  const hpFill = h('i'); const hpShield = h('b'); const hpTxt = h('span');
  hp.append(hpFill, hpShield, hpTxt);
  const xp = h('div', 'barre xp');
  const xpFill = h('i'); const xpTxt = h('span');
  xp.append(xpFill, xpTxt);
  const chips = h('div', 'chips');
  root.append(l1, hp, xp, chips);
  const assist = h('div', 'bas');
  assist.style.zIndex = '3';
  ui.append(root, assist, toastZone);
  hud = { root, choix, pieces, hpFill, hpShield, hpTxt, xpFill, xpTxt, chips, vit, assist, nbMut: -1 };
}
let vitesse = 1;

function majHud(): void {
  if (!run || !hud) return;
  const hp = run.combat && run.phase === 'combat' ? run.combat.hero.hp : run.hp;
  const max = run.maxHp();
  const sh = run.combat && run.phase === 'combat' ? run.combat.shield : D(0);
  hud.choix.textContent = `Choix ${Math.min(run.step, 30)} / 30`;
  hud.pieces.textContent = `${run.pieces} pièces`;
  hud.hpFill.style.width = `${Math.max(0, Math.min(100, hp.div(max).toNumber() * 100))}%`;
  hud.hpShield.style.width = sh.gt(0) ? `${Math.min(100, sh.div(max).toNumber() * 100)}%` : '0';
  hud.hpTxt.textContent = `PV ${fmt(hp)} / ${fmt(max)}${sh.gt(0) ? ` (+${fmt(sh)})` : ''}`;
  hud.xpFill.style.width = `${Math.max(0, Math.min(100, run.xpFraction() * 100))}%`;
  hud.xpTxt.textContent = `Niveau ${run.niveauHeros}`;
  const n = Object.values(run.mutations).reduce((a, b) => a + b, 0);
  if (n !== hud.nbMut) {
    hud.nbMut = n;
    hud.chips.replaceChildren(...Object.entries(run.mutations).map(([id, k]) => {
      const def = data.mutations.mutations.find((x) => x.id === id)!;
      return h('span', 'chip ' + def.rarete, esc(def.nom) + (k > 1 ? ` ×${k}` : ''));
    }));
  }
  if (run.phase === 'combat' && run.combat) {
    const c = run.combat;
    hud.assist.innerHTML = data.herosContent.assistants.map((a, i) => {
      const need = Math.max(1, a.intervalle_tours - (run!.stats().assistReduce ?? 0));
      return `<span class="assist">${esc(data.herosContent.affichage[a.hero] ?? a.hero)} : ${c.assistCounters[i]} / ${need}</span>`;
    }).join(' ');
    hud.assist.style.display = '';
  } else hud.assist.style.display = 'none';
  hud.vit.style.display = profil.parametres.abonne ? '' : 'none';
}

// ---------------------------------------------------------------------------------------------- phases
function cleModal(): string {
  if (!run) return '';
  return [run.phase, run.step, run.offre.map((o) => o.id).join(','), run.rencontre?.etat ?? '', run.nbMutations, run.shop ? run.shop.slots.map((s) => s.achete).join('') : ''].join('|');
}

function syncPhase(): void {
  if (!run) return;
  const cle = cleModal();
  if (cle === phaseAffichee) return;
  phaseAffichee = cle;
  document.querySelectorAll('.modal').forEach((e) => e.remove());
  ocean.appliquer(run.info.monde.palette);
  majHud();
  switch (run.phase) {
    case 'sonar': {
      combatView.visible = false;
      sonar.visible = true;
      sonar.afficher(data, run.info, run.echos, (i) => { run!.chooseEcho(i); syncPhase(); });
      const t = h('div', 'sonar-titre');
      t.className = 'modal sonar-titre-wrap';
      t.style.cssText = 'background:none;pointer-events:none;justify-content:flex-end;padding:0 0 300px';
      t.innerHTML = `<div class="sonar-titre" style="position:static"><div class="t1">Choix ${run.step} / 30 · ${run.step === 30 ? 'Le gardien vous attend' : run.step === 10 || run.step === 20 ? 'Un mini-boss barre la route' : 'Où aller ?'}</div><div class="t2">Touchez une silhouette pour plonger</div></div>`;
      ui.appendChild(t);
      break;
    }
    case 'combat':
      sonar.visible = false;
      combatView.visible = true;
      combatView.demarrer(run);
      break;
    case 'mutation': afficherMutation(); break;
    case 'shop': afficherShop(); break;
    case 'rencontre': afficherRencontre(); break;
    case 'victoire':
    case 'defaite': afficherFin(); break;
  }
}

function modal(): HTMLElement {
  const m = h('div', 'modal');
  m.style.zIndex = '4';
  ui.appendChild(m);
  return m;
}

function afficherMutation(): void {
  const r = run!;
  const m = modal();
  const b = r.butin;
  const titre = r.offreSource === 'combat' ? (b?.kind === 'miniboss' ? 'Mini-boss vaincu !' : 'Victoire !') : r.offreSource === 'shop' ? 'Achat : choisissez' : 'Une mutation vous est offerte';
  m.appendChild(h('h2', '', titre));
  if (b && r.offreSource === 'combat') m.appendChild(h('div', 'recompense', `+${b.xp} XP · +${b.pieces} pièces${b.niveaux ? ` · <b>Niveau ${r.niveauHeros} !</b>` : ''}`));
  m.appendChild(h('div', 'sous', 'Choisissez 1 mutation parmi 3 (perdues en fin de partie)'));
  r.offre.forEach((mu, i) => {
    const k = r.mutations[mu.id] ?? 0;
    const rar = data.mutations.raretes[mu.rarete];
    const c = h('button', 'carte ' + mu.rarete, `<span class="pile">${k ? `possédée ×${k} → ×${k + 1}` : 'nouvelle'}</span><div class="rar" style="color:${rar.couleur}">${rar.nom}${mu.element ? ' · ' + mu.element : ''}</div><div class="nom">${esc(mu.nom)}</div><div class="desc">${esc(mu.description)}</div>`);
    c.onclick = () => { r.pickMutation(i); syncPhase(); };
    m.appendChild(c);
  });
}

function afficherShop(): void {
  const r = run!;
  const m = modal();
  m.appendChild(h('h2', '', 'Marchand'));
  m.appendChild(h('div', 'sous', `Vous avez ${r.pieces} pièces de partie`));
  r.shop!.slots.forEach((s, i) => {
    const prix = Math.round(s.article.prix * (1 + 0.5 * s.achete));
    const epuise = s.achete >= s.article.max;
    const c = h('button', 'carte', `<span class="pile">${epuise ? 'épuisé' : prix + ' pièces'}</span><div class="nom">${esc(s.article.nom)}</div><div class="desc">${esc(s.article.description)}</div>`);
    if (epuise || r.pieces < prix) c.setAttribute('disabled', '');
    c.onclick = () => { if (r.acheter(i)) { phaseAffichee = ''; syncPhase(); majHud(); } };
    m.appendChild(c);
  });
  const q = h('button', 'btn', 'Quitter le marchand');
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
    lastRecompense = terminerPartie(profil, data, r.opts.niveau, r.step, victoire);
    save();
  }
  const rec = lastRecompense!;
  const m = modal();
  m.appendChild(h('h2', '', victoire ? 'Niveau terminé !' : 'Vous avez péri...'));
  m.appendChild(h('div', 'sous', victoire ? `${esc(r.info.boss.nom)} est vaincu.` : `La partie s'arrête au choix ${r.step}. Les mutations sont perdues.`));
  m.appendChild(h('div', 'recompense', `Gains : ${fmt(rec.or)} or · ${fmt(rec.xpHeros)} XP de héros · ${fmt(rec.nourriture)} nourriture${rec.gemmes ? ` · ${rec.gemmes} gemmes` : ''}`));
  m.appendChild(h('div', 'recompense', `Combats : ${r.nbCombats} · Mutations : ${r.nbMutations} · Niveau de partie : ${r.niveauHeros}`));
  if (victoire && r.opts.niveau === profil.parametres.niveau && profil.parametres.niveau < niveauMax(data)) {
    const nx = h('button', 'btn', 'Niveau suivant');
    nx.onclick = () => { profil.parametres.niveau++; save(); afficherMenu(); };
    m.appendChild(nx);
  }
  const rej = h('button', 'btn', 'Rejouer ce niveau');
  if (energieActuelle(profil, data, maintenant()) < data.energie.cout_tentative) rej.setAttribute('disabled', '');
  rej.onclick = () => lancerPartie();
  const menu = h('button', 'btn sec', 'Écran principal');
  menu.onclick = () => afficherMenu();
  m.append(rej, menu);
}
let lastRecompense: ReturnType<typeof terminerPartie> | null = null;

// ---------------------------------------------------------------------------------------------- boucle
function frame(dtReel: number): void {
  ocean.tick(dtReel);
  if (run) {
    for (const t of run.toasts.splice(0)) toast(t);
    if (run.phase === 'combat') {
      run.update(dtReel * vitesse * timeScale);
      combatView.maj(dtReel * timeScale, vitesse);
    }
    if (run.phase === 'sonar') sonar.maj(dtReel);
    majHud();
    syncPhase();
  }
}

async function init(): Promise<void> {
  fit();
  window.addEventListener('resize', fit);
  await app.init({ width: W, height: H, background: '#06243f', antialias: true, resolution: Math.min(3, (window.devicePixelRatio || 1) * 1.5), autoDensity: true, preference: 'webgl' });
  document.getElementById('canvas-host')!.appendChild(app.canvas);
  ocean = new Ocean(W, H);
  sonar = new SonarView();
  combatView = new CombatView();
  sonar.visible = false;
  combatView.visible = false;
  app.stage.addChild(ocean, sonar, combatView);
  app.ticker.add((t) => frame(t.deltaMS / 1000));
  setInterval(save, 10000);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  afficherMenu();
  // acces de test (Playwright / console)
  (window as any).__abyss = {
    data,
    get run() { return run; },
    get profil() { return profil; },
    get timeScale() { return timeScale; },
    set timeScale(v: number) { timeScale = v; },
    menu: afficherMenu,
    lancer: lancerPartie,
    sonar: () => sonar,
    ELEMENT_COULEUR,
  };
}
init();
