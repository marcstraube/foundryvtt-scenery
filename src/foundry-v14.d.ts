/**
 * Type augmentations for Foundry VTT v14 Level API.
 *
 * In v14, scene backgrounds are accessed via the Level API:
 *   scene.firstLevel.background.src   (read)
 *   scene.firstLevel.background.src = value   (in-memory write)
 *   scene.firstLevel.update({"background.src": value})   (DB write)
 *
 * The old scene.background accessor still exists as a deprecated compat shim
 * but writing to it no longer works.
 *
 * These types are not yet in the community Foundry VTT type definitions,
 * so we declare them here as a helper interface.
 */

export interface SceneLevel {
  background: {
    src: string;
  };
  update(data: Record<string, unknown>): Promise<unknown>;
}

/**
 * Scene with v14 Level API properties.
 * Use this type when accessing firstLevel on a Scene object.
 */
export interface SceneWithLevels {
  firstLevel: SceneLevel;
}
