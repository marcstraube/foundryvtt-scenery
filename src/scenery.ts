import Scenery from './classes/Scenery.js';
import { log } from './helpers.js';
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings = game.settings as any;

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
});

// Register v13 context menu hook
// eslint-disable-next-line @typescript-eslint/no-explicit-any
Hooks.on('getSceneContextOptions', (_app: any, menuItems: any[]) => {
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

    const showHeaderButton =
      (game.settings as any)?.get(MODULE_ID, SETTINGS.SHOW_HEADER_BUTTON) ?? true;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Hooks.on('updateScene', (scene: Scene, data: any) => {
    Scenery._onUpdateScene(scene, data);
  });

  Hooks.on('renderSceneDirectory', Scenery._onRenderSceneDirectory);

  log('All hooks registered successfully');
});
