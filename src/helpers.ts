import { MODULE_ID, FLAG_KEY } from './constants.js';

export const PATH = '/modules/scenery';

// Extend CONFIG.debug type to include scenery
declare global {
  interface CONFIG {
    debug: {
      scenery?: boolean;
    } & Record<string, boolean>;
  }
}

/**
 * Variation data structure
 */
export interface Variation {
  name: string;
  file: string;
}

/**
 * Scenery flag data stored in scene
 */
export interface SceneryData {
  bg: string;
  gm: string;
  pl: string;
  variations: Variation[];
}

/**
 * Prints formatted console msg if string, otherwise dumps object
 * @param data - Output to be dumped
 * @param force - Log output even if CONFIG.debug.scenery = false
 */
export function log(data: string | unknown, force = false): void {
  if (CONFIG.debug?.scenery || force) {
    if (typeof data === 'string') {
      // eslint-disable-next-line no-console
      console.log(`Scenery | ${data}`);
    } else {
      // eslint-disable-next-line no-console
      console.log(data);
    }
  }
}

/**
 * Get scenery data from a scene's flags
 * @param scene - The scene to get data from
 * @returns Scenery data or undefined if not set
 */
export function getSceneryData(scene: Scene | undefined): SceneryData | undefined {
  if (!scene) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sceneFlags = (scene.flags as any)?.[MODULE_ID] as { [FLAG_KEY]?: SceneryData } | undefined;
  return sceneFlags?.[FLAG_KEY];
}

/**
 * Set scenery data on a scene's flags
 * @param scene - The scene to set data on
 * @param data - The scenery data to set
 */
export async function setSceneryData(scene: Scene | undefined, data: SceneryData): Promise<void> {
  if (!scene) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (scene as any).setFlag(MODULE_ID, FLAG_KEY, data);
}

/**
 * Get the appropriate image for the current user (GM or Player)
 * @param data - Scenery data containing GM and Player images
 * @returns The image path for the current user's role
 */
export function getUserImage(data: SceneryData): string {
  return game.user?.isGM ? data.gm : data.pl;
}
