// Moteur de combat 100 % automatique, sans aucune dependance au rendu ni au navigateur.
// Pas de temps fixe ; le rendu lit l'etat et vide la file d'evenements (coups, morts, telegraphes...).
import { D, Decimal, ZERO } from './num';
import type { GameData } from '../data/build';
import type { Element, Stats } from './types';
import { Rng } from './rng';
import { multElement, aAvantage } from './elements';
import type { EncounterSpec, EnemySpec } from './enemies';
import { stat } from './stats';

export type CombatEvent =
  | { t: 'attack'; src: number; dst: number }
  | { t: 'hit'; src: number; dst: number; amount: Decimal; crit: boolean; mult: number; element: Element | null; viaPoison?: boolean; thorns?: boolean }
  | { t: 'miss'; src: number; dst: number }
  | { t: 'heal'; dst: number; amount: Decimal }
  | { t: 'shield'; dst: number; amount: Decimal }
  | { t: 'death'; uid: number }
  | { t: 'telegraph'; src: number; dur: number }
  | { t: 'projectile'; src: number; dst: number }
  | { t: 'status'; dst: number; nom: 'etourdi' | 'poison' | 'faiblesse' | 'enrage' }
  | { t: 'spawn'; uid: number }
  | { t: 'assistant'; index: number; nom: string }
  | { t: 'multi'; src: number };

export interface HeroInit {
  element: Element | null;
  atk: Decimal;
  maxHp: Decimal;
  hp: Decimal;
  stats: Stats; // statistiques totales (mutations, passifs, bonus temporaires)
}

export interface Fighter {
  uid: number;
  side: 'ally' | 'enemy';
  kind: 'hero' | 'mount' | 'pet' | 'guardian' | 'enemy';
  nom: string;
  element: Element | null;
  hp: Decimal;
  maxHp: Decimal;
  alive: boolean;
  // allies attaquants
  partDegats: number;
  intervalle: number;
  cd: number;
  // ennemis
  spec?: EnemySpec;
  atk: Decimal;
  stun: number;
  poison: { dps: Decimal; t: number } | null;
  prep: number; // > 0 : charge/attaque lourde en preparation
  prepMult: number;
  caché: number; // embuscade : > 0 tant que l'ennemi est cache
  lourdeCd: number;
  enrage: boolean;
  renfortsFaits: number;
  index: number; // position dans la ligne (rendu)
}

export interface CombatResult { victoire: boolean; duree: number }

const mk = (partial: Partial<Fighter> & Pick<Fighter, 'uid' | 'side' | 'kind' | 'nom'>): Fighter => ({
  element: null, hp: ZERO, maxHp: ZERO, alive: true, partDegats: 0, intervalle: 1, cd: 0, atk: ZERO,
  stun: 0, poison: null, prep: 0, prepMult: 1, caché: 0, lourdeCd: 0, enrage: false, renfortsFaits: 0, index: 0,
  ...partial,
});

export class Combat {
  time = 0;
  ended = false;
  result: CombatResult | null = null;
  events: CombatEvent[] = [];
  hero: Fighter;
  allies: Fighter[] = []; // mount, pets, gardiens (attaquants sans PV)
  enemies: Fighter[] = [];
  shield: Decimal = ZERO;
  heroTurns = 0;
  kills = 0;
  weakT = 0;
  weakPct = 0;
  heroPoison: { dps: Decimal; t: number }[] = [];
  assistCounters: number[] = [];
  private nextUid = 1;
  private acc = 0;
  private poisonTick = 0;
  private stats: Stats;
  private heroAtk: Decimal;
  private heroInterval: number;

