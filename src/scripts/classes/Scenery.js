import { PATH } from '../helpers.js';

export default class Scenery extends FormApplication {
  constructor(id) {
    super();
    this.scene = game.scenes.get(id);
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ['form'],
      closeOnSubmit: true,
      popOut: true,
      editable: game.user.isGM,
      width: 700,
      template: `${PATH}/templates/scenery.hbs`,
      id: 'scenery-config',
      title: game.i18n.localize('SCENERY.scenery'),
    });
  }

  /* -------------------------------------------- */

  /**
   * Obtain module metadata and merge it with game settings which track current module visibility
   * @return {Object}   The data provided to the template when rendering the form
   */
  async getData() {
    const flag = this.scene.getFlag('scenery', 'data') || {};
    if (!this.bg) this.bg = flag.bg || this.scene.background.src;
    if (!this.gm) this.gm = flag.gm || this.scene.background.src;
    if (!this.pl) this.pl = flag.pl || this.scene.background.src;
    if (!this.variations) {
      this.variations = [{ name: 'Default', file: this.bg }];
      if (flag.variations) flag.variations.forEach((v) => this.variations.push(v));
    }

    // Add extra empty variation
    this.variations.push({ name: '', file: '' });
    // Return data to the template
    return { variations: this.variations, gm: this.gm, pl: this.pl };
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    html.find('.delete').click(() => this.deleteVariation());
    html.find('.preview').click(() => this.previewVariation());
    html.find('.scan').click(() => this.scan());
    html.find('.add').click(() => this.add());
    super.activateListeners(html);
  }

  /**
   * Display a preview window of the scene
   */
  previewVariation() {
    const index = document.activeElement.getAttribute('index');
    const url = this.element.find(`#scenery-row-${index} .image`)[0].value.trim();
    if (url !== '') {
      new ImagePopout(url).render(true);
    }
  }

  /**
   * Remove a row in the variation table
   * @param {boolean} index The index of the row
   */
  deleteVariation(index = false) {
    if (!index) index = document.activeElement.getAttribute('index');
    this.element.find(`#scenery-row-${index}`).remove();
  }

  removeBlankVariations() {
    this.element.find('tr').each((i, el) => {
      const file = $(el).find('.scenery-fp input').val();
      const name = $(el).find('.scenery-name input').val();
      const index = $(el).attr('index');
      if (!file && !name) this.deleteVariation(index);
    });
  }

  /**
  * Add a new empty row to the form
  * @param {string} name
  * @param {string} file
  * @param {int,null} id
  */
  async addVariation(name = '', file = '', id = null) {
    if (id === null) id = Number(this.element.find('tr:last').attr('index')) + 1;
    const row = $(await renderTemplate(`${PATH}/templates/variation.hbs`, { id, name, file }));
    row.find('.delete').click(() => this.deleteVariation());
    row.find('.preview').click(() => this.previewVariation());
    await this.element.find('.scenery-table').append(row);
    super.activateListeners(this.element);
  }

  /**
   * This method is called upon form submission after form data is validated
   * @param {Event} event      The initial triggering submission event
   * @param {Object} formData  The object of validated form data with which to update the object
   * @private
   */
  async _updateObject(event, formData) {
    const fd = expandObject(formData);
    const bg = fd.variations[0].file;
    const variations = Object.values(fd.variations)
      .slice(1)
      .filter((v) => v.file);
    const gm = fd.variations[$('input[name="gm"]:checked').val()]?.file;
    const pl = fd.variations[$('input[name="pl"]:checked').val()]?.file;
    if (!gm || !pl) {
      ui.notifications.error(game.i18n.localize('SCENERY.selectError'));
      return;
    }
    const data = { variations, bg, gm, pl };
    await this.scene.update({ img: bg });
    this.scene.setFlag('scenery', 'data', data);
  }

  /**
   * Scan for variations in current directory of default img
   */
  async scan() {
    // Get path fo default img
    const path = this.element.find('[name="variations.0.file"]')[0].value;
    // Load list of files in current dir
    const fp = await FilePicker.browse('data', path);
    // Isolate file name and remove extension
    const defName = path.split('/').pop().split('.').slice(0, -1).join('.');
    // For each file in directory...
    const variations = fp.files
      // Remove default file
      .filter((f) => f !== path)
      // Find only files which are derivatives of default
      .reduce((acc, file) => {
        // Isolate filename and remove extension
        const fn = file.split('/').pop().split('.').slice(0, -1).join('.');
        // If is a derivative...
        if (fn.toLowerCase().includes(defName.toLowerCase())) {
          // Remove crud from filename
          const name = fn.replace(defName, '').replace(/[-_]/g, ' ').replace(/[^a-zA-Z\d\s:]/g, '').trim();
          // Add to found array
          acc.push({ file, name });
        }
        return acc;
      }, []);
    this.removeBlankVariations();
    // eslint-disable-next-line no-restricted-syntax
    let index = Number(this.element.find('tr:last').attr('index')) + 1;
    variations.forEach((v) => {
      this.addVariation(v.name, v.file, index);
      index++;
    });
  }

  /**
   * Add a new empty row to the form
   */
  add() {
    this.addVariation();
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
      await TextureLoader.loader.load([img], game.i18n.localize('SCENERY.loading'));
      canvas.draw();
      // Backup draw because occasionally above seems to fail
      // eslint-disable-next-line no-promise-executor-return
      await new Promise((resolve) => setTimeout(resolve, 1000));
      canvas.draw();
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
    if (!scene._view) return;
    if (hasProperty(data, 'flags.scenery.data')) {
      const img = (game.user.isGM) ? data.flags.scenery.data.gm : data.flags.scenery.data.pl;
      if (img) {
        Scenery.setImage(img);
      }
    }
  }

  static _onContextMenu(html, entryOptions) {
    const viewOption = {
      name: game.i18n.localize('SCENERY.scenery'),
      icon: '<i class="fas fa-images"></i>',
      condition: () => game.user.isGM,
      callback: (el) => {
        const id = el.attr('data-document-id') || el.attr('data-scene-id');
        new Scenery(id).render(true);
      },
    };
    entryOptions.push(viewOption);
  }
}
