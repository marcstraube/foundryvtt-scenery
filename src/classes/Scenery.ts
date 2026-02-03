import {
  MODULE_ID,
  ICONS,
  VARIATIONS,
  WINDOW,
  TEMPLATES,
  I18N_KEYS,
  SETTINGS,
} from '../constants.js';
import {
  log,
  getSceneryData,
  setSceneryData,
  getUserImage,
  type Variation,
  type SceneryData,
} from '../helpers.js';
import type { SceneryContext, SceneryOptions, SceneryScene, SceneUpdate } from '../types.js';

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
    const scene = options.document || game.scenes?.get(sceneId!);
    super({ document: scene, ...options });
  }

  static DEFAULT_OPTIONS = {
    classes: WINDOW.CLASSES,
    position: {
      width: WINDOW.WIDTH,
      height: WINDOW.HEIGHT,
    },
    actions: {
      delete: Scenery.#onDelete,
      preview: Scenery.#onPreview,
      scan: Scenery.#onScan,
      add: Scenery.#onAdd,
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

    const currentBackground = this.getCurrentBackground();

    if (!this.bg) this.bg = flag?.bg ?? currentBackground;
    if (!this.gm) this.gm = flag?.gm ?? currentBackground;
    if (!this.pl) this.pl = flag?.pl ?? currentBackground;
    if (!this.variations) {
      this.variations = [{ name: VARIATIONS.DEFAULT_NAME, file: this.bg ?? '' }];
      if (flag?.variations) {
        const nonDefaultVariations = flag.variations.filter(
          (v: Variation) => v.name?.toLowerCase() !== VARIATIONS.DEFAULT_NAME.toLowerCase()
        );
        nonDefaultVariations.forEach((v: Variation) => this.variations!.push(v));
      }
    }

    this.variations.push(VARIATIONS.EMPTY);

    context.variations = this.variations;
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
    if (canvas?.scene?.id === this.document?.id) {
      return canvas.scene.background.src ?? '';
    }

    const flag = getSceneryData(this.document);
    if (flag) {
      const customBg = getUserImage(flag);
      if (customBg) return customBg;
    }

    return this.document?.background.src ?? '';
  }

  static async #onDelete(_event: Event, target: HTMLElement): Promise<void> {
    const row = target.closest('tr');
    if (row) row.remove();
  }

  static async #onPreview(_event: Event, target: HTMLElement): Promise<void> {
    const row = target.closest('tr');
    const url = (row?.querySelector('.image') as HTMLInputElement | null)?.value?.trim();
    if (url) {
      new ImagePopout(url).render(true);
    }
  }

  /**
   * Extract base filename without extension from a path
   * @param path - File path to extract base name from
   * @returns Base filename without extension
   */
  static #extractBaseNameFromPath(path: string): string {
    return path.split('/').pop()!.split('.').slice(0, -1).join('.');
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

    const imagePaths = Array.from(app.element.querySelectorAll('input.image')).map(
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

  /**
   * Parse variations from form data
   * @param formData - Form data object
   * @returns Array of variations
   */
  static #parseVariationsFromFormData(formData: Record<string, string>): Variation[] {
    const variations: Variation[] = [];
    let index = 0;

    while (formData[`variations.${index}.file`] !== undefined) {
      variations.push({
        name: formData[`variations.${index}.name`] || '',
        file: formData[`variations.${index}.file`] || '',
      });
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
    const gmRadio = form.querySelector('input[name="gm"]:checked') as HTMLInputElement | null;
    const plRadio = form.querySelector('input[name="pl"]:checked') as HTMLInputElement | null;

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
    const bg = variations[0]?.file;
    if (!bg) {
      ui.notifications?.error('No default background specified');
      return null;
    }

    const gm = variations[gmIndex]?.file;
    const pl = variations[plIndex]?.file;

    if (!gm || !pl) {
      ui.notifications?.error(
        game.i18n?.localize(I18N_KEYS.ERROR_SELECTION) ?? 'Invalid selection'
      );
      return null;
    }

    const validVariations = variations.slice(1).filter((v) => v.file);
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

      const variations = Scenery.#parseVariationsFromFormData(fd);
      const { gmIndex, plIndex } = Scenery.#getSelectedRadioIndices(form);
      const data = Scenery.#validateAndBuildSceneryData(variations, gmIndex, plIndex);

      if (!data) return;

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

    this.element.querySelectorAll('button.file-picker').forEach((button: Element) => {
      button.addEventListener('click', this._onClickFilePicker.bind(this));
    });
  }

  async _onClickFilePicker(event: Event): Promise<void> {
    event.preventDefault();
    const button = event.currentTarget as HTMLButtonElement;
    const input = button.parentElement?.querySelector(
      'input[type="text"]'
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
      const fileInput = row.querySelector('.scenery-fp input') as HTMLInputElement | null;
      const nameInput = row.querySelector('.scenery-name input') as HTMLInputElement | null;
      if (fileInput && nameInput && !fileInput.value && !nameInput.value) {
        row.remove();
      }
    });
  }

  async addVariation(name = '', file = '', id: number | null = null): Promise<void> {
    const tbody = this.element.querySelector('.scenery-table');
    if (!tbody) return;

    if (id === null) {
      const lastRow = tbody.querySelector('tr:last-child');
      const lastIndex = lastRow ? parseInt(lastRow.getAttribute('data-index') || '-1') : -1;
      id = lastIndex + 1;
    }

    const rowHtml = await foundry.applications.handlebars.renderTemplate(TEMPLATES.VARIATION, {
      id,
      name,
      file,
    });
    const template = document.createElement('template');
    template.innerHTML = rowHtml;
    const row = template.content.firstElementChild;

    if (row) {
      tbody.appendChild(row);

      const filePickerButton = row.querySelector('button.file-picker');
      if (filePickerButton) {
        filePickerButton.addEventListener('click', this._onClickFilePicker.bind(this));
      }
    }
  }

  static async setImage(img: string, draw = true): Promise<void> {
    if (!canvas?.scene) return;

    if (!game.user?.isGM && !canvas.scene.canUserModify(game.user!, 'update')) {
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

      try {
        log(`Loading new background texture: ${img}`);

        const texture = await foundry.canvas.loadTexture(img);

        if (texture && 'baseTexture' in texture && canvas.primary?.background) {
          canvas.primary.background.texture = texture as PIXI.Texture;
          canvas.scene.background.src = img;
          canvas.primary.renderDirty = true;
          canvas.app?.renderer.render(canvas.app.stage);

          if (!sceneryScene._sceneryPendingBackground) {
            ui.notifications?.info(game.i18n?.localize(I18N_KEYS.LOADING) ?? 'Loading...');
          }
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

    const currentBackground = canvas.scene.background.src ?? '';
    const expectedBackground = data.bg;

    const sceneryScene = canvas.scene as SceneryScene;
    if (currentBackground !== expectedBackground && !sceneryScene._sceneryPendingBackground) {
      log('Background mismatch detected, skipping scenery override');
      log({ current: currentBackground, expected: expectedBackground });
      return;
    }

    const img = getUserImage(data);
    if (img) {
      Scenery.setImage(img, false);
    }
  }

  static async _onCanvasReady(_canvas: Canvas): Promise<void> {
    if (!canvas?.scene) return;

    const sceneryScene = canvas.scene as SceneryScene;
    if (sceneryScene._sceneryPendingBackground) {
      const pendingImg = sceneryScene._sceneryPendingBackground;
      delete sceneryScene._sceneryPendingBackground;

      log(`Applying pending background: ${pendingImg}`);
      await Scenery.setImage(pendingImg);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(game.settings as any)?.get(MODULE_ID, SETTINGS.SHOW_VARIATIONS_LABEL)) return;

    const htmlElement =
      html instanceof HTMLElement
        ? html
        : // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (html as any)[0] instanceof HTMLElement
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (html as any)[0]
          : null;

    if (!htmlElement) {
      console.warn('Scenery | _onRenderSceneDirectory: Invalid html parameter', html);
      return;
    }

    const scenes = game.scenes?.contents ?? [];

    scenes
      .filter((scene) => {
        const data = getSceneryData(scene);
        return data?.variations && data.variations.length > 0;
      })
      .forEach((scene) => {
        const menuEntry = htmlElement.querySelector(`[data-document-id="${scene.id}"]`);
        if (!menuEntry) return;

        const label = document.createElement('label');
        label.classList.add('scenery-variations');
        const data = getSceneryData(scene)!;
        const variationsCount = data.variations.length + 1;
        label.innerHTML = `<i class="fa fa-images"></i> ${variationsCount}`;
        menuEntry.prepend(label);
      });
  }

  static _onContextMenu(
    html: JQuery | HTMLElement | null,
    entryOptions: Array<{
      name: string;
      icon: string;
      condition?: () => boolean;
      callback: (li: JQuery | HTMLElement) => void;
    }>
  ): void {
    log('_onContextMenu called');
    log({ html, entryOptions });

    const viewOption = {
      name: game.i18n?.localize(I18N_KEYS.APP_NAME) ?? 'Scenery',
      icon: 'fas fa-images',
      condition: () => game.user?.isGM ?? false,
      callback: (li: JQuery | HTMLElement) => {
        const element =
          (li as any)[0] instanceof HTMLElement
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (li as any)[0]
            : (li as HTMLElement);
        const id =
          (element as HTMLElement)?.dataset?.documentId ??
          (element as HTMLElement)?.dataset?.sceneId;

        if (!id) {
          console.error('Scenery | No scene ID found on element', li);
          return;
        }

        log(`Opening for scene: ${id}`);
        const sceneryApp = new Scenery({ sceneId: id });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sceneryApp as any).render(true);
      },
    };
    entryOptions.push(viewOption);
    log('Context menu option added');
    log(viewOption);
  }
}
