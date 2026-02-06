import Scenery from './classes/Scenery.js';
import { log } from './helpers.js';
import type { SceneUpdate } from './types.js';
import { MODULE_ID, SETTINGS, I18N_KEYS, ICONS } from './constants.js';

log('Module loading...', true);

// Make Scenery available globally for debugging and compatibility
(window as Window & typeof globalThis & { Scenery: typeof Scenery }).Scenery = Scenery;

Hooks.once('init', () => {
  log('Scenery | Init');

  // Use v13 template loading API
  if (foundry?.applications?.handlebars?.loadTemplates) {
    foundry.applications.handlebars.loadTemplates(['modules/scenery/templates/variation.hbs']);
  }

  // Register settings during init
  const settings = game.settings as unknown as {
    register(module: string, key: string, data: Record<string, unknown>): void;
  };

  settings?.register(MODULE_ID, SETTINGS.DEBUG_LOGGING, {
    name: game.i18n?.localize(I18N_KEYS.SETTING_DEBUG_LOGGING) ?? 'Debug Logging',
    hint:
      game.i18n?.localize(I18N_KEYS.SETTING_DEBUG_LOGGING_HINT) ?? 'Show debug messages in console',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  });

  settings?.register(MODULE_ID, SETTINGS.SHOW_HEADER_BUTTON, {
    name: game.i18n?.localize(I18N_KEYS.SETTING_SHOW_HEADER_BUTTON) ?? 'Show Header Button',
    hint:
      game.i18n?.localize(I18N_KEYS.SETTING_SHOW_HEADER_BUTTON_HINT) ??
      'Show Scenery button in Scene Directory header',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true,
  });

  settings?.register(MODULE_ID, SETTINGS.SHOW_VARIATIONS_LABEL, {
    name: game.i18n?.localize(I18N_KEYS.SETTING_SHOW_VARIATIONS) ?? 'Show Variations Label',
    hint:
      game.i18n?.localize(I18N_KEYS.SETTING_SHOW_VARIATIONS_HINT) ?? 'Show variation count label',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true,
  });

  settings?.register(MODULE_ID, SETTINGS.GM_MAP_IDENTIFIERS, {
    name: game.i18n?.localize(I18N_KEYS.SETTING_GM_MAP_IDENTIFIERS) ?? 'GM Map Identifiers',
    hint:
      game.i18n?.localize(I18N_KEYS.SETTING_GM_MAP_IDENTIFIERS_HINT) ??
      'Comma-separated tokens that identify GM-specific maps in filenames (e.g. gm, dm).',
    scope: 'world',
    config: true,
    type: String,
    default: 'gm, dm',
  });

  settings?.register(MODULE_ID, SETTINGS.PLAYER_MAP_IDENTIFIERS, {
    name: game.i18n?.localize(I18N_KEYS.SETTING_PLAYER_MAP_IDENTIFIERS) ?? 'Player Map Identifiers',
    hint:
      game.i18n?.localize(I18N_KEYS.SETTING_PLAYER_MAP_IDENTIFIERS_HINT) ??
      'Comma-separated tokens that identify Player-specific maps in filenames (e.g. player, pl).',
    scope: 'world',
    config: true,
    type: String,
    default: 'player, pl',
  });

  // Global element type settings
  // When enabled, these element types are NOT managed by variations (they stay on the scene)
  settings?.register(MODULE_ID, SETTINGS.GLOBAL_LIGHTS, {
    name: game.i18n?.localize(I18N_KEYS.SETTING_GLOBAL_LIGHTS) ?? 'Global Lights',
    hint:
      game.i18n?.localize(I18N_KEYS.SETTING_GLOBAL_LIGHTS_HINT) ??
      'Lights stay on the scene when switching variations.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  });

  settings?.register(MODULE_ID, SETTINGS.GLOBAL_SOUNDS, {
    name: game.i18n?.localize(I18N_KEYS.SETTING_GLOBAL_SOUNDS) ?? 'Global Sounds',
    hint:
      game.i18n?.localize(I18N_KEYS.SETTING_GLOBAL_SOUNDS_HINT) ??
      'Sounds stay on the scene when switching variations.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  });

  settings?.register(MODULE_ID, SETTINGS.GLOBAL_TILES, {
    name: game.i18n?.localize(I18N_KEYS.SETTING_GLOBAL_TILES) ?? 'Global Tiles',
    hint:
      game.i18n?.localize(I18N_KEYS.SETTING_GLOBAL_TILES_HINT) ??
      'Tiles stay on the scene when switching variations.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  });

  settings?.register(MODULE_ID, SETTINGS.GLOBAL_WALLS, {
    name: game.i18n?.localize(I18N_KEYS.SETTING_GLOBAL_WALLS) ?? 'Global Walls',
    hint:
      game.i18n?.localize(I18N_KEYS.SETTING_GLOBAL_WALLS_HINT) ??
      'Walls stay on the scene when switching variations.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  });

  settings?.register(MODULE_ID, SETTINGS.GLOBAL_DRAWINGS, {
    name: game.i18n?.localize(I18N_KEYS.SETTING_GLOBAL_DRAWINGS) ?? 'Global Drawings',
    hint:
      game.i18n?.localize(I18N_KEYS.SETTING_GLOBAL_DRAWINGS_HINT) ??
      'Drawings stay on the scene when switching variations.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  settings?.register(MODULE_ID, SETTINGS.GLOBAL_TEMPLATES, {
    name: game.i18n?.localize(I18N_KEYS.SETTING_GLOBAL_TEMPLATES) ?? 'Global Templates',
    hint:
      game.i18n?.localize(I18N_KEYS.SETTING_GLOBAL_TEMPLATES_HINT) ??
      'Templates stay on the scene when switching variations.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  settings?.register(MODULE_ID, SETTINGS.GLOBAL_REGIONS, {
    name: game.i18n?.localize(I18N_KEYS.SETTING_GLOBAL_REGIONS) ?? 'Global Regions',
    hint:
      game.i18n?.localize(I18N_KEYS.SETTING_GLOBAL_REGIONS_HINT) ??
      'Regions stay on the scene when switching variations.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  });

  settings?.register(MODULE_ID, SETTINGS.GLOBAL_NOTES, {
    name: game.i18n?.localize(I18N_KEYS.SETTING_GLOBAL_NOTES) ?? 'Global Notes',
    hint:
      game.i18n?.localize(I18N_KEYS.SETTING_GLOBAL_NOTES_HINT) ??
      'Notes stay on the scene when switching variations.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  });
});

// Register v13 context menu hook
Hooks.on('getSceneContextOptions', (_app, menuItems) => {
  menuItems.push({
    name: game.i18n?.localize(I18N_KEYS.APP_NAME) ?? 'Scenery',
    icon: '<i class="fas fa-images"></i>',
    condition: () => game.user?.isGM ?? false,
    callback: (target: HTMLElement) => {
      // v13 uses different attributes: data-scene-id (Scene Navigation) or data-entry-id (Scene Directory)
      const sceneId = target?.dataset?.sceneId ?? target?.dataset?.entryId;
      if (!sceneId) {
        log('No scene ID found on context menu target', true);
        return;
      }
      log(`Opening Scenery for scene: ${sceneId}`);
      const sceneryApp = new Scenery({ sceneId });
      sceneryApp.render({ force: true });
    },
  });
});

// Add a fallback button in case context menu fails
Hooks.on(
  'renderSceneDirectory',
  (_app: SceneDirectory, html: JQuery | HTMLElement, _data: unknown) => {
    // Handle both jQuery objects and plain HTMLElements
    const htmlElement = html instanceof HTMLElement ? html : html[0];
    if (!htmlElement) return;

    // Check if header button is enabled

    const settings = game.settings as unknown as {
      get?: (module: string, key: string) => boolean;
    };
    const showHeaderButton = settings.get?.(MODULE_ID, SETTINGS.SHOW_HEADER_BUTTON) ?? true;

    // Add a button to the directory header if we're a GM and setting is enabled
    if (game.user?.isGM && showHeaderButton) {
      log('Adding scenery button to Scene Directory');
      const headerActions = htmlElement.querySelector('.directory-header .header-actions');
      if (headerActions && !headerActions.querySelector('.scenery-button')) {
        const sceneryButton = document.createElement('button');
        sceneryButton.className = 'scenery-button';
        sceneryButton.title = game.i18n.localize(I18N_KEYS.APP_NAME);
        sceneryButton.innerHTML = `<i class="${ICONS.APP}"></i>`;

        sceneryButton.addEventListener('click', (event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();

          // Try to get the currently viewed scene first
          const currentSceneId = canvas?.scene?.id;

          // If no scene is currently viewed, get the selected one
          const selectedItem =
            htmlElement.querySelector('.directory-item.context') ||
            htmlElement.querySelector('.directory-item.active');
          const selectedSceneId = (selectedItem as HTMLElement | null)?.dataset.entryId;

          const sceneId = currentSceneId || selectedSceneId || game.scenes?.contents[0]?.id;

          if (sceneId) {
            log(`Opening for scene: ${sceneId}`);
            const sceneryApp = new Scenery({ sceneId });
            // v13 render API
            sceneryApp.render({ force: true });
          } else {
            ui.notifications?.warn('No scene available');
          }
        });

        // Insert the button after the create scene button
        const createButton = headerActions.querySelector('[data-action="create"]');
        if (createButton) {
          createButton.after(sceneryButton);
        } else {
          headerActions.prepend(sceneryButton);
        }
      }
    }

    // Note: Scenery._onRenderSceneDirectory is registered separately in ready hook
  }
);

// Add "Reset to Defaults" button after global element settings
Hooks.on('renderSettingsConfig', (_app: unknown, html: JQuery | HTMLElement) => {
  const htmlElement = html instanceof HTMLElement ? html : html[0];
  if (!htmlElement) return;

  // Find the last global setting checkbox (globalNotes)
  const lastSetting = htmlElement.querySelector(`[name="scenery.${SETTINGS.GLOBAL_NOTES}"]`);
  if (!lastSetting) return;

  const formGroup = lastSetting.closest('.form-group');
  if (!formGroup) return;

  // Default values for global element settings
  const GLOBAL_DEFAULTS: Record<string, boolean> = {
    [SETTINGS.DEBUG_LOGGING]: false,
    [SETTINGS.SHOW_HEADER_BUTTON]: true,
    [SETTINGS.SHOW_VARIATIONS_LABEL]: true,
    [SETTINGS.GLOBAL_LIGHTS]: false,
    [SETTINGS.GLOBAL_SOUNDS]: false,
    [SETTINGS.GLOBAL_TILES]: false,
    [SETTINGS.GLOBAL_WALLS]: false,
    [SETTINGS.GLOBAL_DRAWINGS]: true,
    [SETTINGS.GLOBAL_TEMPLATES]: true,
    [SETTINGS.GLOBAL_REGIONS]: false,
    [SETTINGS.GLOBAL_NOTES]: true,
  };

  // Default values for identifier text settings
  const IDENTIFIER_DEFAULTS: Record<string, string> = {
    [SETTINGS.GM_MAP_IDENTIFIERS]: 'gm, dm',
    [SETTINGS.PLAYER_MAP_IDENTIFIERS]: 'player, pl',
  };

  const wrapper = document.createElement('div');
  wrapper.className = 'form-group';
  wrapper.style.textAlign = 'right';

  const button = document.createElement('button');
  button.type = 'button';
  button.innerHTML = `<i class="${ICONS.RESET}"></i> ${game.i18n?.localize(I18N_KEYS.SETTING_GLOBAL_RESET) ?? 'Reset to Defaults'}`;

  button.addEventListener('click', (event: MouseEvent) => {
    event.preventDefault();
    for (const [key, defaultValue] of Object.entries(GLOBAL_DEFAULTS)) {
      const input = htmlElement.querySelector(`[name="scenery.${key}"]`) as HTMLInputElement | null;
      if (input) input.checked = defaultValue;
    }
    for (const [key, defaultValue] of Object.entries(IDENTIFIER_DEFAULTS)) {
      const input = htmlElement.querySelector(`[name="scenery.${key}"]`) as HTMLInputElement | null;
      if (input) input.value = defaultValue;
    }
    ui.notifications?.info(
      game.i18n?.localize(I18N_KEYS.SETTING_GLOBAL_RESET_DONE) ??
        'Global element settings reset to defaults.'
    );
  });

  wrapper.appendChild(button);
  formGroup.after(wrapper);
});

// Register canvas hooks early in init to catch initial canvas load
Hooks.once('init', () => {
  log('Init - Registering canvas hooks early');
  Hooks.on('canvasInit', Scenery._onCanvasInit);
  Hooks.on('canvasReady', (canvas: Canvas) => {
    Scenery._onCanvasReady(canvas);
  });
});

// Register other hooks after ready
Hooks.once('ready', () => {
  log('Ready - Registering remaining hooks');

  // Wrap updateScene hook with proper signature
  Hooks.on('updateScene', (scene: Scene, data: unknown) => {
    Scenery._onUpdateScene(scene, data as SceneUpdate);
  });

  Hooks.on('renderSceneDirectory', Scenery._onRenderSceneDirectory);

  log('All hooks registered successfully');
});
