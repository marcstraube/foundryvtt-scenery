import { MODULE_ID, FLAG_KEY, SETTINGS } from './constants.js';

// Extend CONFIG.debug type to include scenery
declare global {
  interface CONFIG {
    debug: {
      scenery?: boolean;
    } & Record<string, boolean>;
  }
}

/**
 * Minimal typed interface for Foundry's ClientSettings.
 * Avoids `any` casts when accessing game.settings.
 */
interface FoundrySettingsClient {
  get(module: string, key: string): unknown;
  register(module: string, key: string, data: Record<string, unknown>): void;
}

/** Minimal type for Foundry embedded document collections */
interface EmbeddedCollection extends Iterable<{ id: string; toObject(): object }> {
  size: number;
}

/** Scene methods for embedded document CRUD */
interface SceneDocumentMethods {
  deleteEmbeddedDocuments(type: string, ids: string[]): Promise<unknown>;
  createEmbeddedDocuments(type: string, data: object[]): Promise<unknown>;
}

/**
 * Variation data structure
 * Each variation can have separate GM and Player backgrounds
 */
export interface Variation {
  name: string;
  gmBackground: string; // What GM sees
  plBackground: string; // What Player sees (can be === gmBackground)
  sceneData?: SceneElementData;
}

/**
 * Legacy variation format (pre-migration)
 */
export interface LegacyVariation {
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
  activeVariationIndex: number; // 0 = Default, 1+ = Variations
  variations: Variation[]; // Index 0 is always the Default variation
}

/**
 * Legacy scenery data format (pre-migration)
 */
export interface LegacySceneryData {
  bg: string;
  gm: string;
  pl: string;
  variations: LegacyVariation[];
  defaultSceneData?: SceneElementData;
}

/**
 * Get a module setting value
 * @param key - Setting key from SETTINGS constant
 * @returns The setting value, or undefined if not available
 */
export function getSetting(key: string): unknown {
  try {
    return (game.settings as FoundrySettingsClient)?.get(MODULE_ID, key);
  } catch {
    return undefined;
  }
}

/**
 * Get which element types are managed by variations (not global).
 * Returns a SceneElementSelection where true = variation-managed.
 */
export function getVariationManagedSelection(): SceneElementSelection {
  return {
    lights: !getSetting(SETTINGS.GLOBAL_LIGHTS),
    sounds: !getSetting(SETTINGS.GLOBAL_SOUNDS),
    tiles: !getSetting(SETTINGS.GLOBAL_TILES),
    walls: !getSetting(SETTINGS.GLOBAL_WALLS),
    drawings: !getSetting(SETTINGS.GLOBAL_DRAWINGS),
    templates: !getSetting(SETTINGS.GLOBAL_TEMPLATES),
    regions: !getSetting(SETTINGS.GLOBAL_REGIONS),
    notes: !getSetting(SETTINGS.GLOBAL_NOTES),
  };
}

/**
 * Check if debug logging is enabled
 * @returns true if debug logging is enabled via setting or CONFIG.debug.scenery
 */
export function isDebugEnabled(): boolean {
  // Check setting first (if game is ready)
  try {
    const settingEnabled = (game.settings as FoundrySettingsClient)?.get(
      MODULE_ID,
      SETTINGS.DEBUG_LOGGING
    );
    if (settingEnabled) return true;
  } catch {
    // Settings not available yet, ignore
  }
  // Fall back to CONFIG.debug.scenery
  return CONFIG.debug?.scenery ?? false;
}

/**
 * Clean a file path by trimming whitespace and removing trailing commas
 * @param path - Path to clean
 * @returns Cleaned path string
 */
export function cleanPath(path: unknown): string {
  if (typeof path !== 'string' || !path) return '';
  return path.trim().replace(/,+$/, '');
}

/**
 * Prints formatted console msg if string, otherwise dumps object
 * @param data - Output to be dumped
 * @param force - Log output even if debug logging is disabled
 */
