import Scenery from './classes/Scenery.js';
import { log } from './helpers.js';

Hooks.once('init', () => {
  // eslint-disable-next-line no-console
  log('Scenery | Init');
  loadTemplates(['modules/scenery/templates/variation.hbs']);
});

Hooks.on('getSceneDirectoryEntryContext', Scenery._onContextMenu);
Hooks.on('getSceneNavigationContext', Scenery._onContextMenu);
Hooks.on('canvasInit', Scenery._onCanvasInit);
Hooks.on('updateScene', Scenery._onUpdateScene);
