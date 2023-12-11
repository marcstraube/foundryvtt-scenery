import Scenery from './classes/Scenery.js';
import { log } from './helpers.js';

Hooks.once('init', () => {
  // eslint-disable-next-line no-console
  log('Scenery | Init');
  loadTemplates(['modules/scenery/templates/variation.hbs']);
});
Hooks.on('init', () => {
  game.settings.register('scenery', 'showVariationsLabel', {
    name: game.i18n.localize('SCENERY.SHOW_VARIATIONS_LABEL'),
    hint: game.i18n.localize('SCENERY.SHOW_VARIATIONS_LABEL_HINT'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true,
  });
});

Hooks.on('getSceneDirectoryEntryContext', Scenery._onContextMenu);
Hooks.on('getSceneNavigationContext', Scenery._onContextMenu);
Hooks.on('canvasInit', Scenery._onCanvasInit);
Hooks.on('updateScene', Scenery._onUpdateScene);
Hooks.on('renderSceneDirectory', Scenery._onRenderSceneDirectory);
