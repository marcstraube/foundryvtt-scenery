import {
  MODULE_ID,
  ICONS,
  VARIATIONS,
  WINDOW,
  TEMPLATES,
  I18N_KEYS,
  SETTINGS,
  SELECTORS,
} from '../constants.js';
import {
  log,
  cleanPath,
  getSceneryData,
  setSceneryData,
  getUserImage,
  captureSceneElements,
  restoreSceneElements,
  hasSceneData,
  getSceneDataSummary,
  type Variation,
  type SceneryData,
} from '../helpers.js';
import type { SceneryContext, SceneryOptions, SceneryScene, SceneUpdate } from '../types.js';
import CopyDialog from './CopyDialog.js';

const { HandlebarsApplicationMixin, DocumentSheetV2 } = foundry.applications.api;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BaseClass = HandlebarsApplicationMixin(DocumentSheetV2) as any;

export default class Scenery extends BaseClass {
  // Base class properties that need to be declared
  declare document: Scene;
  declare element: HTMLElement;

  bg?: string;
  gm?: string;
  pl?: string;
  variations?: Variation[];

  constructor(options: SceneryOptions = {}) {
    const sceneId = options.document?.id || options.sceneId;
    const scene = options.document || (sceneId ? game.scenes?.get(sceneId) : undefined);
    super({ document: scene, ...options });
  }

