import { PATH } from '../helpers.js';

export default class Scenery extends foundry.applications.api.DocumentSheetV2 {
  constructor(options = {}) {
    const sceneId = options.document?.id || options.sceneId;
    const scene = options.document || game.scenes.get(sceneId);
    super(scene, options);
  }

  static DEFAULT_OPTIONS = {
    classes: ['scenery'],
    position: {
      width: 700,
      height: 'auto'
    },
    actions: {
      delete: Scenery.#onDelete,
      preview: Scenery.#onPreview,
      scan: Scenery.#onScan,
      add: Scenery.#onAdd
    },
    form: {
      handler: Scenery.#onSubmit,
      closeOnSubmit: true
    },
    window: {
      icon: 'fas fa-images',
      resizable: true
    }
  };

  static PARTS = {
    form: {
      template: `${PATH}/templates/scenery.hbs`
    }
  };

  get title() {
    return game.i18n.localize('SCENERY.APP_NAME');
  }

  /* -------------------------------------------- */

  /**
   * Prepare data for rendering
   * @returns {Promise<Object>}
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const flag = this.document.getFlag('scenery', 'data') || {};
    
    if (!this.bg) this.bg = flag.bg || this.document.background.src;
    if (!this.gm) this.gm = flag.gm || this.document.background.src;
    if (!this.pl) this.pl = flag.pl || this.document.background.src;
    if (!this.variations) {
      this.variations = [{ name: 'Default', file: this.bg }];
      if (flag.variations) flag.variations.forEach((v) => this.variations.push(v));
    }

    // Add extra empty variation
    this.variations.push({ name: '', file: '' });
    
    context.variations = this.variations;
    context.gm = this.gm;
    context.pl = this.pl;
    
    return context;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Handle delete button click
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onDelete(event, target) {
    const row = target.closest('tr');
    if (row) row.remove();
  }

  /**
   * Handle preview button click
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onPreview(event, target) {
    const row = target.closest('tr');
    const url = row?.querySelector('.image')?.value?.trim();
    if (url) {
      new ImagePopout(url).render(true);
    }
  }

  /**
   * Handle scan button click
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onScan(event, target) {
    const app = this;
    
    // Get path of default img
    const path = app.element.querySelector('[name="variations.0.file"]')?.value;
    if (!path) return;
    
    // Get paths of all current variant images
    const imagePaths = Array.from(app.element.querySelectorAll('input.image')).map(input => input.value);
    
    // Load list of files in current dir
    const fp = await FilePicker.browse('data', path);
    
    // Isolate file name and remove extension
    const defName = path.split('/').pop().split('.').slice(0, -1).join('.');
    
    // For each file in directory...
    const variations = fp.files
      // Remove already existing variant images
      .filter((f) => !imagePaths.includes(f))
      // Find only files which are derivatives of default
      .reduce((acc, file) => {
        // Isolate filename and remove extension
        const fn = file.split('/').pop().split('.').slice(0, -1).join('.');
        // If is a derivative...
        if (fn.toLowerCase().includes(defName.toLowerCase())) {
          // Remove crud from filename
          const name = decodeURIComponent(fn.replace(defName, ''))
            .replace(/[-_]/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
          // Add to found array
          acc.push({ file, name });
        }
        return acc;
      }, [])
      .sort((a, b) => a.name.localeCompare(b.name));

    // Remove blank variations
    app.removeBlankVariations();
    
    // Add new variations
    for (const v of variations) {
      await app.addVariation(v.name, v.file);
    }
    
    // Add empty row at end
    await app.addVariation('', '');
  }

  /**
   * Handle add button click
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onAdd(event, target) {
    const app = this;
    await app.addVariation();
  }

  /**
   * Handle form submission
   * @param {Event} event
   * @param {HTMLFormElement} form
   * @param {FormDataExtended} formData
   */
  static async #onSubmit(event, form, formData) {
    const fd = formData.object;
    const bg = fd.variations[0].file;
    const variations = Object.values(fd.variations)
      .slice(1)
      .filter((v) => v.file);
    
    const gmRadio = form.querySelector('input[name="gm"]:checked');
    const plRadio = form.querySelector('input[name="pl"]:checked');
    
    const gm = fd.variations[gmRadio?.value]?.file;
    const pl = fd.variations[plRadio?.value]?.file;
    
