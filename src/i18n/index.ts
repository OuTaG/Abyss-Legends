// Traductions de l'interface. Langues prevues (GDD 1) : anglais, francais, japonais, coreen, chinois traditionnel.
// Une cle absente ou vide retombe sur l'anglais, puis sur le francais (langue de reference), puis sur la cle elle-meme.
// ja / ko / zh-Hant : fichiers prets (memes cles, valeurs vides) ; les traductions seront fournies par des traducteurs.
// Le contenu de jeu (noms d'ennemis, mutations, evenements) reste en francais dans content/ pour ce prototype.
import fr from './locales/fr.json';
import en from './locales/en.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import zhHant from './locales/zh-Hant.json';

export type Dictionnaire = Record<string, string>;
export const LANGUES = [
  { code: 'fr', nom: 'Français' },
  { code: 'en', nom: 'English' },
  { code: 'ja', nom: '日本語' },
  { code: 'ko', nom: '한국어' },
  { code: 'zh-Hant', nom: '繁體中文' },
] as const;
export type CodeLangue = (typeof LANGUES)[number]['code'];

export const DICTIONNAIRES: Record<CodeLangue, Dictionnaire> = { fr, en, ja, ko, 'zh-Hant': zhHant };
const REPLIS: CodeLangue[] = ['en', 'fr'];

let courante: CodeLangue = 'fr';

/** Langue de l'appareil la plus proche parmi celles prevues (zh-TW / zh-HK / zh-Hant -> zh-Hant). */
export function detecterLangue(prefs: readonly string[]): CodeLangue {
  for (const p of prefs) {
    const l = p.toLowerCase();
    if (l.startsWith('zh')) { if (/hant|tw|hk|mo/.test(l)) return 'zh-Hant'; continue; }
    const base = l.split('-')[0];
    const ok = LANGUES.find((x) => x.code === base);
    if (ok) return ok.code;
  }
  return 'en';
}

export function definirLangue(code: string, prefsAppareil: readonly string[] = []): CodeLangue {
  courante = code === 'auto' || !(code in DICTIONNAIRES) ? detecterLangue(prefsAppareil) : (code as CodeLangue);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = courante;
    document.documentElement.classList.toggle('cjk', ['ja', 'ko', 'zh-Hant'].includes(courante));
  }
  return courante;
}
export const langue = (): CodeLangue => courante;

/** Texte traduit ; {nom} est remplace par params.nom. */
export function t(cle: string, params: Record<string, string | number> = {}): string {
  let s = DICTIONNAIRES[courante][cle];
  for (const r of REPLIS) if (!s) s = DICTIONNAIRES[r][cle];
  if (!s) s = cle;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}
