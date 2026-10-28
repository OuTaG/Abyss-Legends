// Partie complete automatisee dans Chromium headless (Playwright preinstalle) + captures d'ecran.
// Usage : node scripts/e2e.cjs [url] [dossierCaptures] [graine-bot] [niveau]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = process.argv[2] || 'http://127.0.0.1:5173/';
const OUT = process.argv[3] || path.join(__dirname, '..', 'docs', 'captures');
const NIVEAU = Number(process.argv[5] || 1);
let seed = Number(process.argv[4] || 1);
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(process.env.DSF || 1.5) });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push('console: ' + m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => window.__abyss, null, { timeout: 20000 });
  await page.waitForTimeout(500);
  const pris = new Set();
  const snap = async (nom, force = false) => {
    if (pris.has(nom) && !force) return;
    pris.add(nom);
    await page.screenshot({ path: path.join(OUT, nom + '.png') });
  };
  const get = (fn, arg) => page.evaluate(fn, arg);

  await page.evaluate(([n, p, a]) => { const pr = window.__abyss.profil.parametres; pr.niveau = n; if (p) pr.preset = p; pr.abonne = !!a; window.__abyss.menu(); }, [NIVEAU, process.env.PRESET, process.env.ABO]);
  await page.waitForTimeout(300);
  await snap('01-ecran-principal');
  await page.evaluate(() => { document.querySelector('.menu').scrollTop = 2000; });
  await page.waitForTimeout(200);
  await snap('01b-ecran-principal-bas');
  await page.click('#go');
  await page.waitForTimeout(400);

  let tours = 0, combatsVus = 0, derniereClef = '';
  const t0 = Date.now();
  while (tours++ < 4000) {
    if (Date.now() - t0 > 900000) throw new Error('Delai depasse : partie bloquee ?');
    const etat = await get(() => {
      const r = window.__abyss.run;
      return { phase: r.phase, step: r.step, types: r.echos.map((e) => e.type), kind: r.combatKind, nbMut: r.offre.length, temps: r.combat ? r.combat.time : 0 };
    });
    if (tours % 100 === 0) console.log(tours, JSON.stringify(etat));
    const clef = etat.phase + etat.step + (etat.phase === 'combat' ? 'c' + combatsVus : '');
    if (etat.phase === 'sonar') {
      await page.waitForTimeout(250);
      if ([1, 10, 30].includes(etat.step)) await snap(etat.step === 1 ? '02-sonar' : etat.step === 10 ? '02b-sonar-miniboss' : '02c-sonar-boss');
      // priorite aux rencontres rares pour les captures, puis combats
      const ordre = ['marchand', 'autel', 'mystere', 'miniboss', 'boss', 'combat', 'epave', 'grotte'];
      let best = 0, br = 99;
      etat.types.forEach((t, i) => { const k = ordre.indexOf(t); if (k < br && !(t === 'marchand' && pris.has('shop-fait')) && !(t === 'autel' && pris.has('autel-fait'))) { br = k; best = i; } });
      const pos = await get((i) => { const it = window.__abyss.sonar().items[i]; return [it.root.x, it.root.y]; }, best);
      await page.mouse.click(pos[0], pos[1]);
      await page.waitForTimeout(900);
    } else if (etat.phase === 'combat') {
      if (clef !== derniereClef) { derniereClef = clef; combatsVus++; await page.evaluate(() => { window.__abyss.timeScale = 1; }); }
      const nom = etat.kind === 'boss' ? '05-combat-boss' : etat.kind === 'miniboss' ? '04b-combat-miniboss' : '04-combat';
      if (etat.temps > 6 && !pris.has(nom)) { await snap(nom); }
      if (etat.kind === 'normal' && etat.temps > 9 && !pris.has('04c-combat-tard')) await snap('04c-combat-tard');
      if (pris.has(nom)) await page.evaluate(() => { window.__abyss.timeScale = 12; });
      await page.waitForTimeout(350);
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
        const ph = await get(() => window.__abyss.run.phase);
        if (ph !== 'shop') break;
        await cartes[0].click();
        await page.waitForTimeout(200);
        if (await get(() => window.__abyss.run.phase) !== 'shop') {
          await snap('06b-mutation-boutique');
          const c2 = await page.$$('.modal .carte');
          await c2[0].click();
          await page.waitForTimeout(200);
        }
      }
      if (await get(() => window.__abyss.run.phase) === 'shop') { await snap('07b-shop-apres'); await page.click('.modal .btn'); }
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
      break;
    } else await page.waitForTimeout(200);
  }
  const bilan = await get(() => {
    const r = window.__abyss.run;
    return { phase: r.phase, step: r.step, combats: r.nbCombats, mutations: r.nbMutations, niveauHeros: r.niveauHeros, cles: window.__abyss.profil.cles, niveaux: window.__abyss.profil.niveaux };
  });
  console.log(JSON.stringify(bilan));
  await page.evaluate(() => window.__abyss.menu());
  await page.waitForTimeout(300);
  await snap('10-ecran-principal-apres', true);
  console.log('erreurs navigateur :', erreurs.length ? erreurs : 'aucune');
  await browser.close();
  if (erreurs.length) process.exit(2);
})().catch((e) => { console.error(e); process.exit(1); });