export function log(data: string | unknown, force = false): void {
  if (isDebugEnabled() || force) {
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
 * Automatically migrates legacy data format if detected
 * @param scene - The scene to get data from
 * @returns Scenery data or undefined if not set
 */
export function getSceneryData(scene: Scene | undefined): SceneryData | undefined {
  if (!scene) return undefined;
  const sceneFlags = (scene.flags as Record<string, Record<string, unknown> | undefined>)?.[
    MODULE_ID
  ] as { [FLAG_KEY]?: SceneryData | LegacySceneryData } | undefined;
  const data = sceneFlags?.[FLAG_KEY];

  if (!data) return undefined;

  // Auto-migrate legacy data
  if (isLegacyData(data)) {
    log('[MIGRATION] Detected legacy scenery data, migrating...');
    return migrateSceneryData(data);
  }

  return data as SceneryData;
}

/**
 * Set scenery data on a scene's flags
 * @param scene - The scene to set data on
 * @param data - The scenery data to set
 */
export async function setSceneryData(scene: Scene | undefined, data: SceneryData): Promise<void> {
  if (!scene) return;
  // Clean save: include new format fields and explicitly null out legacy fields
  // This ensures old 'bg', 'gm', 'pl' don't interfere with isLegacyData check
  const cleanData = {
    activeVariationIndex: data.activeVariationIndex,
    variations: data.variations,
    // Explicitly remove legacy fields by setting to null (Foundry will delete them)
    bg: null,
    gm: null,
    pl: null,
    defaultSceneData: null,
  };
  await (
    scene as unknown as { setFlag(scope: string, key: string, value: unknown): Promise<void> }
  ).setFlag(MODULE_ID, FLAG_KEY, cleanData);
}

/**
 * Get the active variation from scenery data
 * @param data - Scenery data
 * @returns The active Variation or undefined if not found
 */
export function getActiveVariation(data: SceneryData): Variation | undefined {
  return data.variations[data.activeVariationIndex];
}

/**
 * Get the appropriate image for the current user (GM or Player)
 * @param data - Scenery data containing variations
 * @returns The image path for the current user's role
 */
export function getUserImage(data: SceneryData): string {
  const variation = getActiveVariation(data);
  if (!variation) return '';
  return game.user?.isGM ? variation.gmBackground : variation.plBackground;
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
 * @param selection - Optional selection of which element types to restore.
 *   If a type is false (= global), restoreDocumentType is skipped for that type.
 * @returns True if successful, false otherwise
 */
export async function restoreSceneElements(
  scene: Scene,
  sceneData: SceneElementData,
  selection?: SceneElementSelection
): Promise<boolean> {
  if (!scene) return false;

  try {
    log('Restoring scene elements...');
    // Restore each document type (skip global types when selection provided)
    if (!selection || selection.lights !== false)
      await restoreDocumentType(scene, 'AmbientLight', sceneData.lights);
    if (!selection || selection.sounds !== false)
      await restoreDocumentType(scene, 'AmbientSound', sceneData.sounds);
    if (!selection || selection.tiles !== false)
      await restoreDocumentType(scene, 'Tile', sceneData.tiles);
    if (!selection || selection.walls !== false)
      await restoreDocumentType(scene, 'Wall', sceneData.walls);
    if (!selection || selection.drawings !== false)
      await restoreDocumentType(scene, 'Drawing', sceneData.drawings);
    if (!selection || selection.templates !== false)
      await restoreDocumentType(scene, 'MeasuredTemplate', sceneData.templates);
    if (!selection || selection.regions !== false)
      await restoreDocumentType(scene, 'Region', sceneData.regions);
    if (!selection || selection.notes !== false)
      await restoreDocumentType(scene, 'Note', sceneData.notes);

    log('Scene elements restored successfully');
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

  const sceneRecord = scene as unknown as Record<string, EmbeddedCollection | undefined>;
  const collection = sceneRecord[collectionName];
  if (!collection) {
    log(`WARNING: Collection "${collectionName}" not found for ${documentType}!`);
    return;
  }

  log(
    `Restoring ${documentType} (collection: ${collectionName}, current: ${collection.size}, target: ${targetDocs.length})`
  );

  // Get current document IDs
  const currentIds = Array.from(collection).map((doc) => doc.id);

  // Simple approach: if counts match and both are 0, nothing to do
  if (currentIds.length === 0 && targetDocs.length === 0) {
    log(`${documentType}: nothing to do (both empty)`);
    return;
  }

  const sceneDoc = scene as unknown as SceneDocumentMethods;

  // Delete all current documents first (if any)
  if (currentIds.length > 0) {
    log(`Deleting ${currentIds.length} ${documentType} documents`);
    await sceneDoc.deleteEmbeddedDocuments(documentType, currentIds);
  }

  // Create all target documents (if any), stripping _id to let Foundry assign new ones
  if (targetDocs.length > 0) {
    log(`Creating ${targetDocs.length} ${documentType} documents`);
    const docsWithoutIds = targetDocs.map((doc) => {
      const { _id, ...rest } = doc as Record<string, unknown>;
      return rest;
    });
    await sceneDoc.createEmbeddedDocuments(documentType, docsWithoutIds);
  }

  log(`${documentType}: ${currentIds.length} deleted, ${targetDocs.length} created`);
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

/**
 * Parse a comma-separated identifier string into an array of lowercase tokens.
 * Empty input returns an empty array (disables detection).
 * @param value - Comma-separated string of identifiers
 * @returns Deduplicated array of lowercase tokens
 */
export function parseIdentifiers(value: string): string[] {
  if (!value || !value.trim()) return [];
  const seen = new Set<string>();
  return value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => {
      if (!s || seen.has(s)) return false;
      seen.add(s);
      return true;
    });
}

/**
 * Classify a map file as GM, Player, or Neutral based on token matching.
 * Splits the filename by separators and checks each token against identifier lists.
 * GM identifiers take priority over Player if both match.
 * @param fileName - Base filename without extension
 * @param gmIds - Lowercase GM identifier tokens
 * @param plIds - Lowercase Player identifier tokens
 * @returns Classification result with matched token
 */
export function classifyMapFile(
  fileName: string,
  gmIds: string[],
  plIds: string[]
): { category: 'gm' | 'player' | 'neutral'; matchedToken?: string } {
  const tokens = fileName.split(/[-_ .]+/);
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (gmIds.includes(lower)) {
      return { category: 'gm', matchedToken: token };
    }
  }
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (plIds.includes(lower)) {
      return { category: 'player', matchedToken: token };
    }
  }
  return { category: 'neutral' };
}

/**
 * Remove a matched token and its adjacent separator from a filename.
 * Preserves the rest of the filename structure.
 * @param fileName - Base filename without extension
 * @param token - The token to remove (case-insensitive)
 * @returns Filename with the token and one adjacent separator removed
 */
export function removeTokenFromFileName(fileName: string, token: string): string {
  // Split by separators, keeping separators as separate elements
  const parts = fileName.split(/([-_ .])/);
  const tokenLower = token.toLowerCase();

  // Find the index of the matched token
  let tokenIndex = -1;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part && part.toLowerCase() === tokenLower) {
      tokenIndex = i;
      break;
    }
  }

  if (tokenIndex === -1) return fileName;

  // Remove the token
  const result = [...parts];
  result.splice(tokenIndex, 1);

  // Remove one adjacent separator (prefer preceding, fallback to following)
  const preceding = tokenIndex > 0 ? result[tokenIndex - 1] : undefined;
  const following = tokenIndex < result.length ? result[tokenIndex] : undefined;
  if (preceding && /^[-_ .]$/.test(preceding)) {
    result.splice(tokenIndex - 1, 1);
  } else if (following && /^[-_ .]$/.test(following)) {
    result.splice(tokenIndex, 1);
  }

  return result.join('');
}

