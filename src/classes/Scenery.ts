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
  getVariationManagedSelection,
  getSetting,
  parseIdentifiers,
  classifyMapFile,
  removeTokenFromFileName,
  normalizeForPairing,
  computeCleanKey,
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

  // Active variation index (0 = Default)
  activeVariationIndex: number = 0;
  // All variations including Default at index 0
  variations: Variation[] = [];

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
      delete: Scenery.#onDelete,
      about: Scenery.#onAbout,
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

    log('[CONTEXT] Preparing context');
    log(`[CONTEXT] Document: ${this.document?.id} "${this.document?.name}"`);
    log(`[CONTEXT] Background.src: ${this.document?.background?.src}`);
    log(`[CONTEXT] Flag exists: ${!!flag}`);

    const currentBackground = this.getCurrentBackground();
    log(`[CONTEXT] getCurrentBackground(): ${currentBackground}`);

    // Initialize from flag data or create default
    if (flag) {
      log(
        `[CONTEXT] Flag: activeVariationIndex=${flag.activeVariationIndex}, variations=${flag.variations?.length ?? 0}`
      );
      // Debug: log each variation's backgrounds
      flag.variations?.forEach((v, i) => {
        log(`[CONTEXT] Flag variation[${i}]: gm="${v.gmBackground}", pl="${v.plBackground}"`);
      });
      this.activeVariationIndex = flag.activeVariationIndex ?? 0;
      this.variations = flag.variations ? [...flag.variations] : [];
    } else {
      // No flag data - create default variation from current background
      this.activeVariationIndex = 0;
      this.variations = [
        {
          name: VARIATIONS.DEFAULT_NAME,
          gmBackground: cleanPath(currentBackground),
          plBackground: cleanPath(currentBackground),
        },
      ];
    }

    // Ensure we have at least a default variation
    if (this.variations.length === 0) {
      this.variations = [
        {
          name: VARIATIONS.DEFAULT_NAME,
          gmBackground: cleanPath(currentBackground),
          plBackground: cleanPath(currentBackground),
        },
      ];
    }

    log(
      `[CONTEXT] Built ${this.variations.length} variations, active=${this.activeVariationIndex}`
    );

    // Prepare variations for template with additional UI properties
    context.variations = this.variations.map((v, index) => {
      const isDefault = index === 0;
      const isActive = index === this.activeVariationIndex;

      // Determine what scene data to check for display
      let sceneDataToCheck = v.sceneData;
      let liveCapture = false;

      if (isActive && canvas?.scene?.id === this.document?.id) {
        // Active variation on current scene - capture LIVE data (only variation-managed elements)
        sceneDataToCheck =
          captureSceneElements(canvas.scene, getVariationManagedSelection()) ?? undefined;
        liveCapture = true;
        log(
          `[CONTEXT] Live capture for active variation: ${sceneDataToCheck ? getSceneDataSummary(sceneDataToCheck) : 'null'}`
        );
      }

      return {
        ...v,
        index,
        isDefault,
        isActive,
        isEmpty: !v.gmBackground && !v.plBackground,
        hasSceneData: sceneDataToCheck
          ? hasSceneData({ ...v, sceneData: sceneDataToCheck })
          : false,
        sceneDataSummary: sceneDataToCheck
          ? getSceneDataSummary(sceneDataToCheck)
          : v.sceneData
            ? getSceneDataSummary(v.sceneData)
            : undefined,
        isLiveCapture: liveCapture,
      };
    });

    context.activeVariationIndex = this.activeVariationIndex;

    context.buttons = [
      { type: 'button', action: 'scan', icon: ICONS.SCAN, label: I18N_KEYS.BUTTON_SCAN },
      { type: 'button', action: 'add', icon: ICONS.ADD, label: I18N_KEYS.BUTTON_ADD },
      { type: 'submit', icon: ICONS.OK, label: I18N_KEYS.BUTTON_OK },
      { type: 'button', action: 'about', icon: ICONS.INFO, label: I18N_KEYS.BUTTON_ABOUT },
    ];

    return context;
  }

  getCurrentBackground(): string {
    const docId = this.document?.id;
    if (!docId) return '';

    // Get fresh document from game.scenes
    const freshDocument = game.scenes?.get(docId);
    if (!freshDocument) return '';

    log(`[CONTEXT] Fresh document background: ${freshDocument.background?.src}`);

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
    const card = target.closest('.variation-card');
    // Check which background to preview (gm or pl)
    const bgType = target.dataset.background || 'gm';
    const inputSelector =
      bgType === 'pl' ? 'input[name*=".plBackground"]' : 'input[name*=".gmBackground"]';
    const url = (card?.querySelector(inputSelector) as HTMLInputElement | null)?.value?.trim();
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
   * Sort variations alphabetically by name
   * @param variations - Array of variations to sort
   * @returns Sorted variations
   */
  static #sortVariations(variations: Variation[]): Variation[] {
    return variations.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get the common prefix between two strings
   * @param str1 - First string
   * @param str2 - Second string
   * @returns Common prefix
   */
  static #getCommonPrefix(str1: string, str2: string): string {
    let i = 0;
    while (i < str1.length && i < str2.length && str1[i] === str2[i]) {
      i++;
    }
    return str1.substring(0, i);
  }

  /**
   * Check if a filename matches the base name for variation scanning.
   *
   * Uses a fuzzy matching algorithm with three strategies to identify related files:
   *
   * **Strategy 1: Contains Match**
   * The candidate filename contains the base name as a substring.
   * Example: baseName="forest" matches "forest_night", "dark_forest", "forest"
   *
   * **Strategy 2: Bidirectional Match**
   * The base name contains the candidate filename (minimum 4 characters).
   * Handles cases where the default has a longer, more specific name.
   * Example: baseName="forest_clearing_day" matches "forest", "clearing"
   *
   * **Strategy 3: Common Prefix Match (60% threshold)**
   * Both names share a significant common prefix (at least 60% of shorter name length,
   * minimum 4 characters). This catches naming variations where suffixes differ.
   * Example: baseName="tavern_interior" matches "tavern_exterior" (prefix: "tavern_")
   *
   * The 60% threshold balances between catching legitimate variations and avoiding
   * false positives from unrelated files that happen to share short prefixes.
   *
   * @param fileName - The filename to check (without path and extension)
   * @param baseName - The base filename to match against (without path and extension)
   * @returns True if the filename is a likely variation of the base
   */
  static #isLikelyVariation(fileName: string, baseName: string): boolean {
    const fileNameLower = fileName.toLowerCase();
    const baseNameLower = baseName.toLowerCase();

    // Strategy 1: Contains - variation contains base name
    if (fileNameLower.includes(baseNameLower)) {
      log(`[SCAN] Match (contains): "${fileName}" contains "${baseName}"`);
      return true;
    }

    // Strategy 2: Bidirectional - base name contains variation (min 4 chars)
    if (baseNameLower.includes(fileNameLower) && fileNameLower.length > 3) {
      log(`[SCAN] Match (bidirectional): "${baseName}" contains "${fileName}"`);
      return true;
    }

    // Strategy 3: Common prefix (≥60% of shorter name, min 4 chars)
    const commonPrefix = Scenery.#getCommonPrefix(fileNameLower, baseNameLower);
    const minLength = Math.min(fileNameLower.length, baseNameLower.length);
    const threshold = Math.floor(minLength * 0.6);

    log(
      `[SCAN] Prefix check: "${fileName}" vs "${baseName}" → prefix="${commonPrefix}" (${commonPrefix.length}/${minLength}, threshold=${threshold})`
    );

    if (commonPrefix.length >= threshold && commonPrefix.length >= 4) {
      log(
        `[SCAN] Match (prefix): "${fileName}" shares prefix "${commonPrefix}" with "${baseName}"`
      );
      return true;
    }

    log(`[SCAN] No match: "${fileName}" vs "${baseName}"`);
    return false;
  }

  static async #onScan(this: Scenery, _event: Event, _target: HTMLElement): Promise<void> {
    const app = this;

    // Get GM background path from default variation for scanning
    const path = (
      app.element.querySelector('[name="variations.0.gmBackground"]') as HTMLInputElement | null
    )?.value;
    if (!path) return;

    // Read identifier settings
    const gmIds = parseIdentifiers((getSetting(SETTINGS.GM_MAP_IDENTIFIERS) as string) ?? '');
    const plIds = parseIdentifiers((getSetting(SETTINGS.PLAYER_MAP_IDENTIFIERS) as string) ?? '');
    log(`[SCAN] GM identifiers: [${gmIds.join(', ')}], Player identifiers: [${plIds.join(', ')}]`);

    // Collect all existing background paths (both GM and Player) to avoid duplicates
    const existingPaths = new Set<string>();
    app.element.querySelectorAll('input[name*=".gmBackground"]').forEach((input) => {
      const val = (input as HTMLInputElement).value;
      if (val) existingPaths.add(val);
    });
    app.element.querySelectorAll('input[name*=".plBackground"]').forEach((input) => {
      const val = (input as HTMLInputElement).value;
      if (val) existingPaths.add(val);
    });

    const fp = await foundry.applications.apps.FilePicker.implementation.browse('data', path);
    const baseName = Scenery.#extractBaseNameFromPath(path);

    // Types for classification
    interface ClassifiedFile {
      file: string;
      fileName: string;
      category: 'gm' | 'player' | 'neutral';
      matchedToken?: string;
      cleanKey: string;
    }

    interface FileGroup {
      gm?: ClassifiedFile;
      player?: ClassifiedFile;
      neutral?: ClassifiedFile;
    }

    // Step 1: Fuzzy-match files against baseName, classify each, compute cleanKey
    const classifiedFiles: ClassifiedFile[] = [];

    for (const file of fp.files) {
      if (existingPaths.has(file)) continue;
      const fileName = Scenery.#extractBaseNameFromPath(file);
      if (!Scenery.#isLikelyVariation(fileName, baseName)) continue;

      const classification = classifyMapFile(fileName, gmIds, plIds);
      const cleanKey = classification.matchedToken
        ? computeCleanKey(fileName, classification.matchedToken)
        : normalizeForPairing(fileName);

      classifiedFiles.push({
        file,
        fileName,
        category: classification.category,
        matchedToken: classification.matchedToken,
        cleanKey,
      });

      log(
        `[SCAN] Classified "${fileName}" as ${classification.category}${classification.matchedToken ? ` (token: ${classification.matchedToken})` : ''}, cleanKey="${cleanKey}"`
      );
    }

    // Step 2: Group classified files by cleanKey
    const groups = new Map<string, FileGroup>();

    for (const cf of classifiedFiles) {
      if (!groups.has(cf.cleanKey)) {
        groups.set(cf.cleanKey, {});
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const group = groups.get(cf.cleanKey)!;

      // First file of each category wins
      if (cf.category === 'gm' && !group.gm) {
        group.gm = cf;
      } else if (cf.category === 'player' && !group.player) {
        group.player = cf;
      } else if (cf.category === 'neutral' && !group.neutral) {
        group.neutral = cf;
      }
    }

    // Step 3: Compute default's cleanKey for matching
    const defaultClassification = classifyMapFile(baseName, gmIds, plIds);
    const defaultCleanKey = defaultClassification.matchedToken
      ? computeCleanKey(baseName, defaultClassification.matchedToken)
      : normalizeForPairing(baseName);
    log(`[SCAN] Default baseName="${baseName}", cleanKey="${defaultCleanKey}"`);

    // Step 4: Build variations from groups
    const sceneBackground =
      (app.element.querySelector('[name="variations.0.plBackground"]') as HTMLInputElement | null)
        ?.value ?? '';
    const variations: Variation[] = [];

    for (const [key, group] of groups) {
      log(
        `[SCAN] Group "${key}": gm=${group.gm?.fileName ?? 'none'}, player=${group.player?.fileName ?? 'none'}, neutral=${group.neutral?.fileName ?? 'none'}`
      );

      // If this group matches the default's cleanKey, enhance the default instead
      if (key === defaultCleanKey) {
        if (group.gm) {
          // Set the default's gmBackground input in the DOM
          const defaultGmInput = app.element.querySelector(
            '[name="variations.0.gmBackground"]'
          ) as HTMLInputElement | null;
          if (defaultGmInput) {
            defaultGmInput.value = group.gm.file;
            log(`[SCAN] Enhanced default gmBackground with "${group.gm.file}"`);
          }
        }
        // Skip creating a variation for the default group
        continue;
      }

      // Determine GM and Player backgrounds based on group composition
      let gmBg: string;
      let plBg: string;

      if (group.gm && group.player) {
        // GM + Player pair
        gmBg = group.gm.file;
        plBg = group.player.file;
      } else if (group.gm && group.neutral) {
        // GM + Neutral
        gmBg = group.gm.file;
        plBg = group.neutral.file;
      } else if (group.player && group.neutral) {
        // Player + Neutral
        gmBg = group.neutral.file;
        plBg = group.player.file;
      } else if (group.gm) {
        // GM only → player sees scene background
        gmBg = group.gm.file;
        plBg = sceneBackground;
      } else if (group.player) {
        // Player only
        gmBg = group.player.file;
        plBg = group.player.file;
      } else if (group.neutral) {
        // Neutral only (same as current behavior)
        gmBg = group.neutral.file;
        plBg = group.neutral.file;
      } else {
        continue;
      }

      // Derive variation name from the best file in the group (prefer neutral > player > gm)
      const bestFile = group.neutral ?? group.player ?? group.gm;
      if (!bestFile) continue;

      let nameFileName = bestFile.fileName;
      if (bestFile.matchedToken) {
        nameFileName = removeTokenFromFileName(nameFileName, bestFile.matchedToken);
      }

      const name = decodeURIComponent(nameFileName.replace(baseName, ''))
        .replace(/[-_]/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

      variations.push({ name, gmBackground: gmBg, plBackground: plBg });
    }

    Scenery.#sortVariations(variations);

    app.removeBlankVariations();

    for (const v of variations) {
      await app.addVariation(v.name, v.gmBackground, v.plBackground);
    }
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

    // CRITICAL: Sync form data to sceneryData BEFORE opening copy dialog
    // This ensures newly added variations exist in sceneryData
    await app.#syncFormDataToSceneryData();

    // Show copy dialog
    await app.#showCopyDialog(variationIndex);
  }

  /**
   * Sync current form data to sceneryData without closing the dialog.
   * This is used before Copy operations to ensure newly added variations
   * exist in the stored data.
   */
  async #syncFormDataToSceneryData(): Promise<void> {
    // Note: this.element IS the form (tag: 'form'), not a container with a form inside
    const form =
      this.element instanceof HTMLFormElement
        ? this.element
        : (this.element.querySelector('form') as HTMLFormElement | null);
    if (!form) {
      log(`[SYNC] No form found, skipping sync`);
      return;
    }

    const formData = new FormData(form);
    const fd: Record<string, string> = {};
    formData.forEach((value, key) => {
      fd[key] = value as string;
    });

    // Get existing flag to preserve sceneData
    const existingFlag = getSceneryData(this.document);

    const variations = Scenery.#parseVariationsFromFormData(fd, existingFlag);
    const activeIndex = Scenery.#getActiveVariationIndex(form);

    log(`[SYNC] Syncing ${variations.length} variations from form`);

    // Filter out empty variations
    const validVariations = variations.filter((v) => v.gmBackground);

    if (validVariations.length === 0) {
      log(`[SYNC] No valid variations, skipping sync`);
      return;
    }

    const safeActiveIndex = Math.min(activeIndex, validVariations.length - 1);

    const data: SceneryData = {
      activeVariationIndex: safeActiveIndex,
      variations: validVariations,
    };

    // Enforce: Default variation's plBackground always matches scene background
    const sceneBackground = cleanPath(this.document?.background?.src ?? '');
    if (data.variations[0] && sceneBackground) {
      data.variations[0].plBackground = sceneBackground;
    }

    log(
      `[SYNC] Saving: ${validVariations.length} variations, activeIndex=${data.activeVariationIndex}`
    );
    await setSceneryData(this.document, data);

    // Update app state to match the synced data
    this.variations = [...validVariations];
    this.activeVariationIndex = data.activeVariationIndex;

    log(`[SYNC] Sync complete`);
  }

  async #showCopyDialog(targetVariationIndex: number): Promise<void> {
    const targetVariation = this.variations?.[targetVariationIndex];
    if (!targetVariation) return;

    // Build list of source variations (all except target and empty ones)
    const sceneryData = getSceneryData(this.document);

    const sourceVariations = (this.variations || [])
      .map((v, index) => ({ ...v, index }))
      .filter((v, index) => {
        // Exclude target variation
        if (index === targetVariationIndex) return false;
        // Exclude empty variations (no GM background)
        if (!v.gmBackground) return false;

        // Only show variations that have copyable elements
        const isActive = sceneryData && index === sceneryData.activeVariationIndex;
        if (isActive && canvas?.scene?.id === this.document?.id) {
          const liveData = captureSceneElements(
            canvas.scene ?? undefined,
            getVariationManagedSelection()
          );
          return liveData ? hasSceneData({ ...v, sceneData: liveData }) : false;
        }
        return hasSceneData(v);
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

    // CRITICAL: Sync form data to sceneryData first
    // This ensures newly added variations exist in sceneryData
    await app.#syncFormDataToSceneryData();

    // Get the ACTUAL scenery data from the scene (not the copy in app.variations!)
    const scene = app.document;
    const sceneryData = getSceneryData(scene);
    if (!sceneryData) return;

    // In new structure, indices match directly (Default is at index 0 in both)
    const variationInData = sceneryData.variations[variationIndex];

    if (!variationInData || !variationInData.sceneData) {
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

    // Delete sceneData from the ACTUAL data
    delete variationInData.sceneData;

    // Save to scene
    await setSceneryData(scene, sceneryData);

    ui.notifications?.info(
      game.i18n?.localize('SCENERY.RESET_SCENE_DATA_SUCCESS') ?? 'Reset scene data'
    );

    // Refresh UI
    app.render();
  }

  static async #onDelete(this: Scenery, _event: Event, target: HTMLElement): Promise<void> {
    const app = this;
    const variationIndex = parseInt(target.dataset.variationIndex || '0');

    if (variationIndex === 0) return;

    // Sync form data first so any edits are preserved
    await app.#syncFormDataToSceneryData();

    const scene = app.document;
    const sceneryData = getSceneryData(scene);
    if (!sceneryData) return;

    const variation = sceneryData.variations[variationIndex];
    if (!variation) {
      // Variation was new/empty and got filtered out during sync — just re-render
      app.render();
      return;
    }

    // Show confirmation if variation has data
    const hasData =
      variation.sceneData && Object.values(variation.sceneData).some((arr) => arr?.length > 0);
    if (variation.name || variation.gmBackground || hasData) {
      const displayName = variation.name || variation.gmBackground || 'Unknown';
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

    // Remove variation and adjust active index
    sceneryData.variations.splice(variationIndex, 1);
    if (
      sceneryData.activeVariationIndex >= variationIndex &&
      sceneryData.activeVariationIndex > 0
    ) {
      sceneryData.activeVariationIndex--;
    }

    await setSceneryData(scene, sceneryData);
    app.render();
  }

  static async #onAbout(_event: Event, _target: HTMLElement): Promise<void> {
    const title = game.i18n?.localize(I18N_KEYS.ABOUT_TITLE) ?? 'About Scenery';

    const content = `
      <div style="text-align: center; padding: 8px;">
        <h2 style="margin: 0 0 4px;"><i class="${ICONS.APP}"></i> Scenery</h2>
        <p style="margin: 0 0 12px; color: var(--color-text-light-secondary);">
          Background Image Variation Manager
        </p>
        <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
          <a href="https://ko-fi.com/J3J1FVK91" target="_blank"
            style="text-decoration: none; padding: 4px 12px; border-radius: 4px; background: var(--color-control-bg); border: 1px solid var(--color-border-dark-primary);">
            <i class="fas fa-coffee"></i> Ko-fi
          </a>
          <a href="https://www.patreon.com/NerdyByNatureDev" target="_blank"
            style="text-decoration: none; padding: 4px 12px; border-radius: 4px; background: var(--color-control-bg); border: 1px solid var(--color-border-dark-primary);">
            <i class="fab fa-patreon"></i> Patreon
          </a>
          <a href="https://github.com/marcstraube/foundryvtt-scenery" target="_blank"
            style="text-decoration: none; padding: 4px 12px; border-radius: 4px; background: var(--color-control-bg); border: 1px solid var(--color-border-dark-primary);">
            <i class="fab fa-github"></i> GitHub
          </a>
        </div>
      </div>`;

    await foundry.applications.api.DialogV2.prompt({
      window: { title, icon: ICONS.APP },
      content,
      rejectClose: false,
      ok: {
        label: 'OK',
        icon: ICONS.OK,
      },
    });
  }

  /**
   * Parse variations from form data (new card-based format)
   * @param formData - Form data object
   * @param existingFlag - Existing scenery data to preserve sceneData from
   * @returns Array of variations
   */
  static #parseVariationsFromFormData(
    formData: Record<string, string>,
    existingFlag?: SceneryData
  ): Variation[] {
    const variations: Variation[] = [];
    let index = 0;

    log(`[PARSE] existingFlag exists: ${!!existingFlag}`);
    if (existingFlag?.variations) {
      log(
        `[PARSE] existingFlag.variations: ${existingFlag.variations.map((v, i) => `[${i}] gm="${cleanPath(v.gmBackground)}" hasSceneData=${!!v.sceneData}`).join(', ')}`
      );
    }

    // Debug: log all form keys
    log(
      `[PARSE] Form keys: ${Object.keys(formData)
        .filter((k) => k.startsWith('variations'))
        .join(', ')}`
    );

    while (formData[`variations.${index}.gmBackground`] !== undefined) {
      const rawGm = formData[`variations.${index}.gmBackground`];
      const rawPl = formData[`variations.${index}.plBackground`];
      log(`[PARSE] Raw form values for index ${index}: gm="${rawGm}", pl="${rawPl}"`);

      const variation: Variation = {
        name: (
          formData[`variations.${index}.name`] || (index === 0 ? VARIATIONS.DEFAULT_NAME : '')
        ).trim(),
        gmBackground: cleanPath(rawGm),
        plBackground: cleanPath(rawPl),
      };

      log(
        `[PARSE] Form index ${index}: name="${variation.name}", gm="${variation.gmBackground}", pl="${variation.plBackground}"`
      );

      // Preserve sceneData from existing flag data
      // Match by GM background path (primary identifier)
      if (variation.gmBackground && existingFlag?.variations) {
        const existingVariation = existingFlag.variations.find(
          (v) => cleanPath(v.gmBackground) === variation.gmBackground
        );
        log(
          `[PARSE] Looking for gmBackground="${variation.gmBackground}" in existingFlag: found=${!!existingVariation}, hasSceneData=${!!existingVariation?.sceneData}`
        );
        if (existingVariation?.sceneData) {
          variation.sceneData = existingVariation.sceneData;
          log(`[PARSE] Preserved sceneData: ${getSceneDataSummary(variation.sceneData)}`);
        }
      }

      variations.push(variation);
      index++;
    }

    log(`[PARSE] Result: ${variations.length} variations`);
    return variations;
  }

  /**
   * Get selected active variation index from form
   * @param form - HTML form element
   * @returns The active variation index
   */
  static #getActiveVariationIndex(form: HTMLFormElement): number {
    const activeRadio = form.querySelector(
      'input[name="activeVariation"]:checked'
    ) as HTMLInputElement | null;
    return parseInt(activeRadio?.value || '0');
  }

  /**
   * Validate and build SceneryData from variations
   * @param variations - Array of variations
   * @param activeIndex - Active variation index
   * @returns SceneryData object or null if validation fails
   */
  static #validateAndBuildSceneryData(
    variations: Variation[],
    activeIndex: number
  ): SceneryData | null {
    log('[BUILD] Validating scenery data');
    log(`[BUILD] ${variations.length} variations, active=${activeIndex}`);

    // Filter out empty variations (no GM background set)
    const validVariations = variations.filter((v) => v.gmBackground);

    if (validVariations.length === 0) {
      ui.notifications?.error('No valid variations defined');
      return null;
    }

    // Ensure activeIndex is valid
    const safeActiveIndex = Math.min(activeIndex, validVariations.length - 1);
    if (safeActiveIndex < 0) {
      ui.notifications?.error('Invalid active variation');
      return null;
    }

    log(`[BUILD] Valid variations: ${validVariations.length}, safeActiveIndex=${safeActiveIndex}`);

    return {
      activeVariationIndex: safeActiveIndex,
      variations: validVariations,
    };
  }

  async _onFormSubmit(
    _event: Event,
    form: HTMLFormElement,
    formData: FormDataExtended,
    _options: object = {}
  ): Promise<void> {
    try {
      log('[FORM] Submission started');

      const fd = formData.object as Record<string, string>;

      // Get existing flag FIRST to preserve sceneData (this.variations is a stale copy!)
      const existingFlag = getSceneryData(this.document);

      const variations = Scenery.#parseVariationsFromFormData(fd, existingFlag);
      const activeIndex = Scenery.#getActiveVariationIndex(form);
      const data = Scenery.#validateAndBuildSceneryData(variations, activeIndex);

      if (!data) return;

      // Enforce: Default variation's plBackground always matches scene background
      const sceneBackground = cleanPath(this.document?.background?.src ?? '');
      if (data.variations[0] && sceneBackground) {
        data.variations[0].plBackground = sceneBackground;
      }
      log(`[FORM] Existing flag: ${!!existingFlag}`);

      log(
        `[FORM] Saving: activeIndex=${data.activeVariationIndex}, vars=${data.variations.length}`
      );

      // Element save/restore is handled by setImage (triggered via updateScene hook)
      // setImage uses _sceneryCustomBackground which is always correct,
      // unlike canvas.scene.background.src which Foundry resets on updates.
      await setSceneryData(this.document, data);

      if (this.document?.id === canvas?.scene?.id) {
        const img = getUserImage(data);
        if (img) {
          await Scenery.setImage(img);
        } else {
          // No background to switch to, but still restore elements for active variation
          log(`[FORM] No background image, but restoring elements for active variation`);
          await Scenery.#restoreSceneElementsForActiveVariation(data);
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

    // Attach file picker handlers for all file picker buttons
    this.element.querySelectorAll(SELECTORS.BUTTON_FILE_PICKER).forEach((button: Element) => {
      button.addEventListener('click', this._onClickFilePicker.bind(this));
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
    const cards = this.element.querySelectorAll('.variation-card:not(.default)');
    cards.forEach((card: Element) => {
      const gmInput = card.querySelector('input[name*=".gmBackground"]') as HTMLInputElement | null;
      const nameInput = card.querySelector('input[name*=".name"]') as HTMLInputElement | null;
      if (gmInput && nameInput && !gmInput.value && !nameInput.value) {
        card.remove();
      }
    });
  }

  async addVariation(
    name = '',
    gmBackground = '',
    plBackground = '',
    id: number | null = null
  ): Promise<void> {
    const container = this.element.querySelector('.variations-container');
    if (!container) return;

    if (id === null) {
      const lastCard = container.querySelector('.variation-card:last-child');
      const lastIndex = lastCard ? parseInt((lastCard as HTMLElement).dataset.index || '-1') : -1;
      id = lastIndex + 1;
    }

    // Use same plBackground as gmBackground if not specified
    if (!plBackground && gmBackground) {
      plBackground = gmBackground;
    }

    const templateData = {
      index: Number(id),
      name,
      gmBackground,
      plBackground,
      isEmpty: !name && !gmBackground,
      isDefault: id === 0,
      isActive: false,
    };
    const cardHtml = await foundry.applications.handlebars.renderTemplate(
      TEMPLATES.VARIATION,
      templateData
    );
    const template = document.createElement('template');
    template.innerHTML = cardHtml;
    const card = template.content.firstElementChild;

    if (card) {
      container.appendChild(card);

      // Attach file picker handlers
      card.querySelectorAll(SELECTORS.BUTTON_FILE_PICKER).forEach((btn) => {
        btn.addEventListener('click', this._onClickFilePicker.bind(this));
      });
    }
  }

  static async setImage(img: string, draw = true): Promise<void> {
    if (!canvas?.scene) return;
    if (!game.user) return;

    // Note: We don't check scene modification permissions here because
    // setImage only changes the LOCAL canvas texture, not the scene document.
    // This allows players to see their designated background (plBackground)
    // while GM sees theirs (gmBackground).

    if (Scenery._loadingImage === img) {
      log(`[IMAGE] Already loading: ${img}`);
      return;
    }

    const sceneryScene = canvas.scene as SceneryScene;

    // Read current background BEFORE setting the new one!
    // Use Scenery's tracked background, NOT canvas.scene.background.src (which is always the DB value)
    const currentBackgroundSrc =
      sceneryScene._sceneryCustomBackground || (canvas.scene.background.src ?? '');

    if (!draw) {
      if (!sceneryScene._sceneryOriginalBackground) {
        sceneryScene._sceneryOriginalBackground = canvas.scene.background.src ?? '';
      }
      sceneryScene._sceneryPendingBackground = img;
      sceneryScene._sceneryCustomBackground = img; // Set after reading current
      return;
    }

    Scenery._loadingImage = img;

    if (canvas.ready && canvas.primary?.background) {
      if (!sceneryScene._sceneryOriginalBackground) {
        sceneryScene._sceneryOriginalBackground = canvas.scene.background.src ?? '';
      }

      try {
        log(
          `[IMAGE] Loading texture: ${img} (current: ${currentBackgroundSrc}, db: ${canvas.scene.background.src})`
        );

        // Check if we're actually switching backgrounds or just reloading
        const isActualSwitch = cleanPath(currentBackgroundSrc) !== cleanPath(img);

        // Detect fresh page load: _sceneryInitialized is set after canvasReady completes
        // Before that, any setImage call is part of initial page load - don't save!
        const isFreshPageLoad = !sceneryScene._sceneryInitialized;

        // Save and restore only when actually switching variations (GM only)
        // On page reload, the database is the source of truth - don't overwrite it!
        // Players can't modify scene data, so they just get visual background switch
        if (isActualSwitch && game.user?.isGM && !isFreshPageLoad) {
          log(`[IMAGE] Saving elements before switch (GM)`);
          await Scenery.#saveCurrentSceneElements(currentBackgroundSrc);
        } else if (isActualSwitch && isFreshPageLoad) {
          log(`[IMAGE] Fresh page load - skipping save, will restore only`);
        } else if (isActualSwitch) {
          log(`[IMAGE] Switching background (Player - visual only)`);
        } else {
          log(`[IMAGE] Same background (reload), skipping save/restore`);
        }

        log(`[IMAGE] Switching to: ${img}`);

        const texture = await foundry.canvas.loadTexture(img);

        if (texture && 'baseTexture' in texture && canvas.primary?.background) {
          canvas.primary.background.texture = texture as PIXI.Texture;
          canvas.scene.background.src = img;
          canvas.primary.renderDirty = true;
          canvas.app?.renderer.render(canvas.app.stage);

          // Update tracked background AFTER successful switch
          sceneryScene._sceneryCustomBackground = img;

          if (isActualSwitch && !sceneryScene._sceneryPendingBackground) {
            ui.notifications?.info(game.i18n?.localize(I18N_KEYS.LOADING) ?? 'Loading...');
          }

          // Restore scene elements only when user actively switches variations
          // On page reload (fresh load), trust the DB state - user's manual changes are preserved
          // Only restore when it's an actual user-initiated switch (not fresh page load)
          if (isActualSwitch && !isFreshPageLoad) {
            await Scenery.#restoreSceneElementsForCurrentVariation(img);
          } else if (isFreshPageLoad) {
            log(`[IMAGE] Fresh page load - keeping DB elements, not restoring`);
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

  /**
   * Save current scene elements (lights, walls, tiles, etc.) to the active variation.
   * Called automatically before switching to a different variation background.
   *
   * @param currentBackgroundSrc - Optional background source to save for.
   *   If not provided, uses the current canvas background.
   */
  static async #saveCurrentSceneElements(currentBackgroundSrc?: string): Promise<void> {
    if (!canvas?.scene) return;

    const data = getSceneryData(canvas.scene);
    if (!data || !data.variations || data.variations.length === 0) return;

    // Clean the current image path for consistent comparison
    const currentImg = cleanPath(currentBackgroundSrc || canvas.scene.background.src);

    log(`[SAVE] Background: "${currentImg}"`);
    log(
      `[SAVE] Variations: ${data.variations.map((v, i) => `[${i}] "${v.name}" gm="${cleanPath(v.gmBackground)}" pl="${cleanPath(v.plBackground)}"`).join(', ')}`
    );

    // Find the variation matching the current background (check both GM and Player backgrounds)
    const currentVariation = data.variations.find(
      (v) => cleanPath(v.gmBackground) === currentImg || cleanPath(v.plBackground) === currentImg
    );

    if (currentVariation) {
      const selection = getVariationManagedSelection();
      const sceneData = captureSceneElements(canvas.scene ?? undefined, selection);
      if (sceneData) {
        currentVariation.sceneData = sceneData;
        await setSceneryData(canvas.scene, data);
        log(`[SAVE] Saved elements for variation: ${currentVariation.name}`);
      }
    } else {
      log(`[SAVE] Warning: No variation found for background: "${currentImg}"`);
      log(
        `[SAVE] Available variation backgrounds: ${data.variations.map((v) => `gm="${cleanPath(v.gmBackground)}" pl="${cleanPath(v.plBackground)}"`).join(', ')}`
      );
    }
  }

  /**
   * Restore scene elements (lights, walls, tiles, etc.) for the target variation.
   * Called automatically after switching to a different variation background.
   * If the variation has no saved sceneData, clears all elements (empty state).
   *
   * @param targetBackgroundSrc - Optional background source to restore for.
   *   If not provided, uses the current canvas background.
   */
  static async #restoreSceneElementsForCurrentVariation(
    targetBackgroundSrc?: string
  ): Promise<void> {
    if (!canvas?.scene) return;

    const data = getSceneryData(canvas.scene);
    if (!data || !data.variations || data.variations.length === 0) return;

    // Clean paths for consistent comparison
    const currentImg = cleanPath(targetBackgroundSrc || canvas.scene.background.src);
    log(`[RESTORE] Target background: "${currentImg}"`);

    const emptySceneData = {
      lights: [],
      sounds: [],
      tiles: [],
      walls: [],
      drawings: [],
      templates: [],
      regions: [],
      notes: [],
    };

    // Find the variation matching the target background (check both GM and Player backgrounds)
    log(`[RESTORE] Looking for variation with background="${currentImg}"`);
    log(
      `[RESTORE] Available variations: ${data.variations.map((v, i) => `[${i}] gm="${cleanPath(v.gmBackground)}" pl="${cleanPath(v.plBackground)}" hasSceneData=${!!v.sceneData}`).join(', ')}`
    );

    const currentVariation = data.variations.find(
      (v) => cleanPath(v.gmBackground) === currentImg || cleanPath(v.plBackground) === currentImg
    );

    if (currentVariation) {
      // If variation is default (index 0) and has no saved data, keep current elements
      const isDefault = data.variations.indexOf(currentVariation) === 0;
      if (isDefault && !currentVariation.sceneData) {
        log(`[RESTORE] Default variation - no saved data, keeping current elements`);
        return;
      }

      // For non-default variations: If no saved data, clear all elements (new variation = empty)
      const sceneData = currentVariation.sceneData || emptySceneData;

      log(
        `[RESTORE] Found variation: ${currentVariation.name}, hasSceneData=${!!currentVariation.sceneData}`
      );
      log(`[RESTORE] sceneData summary: ${getSceneDataSummary(sceneData)}`);
      log(
        `[RESTORE] Elements: ${sceneData.lights.length}L, ${sceneData.sounds.length}S, ${sceneData.tiles.length}T, ${sceneData.walls.length}W, ${sceneData.templates.length}Tmpl`
      );
      const selection = getVariationManagedSelection();
      await restoreSceneElements(canvas.scene, sceneData, selection);
    } else {
      log(`[RESTORE] Warning: No variation found for background: "${currentImg}"`);
      log(
        `[RESTORE] Comparison failed. Available backgrounds: ${data.variations.map((v) => `gm="${cleanPath(v.gmBackground)}" pl="${cleanPath(v.plBackground)}"`).join(', ')}`
      );
    }
  }

  /**
   * Restore scene elements for the active variation by index.
   * Used when switching variations without changing backgrounds.
   * @param sceneryData - The scenery data containing variations
   */
  static async #restoreSceneElementsForActiveVariation(sceneryData: SceneryData): Promise<void> {
    if (!canvas?.scene) return;

    const activeVariation = sceneryData.variations[sceneryData.activeVariationIndex];
    if (!activeVariation) {
      log(
        `[RESTORE-ACTIVE] No active variation found at index ${sceneryData.activeVariationIndex}`
      );
      return;
    }

    const emptySceneData = {
      lights: [],
      sounds: [],
      tiles: [],
      walls: [],
      drawings: [],
      templates: [],
      regions: [],
      notes: [],
    };

    // Default variation (index 0) without sceneData = keep current elements
    const isDefault = sceneryData.activeVariationIndex === 0;
    if (isDefault && !activeVariation.sceneData) {
      log(`[RESTORE-ACTIVE] Default variation without sceneData - keeping current elements`);
      return;
    }

    // For non-default or variations with sceneData: restore (or clear if empty)
    const sceneData = activeVariation.sceneData || emptySceneData;
    log(
      `[RESTORE-ACTIVE] Restoring for "${activeVariation.name}": ${getSceneDataSummary(sceneData)}`
    );
    const selection = getVariationManagedSelection();
    await restoreSceneElements(canvas.scene, sceneData, selection);
  }

  /**
   * Reset the canvas background to its original (database) state.
   * Removes any scenery-applied custom background and restores the scene's
   * actual background.src value. Called when leaving a scene or cleaning up.
   */
  static async resetBackground(): Promise<void> {
    if (!canvas?.scene) return;

    const sceneryScene = canvas.scene as SceneryScene;
    if (!sceneryScene._sceneryOriginalBackground) return;

    const originalSrc = sceneryScene._sceneryOriginalBackground;

    if (canvas.scene.background.src === originalSrc) {
      log('[RESET] Background already at original');
      return;
    }

    if (canvas.primary?.background) {
      try {
        log(`[RESET] Restoring original background: ${originalSrc}`);

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
    if (!data || !data.variations || data.variations.length === 0) return;

    const currentBackground = cleanPath(canvas.scene.background.src);
    // Expected background is the default variation's GM background (index 0)
    const expectedBackground = cleanPath(data.variations[0]?.gmBackground || '');

    log(`[INIT] current="${currentBackground}", expected="${expectedBackground}"`);

    const sceneryScene = canvas.scene as SceneryScene;

    // Only skip if backgrounds don't match AND there's no pending background
    // This handles cases where the scene was modified outside of Scenery
    if (currentBackground !== expectedBackground && !sceneryScene._sceneryPendingBackground) {
      log('[INIT] Background mismatch, skipping scenery override');
      return;
    }

    // Get the appropriate image for the current user (GM or Player)
    const img = cleanPath(getUserImage(data));
    log(`[INIT] User image: ${img}`);

    if (img) {
      Scenery.setImage(img, false);
    }
  }

  static async _onCanvasReady(_canvas: Canvas): Promise<void> {
    if (!canvas?.scene) {
      log(`[READY] No canvas.scene`);
      return;
    }

    log(`[READY] Scene: ${canvas.scene.name}`);

    const sceneryScene = canvas.scene as SceneryScene;
    log(`[READY] Pending: ${sceneryScene._sceneryPendingBackground || 'none'}`);

    if (sceneryScene._sceneryPendingBackground) {
      const pendingImg = sceneryScene._sceneryPendingBackground;
      delete sceneryScene._sceneryPendingBackground;

      log(`[READY] Applying pending: ${pendingImg}`);
      await Scenery.setImage(pendingImg);
    } else {
      // No pending background - check if we need to apply scenery settings
      const data = getSceneryData(canvas.scene);
      log(`[READY] Scenery data: ${!!data}`);

      if (data) {
        const currentBackground = cleanPath(canvas.scene.background.src);
        const userImage = cleanPath(getUserImage(data));
        const isGM = game.user?.isGM;

        log(`[READY] isGM=${isGM}, current="${currentBackground}", userImage="${userImage}"`);

        // If the user's image differs from current, apply it
        if (userImage && userImage !== currentBackground) {
          log(`[READY] Applying user background: ${userImage}`);
          await Scenery.setImage(userImage);
        } else {
          log(`[READY] No change needed`);
        }
      }
    }

    // Mark scene as initialized - subsequent setImage calls are user-initiated
    sceneryScene._sceneryInitialized = true;
    log(`[READY] Scene initialized`);
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
    const cleanedNewBg = cleanPath(newBackground);

    // Clone the data
    const updatedData: SceneryData = {
      activeVariationIndex: sceneryData.activeVariationIndex,
      variations: sceneryData.variations.map((v) => ({ ...v })),
    };

    // Update the default variation (index 0) with the new background
    // Player background always follows scene background (locked)
    // GM background only updates if it was the same as player background (not customized)
    const defaultVariation = updatedData.variations[0];
    if (defaultVariation) {
      const oldDefaultGm = cleanPath(defaultVariation.gmBackground);
      const oldDefaultPl = cleanPath(defaultVariation.plBackground);

      updatedData.variations[0] = {
        ...defaultVariation,
        name: VARIATIONS.DEFAULT_NAME,
        gmBackground: oldDefaultGm === oldDefaultPl ? cleanedNewBg : defaultVariation.gmBackground,
        plBackground: cleanedNewBg,
      };
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
    log(
      `[UPDATE] Scene ${scene.id}, current=${scene.id === canvas?.scene?.id}, flag=${foundry.utils.hasProperty(data, 'flags.scenery.data')}, bg=${foundry.utils.hasProperty(data, 'background.src')}`
    );

    ui.scenes?.render();

    if (foundry.utils.hasProperty(data, 'background.src')) {
      const newBackground = data.background?.src ?? '';
      const sceneryData = getSceneryData(scene);

      if (sceneryData) {
        log('[UPDATE] Background changed via scene settings, updating scenery data');

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
      // Get fresh scenery data from the scene (not the delta from update)
      const sceneryData = getSceneryData(scene);
      const img = sceneryData ? getUserImage(sceneryData) : undefined;
      log(
        `[UPDATE] Scenery flag changed, isGM=${game.user?.isGM}, newImg="${img}", current="${canvas?.scene?.background.src}"`
      );

      if (img) {
        // Fire-and-forget: Foundry hooks are never awaited (per API design)
        log('[HOOK] Calling setImage from updateScene');
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
      log('[RENDER] SceneDirectory: Invalid html parameter');
      return;
    }

    const scenes = game.scenes?.contents ?? [];

    scenes
      .filter((scene) => {
        const data = getSceneryData(scene);
        // Only show badge when there are 2+ variations (default alone doesn't count)
        return data?.variations && data.variations.length > 1;
      })
      .forEach((scene) => {
        // v13 uses data-entry-id instead of data-document-id
        const menuEntry = htmlElement.querySelector(`[data-entry-id="${scene.id}"]`);
        if (!menuEntry) return;

        const data = getSceneryData(scene);
        if (!data?.variations) return;

        const label = document.createElement('label');
        label.classList.add('scenery-variations');
        // variations array now includes default at index 0
        const variationsCount = data.variations.length;
        label.innerHTML = `<i class="fa fa-images"></i> ${variationsCount}`;
        menuEntry.prepend(label);
      });
  }
}
