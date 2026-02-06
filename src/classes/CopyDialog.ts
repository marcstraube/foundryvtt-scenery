import { TEMPLATES, I18N_KEYS } from '../constants.js';
import {
  getSceneryData,
  setSceneryData,
  getSceneDataSummary,
  captureSceneElements,
  getVariationManagedSelection,
  cleanPath,
  log,
  type Variation,
  type SceneElementSelection,
} from '../helpers.js';
import type Scenery from './Scenery.js';

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
  sceneryApp: Scenery;
}

/**
 * Copy Dialog for copying scene elements between variations
 * Uses Foundry VTT v13 DialogV2 API
 */
export default class CopyDialog extends foundry.applications.api.DialogV2<object> {
  private config: CopyDialogConfig;

  constructor(config: CopyDialogConfig, content: string) {
    super({
      window: {
        title: `${game.i18n?.localize(I18N_KEYS.BUTTON_COPY)}: ${config.targetVariation.name}`,
        icon: 'fa fa-copy',
      },
      position: {
        width: 400,
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
  async _onRender(_context: object, _options: object): Promise<void> {
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

    if (!sourceVariation) return;

    // Get scenery data from the scene - this is the ACTUAL data we need to modify
    const scene = this.config.sceneryApp.document;
    const sceneryData = getSceneryData(scene);

    log(`[COPY] sceneryData exists: ${!!sceneryData}`);
    if (!sceneryData) return;

    log(
      `[COPY] sceneryData.variations: ${sceneryData.variations.map((v, i) => `[${i}] gm="${cleanPath(v.gmBackground)}" hasSceneData=${!!v.sceneData}`).join(', ')}`
    );

    // Determine source sceneData
    // In new structure, sceneryData.variations includes default at index 0
    // So indices match directly between sceneryApp.variations and sceneryData.variations
    let sourceSceneData = sceneryData.variations[sourceIndex]?.sceneData;

    // Active variation: always use live capture since that's the current canvas state.
    // Stored sceneData may be stale or empty (it only updates on variation switch).
    const isActiveVariation = sourceIndex === sceneryData.activeVariationIndex;
    if (isActiveVariation && canvas?.scene?.id === scene.id) {
      sourceSceneData =
        captureSceneElements(canvas.scene, getVariationManagedSelection()) ?? undefined;
      log(`[COPY] Source is active variation - captured live scene data`);
    }

    log(
      `[COPY] Source is variation at index ${sourceIndex}, sourceSceneData exists: ${!!sourceSceneData}`
    );

    if (!sourceSceneData) {
      ui.notifications?.warn(`Source variation "${sourceVariation.name}" has no data to copy`);
      return;
    }

    log(`[COPY] sourceSceneData: ${getSceneDataSummary(sourceSceneData)}`);
    log(`[COPY] targetVariationIndex: ${this.config.targetVariationIndex}`);

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

    log(
      `[COPY] Selection: ${Object.entries(selection)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')}, resetUnselected=${resetUnselected}`
    );

    // Check if at least one element is selected
    if (!Object.values(selection).some((v) => v)) {
      ui.notifications?.warn(
        game.i18n?.localize(I18N_KEYS.ERROR_NO_SELECTION) ?? 'Select at least one element type'
      );
      return;
    }

    // Find target variation in sceneryData.variations
    // In new structure, indices match directly
    // Target can't be Default (index 0) - that's validated in #onCopyOpen
    const targetVariationInData = sceneryData.variations[this.config.targetVariationIndex];

    log(`[COPY] Looking for target at index ${this.config.targetVariationIndex}`);
    log(
      `[COPY] targetVariationInData exists: ${!!targetVariationInData}, gm: ${targetVariationInData ? cleanPath(targetVariationInData.gmBackground) : 'N/A'}`
    );

    if (!targetVariationInData) {
      log(
        `[COPY] ERROR: Target variation not found! sceneryData.variations.length=${sceneryData.variations.length}`
      );
      ui.notifications?.error('Target variation not found in scene data');
      return;
    }

    // Initialize sceneData if needed
    if (!targetVariationInData.sceneData) {
      targetVariationInData.sceneData = {
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
      if (!selection.lights) targetVariationInData.sceneData.lights = [];
      if (!selection.sounds) targetVariationInData.sceneData.sounds = [];
      if (!selection.tiles) targetVariationInData.sceneData.tiles = [];
      if (!selection.walls) targetVariationInData.sceneData.walls = [];
      if (!selection.drawings) targetVariationInData.sceneData.drawings = [];
      if (!selection.templates) targetVariationInData.sceneData.templates = [];
      if (!selection.regions) targetVariationInData.sceneData.regions = [];
      if (!selection.notes) targetVariationInData.sceneData.notes = [];
    }

    // Copy selected elements (deep copy to avoid reference issues)
    if (selection.lights)
      targetVariationInData.sceneData.lights = JSON.parse(JSON.stringify(sourceSceneData.lights));
    if (selection.sounds)
      targetVariationInData.sceneData.sounds = JSON.parse(JSON.stringify(sourceSceneData.sounds));
    if (selection.tiles)
      targetVariationInData.sceneData.tiles = JSON.parse(JSON.stringify(sourceSceneData.tiles));
    if (selection.walls)
      targetVariationInData.sceneData.walls = JSON.parse(JSON.stringify(sourceSceneData.walls));
    if (selection.drawings)
      targetVariationInData.sceneData.drawings = JSON.parse(
        JSON.stringify(sourceSceneData.drawings)
      );
    if (selection.templates)
      targetVariationInData.sceneData.templates = JSON.parse(
        JSON.stringify(sourceSceneData.templates)
      );
    if (selection.regions)
      targetVariationInData.sceneData.regions = JSON.parse(JSON.stringify(sourceSceneData.regions));
    if (selection.notes)
      targetVariationInData.sceneData.notes = JSON.parse(JSON.stringify(sourceSceneData.notes));

    // Save to scene flag
    log(
      `[COPY] About to save. targetVariationInData.sceneData: ${getSceneDataSummary(targetVariationInData.sceneData)}`
    );
    log(
      `[COPY] sceneryData.variations after copy: ${sceneryData.variations.map((v, i) => `[${i}] gm="${cleanPath(v.gmBackground)}" hasSceneData=${!!v.sceneData} summary="${v.sceneData ? getSceneDataSummary(v.sceneData) : 'none'}"`).join(', ')}`
    );

    await setSceneryData(scene, sceneryData);

    // Verify save
    const verifyData = getSceneryData(scene);
    log(
      `[COPY] VERIFY after save: ${verifyData?.variations.map((v, i) => `[${i}] gm="${cleanPath(v.gmBackground)}" hasSceneData=${!!v.sceneData}`).join(', ')}`
    );

    // UI update
    const summary = getSceneDataSummary(targetVariationInData.sceneData);
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
    // Determine which element types are variation-managed (not global)
    const managed = getVariationManagedSelection();

    // Render template content first
    const content = await foundry.applications.handlebars.renderTemplate(TEMPLATES.COPY_DIALOG, {
      targetVariationName: config.targetVariation.name,
      sourceVariations: config.sourceVariations,
      managed,
    });

    const dialog = new CopyDialog(config, content);
    dialog.render(true);
  }
}
