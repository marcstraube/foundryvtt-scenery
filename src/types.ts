/**
 * TypeScript type definitions for Scenery module
 * Re-exports types from helpers for convenience
 */

export type { Variation, SceneryData } from './helpers.js';

/**
 * Extended Scene flags with scenery data
 */
export interface SceneFlags {
  scenery?: {
    data?: import('./helpers.js').SceneryData;
  };
}

/**
 * Form data structure for parsing variation form submissions
 */
export interface VariationFormData {
  [key: `variations.${number}.name`]: string;
  [key: `variations.${number}.file`]: string;
  gm: string;
  pl: string;
}

/**
 * Context data for template rendering
 */
export interface SceneryContext {
  variations: import('./helpers.js').Variation[];
  gm: string;
  pl: string;
  buttons: Array<{
    type: string;
    action?: string;
    icon: string;
    label: string;
  }>;
}

/**
 * Constructor options for Scenery
 */
export interface SceneryOptions {
  document?: Scene;
  sceneId?: string;
}

/**
 * Extended Scene type with scenery custom properties
 */
export interface SceneryScene extends Scene {
  _sceneryCustomBackground?: string;
  _sceneryOriginalBackground?: string;
  _sceneryPendingBackground?: string;
}

/**
 * Helper type for partial Scene updates with scenery data
 */
export type SceneUpdate = Partial<Scene> & {
  flags?: {
    scenery?: {
      data?: import('./helpers.js').SceneryData;
    };
  };
  background?: {
    src: string;
  };
};
