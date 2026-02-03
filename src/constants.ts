/**
 * Scenery Module Constants
 * Centralized location for all magic strings, numbers, and configuration values
 */

/** Module identifier used throughout Foundry VTT */
export const MODULE_ID = 'scenery';

/** Flag key used to store scenery data in scene documents */
export const FLAG_KEY = 'data';

/** Icon classes used in the UI */
export const ICONS = {
  APP: 'fas fa-images',
  PREVIEW: 'fa fa-eye',
  DELETE: 'fa fa-trash',
  ADD: 'fa fa-plus',
  SCAN: 'fas fa-search',
  OK: 'fa fa-check',
} as const;

/** Variation names and defaults */
export const VARIATIONS = {
  DEFAULT_NAME: 'Default',
  EMPTY: { name: '', file: '' },
} as const;

/** Window/dialog configuration */
export const WINDOW = {
  WIDTH: 700,
  HEIGHT: 'auto',
  MIN_HEIGHT_CONTENT: 300,
  MIN_HEIGHT_WINDOW: 350,
  MAX_HEIGHT_WINDOW: '80vh',
  MAX_HEIGHT_TABLE: '60vh',
  ICON: 'fas fa-images',
  CLASSES: ['scenery'],
} as const;

/** Settings keys */
export const SETTINGS = {
  SHOW_VARIATIONS_LABEL: 'showVariationsLabel',
} as const;

/** Template paths */
export const TEMPLATES = {
  SCENERY: '/modules/scenery/templates/scenery.hbs',
  VARIATION: '/modules/scenery/templates/variation.hbs',
  FOOTER: 'templates/generic/form-footer.hbs',
} as const;

/** Button labels (i18n keys) */
export const I18N_KEYS = {
  APP_NAME: 'SCENERY.APP_NAME',
  BUTTON_SCAN: 'SCENERY.BUTTON_SCAN',
  BUTTON_ADD: 'SCENERY.BUTTON_ADD',
  BUTTON_OK: 'SCENERY.BUTTON_OK',
  ERROR_SELECTION: 'SCENERY.ERROR_SELECTION',
  LOADING: 'SCENERY.LOADING',
  SETTING_SHOW_VARIATIONS: 'SCENERY.SETTING_SHOW_VARIATIONS',
  SETTING_SHOW_VARIATIONS_HINT: 'SCENERY.SETTING_SHOW_VARIATIONS_HINT',
} as const;
