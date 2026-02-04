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
  sceneData?: SceneElementData;
}

/**
 * Scene element data captured for a variation
 */
export interface SceneElementData {
  lights: object[];
  sounds: object[];
  tiles: object[];
  walls: object[];
  drawings: object[];
  templates: object[];
  regions: object[];
  notes: object[];
}

/**
 * Selection for scene element capture
 */
export interface SceneElementSelection {
  lights?: boolean;
  sounds?: boolean;
  tiles?: boolean;
  walls?: boolean;
  drawings?: boolean;
  templates?: boolean;
  regions?: boolean;
  notes?: boolean;
}

/**
 * Scenery flag data stored in scene
 */
export interface SceneryData {
  bg: string;
  gm: string;
  pl: string;
  variations: Variation[];
  defaultSceneData?: SceneElementData; // Scene elements for the default background
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

/**
 * Capture scene elements from the current scene
 * @param scene - The scene to capture from (defaults to canvas.scene)
 * @param selection - Optional selection of which element types to capture
 * @returns Captured scene element data or null if no scene available
 */
export function captureSceneElements(
  scene?: Scene,
  selection: SceneElementSelection = {
    lights: true,
    sounds: true,
    tiles: true,
    walls: true,
    drawings: true,
    templates: true,
    regions: true,
    notes: true,
  }
): SceneElementData | null {
  const targetScene = scene || canvas?.scene;
  if (!targetScene) return null;

  return {
    lights: selection.lights ? Array.from(targetScene.lights).map((light) => light.toObject()) : [],
    sounds: selection.sounds ? Array.from(targetScene.sounds).map((sound) => sound.toObject()) : [],
    tiles: selection.tiles ? Array.from(targetScene.tiles).map((tile) => tile.toObject()) : [],
    walls: selection.walls ? Array.from(targetScene.walls).map((wall) => wall.toObject()) : [],
    drawings: selection.drawings
      ? Array.from(targetScene.drawings).map((drawing) => drawing.toObject())
      : [],
    templates: selection.templates
      ? Array.from(targetScene.templates).map((template) => template.toObject())
      : [],
    regions: selection.regions
      ? Array.from(targetScene.regions).map((region) => region.toObject())
      : [],
    notes: selection.notes ? Array.from(targetScene.notes).map((note) => note.toObject()) : [],
  };
}

/**
 * Restore scene elements to the scene
 * @param scene - The scene to restore to
 * @param sceneData - The scene element data to restore
 * @returns True if successful, false otherwise
 */
export async function restoreSceneElements(
  scene: Scene,
  sceneData: SceneElementData
): Promise<boolean> {
  if (!scene) return false;

  try {
    log('Restoring scene elements...', true);
    // Restore each document type
    await restoreDocumentType(scene, 'AmbientLight', sceneData.lights);
    await restoreDocumentType(scene, 'AmbientSound', sceneData.sounds);
    await restoreDocumentType(scene, 'Tile', sceneData.tiles);
    await restoreDocumentType(scene, 'Wall', sceneData.walls);
    await restoreDocumentType(scene, 'Drawing', sceneData.drawings);
    await restoreDocumentType(scene, 'MeasuredTemplate', sceneData.templates);
    await restoreDocumentType(scene, 'Region', sceneData.regions);
    await restoreDocumentType(scene, 'Note', sceneData.notes);

    log('Scene elements restored successfully', true);
    return true;
  } catch (error) {
    console.error('Scenery | Error restoring scene elements:', error);
    return false;
  }
}

/**
 * Restore a specific document type using differential updates
 * @param scene - The scene to update
 * @param documentType - Type of embedded document
 * @param targetDocs - Target documents to restore
 */
async function restoreDocumentType(
  scene: Scene,
  documentType: string,
  targetDocs: object[]
): Promise<void> {
  // Get collection name from document type
  const collectionName =
    documentType === 'AmbientLight'
      ? 'lights'
      : documentType === 'AmbientSound'
        ? 'sounds'
        : documentType === 'Tile'
          ? 'tiles'
          : documentType === 'Wall'
            ? 'walls'
            : documentType === 'Drawing'
              ? 'drawings'
              : documentType === 'MeasuredTemplate'
                ? 'templates'
                : documentType === 'Region'
                  ? 'regions'
                  : documentType === 'Note'
                    ? 'notes'
                    : 'walls';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const collection = (scene as any)[collectionName];
  if (!collection) {
    log(`WARNING: Collection "${collectionName}" not found for ${documentType}!`, true);
    return;
  }

  log(
    `Restoring ${documentType} (collection: ${collectionName}, current: ${collection.size}, target: ${targetDocs.length})`,
    true
  );

  // Build ID maps
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentMap = new Map(Array.from(collection).map((doc: any) => [doc.id, doc]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const targetMap = new Map(targetDocs.map((doc: any) => [doc._id, doc]));

  // Determine operations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toCreate = targetDocs.filter((doc: any) => !doc._id || !currentMap.has(doc._id));
  const toDelete = Array.from(currentMap.keys()).filter((id) => !targetMap.has(id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toUpdate = targetDocs.filter((doc: any) => {
    if (!doc._id || !currentMap.has(doc._id)) return false;
    // Check if document has changed (simple check - compare JSON strings)
    const current = currentMap.get(doc._id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JSON.stringify((current as any).toObject()) !== JSON.stringify(doc);
  });

  // Apply operations
  if (toCreate.length > 0) {
    log(`Creating ${toCreate.length} ${documentType} documents`, true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (scene as any).createEmbeddedDocuments(documentType, toCreate);
  }

  if (toUpdate.length > 0) {
    log(`Updating ${toUpdate.length} ${documentType} documents`, true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (scene as any).updateEmbeddedDocuments(documentType, toUpdate);
  }

  if (toDelete.length > 0) {
    log(`Deleting ${toDelete.length} ${documentType} documents`, true);
    log(`Delete IDs: ${toDelete.join(', ')}`, true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (scene as any).deleteEmbeddedDocuments(documentType, toDelete);
  }

  log(
    `${documentType}: ${toCreate.length} created, ${toUpdate.length} updated, ${toDelete.length} deleted`,
    true
  );
}

/**
 * Check if a variation has captured scene data
 * @param variation - The variation to check
 * @returns True if the variation has scene data
 */
export function hasSceneData(variation: Variation): boolean {
  return Boolean(
    variation.sceneData &&
    (variation.sceneData.lights.length > 0 ||
      variation.sceneData.sounds.length > 0 ||
      variation.sceneData.tiles.length > 0 ||
      variation.sceneData.walls.length > 0 ||
      variation.sceneData.drawings.length > 0 ||
      variation.sceneData.templates.length > 0 ||
      variation.sceneData.regions.length > 0 ||
      variation.sceneData.notes.length > 0)
  );
}

/**
 * Get a summary string of captured scene data
 * @param sceneData - The scene data to summarize
 * @returns Human-readable summary string
 */
export function getSceneDataSummary(sceneData?: SceneElementData): string {
  if (!sceneData) return '';

  const parts: string[] = [];
  if (sceneData.lights.length > 0) parts.push(`${sceneData.lights.length} lights`);
  if (sceneData.sounds.length > 0) parts.push(`${sceneData.sounds.length} sounds`);
  if (sceneData.tiles.length > 0) parts.push(`${sceneData.tiles.length} tiles`);
  if (sceneData.walls.length > 0) parts.push(`${sceneData.walls.length} walls`);
  if (sceneData.drawings.length > 0) parts.push(`${sceneData.drawings.length} drawings`);
  if (sceneData.templates.length > 0) parts.push(`${sceneData.templates.length} templates`);
  if (sceneData.regions.length > 0) parts.push(`${sceneData.regions.length} regions`);
  if (sceneData.notes.length > 0) parts.push(`${sceneData.notes.length} notes`);

  return parts.join(', ') || 'No elements';
}

/**
 * Get current scene element counts
 * @param scene - The scene to count elements from (defaults to canvas.scene)
 * @returns Object with counts for each element type
 */
export function getCurrentSceneCounts(scene?: Scene): Record<string, number> {
  const targetScene = scene || canvas?.scene;
  if (!targetScene)
    return {
      lights: 0,
      sounds: 0,
      tiles: 0,
      walls: 0,
      drawings: 0,
      templates: 0,
      regions: 0,
      notes: 0,
    };

  return {
    lights: targetScene.lights.size,
    sounds: targetScene.sounds.size,
    tiles: targetScene.tiles.size,
    walls: targetScene.walls.size,
    drawings: targetScene.drawings.size,
    templates: targetScene.templates.size,
    regions: targetScene.regions.size,
    notes: targetScene.notes.size,
  };
}
