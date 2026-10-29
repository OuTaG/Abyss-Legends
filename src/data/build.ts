// Construction des donnees de jeu (sans Vite : utilisable par les scripts Node) : config d'equilibrage (copie de /home/user/balance/config/),
// valeurs provisoires et contenu. Ajouter un monde = ajouter content/worlds/mondeN.json (decouvert automatiquement).
import difficulte from '../../config/balance/difficulte_niveaux.json';
import xpPartie from '../../config/balance/xp_partie.json';
import energie from '../../config/balance/energie.json';
import herosBalance from '../../config/balance/heros.json';
import tirages from '../../config/balance/tirages.json';
import economie from '../../config/balance/economie_sources.json';
import temps from '../../config/balance/temps_et_profils.json';
import provisoire from '../../config/provisoire.json';
import familles from '../../content/familles.json';
import herosContent from '../../content/heros.json';
import mutations from '../../content/mutations.json';
import rencontres from '../../content/rencontres.json';
import boutique from '../../content/boutique.json';
import type { WorldDef, FamillesData, MutationDef, EventDef, ShopArticle, Element, Stats, Rarete } from '../core/types';


export interface GameData {
  difficulte: typeof difficulte;
  xp: typeof xpPartie;
  energie: typeof energie;
  heros: typeof herosBalance;
  tirages: typeof tirages;
  economie: typeof economie;
  temps: typeof temps;
  prov: typeof provisoire;
  familles: FamillesData;
  herosContent: {
    passifs_element: Record<string, Stats>;
    affichage: Record<string, string>;
    heros_defaut: string;
    monture: { nom: string; element: Element | null; rarete: string; intervalle: number; part_degats: number; bonus: Stats };
    pets: { nom: string; element: Element | null; intervalle: number; part_degats: number }[];
    gardiens: { nom: string; element: Element | null; intervalle: number; part_degats: number }[];
    assistants: {
      hero: string; intervalle_tours: number; description: string;
      capacite: { type: string; puissance: number }; secondaire: { type: string; duree?: number; puissance?: number };
    }[];
    /** Catalogue du GDD (affichage seulement dans le prototype). */
    catalogue: {
      montures: { nom: string; rarete: string }[];
      gardiens: { nom: string; element: Element | null; rarete: string }[];
      armes: { element: Element | null; base: string; legendaire: string }[];
      pets: Record<string, string[]>;
    };
  };
  mutations: {
    raretes: Record<Rarete, { poids: number; couleur: string; pileMax: number; nom: string }>;
    mutations: MutationDef[];
  };
  rencontres: {
    epave: { pieces: [number, number]; chance_mutation: number; rarete_min_mutation: Rarete };
    grotte: { soin_pct: number };
    autel: { rarete_min: Rarete; couts: { id: string; texte: string; effets: any[]; conditionPieces?: number }[] };
    mysteres: EventDef[];
  };
  boutique: { stock: number; articles: ShopArticle[] };
  mondes: WorldDef[];
}

export function buildGameData(mondes: WorldDef[]): GameData {
  return {
    difficulte, xp: xpPartie, energie, heros: herosBalance, tirages, economie, temps,
    prov: provisoire,
    familles: familles as unknown as FamillesData,
    herosContent: herosContent as unknown as GameData['herosContent'],
    mutations: mutations as unknown as GameData['mutations'],
    rencontres: rencontres as unknown as GameData['rencontres'],
    boutique: boutique as unknown as GameData['boutique'],
    mondes: [...mondes].sort((a, b) => a.id - b.id),
  };
}

