// Partie complete automatisee dans Chromium headless (Playwright preinstalle) + captures d'ecran + verifications.
// Usage : node scripts/e2e.cjs [url] [dossierCaptures] [graine-bot] [niveau]
// Variables : PRESET=facile|calibre|dur, ABO=1 (abonnement x2), DSF (densite de pixels, 1,5 par defaut).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = process.argv[2] || 'http://127.0.0.1:5173/';
const OUT = process.argv[3] || path.join(__dirname, '..', 'docs', 'captures', 'v2');
const NIVEAU = Number(process.argv[5] || 1);
let seed = Number(process.argv[4] || 1);
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
fs.mkdirSync(OUT, { recursive: true });
const verifs = [];
const verifier = (ok, msg) => { verifs.push((ok ? 'OK   ' : 'ECHEC ') + msg); if (!ok) console.error('ECHEC : ' + msg); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(process.env.DSF || 1.5) });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text()) && !/ERR_/.test(m.text())) erreurs.push('console: ' + m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => window.__abyss, null, { timeout: 30000 });
  const pris = new Set();
  const snap = async (nom, force = false) => {
    if (pris.has(nom) && !force) return;
    pris.add(nom);
    await page.screenshot({ path: path.join(OUT, nom + '.png') });
  };
  const get = (fn, arg) => page.evaluate(fn, arg);
  const ts = (v) => page.evaluate((x) => { window.__abyss.timeScale = x; }, v);

  // profil de test : francais, niveau, puissance, abonnement
  await page.evaluate(([n, p, a]) => {
    const pr = window.__abyss.profil.parametres;
    pr.niveau = n; pr.langue = 'fr'; if (p) pr.preset = p; pr.abonne = !!a;
    localStorage.setItem('abyss-legends-save', JSON.stringify(window.__abyss.profil));
  }, [NIVEAU, process.env.PRESET, process.env.ABO]);
  await page.reload();
  await page.waitForFunction(() => window.__abyss, null, { timeout: 30000 });
  await page.waitForTimeout(700);
  await snap('01-ecran-principal');
  const nav = await page.$$eval('.nav-bas .nav-btn', (b) => b.map((x) => x.dataset.onglet));
  verifier(JSON.stringify(nav) === JSON.stringify(['boutique', 'heros', 'recif', 'evenements', 'pets']), 'barre du bas : Boutique, Héros, Récif, Événements, Pets (' + nav + ')');
  const nrj = await page.textContent('#energie');
  verifier(/^\d+\/\d+$/.test(nrj.trim()), `énergie au format « 45/60 » (${nrj})`);
  verifier(!!(await page.$('#record')), 'record du niveau affiché sur l\'écran principal');
  // onglets
  await page.click('.nav-btn[data-onglet="heros"]'); await page.waitForTimeout(250); await snap('01b-onglet-heros');
  const sous = await page.$$eval('.sous-nav .chip-nav', (b) => b.map((x) => x.dataset.sous));
  verifier(sous.join(',') === 'heros,talents,perles,gardiens,equipement,montures', 'onglet Héros : héros, talents, perles, gardiens, équipement, montures');
  await page.click('.chip-nav[data-sous="equipement"]'); await page.waitForTimeout(250); await snap('01c-equipement-raretes');
  for (const o of ['boutique', 'evenements', 'pets']) { await page.click(`.nav-btn[data-onglet="${o}"]`); await page.waitForTimeout(150); await snap('01d-onglet-' + o); }
  verifier(!(await page.$('#record')), 'record absent des autres onglets');
  await page.click('.nav-btn[data-onglet="recif"]'); await page.waitForTimeout(200);
  await page.click('#reglages'); await page.waitForTimeout(250); await snap('01e-reglages');
  await page.click('#fermer'); await page.waitForTimeout(200);
  await page.click('#go');
  await page.waitForTimeout(500);

  let tours = 0, combatsVus = 0, derniereClef = '', traverseesFilmees = 0;
  const t0 = Date.now();
  while (tours++ < 5000) {
    if (Date.now() - t0 > 1200000) throw new Error('Délai dépassé : partie bloquée ?');
    const etat = await get(() => {
      const a = window.__abyss, r = a.run;
      return {
        phase: r.phase, step: r.step, types: r.echos.map((e) => e.type), kind: r.combatKind, temps: r.combat ? r.combat.time : 0,
        trav: a.enTraversee, scenes: a.scenes(), sonarUi: !!document.querySelector('.sonar-ui, .btn-direction'), nbEchos: a.sonar().items.length,
      };
    });
    if (tours % 100 === 0) console.log(tours, JSON.stringify(etat));
    if (etat.trav) { await page.waitForTimeout(200); continue; }
    if (etat.phase === 'sonar') {
      await page.waitForTimeout(250);
      verifier(etat.types.length === 3 && etat.nbEchos === 3, `choix ${etat.step} : 3 échos (logique ${etat.types.length}, affichés ${etat.nbEchos})`);
      if ([10, 20, 30].includes(etat.step)) verifier(etat.types.every((x) => x === (etat.step === 30 ? 'boss' : 'miniboss')), `choix ${etat.step} : les 3 échos mènent au ${etat.step === 30 ? 'boss' : 'mini-boss'}`);
      const sv = await get(() => window.__abyss.profil.partieEnCours && window.__abyss.profil.partieEnCours.step);
      verifier(sv === etat.step, 'partie sauvegardée à chaque tour');
      if (etat.step === 5 && !pris.has('reprise')) {
        // fermeture de l'application puis reprise : meme tour, memes pieces, memes mutations
        pris.add('reprise');
        const avant = await get(() => { const r = window.__abyss.run; return JSON.stringify([r.step, r.pieces, r.mutations, r.hp.toString(), r.echos]); });
        await page.reload();
        await page.waitForFunction(() => window.__abyss && window.__abyss.run, null, { timeout: 30000 });
        await page.waitForTimeout(500);
        const apres = await get(() => { const r = window.__abyss.run; return JSON.stringify([r.step, r.pieces, r.mutations, r.hp.toString(), r.echos]); });
        verifier(avant === apres, 'reprise après fermeture : exactement le même état (tour, pièces, mutations, PV, Sonar)');
        await snap('02d-sonar-apres-reprise');
        continue;
      }
      if ([1, 10, 30].includes(etat.step)) await snap(etat.step === 1 ? '02-sonar' : etat.step === 10 ? '02b-sonar-miniboss' : '02c-sonar-boss');
      // priorite aux rencontres rares pour les captures, puis combats (le bot lit la logique ; l'ecran ne montre rien)
      const ordre = ['marchand', 'autel', 'mystere', 'miniboss', 'boss', 'combat', 'epave', 'grotte'];
      let best = 0, br = 99;
      etat.types.forEach((x, i) => { const k = ordre.indexOf(x); if (k < br && !(x === 'marchand' && pris.has('shop-fait')) && !(x === 'autel' && pris.has('autel-fait'))) { br = k; best = i; } });
      const film = traverseesFilmees === 0 && etat.types[best] === 'combat';
      await ts(film ? 0.2 : 1);
      if (rnd() < 0.5) await page.click(`.btn-direction[data-echo="${best}"]`);
      else { const pos = await get((i) => window.__abyss.sonar().positionEcho(i), best); await page.mouse.click(pos[0], pos[1]); }
      if (film) {
        traverseesFilmees++;
        // temps de jeu = temps reel x 0,2 : captures des etapes du storyboard
        for (const [tj, nom] of [[0.25, '03a-traversee-fermeture'], [1.0, '03b-traversee-plongee'], [1.9, '03c-traversee-forme'], [2.3, '03d-traversee-revelation']]) {
          await page.waitForFunction((x) => !window.__abyss.traversee || window.__abyss.traversee.t >= x, tj);
          await snap(nom);
        }
        await ts(1);
      }
      await page.waitForFunction(() => !window.__abyss.enTraversee, null, { timeout: 20000 });
      if (!film && !pris.has('mesure-traversee') && process.env.ABO) {
        // horloge = temps ecoule pendant la traversee ; acceleree x2, elle s'arreterait vers 1,25 s
        pris.add('mesure-traversee');
        const m = await get(() => ({ h: window.__abyss.horlogeTraversee, v: window.__abyss.vitesse }));
        verifier(m.v === 2 && m.h >= 2.45 && m.h < 2.75, `traversée non accélérée par l'abonnement x2 (vitesse combat ×${m.v}, traversée ${m.h.toFixed(2)} s)`);
      }
    } else if (etat.phase === 'combat') {
      verifier(!etat.scenes.sonar && !etat.sonarUi, 'pas de Sonar ni de choix pendant le combat');
      if (clef(etat) !== derniereClef) { derniereClef = clef(etat); combatsVus++; await ts(1); }
      const nom = etat.kind === 'boss' ? '05-combat-boss' : etat.kind === 'miniboss' ? '04c-combat-miniboss' : '04-combat';
      if (etat.temps > 4 && !pris.has(nom)) await snap(nom);
      if (etat.kind === 'normal' && !pris.has('04a-combat-attaque') && etat.temps > 2) {
        // poses figees du rig (temps de jeu arrete) : attaque au moment du coup de harpon, puis coup recu (recul + flash)
        await ts(0);
        await get(() => window.__abyss.combatView().visuelHeros.figer('attaque', 0.24));
        await page.waitForTimeout(150); await snap('04a-combat-attaque');
        await get(() => window.__abyss.combatView().visuelHeros.figer('coup', 0.13));
        await page.waitForTimeout(150); await snap('04b-coup-recu');
        await get(() => window.__abyss.combatView().visuelHeros.figer(null));
        await ts(1);
      }
      if (pris.has(nom) && pris.has('04b-coup-recu')) await ts(12);
      await page.waitForTimeout(300);
    } else if (etat.phase === 'mutation') {
      await page.waitForTimeout(300);
      await snap('06-mutation');
      const cartes = await page.$$('.modal .carte');
      await cartes[Math.floor(rnd() * cartes.length)].click();
      await page.waitForTimeout(200);
    } else if (etat.phase === 'shop') {
      await page.waitForTimeout(300);
      await snap('07-shop');
      pris.add('shop-fait');
      for (let k = 0; k < 6; k++) {
        const cartes = await page.$$('.modal .carte:not([disabled])');
        if (!cartes.length) break;
        if (await get(() => window.__abyss.run.phase) !== 'shop') break;
        await cartes[0].click();
        await page.waitForTimeout(200);
        if (await get(() => window.__abyss.run.phase) !== 'shop') {
          const c2 = await page.$$('.modal .carte');
          await c2[0].click();
          await page.waitForTimeout(200);
        }
      }
      if (await get(() => window.__abyss.run.phase) === 'shop') await page.click('.modal .btn');
      await page.waitForTimeout(200);
    } else if (etat.phase === 'rencontre') {
      await page.waitForTimeout(300);
      const type = await get(() => window.__abyss.run.rencontre.type);
      if (type === 'autel') pris.add('autel-fait');
      await snap('08-rencontre-' + type);
      const cartes = await page.$$('.modal .carte:not([disabled])');
      await cartes[0].click();
      await page.waitForTimeout(200);
    } else if (etat.phase === 'victoire' || etat.phase === 'defaite') {
      await page.waitForTimeout(500);
      await snap('09-fin-' + etat.phase);
      if (etat.phase === 'defaite') {
        const txt = await page.textContent('.modal');
        verifier(/Défaite/.test(txt) && new RegExp('Tour ' + etat.step).test(txt) && !/Gains|record/i.test(txt), 'écran de défaite : « Défaite » et « Tour X » seulement');
      }
      verifier(await get(() => window.__abyss.profil.partieEnCours === null), 'partie en cours effacée à la fin');
      break;
    } else await page.waitForTimeout(200);
  }
  function clef(e) { return e.phase + e.step + 'c' + combatsVus; }
  const bilan = await get(() => {
    const r = window.__abyss.run;
    return { phase: r.phase, step: r.step, combats: r.nbCombats, mutations: r.nbMutations, niveauHeros: r.niveauHeros, cles: window.__abyss.profil.cles };
  });
  console.log(JSON.stringify(bilan));
  await page.evaluate(() => window.__abyss.menu());
  await page.waitForTimeout(400);
  await snap('10-ecran-principal-apres', true);
  const uniques = [...new Set(verifs)];
  console.log(uniques.join('\n'));
  console.log('erreurs navigateur :', erreurs.length ? erreurs : 'aucune');
  await browser.close();
  if (erreurs.length || uniques.some((v) => v.startsWith('ECHEC'))) process.exit(2);
})().catch((e) => { console.error(e); process.exit(1); });