  static DEFAULT_OPTIONS = {
    classes: WINDOW.CLASSES,
    position: {
      width: WINDOW.WIDTH,
      height: WINDOW.HEIGHT,
    },
    actions: {
      preview: Scenery.#onPreview,
      scan: Scenery.#onScan,
      add: Scenery.#onAdd,
      'copy-open': Scenery.#onCopyOpen,
      'reset-scene-data': Scenery.#onResetSceneData,
    },
    form: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: function (this: Scenery, ...args: any[]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (this._onFormSubmit as any)(...args);
      },
      submitOnChange: false,
      closeOnSubmit: true,
    },
    window: {
      icon: WINDOW.ICON,
      resizable: true,
      contentClasses: ['standard-form'],
    },
    tag: 'form',
  };

  static PARTS = {
    form: {
      template: TEMPLATES.SCENERY,
    },
    footer: {
      template: TEMPLATES.FOOTER,
    },
  };

  static _loadingImage: string | null = null;

  get title(): string {
    return game.i18n?.localize(I18N_KEYS.APP_NAME) ?? 'Scenery';
  }

  async _prepareContext(options: object): Promise<SceneryContext> {
    const context = (await super._prepareContext(options)) as SceneryContext;
    const flag = getSceneryData(this.document);

    log('=== PREPARE CONTEXT ===');
    log(`Document ID: ${this.document?.id}`);
    log(`Document name: ${this.document?.name}`);
    log(`Document background.src: ${this.document?.background?.src}`);
    log(`Flag exists: ${!!flag}`);
    if (flag) {
      log(`Flag bg: ${flag.bg}`);
      log(`Flag gm: ${flag.gm}`);
      log(`Flag pl: ${flag.pl}`);
      log(`Flag variations: ${flag.variations?.length ?? 0}`);
    }

    const currentBackground = this.getCurrentBackground();
    log(`Current background from getCurrentBackground(): ${currentBackground}`, true);

    // Always reload from flag to ensure fresh data (don't reuse old instance properties)
    // Use || instead of ?? so empty strings also fall back to currentBackground
    this.bg = cleanPath(flag?.bg) || cleanPath(currentBackground);
    this.gm = cleanPath(flag?.gm) || cleanPath(currentBackground);
    this.pl = cleanPath(flag?.pl) || cleanPath(currentBackground);

    log(`Computed bg: ${this.bg}`);
    log(`Computed gm: ${this.gm}`);
    log(`Computed pl: ${this.pl}`);

    // Always rebuild variations from flag to ensure fresh data
    this.variations = [{ name: VARIATIONS.DEFAULT_NAME, file: this.bg }];
    if (flag?.variations && Array.isArray(flag.variations)) {
      const nonDefaultVariations = flag.variations
        .filter(
          (v: Variation) => v && v.name?.toLowerCase() !== VARIATIONS.DEFAULT_NAME.toLowerCase()
        )
        .map((v: Variation) => ({
          ...v,
          name: typeof v.name === 'string' ? v.name.trim() : '',
          file: cleanPath(v.file),
        }));
      this.variations.push(...nonDefaultVariations);
    }
    log(`Built variations: ${this.variations.length}`);

    this.variations.push(VARIATIONS.EMPTY);

    context.variations = this.variations.map((v, index) => {
      // For default variation, check defaultSceneData instead of sceneData
      let sceneDataToCheck = v.sceneData;
      if (v.file === flag?.bg && flag?.defaultSceneData) {
        sceneDataToCheck = flag.defaultSceneData;
      }

      return {
        ...v,
        isDefault: index === 0,
        isEmpty: !v.name && !v.file,
        hasSceneData: sceneDataToCheck
          ? hasSceneData({ ...v, sceneData: sceneDataToCheck })
          : false,
        sceneDataSummary: sceneDataToCheck ? getSceneDataSummary(sceneDataToCheck) : undefined,
      };
    });
    context.gm = this.gm ?? '';
    context.pl = this.pl ?? '';

    context.buttons = [
      { type: 'button', action: 'scan', icon: ICONS.SCAN, label: I18N_KEYS.BUTTON_SCAN },
      { type: 'button', action: 'add', icon: ICONS.ADD, label: I18N_KEYS.BUTTON_ADD },
      { type: 'submit', icon: ICONS.OK, label: I18N_KEYS.BUTTON_OK },
    ];

    return context;
  }

  getCurrentBackground(): string {
    const docId = this.document?.id;
    if (!docId) return '';

    // Get fresh document from game.scenes
    const freshDocument = game.scenes?.get(docId);
    if (!freshDocument) return '';

    log(`getCurrentBackground: freshDocument.background.src = ${freshDocument.background?.src}`);

    // Check for scenery flag data first
    const flag = getSceneryData(freshDocument);
    if (flag) {
      const customBg = getUserImage(flag);
      if (customBg) return customBg;
    }

    // If this is the active canvas scene, try canvas data
    if (canvas?.scene?.id === docId && canvas.scene.background?.src) {
      return canvas.scene.background.src;
    }

    // Fall back to the fresh document's background
    return freshDocument.background?.src ?? '';
  }

  static async #onPreview(_event: Event, target: HTMLElement): Promise<void> {
    const row = target.closest('tr');
    const url = (
      row?.querySelector(SELECTORS.INPUT_IMAGE) as HTMLInputElement | null
    )?.value?.trim();
    if (url) {
      // Use v13 ImagePopout API
      const ImagePopoutClass = foundry.applications.apps.ImagePopout;
      new ImagePopoutClass({ src: url }).render({ force: true });
    }
  }

  /**
   * Extract base filename without extension from a path
   * @param path - File path to extract base name from
   * @returns Base filename without extension
   */
  static #extractBaseNameFromPath(path: string): string {
    const fileName = path.split('/').pop() || '';
    return fileName.split('.').slice(0, -1).join('.');
  }

  /**
   * Create a variation object from a file path
   * @param file - Full file path
   * @param baseName - Base filename to remove from variation name
   * @returns Variation object with cleaned name
   */
  static #createVariationFromFile(file: string, baseName: string): Variation {
    const fileName = Scenery.#extractBaseNameFromPath(file);
    const name = decodeURIComponent(fileName.replace(baseName, ''))
      .replace(/[-_]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return { file, name };
  }

  /**
   * Sort variations alphabetically by name
   * @param variations - Array of variations to sort
   * @returns Sorted variations
   */
  static #sortVariations(variations: Variation[]): Variation[] {
    return variations.sort((a, b) => a.name.localeCompare(b.name));
  }

  static async #onScan(this: Scenery, _event: Event, _target: HTMLElement): Promise<void> {
    const app = this;

    const path = (
      app.element.querySelector('[name="variations.0.file"]') as HTMLInputElement | null
    )?.value;
    if (!path) return;

    const imagePaths = Array.from(app.element.querySelectorAll(SELECTORS.INPUT_IMAGE)).map(
      (input) => (input as HTMLInputElement).value
    );
    const fp = await foundry.applications.apps.FilePicker.implementation.browse('data', path);

    const baseName = Scenery.#extractBaseNameFromPath(path);

    const variations = fp.files
      .filter((f) => !imagePaths.includes(f))
      .reduce<Variation[]>((acc, file) => {
        const fileName = Scenery.#extractBaseNameFromPath(file);
        if (fileName.toLowerCase().includes(baseName.toLowerCase())) {
          acc.push(Scenery.#createVariationFromFile(file, baseName));
        }
        return acc;
      }, []);

    Scenery.#sortVariations(variations);

    app.removeBlankVariations();

    for (const v of variations) {
      await app.addVariation(v.name, v.file);
    }

    await app.addVariation('', '');
  }

  static async #onAdd(this: Scenery, _event: Event, _target: HTMLElement): Promise<void> {
    const app = this;
    await app.addVariation();
  }

  static async #onCopyOpen(this: Scenery, _event: Event, target: HTMLElement): Promise<void> {
    const app = this;
    const variationIndex = parseInt(target.dataset.variationIndex || '0');

    // Validations
    if (variationIndex === 0) {
      ui.notifications?.warn(
        game.i18n?.localize(I18N_KEYS.ERROR_COPY_DEFAULT) ?? 'Cannot copy to default variation'
      );
      return;
    }

    // Show copy dialog
    await app.#showCopyDialog(variationIndex);
  }

  async #showCopyDialog(targetVariationIndex: number): Promise<void> {
    const targetVariation = this.variations?.[targetVariationIndex];
    if (!targetVariation) return;

    // Build list of source variations (all except target and empty row)
    const sourceVariations = (this.variations || [])
      .map((v, index) => ({ ...v, index }))
      .filter((v, index) => {
        // Exclude target variation
        if (index === targetVariationIndex) return false;
        // Exclude empty rows (no file)
        if (!v.file) return false;
        // Include all variations with files (including Default)
        return true;
      });

    // Show CopyDialog (V2)
    await CopyDialog.show({
      targetVariationIndex,
      targetVariation,
      sourceVariations,
      sceneryApp: this,
    });
  }

  static async #onResetSceneData(this: Scenery, _event: Event, target: HTMLElement): Promise<void> {
    const app = this;
    const variationIndex = parseInt(target.dataset.variationIndex || '0');

    // Validations
    if (variationIndex === 0) {
      ui.notifications?.warn('Cannot reset default variation');
      return;
    }

    const variation = app.variations?.[variationIndex];
    if (!variation || !variation.sceneData) {
      return;
    }

    // Show confirmation dialog
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: game.i18n?.localize('SCENERY.RESET_SCENE_DATA_TITLE') ?? 'Reset Scene Data',
      },
      content: `<p>${game.i18n?.localize('SCENERY.RESET_SCENE_DATA_CONTENT') ?? 'Remove all captured scene elements for this variation?'}</p>`,
      rejectClose: false,
      modal: true,
    });

    if (!confirmed) return;

    // Delete sceneData
    delete variation.sceneData;

    // Save to scene
    const scene = app.document;
    const sceneryData = getSceneryData(scene);
    if (sceneryData) {
      await setSceneryData(scene, sceneryData);
    }

    ui.notifications?.info(
      game.i18n?.localize('SCENERY.RESET_SCENE_DATA_SUCCESS') ?? 'Reset scene data'
    );

    // Refresh UI
    app.render();
  }

  /**
   * Parse variations from form data
   * @param formData - Form data object
   * @param existingVariations - Existing variations to preserve sceneData
   * @returns Array of variations
   */
  static #parseVariationsFromFormData(
    formData: Record<string, string>,
    existingVariations?: Variation[]
  ): Variation[] {
    const variations: Variation[] = [];
    let index = 0;

    while (formData[`variations.${index}.file`] !== undefined) {
      const variation: Variation = {
        name: (formData[`variations.${index}.name`] || '').trim(),
        file: cleanPath(formData[`variations.${index}.file`]),
      };

      // Preserve sceneData from existing variation
      const existingVariation = existingVariations?.[index];
      if (existingVariation?.sceneData) {
        variation.sceneData = existingVariation.sceneData;
      }

      variations.push(variation);
      index++;
    }

    return variations;
  }

  /**
   * Get selected radio button indices for GM and Player
   * @param form - HTML form element
   * @returns Object with gmIndex and plIndex
   */
  static #getSelectedRadioIndices(form: HTMLFormElement): { gmIndex: number; plIndex: number } {
    const gmRadio = form.querySelector(SELECTORS.RADIO_GM) as HTMLInputElement | null;
    const plRadio = form.querySelector(SELECTORS.RADIO_PLAYER) as HTMLInputElement | null;

    return {
      gmIndex: parseInt(gmRadio?.value || '0'),
      plIndex: parseInt(plRadio?.value || '0'),
    };
  }

  /**
   * Validate selections and build SceneryData
   * @param variations - Array of variations
   * @param gmIndex - Index of GM variation
   * @param plIndex - Index of Player variation
   * @returns SceneryData object or null if validation fails
   */
  static #validateAndBuildSceneryData(
    variations: Variation[],
    gmIndex: number,
    plIndex: number
  ): SceneryData | null {
    log('=== BUILD SCENERY DATA ===');
    log(`Variations count: ${variations.length}`);
    variations.forEach((v, i) => {
      log(`  [${i}] name="${v.name}", file="${v.file}"`);
    });
    log(`GM Index: ${gmIndex}, Player Index: ${plIndex}`);

    const bg = variations[0]?.file;
    if (!bg) {
      ui.notifications?.error('No default background specified');
      return null;
    }

    const gm = variations[gmIndex]?.file;
    const pl = variations[plIndex]?.file;

    log(`Computed: bg="${bg}", gm="${gm}", pl="${pl}"`);

    if (!gm || !pl) {
      ui.notifications?.error(
        game.i18n?.localize(I18N_KEYS.ERROR_SELECTION) ?? 'Invalid selection'
      );
      return null;
    }

    const validVariations = variations.slice(1).filter((v) => v.file);
    log(`Valid variations (slice(1)): ${validVariations.length}`);

    return { variations: validVariations, bg, gm, pl };
  }

  async _onFormSubmit(
    _event: Event,
    form: HTMLFormElement,
    formData: FormDataExtended,
    options: object = {}
  ): Promise<void> {
    try {
      log('Form submission started');
      log({ formData: formData.object, options });

      const fd = formData.object as Record<string, string>;

      const variations = Scenery.#parseVariationsFromFormData(fd, this.variations);
      const { gmIndex, plIndex } = Scenery.#getSelectedRadioIndices(form);
      const data = Scenery.#validateAndBuildSceneryData(variations, gmIndex, plIndex);

      if (!data) return;

      // Preserve defaultSceneData and bg from existing flag
      const existingFlag = getSceneryData(this.document);
      log('=== PRESERVE CHECK ===');
      log(`Existing flag exists: ${!!existingFlag}`);
      if (existingFlag) {
        log(`Existing bg: ${existingFlag.bg}`);
        log(`Existing defaultSceneData: ${!!existingFlag.defaultSceneData}`);
        if (existingFlag.defaultSceneData) {
          data.defaultSceneData = existingFlag.defaultSceneData;
          log(`Preserved defaultSceneData`);
        }
        // Preserve bg if variations[0].file is empty (disabled field not submitted)
        if (!variations[0]?.file && existingFlag.bg) {
          log(`Preserving bg from existing: ${existingFlag.bg}`);
          data.bg = existingFlag.bg;
        }
      }

      // CRITICAL: Capture defaultSceneData on first save if we're currently on the default background
      if (!data.defaultSceneData && canvas?.scene && canvas.scene.id === this.document?.id) {
        const currentBg = canvas.scene.background.src ?? '';
        if (currentBg === data.bg) {
          log('=== FIRST SAVE: Capturing defaultSceneData ===');
          const capturedData = captureSceneElements(canvas.scene);
          if (capturedData) {
            data.defaultSceneData = capturedData;
            log(`Captured defaultSceneData: ${getSceneDataSummary(capturedData)}`);
          }
        }
      }

      log('=== FINAL DATA TO SAVE ===');
      log(`bg: ${data.bg}`);
      log(`gm: ${data.gm}`);
      log(`pl: ${data.pl}`);
      log(`variations: ${data.variations.length}`);
      log(`defaultSceneData: ${!!data.defaultSceneData}`);

      await setSceneryData(this.document, data);

      if (this.document?.id === canvas?.scene?.id) {
        const img = getUserImage(data);
        if (img) {
          await Scenery.setImage(img);
        }
      }
    } catch (error) {
      console.error('Scenery | Error in form submission:', error);
      ui.notifications?.error(`Scenery error: ${(error as Error).message}`);
      throw error;
    }
  }

  _onRender(context: object, options: object): void {
    super._onRender(context, options);

    this.element.querySelectorAll(SELECTORS.BUTTON_FILE_PICKER).forEach((button: Element) => {
      button.addEventListener('click', this._onClickFilePicker.bind(this));
    });

    // Delete button handler
    this.element.querySelectorAll(SELECTORS.BUTTON_DELETE).forEach((button: Element) => {
      this.#attachDeleteHandler(button);
    });
  }

  #attachDeleteHandler(button: Element): void {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const target = event.currentTarget as HTMLElement;
      const row = target.closest('tr');
      if (!row) return;

      // Check if row has name, file, or scene data
      const nameInput = row.querySelector(SELECTORS.INPUT_NAME) as HTMLInputElement | null;
      const fileInput = row.querySelector(SELECTORS.INPUT_FILE) as HTMLInputElement | null;
      const name = nameInput?.value?.trim();
      const file = fileInput?.value?.trim();

      // Check for scene data via variation index
      const variationIndex = parseInt(row.dataset.index || '0');
      const variation = this.variations?.[variationIndex];
      const hasData =
        variation?.sceneData && Object.values(variation.sceneData).some((arr) => arr?.length > 0);

      // If name, file, or scene data is set, show confirmation dialog
      if (name || file || hasData) {
        const displayName = name || file || 'Unknown';
        const confirmed = await foundry.applications.api.DialogV2.confirm({
          window: {
            title: game.i18n?.localize('SCENERY.DELETE_VARIATION_TITLE') ?? 'Delete Variation',
          },
          content: `<p>${game.i18n?.format('SCENERY.DELETE_VARIATION_CONTENT', { name: displayName }) ?? `Delete variation "${displayName}"?`}</p>`,
          rejectClose: false,
          modal: true,
        });

        if (!confirmed) return;
      }

      row.remove();
    });
  }

  async _onClickFilePicker(event: Event): Promise<void> {
    event.preventDefault();
    const button = event.currentTarget as HTMLButtonElement;
    const input = button.parentElement?.querySelector(
      SELECTORS.INPUT_TEXT
    ) as HTMLInputElement | null;

    if (!input) return;

    const fp = new foundry.applications.apps.FilePicker.implementation({
      type: (button.dataset.type as 'imagevideo' | undefined) ?? 'imagevideo',
      current: input.value,
      callback: (path: string) => {
        input.value = path;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      },
    });

    await fp.browse();
  }

  removeBlankVariations(): void {
    const rows = this.element.querySelectorAll('tr');
    rows.forEach((row: Element) => {
      const fileInput = row.querySelector(SELECTORS.CELL_FILE_INPUT) as HTMLInputElement | null;
      const nameInput = row.querySelector(SELECTORS.CELL_NAME_INPUT) as HTMLInputElement | null;
      if (fileInput && nameInput && !fileInput.value && !nameInput.value) {
        row.remove();
      }
    });
  }

  async addVariation(name = '', file = '', id: number | null = null): Promise<void> {
    const tbody = this.element.querySelector(SELECTORS.TABLE_BODY);
    if (!tbody) return;

    if (id === null) {
      const lastRow = tbody.querySelector(SELECTORS.ROW_LAST);
      const lastIndex = lastRow ? parseInt(lastRow.getAttribute('data-index') || '-1') : -1;
      id = lastIndex + 1;
    }

    const templateData = {
      id: Number(id),
      name,
      file,
      isEmpty: !name && !file,
      isDefault: id === 0,
    };
    const rowHtml = await foundry.applications.handlebars.renderTemplate(
      TEMPLATES.VARIATION,
      templateData
    );
    const template = document.createElement('template');
    template.innerHTML = rowHtml;
    const row = template.content.firstElementChild;

    if (row) {
      tbody.appendChild(row);

      const filePickerButton = row.querySelector(SELECTORS.BUTTON_FILE_PICKER);
      if (filePickerButton) {
        filePickerButton.addEventListener('click', this._onClickFilePicker.bind(this));
      }

      // Add delete button handler
      const deleteButton = row.querySelector(SELECTORS.BUTTON_DELETE);
      if (deleteButton) {
        this.#attachDeleteHandler(deleteButton);
      }
    }
  }

  static async setImage(img: string, draw = true): Promise<void> {
    if (!canvas?.scene) return;
    if (!game.user) return;

    if (!game.user.isGM && !canvas.scene.canUserModify(game.user, 'update')) {
      log('User does not have permission to modify scene background');
      return;
    }

    if (Scenery._loadingImage === img) {
      log(`Already loading image: ${img}`);
      return;
    }

    const sceneryScene = canvas.scene as SceneryScene;
    sceneryScene._sceneryCustomBackground = img;

    if (!draw) {
      if (!sceneryScene._sceneryOriginalBackground) {
        sceneryScene._sceneryOriginalBackground = canvas.scene.background.src ?? '';
      }
      sceneryScene._sceneryPendingBackground = img;
      return;
    }

    Scenery._loadingImage = img;

    if (canvas.ready && canvas.primary?.background) {
      if (!sceneryScene._sceneryOriginalBackground) {
        sceneryScene._sceneryOriginalBackground = canvas.scene.background.src ?? '';
      }

      const currentBackgroundSrc = canvas.scene.background.src ?? '';

      try {
        log(`Loading new background texture: ${img}`);
        log(`Current background: ${currentBackgroundSrc}`);

        // Save current scene elements before switching (skip if already on target)
        if (currentBackgroundSrc !== img) {
          log(`Saving current background before switch`);
          await Scenery.#saveCurrentSceneElements(currentBackgroundSrc);
        } else {
          log(`Already on target background src, skipping save`);
        }

        log(`Switching to new background: ${img}`);

        const texture = await foundry.canvas.loadTexture(img);

        if (texture && 'baseTexture' in texture && canvas.primary?.background) {
          canvas.primary.background.texture = texture as PIXI.Texture;
          canvas.scene.background.src = img;
          canvas.primary.renderDirty = true;
          canvas.app?.renderer.render(canvas.app.stage);

          if (!sceneryScene._sceneryPendingBackground) {
            ui.notifications?.info(game.i18n?.localize(I18N_KEYS.LOADING) ?? 'Loading...');
          }

          // Restore scene elements for new variation (pass new background explicitly)
          await Scenery.#restoreSceneElementsForCurrentVariation(img);
        }
      } catch (err) {
        console.error('Scenery | Error updating background:', err);
        ui.notifications?.error('Failed to update background image');
      } finally {
        Scenery._loadingImage = null;
      }
    } else {
      Scenery._loadingImage = null;
    }
  }

  static async #saveCurrentSceneElements(currentBackgroundSrc?: string): Promise<void> {
    if (!canvas?.scene) return;

    const data = getSceneryData(canvas.scene);
    if (!data) return;

    // Use provided background src or fall back to current
    const currentImg = currentBackgroundSrc || canvas.scene.background.src;

    log(`=== SAVE DEBUG ===`);
    log(`Current background src: ${currentImg}`);
    log(`Default background (bg): ${data.bg}`);
    log(`Available variations:`);
    data.variations.forEach((v, i) => {
      log(`  [${i}] name="${v.name}", file="${v.file}"`);
    });

    // Check if this is the default background
    if (currentImg === data.bg) {
      // Save to defaultSceneData
      const sceneData = captureSceneElements(canvas.scene ?? undefined);
      if (sceneData) {
        data.defaultSceneData = sceneData;
        await setSceneryData(canvas.scene, data);
        log(`Auto-saved scene elements for DEFAULT background`);
      }
      return;
    }

    // Otherwise find the variation
    const currentVariation = data.variations.find((v) => v.file === currentImg);

    if (currentVariation) {
      // Auto-capture all scene elements
      const sceneData = captureSceneElements(canvas.scene ?? undefined);
      if (sceneData) {
        currentVariation.sceneData = sceneData;
        await setSceneryData(canvas.scene, data);
        log(`Auto-saved scene elements for variation: ${currentVariation.name}`);
      }
    } else {
      log(`!!! No variation found for background: ${currentImg}`);
    }
  }

  static async #restoreSceneElementsForCurrentVariation(
    targetBackgroundSrc?: string
  ): Promise<void> {
    if (!canvas?.scene) return;

    const data = getSceneryData(canvas.scene);
    if (!data) return;

    // Use provided background src or fall back to current
    const currentImg = targetBackgroundSrc || canvas.scene.background.src;
    log(`Restore target background: ${currentImg}`);

    // Check if this is the default background
    if (currentImg === data.bg) {
      // Restore from defaultSceneData
      const sceneData = data.defaultSceneData || {
        lights: [],
        sounds: [],
        tiles: [],
        walls: [],
        drawings: [],
        templates: [],
        regions: [],
        notes: [],
      };

      log(`Restoring scene elements for DEFAULT background`);
      log(
        `SceneData counts: ${sceneData.lights.length} lights, ${sceneData.sounds.length} sounds, ${sceneData.tiles.length} tiles, ${sceneData.walls.length} walls`,
        true
      );
      await restoreSceneElements(canvas.scene, sceneData);
      return;
    }

    // Otherwise find the variation
    const currentVariation = data.variations.find((v) => v.file === currentImg);

    if (currentVariation) {
      // If variation has sceneData, restore it
      // If not, treat as empty state and clear all elements
      const sceneData = currentVariation.sceneData || {
        lights: [],
        sounds: [],
        tiles: [],
        walls: [],
        drawings: [],
        templates: [],
        regions: [],
        notes: [],
      };

      log(`Restoring scene elements for variation: ${currentVariation.name}`);
      log(
        `SceneData counts: ${sceneData.lights.length} lights, ${sceneData.sounds.length} sounds, ${sceneData.tiles.length} tiles, ${sceneData.walls.length} walls`,
        true
      );
      await restoreSceneElements(canvas.scene, sceneData);
    } else {
      log(`No variation found for background: ${currentImg}`);
    }
  }

  static async resetBackground(): Promise<void> {
    if (!canvas?.scene) return;

    const sceneryScene = canvas.scene as SceneryScene;
    if (!sceneryScene._sceneryOriginalBackground) return;

    const originalSrc = sceneryScene._sceneryOriginalBackground;

    if (canvas.scene.background.src === originalSrc) {
      log('Background already reset to original');
      return;
    }

    if (canvas.primary?.background) {
      try {
        log(`Resetting background to original: ${originalSrc}`);

        const texture = await foundry.canvas.loadTexture(originalSrc);

        if (texture && 'baseTexture' in texture) {
          canvas.primary.background.texture = texture as PIXI.Texture;
          canvas.scene.background.src = originalSrc;
          canvas.primary.renderDirty = true;
          canvas.app?.renderer.render(canvas.app.stage);
        }
      } catch (err) {
        console.error('Scenery | Error resetting background:', err);
      }
    }

    delete sceneryScene._sceneryOriginalBackground;
    delete sceneryScene._sceneryCustomBackground;
  }

  static _onCanvasInit(): void {
    if (!canvas?.scene) return;

    const data = getSceneryData(canvas.scene);
    if (!data) return;

    const currentBackground = cleanPath(canvas.scene.background.src);
    const expectedBackground = cleanPath(data.bg);

    log(`_onCanvasInit: current="${currentBackground}", expected="${expectedBackground}"`);

    const sceneryScene = canvas.scene as SceneryScene;

    // Only skip if backgrounds don't match AND there's no pending background
    // This handles cases where the scene was modified outside of Scenery
    if (currentBackground !== expectedBackground && !sceneryScene._sceneryPendingBackground) {
      log('Background mismatch detected, skipping scenery override');
      return;
    }

    // Get the appropriate image for the current user (GM or Player)
    const img = cleanPath(getUserImage(data));
    log(`_onCanvasInit: user image="${img}"`);

    if (img) {
      Scenery.setImage(img, false);
    }
  }

  static async _onCanvasReady(_canvas: Canvas): Promise<void> {
    if (!canvas?.scene) {
      log(`_onCanvasReady: No canvas.scene`);
      return;
    }

    log(`_onCanvasReady called for scene: ${canvas.scene.name}`);

    const sceneryScene = canvas.scene as SceneryScene;
    log(`_onCanvasReady: pendingBackground="${sceneryScene._sceneryPendingBackground}"`);

    if (sceneryScene._sceneryPendingBackground) {
      const pendingImg = sceneryScene._sceneryPendingBackground;
      delete sceneryScene._sceneryPendingBackground;

      log(`Applying pending background: ${pendingImg}`);
      await Scenery.setImage(pendingImg);
    } else {
      // No pending background - check if we need to apply scenery settings
      const data = getSceneryData(canvas.scene);
      log(`_onCanvasReady: scenery data exists: ${!!data}`);

      if (data) {
        log(`_onCanvasReady: data.bg="${data.bg}", data.gm="${data.gm}", data.pl="${data.pl}"`);

        const currentBackground = cleanPath(canvas.scene.background.src);
        const userImage = cleanPath(getUserImage(data));
        const isGM = game.user?.isGM;

        log(
          `_onCanvasReady: isGM=${isGM}, current="${currentBackground}", userImage="${userImage}"`
        );

        // If the user's image differs from current, apply it
        if (userImage && userImage !== currentBackground) {
          log(`Applying user background on canvas ready: ${userImage}`);
          await Scenery.setImage(userImage);
        } else {
          log(`_onCanvasReady: No change needed (same background or no user image)`);
        }
      }
    }
  }

  /**
   * Update scenery data when background changes through scene settings
   * @param sceneryData - Current scenery data
   * @param newBackground - New background path
   * @returns Updated scenery data
   */
  static #updateSceneryDataForBackgroundChange(
    sceneryData: SceneryData,
    newBackground: string
  ): SceneryData {
    const updatedData: SceneryData = {
      ...sceneryData,
      bg: newBackground,
      gm: sceneryData.gm === sceneryData.bg ? newBackground : sceneryData.gm,
      pl: sceneryData.pl === sceneryData.bg ? newBackground : sceneryData.pl,
    };

    if (updatedData.variations && updatedData.variations.length > 0) {
      updatedData.variations[0] = { name: VARIATIONS.DEFAULT_NAME, file: newBackground };
    }

    return updatedData;
  }

  /**
   * Apply scenery data to the current scene if it matches
   * @param scene - Scene to check
   * @param sceneryData - Scenery data to apply
   */
  static #applySceneryDataToCurrentScene(scene: Scene, sceneryData: SceneryData): void {
    if (scene.id === canvas?.scene?.id) {
      const img = getUserImage(sceneryData);
      if (img) {
        Scenery.setImage(img);
      }
    }
  }

  static _onUpdateScene(scene: Scene, data: SceneUpdate): void {
    log('_onUpdateScene called');
    log({
      sceneId: scene.id,
      isCurrentScene: scene.id === canvas?.scene?.id,
      updateData: data,
      hasSceneryFlag: foundry.utils.hasProperty(data, 'flags.scenery.data'),
      hasBackgroundChange: foundry.utils.hasProperty(data, 'background.src'),
    });

    ui.scenes?.render();

    if (foundry.utils.hasProperty(data, 'background.src')) {
      const newBackground = data.background?.src ?? '';
      const sceneryData = getSceneryData(scene);

      if (sceneryData) {
        log('Background changed through scene settings, updating scenery data');

        const updatedData = Scenery.#updateSceneryDataForBackgroundChange(
          sceneryData,
          newBackground
        );
        setSceneryData(scene, updatedData);
        Scenery.#applySceneryDataToCurrentScene(scene, updatedData);

        return;
      }
    }

    if (scene.id !== canvas?.scene?.id) return;

    if (foundry.utils.hasProperty(data, 'flags.scenery.data')) {
      const sceneryData = data.flags?.scenery?.data;
      const img = sceneryData ? getUserImage(sceneryData) : undefined;
      log('Scenery data updated via hook, checking if update needed');
      log({
        newImg: img,
        currentBg: canvas?.scene?.background.src,
        customBg: (canvas?.scene as SceneryScene | undefined)?._sceneryCustomBackground,
      });

      if (img) {
        log('Calling setImage from update hook');
        Scenery.setImage(img);
      }
    }
  }

  static _onRenderSceneDirectory(_sceneDir: SceneDirectory, html: JQuery | HTMLElement): void {
    // Check if setting is enabled (default to true if not yet initialized)
    const settings = game.settings as unknown as {
      get?: (module: string, key: string) => boolean;
    };
    const showLabel = settings.get?.(MODULE_ID, SETTINGS.SHOW_VARIATIONS_LABEL) ?? true;
    if (!showLabel) return;

    let htmlElement: HTMLElement | null = null;
    if (html instanceof HTMLElement) {
      htmlElement = html;
    } else {
      // JQuery object - get first element
      const jqElement = (html as { 0?: HTMLElement })[0];
      if (jqElement instanceof HTMLElement) {
        htmlElement = jqElement;
      }
    }

    if (!htmlElement) {
      log('_onRenderSceneDirectory: Invalid html parameter');
      log(html);
      return;
    }

    const scenes = game.scenes?.contents ?? [];

    scenes
      .filter((scene) => {
        const data = getSceneryData(scene);
        return data?.variations && data.variations.length > 0;
      })
      .forEach((scene) => {
        // v13 uses data-entry-id instead of data-document-id
        const menuEntry = htmlElement.querySelector(`[data-entry-id="${scene.id}"]`);
        if (!menuEntry) return;

        const data = getSceneryData(scene);
        if (!data?.variations) return;

        const label = document.createElement('label');
        label.classList.add('scenery-variations');
        const variationsCount = data.variations.length + 1;
        label.innerHTML = `<i class="fa fa-images"></i> ${variationsCount}`;
        menuEntry.prepend(label);
      });
  }
}