/**
 * Normalize a filename for pairing by splitting into lowercase tokens and joining with underscore.
 * @param fileName - Base filename without extension
 * @returns Normalized key string
 */
export function normalizeForPairing(fileName: string): string {
  return fileName
    .split(/[-_ .]+/)
    .map((s) => s.toLowerCase())
    .filter((s) => s.length > 0)
    .join('_');
}

/**
 * Compute a clean grouping key by normalizing and removing the matched token.
 * Used for grouping GM/Player files that should be paired together.
 * @param fileName - Base filename without extension
 * @param token - The token to remove (will be lowercased)
 * @returns Clean key string for grouping
 */
export function computeCleanKey(fileName: string, token: string): string {
  const tokenLower = token.toLowerCase();
  return fileName
    .split(/[-_ .]+/)
    .map((s) => s.toLowerCase())
    .filter((s) => s.length > 0 && s !== tokenLower)
    .join('_');
}

/**
 * Check if scenery data is in legacy format
 * @param data - Data to check
 * @returns True if data is in legacy format
 */
export function isLegacyData(data: unknown): data is LegacySceneryData {
  if (!data || typeof data !== 'object') return false;
  // New format has 'activeVariationIndex' - if present, it's NOT legacy
  // (Foundry's setFlag merges data, so old properties might still exist)
  if ('activeVariationIndex' in data) return false;
  // Legacy format has 'bg', 'gm', 'pl' properties without activeVariationIndex
  return 'bg' in data && 'gm' in data && 'pl' in data;
}

/**
 * Migrate legacy scenery data to new format
 * @param oldData - Legacy scenery data
 * @returns Migrated SceneryData
 */
export function migrateSceneryData(oldData: LegacySceneryData): SceneryData {
  const gmPath = cleanPath(oldData.gm);
  const bgPath = cleanPath(oldData.bg);

  // Default variation (index 0)
  const variations: Variation[] = [
    {
      name: 'Default',
      gmBackground: bgPath,
      plBackground: bgPath,
      sceneData: oldData.defaultSceneData,
    },
  ];

  // Find active variation based on old gm/pl values
  let activeIndex = 0;

  // Convert other variations
  if (oldData.variations && Array.isArray(oldData.variations)) {
    oldData.variations.forEach((v, i) => {
      const filePath = cleanPath(v.file);
      variations.push({
        name: v.name || `Variation ${i + 1}`,
        gmBackground: filePath,
        plBackground: filePath,
        sceneData: v.sceneData,
      });

      // Check if this variation was the active one for GM
      if (filePath === gmPath) {
        activeIndex = i + 1; // +1 because Default is at index 0
      }
    });
  }

  // If GM was using default background, activeIndex stays 0
  // If GM was using a variation not in the list, default to 0 as well

  log(
    `[MIGRATION] Migrated ${oldData.variations?.length || 0} variations, activeIndex=${activeIndex}`
  );

  return {
    activeVariationIndex: activeIndex,
    variations,
  };
}