  constructor(
    private data: GameData,
    heroInit: HeroInit,
    encounter: EncounterSpec,
    private rng: Rng,
    private ctx: { renfort?: (spec: EnemySpec) => EnemySpec } = {},
  ) {
    this.stats = heroInit.stats;
    this.heroAtk = heroInit.atk;
    this.heroInterval = data.prov.heros.intervalle_s / (1 + stat(this.stats, 'speedPct'));
    this.hero = mk({
      uid: this.nextUid++, side: 'ally', kind: 'hero', nom: 'Héros', element: heroInit.element,
      hp: heroInit.hp, maxHp: heroInit.maxHp, intervalle: this.heroInterval, cd: this.heroInterval * 0.5,
    });
    const hc = data.herosContent;
    const mk2 = (nom: string, kind: Fighter['kind'], element: Element | null, intervalle: number, part: number, i: number) =>
      this.allies.push(mk({ uid: this.nextUid++, side: 'ally', kind, nom, element, intervalle, partDegats: part, cd: intervalle * (0.3 + 0.2 * i), index: i }));
    mk2(hc.monture.nom, 'mount', hc.monture.element, hc.monture.intervalle, hc.monture.part_degats, 0);
    hc.pets.forEach((p, i) => mk2(p.nom, 'pet', p.element, p.intervalle, p.part_degats, i));
    hc.gardiens.forEach((g, i) => mk2(g.nom, 'guardian', g.element, g.intervalle, g.part_degats, i));
    this.assistCounters = hc.assistants.map(() => 0);
    encounter.enemies.forEach((e, i) => this.addEnemy(e, i, false));
    const sh = heroInit.maxHp.mul(stat(this.stats, 'shieldStart'));
    if (sh.gt(0)) {
      this.shield = sh;
      this.events.push({ t: 'shield', dst: this.hero.uid, amount: sh });
    }
  }

  private addEnemy(spec: EnemySpec, index: number, renfort: boolean): Fighter {
    const f = mk({
      uid: this.nextUid++, side: 'enemy', kind: 'enemy', nom: spec.nom, element: spec.element,
      hp: spec.hp, maxHp: spec.hp, atk: spec.atk, intervalle: spec.intervalle, spec, index,
      cd: spec.intervalle * (0.6 + 0.25 * (index % 3)),
    });
    if (spec.comportement === 'embuscade') {
      f.caché = spec.def!.embuscade_delai ?? 1.4;
      f.cd = f.caché;
    }
    if (spec.comportement === 'boss' && spec.pattern) f.lourdeCd = spec.pattern.lourde_toutes_s;
    this.enemies.push(f);
    if (renfort) this.events.push({ t: 'spawn', uid: f.uid });
    return f;
  }

  drainEvents(): CombatEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  get heroHp(): Decimal { return this.hero.hp; }
  vivants(): Fighter[] { return this.enemies.filter((e) => e.alive); }
  byUid(uid: number): Fighter | undefined {
    if (uid === this.hero.uid) return this.hero;
    return this.allies.find((a) => a.uid === uid) ?? this.enemies.find((e) => e.uid === uid);
  }

  /** Avance la simulation de dt secondes (a pas fixe, borne pour ne jamais boucler indefiniment). */
  update(dt: number): void {
    if (this.ended) return;
    const step = this.data.prov.combat.pas_s;
    this.acc += Math.min(dt, 5);
    let guard = 0;
    while (this.acc >= step && !this.ended && guard++ < 400) {
      this.acc -= step;
      this.tick(step);
    }
  }

  /** Simule jusqu'a la fin (tests, calibrage, hors-ligne) sans passer par le temps reel. */
  runToEnd(maxS = 600): CombatResult {
    const step = this.data.prov.combat.pas_s;
    while (!this.ended && this.time < maxS) this.tick(step);
    if (!this.ended) this.end(false);
    return this.result!;
  }

