import Scenery from './classes/Scenery.js';
import { log } from './helpers.js';
import { MODULE_ID, SETTINGS, I18N_KEYS, ICONS } from './constants.js';

log('Module loading...', true);

// Make Scenery available globally for debugging and compatibility
(window as Window & typeof globalThis & { Scenery: typeof Scenery }).Scenery = Scenery;

Hooks.once('init', () => {
  log('Scenery | Init');

  // Use the new namespaced helper if available (Foundry VTT v13+)
  const loadTemplatesFn = foundry?.applications?.handlebars?.loadTemplates ?? loadTemplates;
  loadTemplatesFn(['modules/scenery/templates/variation.hbs']);

  // Register settings during init
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (game.settings as any)?.register(MODULE_ID, SETTINGS.SHOW_VARIATIONS_LABEL, {
    name: game.i18n?.localize(I18N_KEYS.SETTING_SHOW_VARIATIONS) ?? 'Show Variations',
    hint:
      game.i18n?.localize(I18N_KEYS.SETTING_SHOW_VARIATIONS_HINT) ?? 'Show variation count label',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true,
  });
});

// For v13+ context menu system
Hooks.once('ready', () => {
  log('Applying v13 context menu patches');
  log(`ui.nav exists: ${!!ui.nav}`);
  log(`ui.scenes exists: ${!!ui.scenes}`);

  // Patch Scene Directory context menu
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originalGetEntryContextOptions = (ui.scenes as any)?._getEntryContextOptions;
  if (originalGetEntryContextOptions && ui.scenes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ui.scenes as any)._getEntryContextOptions = function (this: SceneDirectory) {
      const options = originalGetEntryContextOptions.call(this);
      // Use the existing _onContextMenu handler to add our option
      Scenery._onContextMenu(null, options);
      return options;
    };
    log('Scene Directory context menu patched');
  } else {
    log('Scene Directory _getEntryContextOptions not found');
  }

  // Patch Scene Navigation context menu
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originalGetNavigationContextOptions = (ui.nav as any)?._getContextMenuOptions;
  log(`ui.nav._getContextMenuOptions exists: ${!!originalGetNavigationContextOptions}`);
  if (originalGetNavigationContextOptions && ui.nav) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ui.nav as any)._getContextMenuOptions = function () {
      log('_getContextMenuOptions called');
      const options = originalGetNavigationContextOptions.call(this);
      log('Original options:');
      log(options);
      // Use the existing _onContextMenu handler to add our option
      Scenery._onContextMenu(null, options);
      log('Modified options:');
      log(options);
      return options;
    };
    log('Scene Navigation context menu patched');
  } else {
    log('Scene Navigation _getContextMenuOptions not found');
  }
});

// Add a fallback button in case context menu fails
Hooks.on(
  'renderSceneDirectory',
  (app: SceneDirectory, html: JQuery | HTMLElement, _data: unknown) => {
    log('Adding scenery button to Scene Directory');

    // Handle both jQuery objects and plain HTMLElements
    const htmlElement = html instanceof HTMLElement ? html : html[0];
    if (!htmlElement) return;

    // Add a button to the directory header if we're a GM
    if (game.user?.isGM) {
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
          const selectedSceneId = (selectedItem as HTMLElement | null)?.dataset.documentId;

          const sceneId = currentSceneId || selectedSceneId || game.scenes?.contents[0]?.id;

          if (sceneId) {
            log(`Opening for scene: ${sceneId}`);
            const sceneryApp = new Scenery({ sceneId });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (sceneryApp as any).render(true);
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

    // Also add context menu handler to individual scenes
    Scenery._onRenderSceneDirectory(app, html);
  }
);

// Register other hooks after ready
Hooks.once('ready', () => {
  log('Ready - Registering remaining hooks');

  Hooks.on('canvasInit', Scenery._onCanvasInit);

  // Wrap async canvasReady hook
  Hooks.on('canvasReady', (canvas: Canvas) => {
    Scenery._onCanvasReady(canvas);
  });

  // Wrap updateScene hook with proper signature
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Hooks.on('updateScene', (scene: Scene, data: any) => {
    Scenery._onUpdateScene(scene, data);
  });

  Hooks.on('renderSceneDirectory', Scenery._onRenderSceneDirectory);

  log('All hooks registered successfully');
});
