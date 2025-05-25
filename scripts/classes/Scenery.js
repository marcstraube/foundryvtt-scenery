import { PATH } from '../helpers.js';

const { HandlebarsApplicationMixin, DocumentSheetV2 } = foundry.applications.api;

export default class Scenery extends HandlebarsApplicationMixin(DocumentSheetV2) {
  constructor(options = {}) {
    const sceneId = options.document?.id || options.sceneId;
    const scene = options.document || game.scenes.get(sceneId);
    super({ document: scene, ...options });
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
      handler: function(...args) { 
        return this._onFormSubmit(...args); 
      },
      submitOnChange: false,
      closeOnSubmit: true
    },
    window: {
      icon: 'fas fa-images',
      resizable: true,
      contentClasses: ["standard-form"]
    },
    tag: "form"
  };

  static PARTS = {
    form: {
      template: `${PATH}/templates/scenery.hbs`
    },
    footer: {
      template: "templates/generic/form-footer.hbs"
    }
  };

  static _loadingImage = null;

  get title() {
    return game.i18n.localize('SCENERY.APP_NAME');
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const flag = this.document.getFlag('scenery', 'data') || {};
    
    const currentBackground = this.getCurrentBackground();
    
    if (!this.bg) this.bg = flag.bg || currentBackground;
    if (!this.gm) this.gm = flag.gm || currentBackground;
    if (!this.pl) this.pl = flag.pl || currentBackground;
    if (!this.variations) {
      this.variations = [{ name: 'Default', file: this.bg }];
      if (flag.variations) {
        const nonDefaultVariations = flag.variations.filter(v => 
          v.name?.toLowerCase() !== 'default'
        );
        nonDefaultVariations.forEach((v) => this.variations.push(v));
      }
    }

    this.variations.push({ name: '', file: '' });
    
    context.variations = this.variations;
    context.gm = this.gm;
    context.pl = this.pl;
    
    context.buttons = [
      { type: "button", action: "scan", icon: "fas fa-search", label: "SCENERY.BUTTON_SCAN" },
      { type: "button", action: "add", icon: "fa fa-plus", label: "SCENERY.BUTTON_ADD" },
      { type: "submit", icon: "fa fa-check", label: "SCENERY.BUTTON_OK" }
    ];
    
    return context;
  }

  getCurrentBackground() {
    if (canvas.scene?.id === this.document.id) {
      return canvas.scene.background.src;
    }
    
    const flag = this.document.getFlag('scenery', 'data');
    if (flag) {
      const customBg = game.user.isGM ? flag.gm : flag.pl;
      if (customBg) return customBg;
    }
    
    return this.document.background.src;
  }

  static async #onDelete(event, target) {
    const row = target.closest('tr');
    if (row) row.remove();
  }

  static async #onPreview(event, target) {
    const row = target.closest('tr');
    const url = row?.querySelector('.image')?.value?.trim();
    if (url) {
      new ImagePopout(url).render(true);
    }
  }

  static async #onScan(event, target) {
    const app = this;
    
    const path = app.element.querySelector('[name="variations.0.file"]')?.value;
    if (!path) return;
    
    const imagePaths = Array.from(app.element.querySelectorAll('input.image')).map(input => input.value);
    const fp = await foundry.applications.apps.FilePicker.implementation.browse('data', path);
    
    const defName = path.split('/').pop().split('.').slice(0, -1).join('.');
    
    const variations = fp.files
      .filter((f) => !imagePaths.includes(f))
      .reduce((acc, file) => {
        const fn = file.split('/').pop().split('.').slice(0, -1).join('.');
        if (fn.toLowerCase().includes(defName.toLowerCase())) {
          const name = decodeURIComponent(fn.replace(defName, ''))
            .replace(/[-_]/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
          acc.push({ file, name });
        }
        return acc;
      }, [])
      .sort((a, b) => a.name.localeCompare(b.name));

    app.removeBlankVariations();
    
    for (const v of variations) {
      await app.addVariation(v.name, v.file);
    }
    
    await app.addVariation('', '');
  }

  static async #onAdd(event, target) {
    const app = this;
    await app.addVariation();
  }

  async _onFormSubmit(event, form, formData, options = {}) {
    try {
      console.log('Scenery | Form submission started', { formData: formData.object, options });
      
      const fd = formData.object;
      
      const variations = [];
      let index = 0;
      
      while (fd[`variations.${index}.file`] !== undefined) {
        variations.push({
          name: fd[`variations.${index}.name`] || '',
          file: fd[`variations.${index}.file`] || ''
        });
        index++;
      }
      
      const bg = variations[0]?.file;
      if (!bg) {
        ui.notifications.error('No default background specified');
        return;
      }
      
      const gmRadio = form.querySelector('input[name="gm"]:checked');
      const plRadio = form.querySelector('input[name="pl"]:checked');
      
      const gmIndex = parseInt(gmRadio?.value);
      const plIndex = parseInt(plRadio?.value);
      
      const gm = variations[gmIndex]?.file;
      const pl = variations[plIndex]?.file;
      
      if (!gm || !pl) {
        ui.notifications.error(game.i18n.localize('SCENERY.ERROR_SELECTION'));
        return;
      }
      
      const validVariations = variations.slice(1).filter((v) => v.file);
      const data = { variations: validVariations, bg, gm, pl };
      
      await this.document.setFlag('scenery', 'data', data);
      
      if (this.document.id === canvas.scene?.id) {
        const img = game.user.isGM ? data.gm : data.pl;
        if (img) {
          await Scenery.setImage(img);
        }
      }
    } catch (error) {
      console.error('Scenery | Error in form submission:', error);
      ui.notifications.error(`Scenery error: ${error.message}`);
      throw error;
    }
  }

  _onRender(context, options) {
    super._onRender(context, options);
    
    this.element.querySelectorAll('button.file-picker').forEach(button => {
      button.addEventListener('click', this._onClickFilePicker.bind(this));
    });
  }

  async _onClickFilePicker(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const input = button.parentElement.querySelector('input[type="text"]');
    
    if (!input) return;
    
    const fp = new foundry.applications.apps.FilePicker.implementation({
      type: button.dataset.type || 'imagevideo',
      current: input.value,
      callback: path => {
        input.value = path;
        input.dispatchEvent(new Event('change', {bubbles: true}));
      }
    });
    
    return fp.browse();
  }

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

  async addVariation(name = '', file = '', id = null) {
    const tbody = this.element.querySelector('.scenery-table');
    if (!tbody) return;
    
    if (id === null) {
      const lastRow = tbody.querySelector('tr:last-child');
      const lastIndex = lastRow ? parseInt(lastRow.getAttribute('data-index')) : -1;
      id = lastIndex + 1;
    }
    
    const rowHtml = await foundry.applications.handlebars.renderTemplate(`${PATH}/templates/variation.hbs`, { id, name, file });
    const template = document.createElement('template');
    template.innerHTML = rowHtml;
    const row = template.content.firstElementChild;
    
    tbody.appendChild(row);
    
    const filePickerButton = row.querySelector('button.file-picker');
    if (filePickerButton) {
      filePickerButton.addEventListener('click', this._onClickFilePicker.bind(this));
    }
  }

  static async setImage(img, draw = true) {
    if (!canvas.scene) return;
    
    if (!game.user.isGM && !canvas.scene.canUserModify(game.user, "update")) {
      console.log('Scenery | User does not have permission to modify scene background');
      return;
    }
    
    if (Scenery._loadingImage === img) {
      console.log('Scenery | Already loading image:', img);
      return;
    }
    
    const previousCustomBg = canvas.scene._sceneryCustomBackground;
    canvas.scene._sceneryCustomBackground = img;
    
    if (!draw) {
      if (!canvas.scene._sceneryOriginalBackground) {
        canvas.scene._sceneryOriginalBackground = canvas.scene.background.src;
      }
      canvas.scene._sceneryPendingBackground = img;
      return;
    }
    
    Scenery._loadingImage = img;
    
    if (canvas.ready && canvas.primary?.background) {
      if (!canvas.scene._sceneryOriginalBackground) {
        canvas.scene._sceneryOriginalBackground = canvas.scene.background.src;
      }
      
      try {
        console.log('Scenery | Loading new background texture:', img);
        
        const texture = await foundry.canvas.loadTexture(img);
        
        if (texture && canvas.primary.background) {
          canvas.primary.background.texture = texture;
          canvas.scene.background.src = img;
          canvas.primary.renderDirty = true;
          canvas.app.renderer.render(canvas.app.stage);
          
          if (!canvas.scene._sceneryPendingBackground) {
            ui.notifications.info(game.i18n.localize('SCENERY.LOADING'));
          }
        }
      } catch (err) {
        console.error('Scenery | Error updating background:', err);
        ui.notifications.error('Failed to update background image');
      } finally {
        Scenery._loadingImage = null;
      }
    } else {
      Scenery._loadingImage = null;
    }
  }

  static async resetBackground() {
    if (!canvas.scene || !canvas.scene._sceneryOriginalBackground) return;
    
    const originalSrc = canvas.scene._sceneryOriginalBackground;
    
    if (canvas.scene.background.src === originalSrc) {
      console.log('Scenery | Background already reset to original');
      return;
    }
    
    if (canvas.primary?.background) {
      try {
        console.log('Scenery | Resetting background to original:', originalSrc);
        
        const texture = await foundry.canvas.loadTexture(originalSrc);
        
        if (texture) {
          canvas.primary.background.texture = texture;
          canvas.scene.background.src = originalSrc;
          canvas.primary.renderDirty = true;
          canvas.app.renderer.render(canvas.app.stage);
        }
      } catch (err) {
        console.error('Scenery | Error resetting background:', err);
      }
    }
    
    delete canvas.scene._sceneryOriginalBackground;
    delete canvas.scene._sceneryCustomBackground;
  }

  static _onCanvasInit() {
    const data = canvas.scene.getFlag('scenery', 'data');
    if (!data) return;
    
    const currentBackground = canvas.scene.background.src;
    const expectedBackground = data.bg;
    
    if (currentBackground !== expectedBackground && !canvas.scene._sceneryPendingBackground) {
      console.log('Scenery | Background mismatch detected, skipping scenery override:', {
        current: currentBackground,
        expected: expectedBackground
      });
      return;
    }
    
    const img = (game.user.isGM) ? data.gm : data.pl;
    if (img) {
      Scenery.setImage(img, false);
    }
  }

  static async _onCanvasReady() {
    if (canvas.scene?._sceneryPendingBackground) {
      const pendingImg = canvas.scene._sceneryPendingBackground;
      delete canvas.scene._sceneryPendingBackground;
      
      console.log('Scenery | Applying pending background:', pendingImg);
      await Scenery.setImage(pendingImg);
    }
  }

  static _onUpdateScene(scene, data) {
    console.log('Scenery | _onUpdateScene called:', {
      sceneId: scene.id,
      isCurrentScene: scene.id === canvas.scene?.id,
      updateData: data,
      hasSceneryFlag: foundry.utils.hasProperty(data, 'flags.scenery.data'),
      hasBackgroundChange: foundry.utils.hasProperty(data, 'background.src')
    });
    
    ui.scenes.render();
    
    if (foundry.utils.hasProperty(data, 'background.src')) {
      const newBackground = data.background.src;
      const sceneryData = scene.getFlag('scenery', 'data');
      
      if (sceneryData) {
        console.log('Scenery | Background changed through scene settings, updating scenery data');
        
        const updatedData = {
          ...sceneryData,
          bg: newBackground,
          gm: sceneryData.gm === sceneryData.bg ? newBackground : sceneryData.gm,
          pl: sceneryData.pl === sceneryData.bg ? newBackground : sceneryData.pl
        };
        
        if (updatedData.variations && updatedData.variations.length > 0) {
          updatedData.variations[0] = { name: 'Default', file: newBackground };
        }
        
        scene.setFlag('scenery', 'data', updatedData);
        
        if (scene.id === canvas.scene?.id) {
          const img = game.user.isGM ? updatedData.gm : updatedData.pl;
          if (img) {
            Scenery.setImage(img);
          }
        }
        
        return;
      }
    }
    
    if (scene.id !== canvas.scene?.id) return;
    
    if (foundry.utils.hasProperty(data, 'flags.scenery.data')) {
      const img = (game.user.isGM) ? data.flags.scenery.data.gm : data.flags.scenery.data.pl;
      console.log('Scenery | Scenery data updated via hook, checking if update needed:', {
        newImg: img,
        currentBg: canvas.scene.background.src,
        customBg: canvas.scene._sceneryCustomBackground
      });
      
      if (img) {
        console.log('Scenery | Calling setImage from update hook');
        Scenery.setImage(img);
      }
    }
  }

  static _onRenderSceneDirectory(sceneDir, html) {
    if (!game.settings.get('scenery', 'showVariationsLabel')) return;
    
    const htmlElement = html instanceof jQuery ? html[0] : 
                       html instanceof HTMLElement ? html : 
                       Array.isArray(html) ? html[0] : 
                       html?.[0];
    
    if (!htmlElement) {
      console.warn('Scenery | _onRenderSceneDirectory: Invalid html parameter', html);
      return;
    }
    
    const scenes = game.scenes?.contents || [];
    
    scenes
      .filter((scene) => scene?.flags?.scenery?.data?.variations?.length > 0)
      .forEach((scene) => {
        const menuEntry = htmlElement.querySelector(`[data-document-id="${scene.id}"]`);
        if (!menuEntry) return;
        
        const label = document.createElement('label');
        label.classList.add('scenery-variations');
        label.innerHTML = `<i class="fa fa-images"></i> ${scene.flags.scenery.data.variations.length + 1}`;
        menuEntry.prepend(label);
      });
  }

  static _onContextMenu(html, entryOptions) {
    console.log('Scenery | _onContextMenu called', { html, entryOptions });
    
    const viewOption = {
      name: game.i18n.localize('SCENERY.APP_NAME'),
      icon: 'fas fa-images',
      condition: () => game.user.isGM,
      callback: li => {
        const element = li.jquery ? li[0] : li;
        const id = element?.dataset?.documentId || element?.dataset?.sceneId;
        
        if (!id) {
          console.error('Scenery | No scene ID found on element', li);
          return;
        }
        
        console.log('Scenery | Opening for scene:', id);
        new Scenery({ sceneId: id }).render(true);
      }
    };
    entryOptions.push(viewOption);
    console.log('Scenery | Context menu option added', viewOption);
  }
}
