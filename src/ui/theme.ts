// Theme central de l'interface : couleurs des raretes (GDD 2), halos S / SS, matieres du bathyscaphe (guide de style 13).
// Toute couleur d'UI liee a une rarete passe par ce fichier (CSS : variables --rar-*, posees par appliquerTheme()).

export const RARETES = ['commun', 'original', 'rare', 'epique', 'legendaire', 'mythique'] as const;
export type RareteObjet = (typeof RARETES)[number];
export type RangSpecial = 'S' | 'SS' | null;

/** Couleurs des raretes, decidees par le porteur : Commun gris, Original vert, Rare bleu, Epique violet, Legendaire jaune, Mythique rouge. */
export const COULEUR_RARETE: Record<RareteObjet, string> = {
  commun: '#9aa3ab',
  original: '#4fc35a',
  rare: '#3d8bff',
  epique: '#a15cf0',
  legendaire: '#f4c430',
  mythique: '#e8403a',
};

/** Halos des rangs S (blanc) et SS (rouge rubis), sigle en bas a droite de l'icone. */
export const HALO_RANG: Record<'S' | 'SS', string> = { S: '#ffffff', SS: '#c3142d' };

/** Raretes des mutations de partie (commune / rare / epique) rattachees aux couleurs communes. */
export const RARETE_MUTATION: Record<string, RareteObjet> = { commune: 'commun', rare: 'rare', epique: 'epique' };

/** Matieres de l'interface (bathyscaphe dans l'obscurite). */
export const MATIERES = {
  verreHaut: '#10212c',
  verreBas: '#060e15',
  laiton: '#c9a24a',
  laitonFonce: '#6e5320',
  laitonClair: '#f0d48a',
  acier: '#5d6b74',
  acierFonce: '#2a3238',
  phosphore: '#5dffa8',
  phosphoreFonce: '#0b3a24',
  ambre: '#f0a838',
  ambreFonce: '#6a300c',
  vie: '#6af0a8',
  vieFonce: '#14804a',
  xp: '#9a78ff',
  progression: '#7af4ff',
  or: '#c8a040',
  gemmes: '#1aa8a0',
  energie: '#ffb040',
} as const;

export const num = (hex: string): number => parseInt(hex.replace('#', ''), 16);

/** Pose les variables CSS du theme sur :root (appele une fois au demarrage). */
export function appliquerTheme(root: HTMLElement = document.documentElement): void {
  for (const r of RARETES) root.style.setProperty(`--rar-${r}`, COULEUR_RARETE[r]);
  root.style.setProperty('--halo-s', HALO_RANG.S);
  root.style.setProperty('--halo-ss', HALO_RANG.SS);
  for (const [k, v] of Object.entries(MATIERES)) root.style.setProperty(`--${k}`, v);
}

/** Icone d'objet (HTML) : cadre a la couleur de rarete, halo S/SS et sigle en bas a droite. */
export function iconeObjet(rarete: RareteObjet, rang: RangSpecial = null, contenu = '', titre = ''): string {
  const halo = rang ? ` halo-${rang.toLowerCase()}` : '';
  const sigle = rang ? `<span class="sigle">${rang}</span>` : '';
  return `<div class="icone-objet${halo}" style="--c:${COULEUR_RARETE[rarete]}" title="${titre}">${contenu}${sigle}</div>`;
}
