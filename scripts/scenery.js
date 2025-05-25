import Scenery from './classes/Scenery.js';
import { log } from './helpers.js';

console.log('Scenery | Module loading...');

// Make Scenery available globally for debugging and compatibility
window.Scenery = Scenery;

Hooks.once('init', () => {
  log('Scenery | Init');
  // Use the new namespaced helper if available (Foundry VTT v13+), otherwise fall back
  // to the global for older releases to maintain backward-compatibility.
  const loadTemplatesFn = (foundry?.applications?.handlebars?.loadTemplates) || loadTemplates;
  loadTemplatesFn(['modules/scenery/templates/variation.hbs']);
  
  // Register settings during init
  game.settings.register('scenery', 'showVariationsLabel', {
    name: game.i18n.localize('SCENERY.SETTING_SHOW_VARIATIONS'),
    hint: game.i18n.localize('SCENERY.SETTING_SHOW_VARIATIONS_HINT'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true,
  });
});

// For v13+ context menu system
Hooks.once('ready', () => {
  console.log('Scenery | Applying v13 context menu patches');
  console.log('Scenery | ui.nav exists:', !!ui.nav);
  console.log('Scenery | ui.scenes exists:', !!ui.scenes);
  
  // Patch Scene Directory context menu
  const originalGetEntryContextOptions = ui.scenes?._getEntryContextOptions;
  if (originalGetEntryContextOptions) {
    ui.scenes._getEntryContextOptions = function() {
      const options = originalGetEntryContextOptions.call(this);
      // Use the existing _onContextMenu handler to add our option
      Scenery._onContextMenu(null, options);
      return options;
    };
    console.log('Scenery | Scene Directory context menu patched');
  } else {
    console.log('Scenery | Scene Directory _getEntryContextOptions not found');
  }
  
  // Patch Scene Navigation context menu
  const originalGetNavigationContextOptions = ui.nav?._getContextMenuOptions;
  console.log('Scenery | ui.nav._getContextMenuOptions exists:', !!originalGetNavigationContextOptions);
  if (originalGetNavigationContextOptions) {
    ui.nav._getContextMenuOptions = function() {
      console.log('Scenery | _getContextMenuOptions called');
      const options = originalGetNavigationContextOptions.call(this);
      console.log('Scenery | Original options:', options);
      // Use the existing _onContextMenu handler to add our option
      Scenery._onContextMenu(null, options);
      console.log('Scenery | Modified options:', options);
      return options;
    };
    console.log('Scenery | Scene Navigation context menu patched');
  } else {
    console.log('Scenery | Scene Navigation _getContextMenuOptions not found');
  }
});

// Add a fallback button in case context menu fails
Hooks.on('renderSceneDirectory', (app, html, data) => {
  console.log('Scenery | Adding scenery button to Scene Directory');
  
  // Handle both jQuery objects and plain HTMLElements
  const htmlElement = html instanceof HTMLElement ? html : html[0];
  if (!htmlElement) return;
  
  // Add a button to the directory header if we're a GM
  if (game.user.isGM) {
    const headerActions = htmlElement.querySelector('.directory-header .header-actions');
    if (headerActions && !headerActions.querySelector('.scenery-button')) {
      const sceneryButton = document.createElement('button');
      sceneryButton.className = 'scenery-button';
      sceneryButton.title = game.i18n.localize('SCENERY.APP_NAME');
      sceneryButton.innerHTML = '<i class="fas fa-images"></i>';
      
      sceneryButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        // Try to get the currently viewed scene first
        const currentSceneId = canvas.scene?.id;
        
        // If no scene is currently viewed, get the selected one
        const selectedItem = htmlElement.querySelector('.directory-item.context') || 
                           htmlElement.querySelector('.directory-item.active');
        const selectedSceneId = selectedItem?.dataset.documentId;
        
        const sceneId = currentSceneId || selectedSceneId || game.scenes.contents[0]?.id;
        
        if (sceneId) {
          console.log('Scenery | Opening for scene:', sceneId);
          new Scenery({ sceneId }).render(true);
        } else {
          ui.notifications.warn("No scene available");
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
});

// Register other hooks after ready
Hooks.once('ready', () => {
  log('Scenery | Ready - Registering remaining hooks');
  
  Hooks.on('canvasInit', Scenery._onCanvasInit);
  Hooks.on('canvasReady', Scenery._onCanvasReady);
  Hooks.on('updateScene', Scenery._onUpdateScene);
  Hooks.on('renderSceneDirectory', Scenery._onRenderSceneDirectory);
  
  log('Scenery | All hooks registered successfully');
});