    if (!gm || !pl) {
      ui.notifications.error(game.i18n.localize('SCENERY.ERROR_SELECTION'));
      return;
    }
    
    const data = { variations, bg, gm, pl };
    await this.document.update({ img: bg });
    await this.document.setFlag('scenery', 'data', data);
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Remove rows with empty file and name
   */
  removeBlankVariations() {
    const rows = this.element.querySelectorAll('tr');
    rows.forEach((row) => {
      const fileInput = row.querySelector('.scenery-fp input');
      const nameInput = row.querySelector('.scenery-name input');
      if (fileInput && nameInput && !fileInput.value && !nameInput.value) {
        row.remove();
      }
    });
  }

  /**
   * Add a new variation row
   * @param {string} name
   * @param {string} file
   * @param {number|null} id
   */
  async addVariation(name = '', file = '', id = null) {
    const tbody = this.element.querySelector('.scenery-table');
    if (!tbody) return;
    
    if (id === null) {
      const lastRow = tbody.querySelector('tr:last-child');
      const lastIndex = lastRow ? parseInt(lastRow.getAttribute('data-index')) : -1;
      id = lastIndex + 1;
    }
    
    const rowHtml = await renderTemplate(`${PATH}/templates/variation.hbs`, { id, name, file });
    const template = document.createElement('template');
    template.innerHTML = rowHtml;
    const row = template.content.firstElementChild;
    
    tbody.appendChild(row);
  }

  /**
   * Sets background image of the current scene
   * @param {String} img   The image URL to be used
   * @param {Boolean} draw Used to prevent draw if being called during canvasInit
   */
  static async setImage(img, draw = true) {
    canvas.scene.background.src = img;
    if (draw) {
      // Wait for texture to load
      await foundry.canvas.assets.TextureLoader.loader.load(
        [img],
        { message: game.i18n.localize('SCENERY.LOADING') },
      );
      await canvas.draw();
    }
  }

  /**
   * React to canvasInit hook to set custom image if needed
   */
  static _onCanvasInit() {
    const data = canvas.scene.getFlag('scenery', 'data');
    if (!data) return;
    const img = (game.user.isGM) ? data.gm : data.pl;
    if (img) Scenery.setImage(img, false);
  }

  /**
   * React to updateScene hook to set custom image if needed
   * @param {Scene} scene
   * @param {Object} data
   */
  static _onUpdateScene(scene, data) {
    ui.scenes.render();
    if (!scene._view) return;
    if (foundry.utils.hasProperty(data, 'flags.scenery.data')) {
      const img = (game.user.isGM) ? data.flags.scenery.data.gm : data.flags.scenery.data.pl;
      if (img) Scenery.setImage(img);
    }
  }

  /**
   * React to renderSceneDirectory to add count of Scenery variations on SceneDirectory entries.
   * @param {SceneDirectory} sceneDir
   * @param {Object} html
   * @private
   */
  static _onRenderSceneDirectory(sceneDir, html) {
    if (!game.settings.get('scenery', 'showVariationsLabel')) return;
    Object.values(sceneDir.documents)
      .filter((f) => f.flags.scenery !== undefined && f.flags.scenery.data.variations.length > 0)
      .forEach((entry) => {
        const menuEntry = html[0].querySelectorAll(`[data-document-id="${entry._id}"]`)[0];
        const label = document.createElement('label');
        label.classList.add('scenery-variations');
        label.innerHTML = `<i class="fa fa-images"></i> ${entry.flags.scenery.data.variations.length + 1}`;
        menuEntry.prepend(label);
      });
  }

  /**
   * React to getSceneNavigationContext and getSceneDirectoryEntryContext hooks to add Scenery menu entry
   * @param {Object} html
   * @param {Object} entryOptions
   * @private
   */
  static _onContextMenu(html, entryOptions) {
    const viewOption = {
      name: game.i18n.localize('SCENERY.APP_NAME'),
      icon: '<i class="fas fa-images"></i>',
      condition: () => game.user.isGM,
      callback: (el) => {
        const element = el[0] || el;
        const id = element.dataset.documentId || element.dataset.sceneId;
        new Scenery({ sceneId: id }).render(true);
      },
    };
    entryOptions.push(viewOption);
  }
}
