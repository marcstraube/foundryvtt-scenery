import { TEMPLATES, I18N_KEYS } from '../constants.js';
import {
  getSceneryData,
  setSceneryData,
  getSceneDataSummary,
  type Variation,
  type SceneElementSelection,
} from '../helpers.js';

/**
 * Configuration for CopyDialog
 */
interface CopyDialogConfig {
  /** Index of target variation to copy to */
  targetVariationIndex: number;
  /** Target variation object */
  targetVariation: Variation;
  /** Available source variations */
  sourceVariations: Array<Variation & { index: number }>;
  /** Reference to parent Scenery app */
  sceneryApp: any;
}

/**
 * Copy Dialog for copying scene elements between variations
 * Uses Foundry VTT v13 DialogV2 API
 */
export default class CopyDialog extends foundry.applications.api.DialogV2<any> {
  private config: CopyDialogConfig;

  constructor(config: CopyDialogConfig, content: string) {
    super({
      window: {
        title: `${game.i18n?.localize(I18N_KEYS.BUTTON_COPY)}: ${config.targetVariation.name}`,
        icon: 'fa fa-copy',
      },
      position: {
        width: 500,
      },
      content,
      buttons: [
        {
          action: 'copy',
          label: game.i18n?.localize(I18N_KEYS.BUTTON_COPY) ?? 'Copy',
          icon: 'fa-solid fa-copy',
          callback: (_event, button) => this.#handleCopy(button.form),
        },
        {
          action: 'cancel',
          label: game.i18n?.localize(I18N_KEYS.BUTTON_CANCEL) ?? 'Cancel',
          icon: 'fa-solid fa-times',
        },
      ],
      modal: true,
    });

    this.config = config;
  }

  /**
   * Attach event listeners after render
   */
  async _onRender(_context: any, _options: any): Promise<void> {
    await super._onRender(_context, _options);

    // Attach select-all/select-none listeners
    const selectAllBtn = this.element.querySelector('[data-action="select-all"]');
    selectAllBtn?.addEventListener('click', () => this.#selectAll());

    const selectNoneBtn = this.element.querySelector('[data-action="select-none"]');
    selectNoneBtn?.addEventListener('click', () => this.#selectNone());
  }

  /**
   * Select all checkboxes
   */
  #selectAll(): void {
    this.element.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      (cb as HTMLInputElement).checked = true;
    });
  }

  /**
   * Select none checkboxes
   */
  #selectNone(): void {
    this.element.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      (cb as HTMLInputElement).checked = false;
    });
  }

  /**
   * Handle copy button click
   */
  async #handleCopy(form: HTMLFormElement | null): Promise<void> {
    if (!form) return;

    const formData = new FormData(form);
    const sourceIndexStr = formData.get('sourceVariation') as string;

    if (!sourceIndexStr) {
      ui.notifications?.warn(
        game.i18n?.localize(I18N_KEYS.ERROR_NO_SOURCE) ?? 'Select a source variation'
      );
      return;
    }

    const sourceIndex = parseInt(sourceIndexStr);
    const sourceVariation = this.config.sceneryApp.variations?.[sourceIndex];
    const targetVariation = this.config.sceneryApp.variations?.[this.config.targetVariationIndex];

    if (!sourceVariation || !targetVariation) return;

    // Get scenery data to access defaultSceneData
    const scene = canvas?.scene;
    const sceneryData = scene ? getSceneryData(scene) : null;
    if (!sceneryData) return;

    // Check if source has sceneData - handle both regular variations and default
    let sourceSceneData = sourceVariation.sceneData;

    // If source variation file matches default background, use defaultSceneData
    if (sourceVariation.file === sceneryData.bg && sceneryData.defaultSceneData) {
      sourceSceneData = sceneryData.defaultSceneData;
    }

    if (!sourceSceneData) {
      ui.notifications?.warn(`Source variation "${sourceVariation.name}" has no data to copy`);
      return;
    }

    // Read checkbox selection
    const selection: SceneElementSelection = {
      lights: (formData.get('lights') as string) === 'on',
      sounds: (formData.get('sounds') as string) === 'on',
      tiles: (formData.get('tiles') as string) === 'on',
      walls: (formData.get('walls') as string) === 'on',
      drawings: (formData.get('drawings') as string) === 'on',
      templates: (formData.get('templates') as string) === 'on',
      regions: (formData.get('regions') as string) === 'on',
      notes: (formData.get('notes') as string) === 'on',
    };

    const resetUnselected = (formData.get('resetUnselected') as string) === 'on';

    // Check if at least one element is selected
    if (!Object.values(selection).some((v) => v)) {
      ui.notifications?.warn(
        game.i18n?.localize(I18N_KEYS.ERROR_NO_SELECTION) ?? 'Select at least one element type'
      );
      return;
    }

    // Copy selected elements from source to target
    if (!targetVariation.sceneData) {
      targetVariation.sceneData = {
        lights: [],
        sounds: [],
        tiles: [],
        walls: [],
        drawings: [],
        templates: [],
        regions: [],
        notes: [],
      };
    }

    // Reset unselected elements if requested
    if (resetUnselected) {
      if (!selection.lights) targetVariation.sceneData.lights = [];
      if (!selection.sounds) targetVariation.sceneData.sounds = [];
      if (!selection.tiles) targetVariation.sceneData.tiles = [];
      if (!selection.walls) targetVariation.sceneData.walls = [];
      if (!selection.drawings) targetVariation.sceneData.drawings = [];
      if (!selection.templates) targetVariation.sceneData.templates = [];
      if (!selection.regions) targetVariation.sceneData.regions = [];
      if (!selection.notes) targetVariation.sceneData.notes = [];
    }

    // Copy selected elements
    if (selection.lights) targetVariation.sceneData.lights = [...sourceSceneData.lights];
    if (selection.sounds) targetVariation.sceneData.sounds = [...sourceSceneData.sounds];
    if (selection.tiles) targetVariation.sceneData.tiles = [...sourceSceneData.tiles];
    if (selection.walls) targetVariation.sceneData.walls = [...sourceSceneData.walls];
    if (selection.drawings) targetVariation.sceneData.drawings = [...sourceSceneData.drawings];
    if (selection.templates) targetVariation.sceneData.templates = [...sourceSceneData.templates];
    if (selection.regions) targetVariation.sceneData.regions = [...sourceSceneData.regions];
    if (selection.notes) targetVariation.sceneData.notes = [...sourceSceneData.notes];

    // Save to scene flag (reuse scene and sceneryData from above)
    if (sceneryData && scene) {
      await setSceneryData(scene, sceneryData);
    }

    // UI update
    const summary = getSceneDataSummary(targetVariation.sceneData);
    ui.notifications?.info(
      game.i18n?.format(I18N_KEYS.SUCCESS_COPY, { summary }) || `Copied: ${summary}`
    );

    // Close dialog and refresh parent UI
    this.close();
    this.config.sceneryApp.render();
  }

  /**
   * Static method to show the dialog
   */
  static async show(config: CopyDialogConfig): Promise<void> {
    // Render template content first
    const content = await foundry.applications.handlebars.renderTemplate(TEMPLATES.COPY_DIALOG, {
      targetVariationName: config.targetVariation.name,
      sourceVariations: config.sourceVariations,
    });

    const dialog = new CopyDialog(config, content);
    dialog.render(true);
  }
}
