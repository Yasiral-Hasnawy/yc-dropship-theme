class ProductSectionController {
  constructor(section) {
    this.section = section;
    this.product = this.parseProduct();
    this.form = section.querySelector('[data-product-form]');
    this.gallery = section.querySelector('[data-product-gallery]');
    this.viewport = section.querySelector('[data-gallery-viewport]');
    this.stickyBar = section.querySelector('[data-sticky-bar]');
    this.optionButtons = [...section.querySelectorAll('[data-option-button]')];
    this.optionSelects = [...section.querySelectorAll('[data-option-select]')];
    this.variantIdInputs = [...section.querySelectorAll('[data-variant-id-input]')];
    this.quantityInput = section.querySelector('[data-quantity-input]');
    this.lowStockNotices = [...section.querySelectorAll('[data-low-stock-notice]')];
    this.sizeGuideButtons = [...section.querySelectorAll('.product-info__size-guide')];
    this.sizeChartModal = section.querySelector('[data-size-chart-modal]');
    this.sizeChartClose = section.querySelector('[data-size-chart-close]');
    this.accordionTriggers = [...section.querySelectorAll('[data-accordion-trigger]')];
    this.price = section.querySelector('[data-product-price]');
    this.comparePrice = section.querySelector('[data-product-compare-price]');
    this.savingsBadge = section.querySelector('[data-product-savings-badge]');
    this.priceWrap = section.querySelector('[data-savings-format]');
    this.savingsFormat = this.priceWrap?.dataset.savingsFormat || 'percent';
    this.savingsTemplatePercent = this.priceWrap?.dataset.savingsTemplatePercent || 'Save [[value]] today';
    this.savingsTemplateAmount = this.priceWrap?.dataset.savingsTemplateAmount || 'Save [[value]] today';
    this.inventory = section.querySelector('[data-product-inventory]');
    this.sku = section.querySelector('[data-product-sku]');
    this.stickyPrice = section.querySelector('[data-sticky-price]');
    this.addToCart = section.querySelector('[data-add-to-cart]');
    this.addToCartLabel = section.querySelector('[data-add-to-cart-label]');
    this.stickySubmit = section.querySelector('[data-sticky-submit]');
    this.addToCartText = section.dataset.addToCartLabel || 'Add to cart';
    this.soldOutText = section.dataset.soldOutLabel || 'Sold out';
    this.unavailableText = section.dataset.unavailableLabel || 'Unavailable';
    this.availableToOrderText = section.dataset.availableToOrderLabel || 'Available to order';
    this.inStockTemplate = section.dataset.inStockTemplate || '[[count]] in stock';
    this.skuTemplate = section.dataset.skuTemplate || 'SKU: [[value]]';
    this.currentVariant = this.findInitialVariant();

    if (!this.product || !this.form) return;

    this.bindOptionInputs();
    this.bindQuantityControls();
    this.bindGallery();
    this.bindStickyBar();
    this.bindSizeChart();
    this.bindAccordions();
    this.updateLowStockText();
    this.applySelections(this.currentVariant?.options || this.getSelectedOptions());
    this.updateVariantUI(this.currentVariant);
  }

  parseProduct() {
    const node = this.section.querySelector('[data-product-json]');
    if (!node) return null;

    try {
      return JSON.parse(node.textContent);
    } catch (error) {
      console.error('Unable to parse product JSON', error);
      return null;
    }
  }

  findInitialVariant() {
    const currentId = Number(this.form.querySelector('[name="id"]')?.value);
    return (
      this.product.variants.find((variant) => variant.id === currentId) ||
      this.product.selected_or_first_available_variant ||
      this.product.variants[0]
    );
  }

  bindOptionInputs() {
    this.optionButtons.forEach((button) => {
      button.addEventListener('click', () => {
        if (button.disabled) return;
        const optionName = button.dataset.optionName;
        const optionValue = button.dataset.optionValue;
        this.handleVariantChange(optionName, optionValue);
      });
    });

    this.optionSelects.forEach((select) => {
      select.addEventListener('change', () => {
        this.handleVariantChange(select.dataset.optionName, select.value);
      });
    });
  }

  updateSelectedValue(optionName, optionValue) {
    const option = this.product.options.findIndex((name) => name === optionName);
    const label = this.section.querySelector(`[data-selected-option="${option + 1}"]`);
    if (label) label.textContent = optionValue;
  }

  getSelectedOptions() {
    return this.product.options.map((optionName) => {
      const select = this.optionSelects.find((item) => item.dataset.optionName === optionName);
      if (select) return select.value;

      const button = this.optionButtons.find(
        (item) => item.dataset.optionName === optionName && item.classList.contains('is-active')
      );
      return button?.dataset.optionValue;
    });
  }

  handleVariantChange(optionName, optionValue) {
    const optionIndex = this.product.options.findIndex((name) => name === optionName);
    const selectedOptions = this.getSelectedOptions();

    if (optionIndex >= 0) {
      selectedOptions[optionIndex] = optionValue;
    }

    const nextVariant = this.resolveVariantFromSelection(selectedOptions, optionIndex);
    if (!nextVariant) return;

    const normalizedSelections = [...nextVariant.options];
    this.applySelections(normalizedSelections);
    this.currentVariant = nextVariant;
    this.updateVariantUI(nextVariant);
  }

  applySelections(selectedOptions) {
    this.product.options.forEach((optionName, index) => {
      const selectedValue = selectedOptions[index];
      const relatedButtons = this.optionButtons.filter((button) => button.dataset.optionName === optionName);

      relatedButtons.forEach((button) => {
        const isActive = button.dataset.optionValue === selectedValue;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });

      const select = this.optionSelects.find((item) => item.dataset.optionName === optionName);
      if (select) select.value = selectedValue;

      this.updateSelectedValue(optionName, selectedValue);
    });

    this.updateOptionAvailability(selectedOptions);
  }

  updateOptionAvailability(selectedOptions) {
    this.product.options.forEach((optionName, index) => {
      this.optionButtons
        .filter((button) => button.dataset.optionName === optionName)
        .forEach((button) => {
          const isReachable = this.isOptionValueReachable(index, button.dataset.optionValue, selectedOptions);
          button.disabled = !isReachable;
          button.classList.toggle('is-unavailable', !isReachable);
          button.setAttribute('aria-disabled', isReachable ? 'false' : 'true');
        });

      const select = this.optionSelects.find((item) => item.dataset.optionName === optionName);
      if (!select) return;

      [...select.options].forEach((option) => {
        option.disabled = !this.isOptionValueReachable(index, option.value, selectedOptions);
      });
    });
  }

  isOptionValueReachable(index, optionValue, selectedOptions) {
    return this.product.variants.some((variant) =>
      variant.options.every((value, variantIndex) => {
        if (variantIndex === index) return value === optionValue;

        const selectedValue = selectedOptions[variantIndex];
        return !selectedValue || value === selectedValue;
      })
    );
  }

  resolveVariantFromSelection(selectedOptions, changedIndex = 0) {
    const exactVariant = this.findVariantByOptions(selectedOptions);
    if (exactVariant) return exactVariant;

    const rankedVariants = this.product.variants
      .filter((variant) => {
        if (changedIndex < 0) return true;
        return variant.options[changedIndex] === selectedOptions[changedIndex];
      })
      .map((variant) => ({
        variant,
        score: variant.options.reduce((total, value, index) => total + (value === selectedOptions[index] ? 1 : 0), 0)
      }))
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        if (left.variant.available !== right.variant.available) {
          return Number(right.variant.available) - Number(left.variant.available);
        }

        return 0;
      });

    return rankedVariants[0]?.variant || null;
  }

  findVariantByOptions(selectedOptions) {
    return this.product.variants.find((variant) =>
      variant.options.every((option, index) => option === selectedOptions[index])
    );
  }

  updateVariantUI(variant) {
    this.variantIdInputs.forEach((input) => {
      input.value = variant.id;
    });

    if (this.price) this.price.textContent = this.formatMoney(variant.price);
    if (this.stickyPrice) this.stickyPrice.textContent = this.formatMoney(variant.price);

    if (this.comparePrice) {
      if (variant.compare_at_price > variant.price) {
        this.comparePrice.hidden = false;
        this.comparePrice.textContent = this.formatMoney(variant.compare_at_price);
      } else {
        this.comparePrice.hidden = true;
        this.comparePrice.textContent = '';
      }
    }

    if (this.savingsBadge) {
      if (variant.compare_at_price > variant.price) {
        const savingsAmount = variant.compare_at_price - variant.price;
        const savingsPercent = Math.round((savingsAmount / variant.compare_at_price) * 100);
        this.savingsBadge.hidden = false;
        this.savingsBadge.textContent =
          this.savingsFormat === 'amount'
            ? this.savingsTemplateAmount.replace('[[value]]', this.formatMoney(savingsAmount))
            : this.savingsTemplatePercent.replace('[[value]]', `${savingsPercent}%`);
      } else {
        this.savingsBadge.hidden = true;
        this.savingsBadge.textContent = '';
      }
    }

    if (this.inventory) {
      this.inventory.textContent = variant.available
        ? variant.inventory_quantity > 0
          ? this.inStockTemplate.replace('[[count]]', variant.inventory_quantity)
          : this.availableToOrderText
        : this.unavailableText;
    }

    if (this.sku) {
      this.sku.textContent = variant.sku ? this.skuTemplate.replace('[[value]]', variant.sku) : '';
    }

    if (this.addToCart && this.addToCartLabel) {
      this.addToCart.disabled = !variant.available;
      this.addToCartLabel.textContent = variant.available ? this.addToCartText : this.soldOutText;
    }

    if (variant.featured_media?.id) {
      this.showMedia(variant.featured_media.id);
    }

    const nextUrl = `${this.section.dataset.productUrl}?variant=${variant.id}`;
    window.history.replaceState({}, '', nextUrl);
  }

  updateLowStockText() {
    if (!this.lowStockNotices.length) return;

    this.lowStockNotices.forEach((notice) => {
      const textNode = notice.querySelector('[data-low-stock-text]');
      if (!textNode) return;

      const template = notice.dataset.lowStockTextTemplate || textNode.textContent || '';
      const deliveryDays = Number(notice.dataset.lowStockDeliveryDays || 0);
      const currentDate = new Date();
      currentDate.setDate(currentDate.getDate() + deliveryDays);

      const day = currentDate.getDate();
      const monthName = currentDate.toLocaleString(document.documentElement.lang || 'en-US', {
        month: 'long'
      });
      const weekdayName = currentDate.toLocaleString(document.documentElement.lang || 'en-US', {
        weekday: 'long'
      });

      textNode.textContent = template
        .replace('[weekday]', weekdayName)
        .replace('[day]', this.formatOrdinalDay(day))
        .replace('[month]', monthName)
        .replace('[year]', String(currentDate.getFullYear()));
    });
  }

  bindGallery() {
    if (!this.gallery || !this.viewport) return;

    const thumbButtons = [...this.section.querySelectorAll('[data-gallery-thumb]')];
    const items = [...this.section.querySelectorAll('[data-media-id]')];
    const prev = this.section.querySelector('[data-gallery-prev]');
    const next = this.section.querySelector('[data-gallery-next]');
    const zoomButtons = [...this.section.querySelectorAll('[data-gallery-zoom]')];
    const modal = this.section.querySelector('[data-gallery-modal]');
    const modalBody = this.section.querySelector('[data-gallery-modal-body]');
    const modalThumbs = this.section.querySelector('[data-gallery-modal-thumbs]');
    const modalTemplates = [...this.section.querySelectorAll('[data-gallery-modal-template]')];
    const closeModal = this.section.querySelector('[data-gallery-close]');
    const mediaIds = items.map((item) => Number(item.dataset.mediaId));
    let lastZoomTrigger = null;
    let activeModalMediaId = null;

    thumbButtons.forEach((button) => {
      button.addEventListener('click', () => this.showMedia(Number(button.dataset.targetMediaId)));
    });

    const scrollToOffset = (direction) => {
      this.viewport.scrollBy({ left: direction * this.viewport.clientWidth, behavior: 'smooth' });
    };

    prev?.addEventListener('click', () => scrollToOffset(-1));
    next?.addEventListener('click', () => scrollToOffset(1));

    const renderModalMedia = (mediaId) => {
      const template = modalTemplates.find((item) => Number(item.dataset.galleryModalTemplate) === mediaId);
      if (!template || !modalBody) return;

      modalBody.replaceChildren(template.content.cloneNode(true));
      activeModalMediaId = mediaId;

      modalThumbs?.querySelectorAll('[data-gallery-modal-thumb]').forEach((thumb) => {
        const isActive = Number(thumb.dataset.targetMediaId) === mediaId;
        thumb.classList.toggle('is-active', isActive);
        thumb.setAttribute('aria-current', isActive ? 'true' : 'false');
      });
    };

    const renderAdjacentModalMedia = (direction) => {
      if (!mediaIds.length || activeModalMediaId === null) return;
      const currentIndex = mediaIds.indexOf(activeModalMediaId);
      if (currentIndex < 0) return;

      const nextIndex = (currentIndex + direction + mediaIds.length) % mediaIds.length;
      renderModalMedia(mediaIds[nextIndex]);
    };

    modalThumbs?.querySelectorAll('[data-gallery-modal-thumb]').forEach((thumb) => {
      thumb.addEventListener('click', () => {
        renderModalMedia(Number(thumb.dataset.targetMediaId));
      });
    });

    zoomButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const item = button.closest('[data-media-id]');
        if (!item || !modal || !modalBody) return;
        lastZoomTrigger = button;
        renderModalMedia(Number(item.dataset.mediaId));
        document.documentElement.classList.add('product-gallery-modal-open');
        document.body.classList.add('product-gallery-modal-open');
        modal.showModal();
        closeModal?.focus();
      });
    });

    closeModal?.addEventListener('click', () => modal?.close());
    modal?.addEventListener('click', (event) => {
      if (event.target === modal) modal.close();
    });
    modal?.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        renderAdjacentModalMedia(-1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        renderAdjacentModalMedia(1);
      }
    });
    modal?.addEventListener('close', () => {
      modalBody?.replaceChildren();
      activeModalMediaId = null;
      document.documentElement.classList.remove('product-gallery-modal-open');
      document.body.classList.remove('product-gallery-modal-open');
      lastZoomTrigger?.focus();
    });

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (!visible) return;
        const mediaId = Number(visible.target.dataset.mediaId);
        items.forEach((item) => item.classList.toggle('is-active', item === visible.target));
        thumbButtons.forEach((button) =>
          button.classList.toggle('is-active', Number(button.dataset.targetMediaId) === mediaId)
        );
      },
      { root: this.viewport, threshold: 0.55 }
    );

    items.forEach((item) => observer.observe(item));
  }

  bindQuantityControls() {
    if (!this.quantityInput) return;

    const decrease = this.section.querySelector('[data-quantity-decrease]');
    const increase = this.section.querySelector('[data-quantity-increase]');

    decrease?.addEventListener('click', () => {
      const nextValue = Math.max(1, Number(this.quantityInput.value || 1) - 1);
      this.quantityInput.value = nextValue;
    });

    increase?.addEventListener('click', () => {
      const nextValue = Math.max(1, Number(this.quantityInput.value || 1) + 1);
      this.quantityInput.value = nextValue;
    });

    this.quantityInput.addEventListener('change', () => {
      const normalized = Math.max(1, Number(this.quantityInput.value || 1));
      this.quantityInput.value = normalized;
    });
  }

  showMedia(mediaId) {
    const target = this.section.querySelector(`[data-media-id="${mediaId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });

    this.section.querySelectorAll('[data-gallery-thumb]').forEach((button) => {
      button.classList.toggle('is-active', Number(button.dataset.targetMediaId) === mediaId);
    });
  }

  bindStickyBar() {
    if (!this.stickyBar || !this.addToCart || !this.stickySubmit) return;

    this.stickySubmit.addEventListener('click', () => {
      this.addToCart.click();
    });

    const observer = new IntersectionObserver(
      ([entry]) => {
        this.stickyBar.hidden = entry.isIntersecting;
      },
      { threshold: 0.35 }
    );

    observer.observe(this.addToCart);
  }

  bindSizeChart() {
    if (!this.sizeGuideButtons.length || !this.sizeChartModal) return;

    this.sizeGuideButtons.forEach((button) => {
      button.addEventListener('click', () => {
        this.sizeChartModal.showModal();
      });
    });

    this.sizeChartClose?.addEventListener('click', () => {
      this.sizeChartModal?.close();
    });

    this.sizeChartModal.addEventListener('click', (event) => {
      if (event.target === this.sizeChartModal) {
        this.sizeChartModal.close();
      }
    });
  }

  bindAccordions() {
    if (!this.accordionTriggers.length) return;

    this.accordionTriggers.forEach((trigger) => {
      const panelId = trigger.getAttribute('aria-controls');
      const panel = panelId ? this.section.querySelector(`#${CSS.escape(panelId)}`) : null;
      if (!panel) return;

      if (panel.dataset.accordionOpenDefault === 'true') {
        panel.style.height = `${panel.scrollHeight}px`;
      }

      trigger.addEventListener('click', () => {
        const isOpen = trigger.getAttribute('aria-expanded') === 'true';
        this.setAccordionState(trigger, panel, !isOpen);
      });
    });
  }

  setAccordionState(trigger, panel, shouldOpen) {
    trigger.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    trigger.classList.toggle('is-open', shouldOpen);
    panel.classList.toggle('is-open', shouldOpen);

    if (shouldOpen) {
      panel.style.height = `${panel.scrollHeight}px`;
    } else {
      panel.style.height = `${panel.scrollHeight}px`;
      requestAnimationFrame(() => {
        panel.style.height = '0px';
      });
    }
  }

  formatMoney(amount) {
    const currency = window.Shopify?.currency?.active || 'USD';
    return new Intl.NumberFormat(document.documentElement.lang || 'en-US', {
      style: 'currency',
      currency
    }).format(amount / 100);
  }

  formatOrdinalDay(day) {
    const mod100 = day % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${day}th`;

    const mod10 = day % 10;
    if (mod10 === 1) return `${day}st`;
    if (mod10 === 2) return `${day}nd`;
    if (mod10 === 3) return `${day}rd`;
    return `${day}th`;
  }
}

document.querySelectorAll('[data-product-section]').forEach((section) => {
  new ProductSectionController(section);
});
