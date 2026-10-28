// Point d'entree des donnees pour le jeu (Vite) : decouvre automatiquement content/worlds/*.json.
// Ajouter un monde = ajouter un fichier JSON dans content/worlds/, sans toucher au code.
import { buildGameData } from './build';
import type { WorldDef } from '../core/types';

export type { GameData } from './build';
const worldModules = import.meta.glob('../../content/worlds/*.json', { eager: true, import: 'default' }) as Record<string, WorldDef>;
export const GAME_DATA = buildGameData(Object.values(worldModules));