  private tick(dt: number): void {
    this.time += dt;
    const P = this.data.prov;
    // regeneration, poison sur le heros
    const regen = stat(this.stats, 'regen');
    if (regen > 0 && this.hero.hp.lt(this.hero.maxHp)) {
      this.hero.hp = Decimal.min(this.hero.maxHp, this.hero.hp.add(this.hero.maxHp.mul(regen * dt)));
    }
    this.poisonTick += dt;
    if (this.poisonTick >= 0.5) {
      const span = this.poisonTick;
      this.poisonTick = 0;
      this.tickPoisons(span);
      if (this.ended) return;
    }
    if (this.weakT > 0) this.weakT -= dt;

    // attaques du heros et de ses allies
    this.hero.cd -= dt;
    if (this.hero.cd <= 0) {
      this.hero.cd += this.heroInterval;
      this.heroAttack();
      this.heroTurns++;
      this.tickAssistants();
    }
    for (const a of this.allies) {
      a.cd -= dt;
      if (a.cd <= 0 && this.vivants().length) {
        a.cd += a.intervalle;
        this.allyAttack(a);
      }
    }
    // ennemis
    const enrageGlobal = 1 + Math.max(0, (this.time - P.ennemis.enrage_global_apres_s) / 30) * P.ennemis.enrage_global_par_30s;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      this.enemyUpdate(e, dt, enrageGlobal);
      if (this.ended) return;
    }
    if (!this.vivants().length) this.end(true);
  }

  // ---------------------------------------------------------------- degats du camp du heros
  private critRoll(extra = 0): { crit: boolean; mult: number } {
    const chance = Math.min(0.95, this.data.prov.heros.crit_base + stat(this.stats, 'critChance') + extra);
    const crit = this.rng.chance(chance);
    return { crit, mult: crit ? this.data.prov.heros.crit_mult_base + stat(this.stats, 'critMult') : 1 };
  }

  private heroTarget(): Fighter | undefined {
    return this.enemies.find((e) => e.alive);
  }

  private dealToEnemy(src: Fighter, e: Fighter, base: Decimal, opts: { viaHero: boolean }): Decimal {
    const em = multElement(this.data, src.element, e.element);
    let m = em;
    if (aAvantage(this.data, src.element, e.element)) m *= 1 + stat(this.stats, 'advDmg');
    const { crit, mult } = this.critRoll();
    m *= mult;
    if (e.hp.lt(e.maxHp.mul(0.3))) m *= 1 + stat(this.stats, 'execute');
    if (opts.viaHero) {
      m *= 1 + stat(this.stats, 'ramp') * this.kills;
      if (this.weakT > 0) m *= 1 - this.weakPct;
    }
    const armure = e.spec?.def?.armure ?? 0;
    m *= 1 - armure;
    const dmg = base.mul(m);
    e.hp = e.hp.sub(dmg);
    this.events.push({ t: 'hit', src: src.uid, dst: e.uid, amount: dmg, crit, mult: em, element: src.element });
    if (opts.viaHero) {
      const ls = stat(this.stats, 'lifesteal');
      if (ls > 0) this.heal(dmg.mul(ls));
    }
    const po = stat(this.stats, 'poisonOnHit');
    if (po > 0 && e.alive) {
      e.poison = { dps: this.heroAtk.mul(1 + stat(this.stats, 'atkPct')).mul(po), t: this.data.prov.combat.poison_duree_s };
      this.events.push({ t: 'status', dst: e.uid, nom: 'poison' });
    }
    const st = stat(this.stats, 'stunChance');
    if (st > 0 && opts.viaHero && this.rng.chance(st)) this.stunEnemy(e, this.data.prov.combat.etourdissement_s);
    this.checkDeath(e);
    return dmg;
  }

  private stunEnemy(e: Fighter, dur: number): void {
    if (!e.alive) return;
    const d = e.spec?.comportement === 'boss' ? dur * this.data.prov.combat.etourdissement_boss_x : dur;
    e.stun = Math.max(e.stun, d);
    e.prep = 0;
    this.events.push({ t: 'status', dst: e.uid, nom: 'etourdi' });
  }

  private heroAttack(): void {
    const t = this.heroTarget();
    if (!t) return;
    this.events.push({ t: 'attack', src: this.hero.uid, dst: t.uid });
    const base = this.heroAtk.mul(1 + stat(this.stats, 'atkPct'));
    this.dealToEnemy(this.hero, t, base, { viaHero: true });
    if (stat(this.stats, 'multiHit') > 0 && this.rng.chance(stat(this.stats, 'multiHit'))) {
      const t2 = this.heroTarget();
      if (t2) {
        this.events.push({ t: 'multi', src: this.hero.uid });
        this.dealToEnemy(this.hero, t2, base, { viaHero: true });
      }
    }
  }

  private allyAttack(a: Fighter): void {
    const vivants = this.vivants();
    if (!vivants.length) return;
    let t: Fighter;
    if (a.kind === 'mount') t = vivants[0];
    else if (a.kind === 'guardian') t = vivants.reduce((p, c) => (c.hp.gt(p.hp) ? c : p));
    else t = vivants[this.rng.int(0, vivants.length - 1)];
    const bonusKey = a.kind === 'mount' ? 'mountDmg' : a.kind === 'guardian' ? 'guardianDmg' : 'petDmg';
    const base = this.heroAtk.mul(1 + stat(this.stats, 'atkPct') * 0.5).mul(a.partDegats).mul(1 + stat(this.stats, bonusKey));
    this.events.push({ t: 'attack', src: a.uid, dst: t.uid });
    this.dealToEnemy(a, t, base, { viaHero: false });
  }

  private tickAssistants(): void {
    const assistants = this.data.herosContent.assistants;
    const reduce = stat(this.stats, 'assistReduce');
    assistants.forEach((as, i) => {
      this.assistCounters[i]++;
      const need = Math.max(1, as.intervalle_tours - reduce);
      if (this.assistCounters[i] < need) return;
      this.assistCounters[i] = 0;
      this.events.push({ t: 'assistant', index: i, nom: as.hero });
      const cap = as.capacite;
      const sec = as.secondaire;
      const hero = this.data.heros.heros.find((h) => h.nom === as.hero);
      const el = (hero?.element ?? null) as Element | null;
      if (cap.type === 'degats_zone') {
        const base = this.heroAtk.mul(1 + stat(this.stats, 'atkPct')).mul(cap.puissance);
        const src = mk({ uid: 0, side: 'ally', kind: 'pet', nom: as.hero, element: el });
        for (const e of this.vivants()) {
          this.dealToEnemy(src, e, base, { viaHero: false });
          if (sec.type === 'etourdit') this.stunEnemy(e, sec.duree ?? 1);
        }
      } else if (cap.type === 'soin') {
        this.heal(this.hero.maxHp.mul(cap.puissance));
      }
      if (sec.type === 'bouclier') {
        const add = this.hero.maxHp.mul(sec.puissance ?? 0.08);
        this.shield = this.shield.add(add);
        this.events.push({ t: 'shield', dst: this.hero.uid, amount: add });
      }
    });
  }

  private heal(amount: Decimal): void {
    if (this.hero.hp.lte(0)) return;
    const before = this.hero.hp;
    this.hero.hp = Decimal.min(this.hero.maxHp, this.hero.hp.add(amount));
    const gained = this.hero.hp.sub(before);
    if (gained.gt(0)) this.events.push({ t: 'heal', dst: this.hero.uid, amount: gained });
  }

  private checkDeath(e: Fighter): void {
    if (!e.alive || e.hp.gt(0)) {
      this.checkRenforts(e);
      return;
    }
    e.alive = false;
    e.hp = ZERO;
    this.kills++;
    this.events.push({ t: 'death', uid: e.uid });
    const hk = stat(this.stats, 'healOnKill');
    if (hk > 0) this.heal(this.hero.maxHp.mul(hk));
  }

  private checkRenforts(e: Fighter): void {
    const pat = e.spec?.pattern;
    if (!pat || !e.alive) return;
    const frac = e.hp.div(e.maxHp).toNumber();
    if (!e.enrage && frac < pat.enrage_sous) {
      e.enrage = true;
      this.events.push({ t: 'status', dst: e.uid, nom: 'enrage' });
    }
    while (e.renfortsFaits < pat.renforts.length && frac < pat.renforts[e.renfortsFaits]) {
      e.renfortsFaits++;
      const n = pat.renforts_nombre ?? 2;
      for (let i = 0; i < n; i++) {
        const base = this.ctx.renfort?.(e.spec!);
        if (base) this.addEnemy(base, this.enemies.length, true);
      }
    }
  }

  // ---------------------------------------------------------------- camp ennemi
  private enemyUpdate(e: Fighter, dt: number, enrageGlobal: number): void {
    // poison recu
    if (e.poison) {
      const d = e.poison.dps.mul(dt);
      e.hp = e.hp.sub(d);
      e.poison.t -= dt;
      if (e.poison.t <= 0) e.poison = null;
      if (e.hp.lte(0)) {
        this.events.push({ t: 'hit', src: this.hero.uid, dst: e.uid, amount: d, crit: false, mult: 1, element: null, viaPoison: true });
        this.checkDeath(e);
        return;
      }
    }
    if (e.stun > 0) {
      e.stun -= dt;
      return;
    }
    const spec = e.spec!;
    const enr = (e.enrage ? spec.pattern?.enrage_atk ?? 1 : 1) * enrageGlobal;
    // preparation (charge / attaque lourde)
    if (e.prep > 0) {
      e.prep -= dt;
      if (e.prep <= 0) {
        e.prep = 0;
        this.enemyHit(e, e.prepMult * enr, false);
        e.cd = Math.max(e.cd, 0.4);
      }
      return;
    }
    if (e.caché > 0) {
      e.caché -= dt;
      if (e.caché <= 0) {
        e.caché = 0;
        this.enemyHit(e, (spec.def?.embuscade_mult ?? 3) * enr, false);
        e.cd = spec.intervalle;
      }
      return;
    }
    // attaque lourde des (mini-)boss
    if (spec.pattern) {
      e.lourdeCd -= dt;
      if (e.lourdeCd <= 0) {
        e.lourdeCd = spec.pattern.lourde_toutes_s;
        e.prep = spec.pattern.lourde_prep;
        e.prepMult = spec.pattern.lourde_mult;
        this.events.push({ t: 'telegraph', src: e.uid, dur: e.prep });
        return;
      }
    }
    e.cd -= dt;
    if (e.cd > 0) return;
    e.cd += spec.intervalle / (e.enrage ? 1.2 : 1);
    if (spec.comportement === 'charge') {
      e.prep = spec.def!.charge_prep ?? 1;
      e.prepMult = spec.def!.charge_mult ?? 2;
      this.events.push({ t: 'telegraph', src: e.uid, dur: e.prep });
      return;
    }
    this.enemyHit(e, enr, spec.comportement === 'distance');
  }

  private enemyHit(e: Fighter, mult: number, ranged: boolean): void {
    if (this.hero.hp.lte(0)) return;
    const spec = e.spec!;
    this.events.push({ t: ranged ? 'projectile' : 'attack', src: e.uid, dst: this.hero.uid });
    const dodge = stat(this.stats, 'dodge');
    if (dodge > 0 && this.rng.chance(Math.min(0.75, dodge))) {
      this.events.push({ t: 'miss', src: e.uid, dst: this.hero.uid });
      return;
    }
    const em = multElement(this.data, e.element, this.hero.element);
    const dr = Math.min(0.8, stat(this.stats, 'dr'));
    const dmg = e.atk.mul(mult * em * (1 - dr));
    this.hurtHero(dmg, e, em);
    if (!ranged) {
      const th = stat(this.stats, 'thorns');
      if (th > 0 && e.alive) {
        const back = this.heroAtk.mul(1 + stat(this.stats, 'atkPct')).mul(th);
        e.hp = e.hp.sub(back);
        this.events.push({ t: 'hit', src: this.hero.uid, dst: e.uid, amount: back, crit: false, mult: 1, element: null, thorns: true });
        this.checkDeath(e);
      }
    }
    const def = spec.def;
    if (def?.comportement === 'poison' && !this.ended) {
      const dps = e.atk.mul(def.poison_dps ?? 0.2);
      this.heroPoison.push({ dps, t: def.poison_duree ?? 4 });
      if (this.heroPoison.length > 4) this.heroPoison.shift();
      this.weakT = def.poison_duree ?? 4;
      this.weakPct = def.faiblesse ?? 0.08;
      this.events.push({ t: 'status', dst: this.hero.uid, nom: 'poison' });
    }
  }

  private hurtHero(dmg: Decimal, src: Fighter, mult: number, silent = false): void {
    let rest = dmg;
    if (this.shield.gt(0)) {
      const ab = Decimal.min(this.shield, rest);
      this.shield = this.shield.sub(ab);
      rest = rest.sub(ab);
    }
    this.hero.hp = this.hero.hp.sub(rest);
    if (!silent) this.events.push({ t: 'hit', src: src.uid, dst: this.hero.uid, amount: dmg, crit: false, mult, element: src.element });
    if (this.hero.hp.lte(0)) {
      this.hero.hp = ZERO;
      this.hero.alive = false;
      this.end(false);
    }
  }

  private tickPoisons(span: number): void {
    if (!this.heroPoison.length) return;
    let total = ZERO;
    for (const p of this.heroPoison) {
      total = total.add(p.dps.mul(Math.min(span, p.t)));
      p.t -= span;
    }
    this.heroPoison = this.heroPoison.filter((p) => p.t > 0);
    const dr = Math.min(0.8, stat(this.stats, 'dr'));
    const dmg = total.mul(1 - dr);
    let rest = dmg;
    if (this.shield.gt(0)) {
      const ab = Decimal.min(this.shield, rest);
      this.shield = this.shield.sub(ab);
      rest = rest.sub(ab);
    }
    this.hero.hp = this.hero.hp.sub(rest);
    this.events.push({ t: 'hit', src: 0, dst: this.hero.uid, amount: dmg, crit: false, mult: 1, element: null, viaPoison: true });
    if (this.hero.hp.lte(0)) {
      this.hero.hp = ZERO;
      this.hero.alive = false;
      this.end(false);
    }
  }

  private end(victoire: boolean): void {
    if (this.ended) return;
    this.ended = true;
    this.result = { victoire, duree: this.time };
  }
}

export { D };
