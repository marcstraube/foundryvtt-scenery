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
  COPY: 'fa fa-copy',
  RESET: 'fa fa-undo',
  HAS_DATA: 'fa fa-check-circle',
  INFO: 'fa fa-info-circle',
  LIGHTBULB: 'fa fa-lightbulb',
  VOLUME: 'fa fa-volume-up',
  TILES: 'fa fa-th',
  WALLS: 'fa fa-vector-square',
  DRAWINGS: 'fa fa-pencil-alt',
  TEMPLATES: 'fa fa-ruler-combined',
  REGIONS: 'fa fa-draw-polygon',
  NOTES: 'fa fa-bookmark',
  CLEAR: 'fa fa-trash',
  CANCEL: 'fa fa-times',
} as const;

/** Variation names and defaults */
export const VARIATIONS = {
  DEFAULT_NAME: 'Default',
  EMPTY: { name: '', file: '' },
} as const;

/** Window/dialog configuration */
export const WINDOW = {
  WIDTH: 900,
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

/** CSS Selectors used in the UI */
export const SELECTORS = {
  TABLE_BODY: '.scenery-table tbody',
  ROW: 'tr',
  ROW_LAST: 'tr:last-child',
  CELL_NAME_INPUT: '.scenery-name input',
  CELL_FILE_INPUT: '.scenery-fp input',
  BUTTON_FILE_PICKER: 'button.file-picker',
  BUTTON_DELETE: 'button.delete',
  INPUT_IMAGE: 'input.image',
  INPUT_NAME: 'input[name*=".name"]',
  INPUT_FILE: 'input[name*=".file"]',
  INPUT_TEXT: 'input[type="text"]',
  RADIO_GM: 'input[name="gm"]:checked',
  RADIO_PLAYER: 'input[name="pl"]:checked',
} as const;

/** Template paths */
export const TEMPLATES = {
  SCENERY: '/modules/scenery/templates/scenery.hbs',
  VARIATION: '/modules/scenery/templates/variation.hbs',
  COPY_DIALOG: '/modules/scenery/templates/copy-dialog.hbs',
  FOOTER: 'templates/generic/form-footer.hbs',
} as const;

/** Button labels (i18n keys) */
export const I18N_KEYS = {
  APP_NAME: 'SCENERY.APP_NAME',
  BUTTON_SCAN: 'SCENERY.BUTTON_SCAN',
  BUTTON_ADD: 'SCENERY.BUTTON_ADD',
  BUTTON_OK: 'SCENERY.BUTTON_OK',
  BUTTON_COPY: 'SCENERY.BUTTON_COPY',
  BUTTON_CANCEL: 'SCENERY.BUTTON_CANCEL',
  LABEL_COPY: 'SCENERY.LABEL_COPY',
  COPY_SELECT_SOURCE: 'SCENERY.COPY_SELECT_SOURCE',
  COPY_SELECT_SOURCE_PLACEHOLDER: 'SCENERY.COPY_SELECT_SOURCE_PLACEHOLDER',
  COPY_SELECT_ELEMENTS: 'SCENERY.COPY_SELECT_ELEMENTS',
  ELEMENT_LIGHTS: 'SCENERY.ELEMENT_LIGHTS',
  ELEMENT_SOUNDS: 'SCENERY.ELEMENT_SOUNDS',
  ELEMENT_TILES: 'SCENERY.ELEMENT_TILES',
  ELEMENT_WALLS: 'SCENERY.ELEMENT_WALLS',
  SELECT_ALL: 'SCENERY.SELECT_ALL',
  SELECT_NONE: 'SCENERY.SELECT_NONE',
  ERROR_SELECTION: 'SCENERY.ERROR_SELECTION',
  ERROR_COPY_DEFAULT: 'SCENERY.ERROR_COPY_DEFAULT',
  ERROR_NO_SELECTION: 'SCENERY.ERROR_NO_SELECTION',
  ERROR_NO_SOURCE: 'SCENERY.ERROR_NO_SOURCE',
  SUCCESS_COPY: 'SCENERY.SUCCESS_COPY',
  LOADING: 'SCENERY.LOADING',
  SETTING_SHOW_VARIATIONS: 'SCENERY.SETTING_SHOW_VARIATIONS',
  SETTING_SHOW_VARIATIONS_HINT: 'SCENERY.SETTING_SHOW_VARIATIONS_HINT',
} as const;
