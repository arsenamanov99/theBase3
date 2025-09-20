// ===== Анимация чашек (центр под словом "Бишкек") =====
(() => {
  const lane = document.querySelector('.lane');
  const path = document.querySelector('.path');
  const cups = document.querySelectorAll('.cup');
  if (!lane || !path || !cups.length) return;

  const PAD = 8;
  let anims = [];

  function layout() {
    const cities = lane.querySelectorAll('.city');
    if (cities.length < 2) return 0;
    const laneRect = lane.getBoundingClientRect();
    const aRect = cities[0].getBoundingClientRect();
    const bNode = lane.querySelector('.city .city-txt-bishkek') || cities[1];
    const bRect = bNode.getBoundingClientRect();

    const startX = aRect.left + aRect.width / 2 - laneRect.left;
    const endX = bRect.left + bRect.width / 2 - laneRect.left;
    const y = Math.max(aRect.bottom, bRect.bottom) - laneRect.top + 50;
    const widthRaw = Math.max(0, endX - startX);

    path.style.left = `${startX - PAD}px`;
    path.style.top = `${y}px`;
    path.style.width = `${widthRaw + PAD * 2}px`;

    const rt = path.querySelector('svg.route');
    if (rt) rt.setAttribute('viewBox', `0 0 ${Math.max(100, Math.round(widthRaw + PAD * 2))} 30`);

    const ln = path.querySelector('line');
    if (ln) {
      ln.setAttribute('x1', PAD);
      ln.setAttribute('x2', Math.round(widthRaw + PAD));
    }
    const circles = path.querySelectorAll('circle.point');
    if (circles.length >= 2) {
      circles[0].setAttribute('cx', PAD);
      circles[1].setAttribute('cx', Math.round(widthRaw + PAD));
    }
    return widthRaw + PAD * 2;
  }

  function animate(width) {
    const travel = Math.max(0, width - 36);
    const dur = 3584; // плавное перемещение чашек
    const step = dur / cups.length;
    const fadePad = 20;
    anims.forEach((anim) => anim.cancel());
    anims = [];
    cups.forEach((cup, index) => {
      cup.style.opacity = '1';
      const anim = cup.animate(
        [
          { transform: 'translate(-18px,-50%) translateX(0)', opacity: 0 },
          { offset: 0.12, transform: `translate(-18px,-50%) translateX(${fadePad}px)`, opacity: 1 },
          { offset: 0.88, transform: `translate(-18px,-50%) translateX(${Math.max(0, travel - fadePad)}px)`, opacity: 1 },
          { transform: `translate(-18px,-50%) translateX(${travel}px)`, opacity: 0 },
        ],
        { duration: dur, delay: index * step, iterations: Infinity, easing: 'linear', fill: 'both' }
      );
      anims.push(anim);
    });
  }

  let tries = 0;
  function start() {
    const width = layout();
    if (width <= 0 && tries < 20) {
      tries += 1;
      return setTimeout(start, 60);
    }
    if (width > 0) animate(width);
    return undefined;
  }

  if (document.readyState !== 'complete') {
    window.addEventListener('load', start);
  } else {
    start();
  }
  if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
    document.fonts.ready.then(start);
  }
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(() => start());
    observer.observe(lane);
  } else {
    window.addEventListener('resize', start);
  }

  const pauseAll = () => anims.forEach((anim) => anim.pause());
  const playAll = () => anims.forEach((anim) => anim.play());
  path.addEventListener('mouseenter', pauseAll);
  path.addEventListener('mouseleave', playAll);
  path.addEventListener('touchstart', () => {
    pauseAll();
    setTimeout(playAll, 1200);
  }, { passive: true });
})();

// ===== заявки: контактная форма =====
(() => {
  const form = document.getElementById('lead-form');
  if (!form) {
    return;
  }

  const status = document.getElementById('form-status');
  const nameInput = document.getElementById('name');
  const phoneInput = document.getElementById('phone');
  const addressInput = document.getElementById('address');
  const timeInput = document.getElementById('delivery-time');
  const noteInput = document.getElementById('msg');

  const PHONE_RE = /^\+996\d{9}$/;

  const showStatus = (message) => {
    if (status) {
      status.textContent = message;
    }
  };

  const readInput = (input) => (input && typeof input.value === 'string' ? input.value.trim() : '');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
      return;
    }

    const name = readInput(nameInput);
    const phone = readInput(phoneInput);
    const address = readInput(addressInput);
    const time = readInput(timeInput);
    const note = readInput(noteInput);

    if (!PHONE_RE.test(phone)) {
      showStatus('Введите номер в формате +996XXXXXXXXX.');
      if (phoneInput && typeof phoneInput.focus === 'function') {
        phoneInput.focus();
      }
      return;
    }

    const noteParts = [];
    if (address) noteParts.push(`Адрес: ${address}`);
    if (time) noteParts.push(`Желаемое время: ${time}`);
    if (note) noteParts.push(note);

    try {
      showStatus('Отправляем...');
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          note: noteParts.join('\n') || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showStatus(`Ошибка: ${err.error || err.detail || res.status}`);
        return;
      }
      form.reset();
      showStatus('Спасибо! Мы свяжемся с вами.');
    } catch (error) {
      showStatus('Не удалось отправить сообщение. Попробуйте позже.');
    }
  });
})();

// ===== cart & checkout =====
(() => {
  const cartToggle = document.getElementById('cart-toggle');
  const cartPanel = document.getElementById('cart-panel');
  const cartOverlay = document.getElementById('cart-overlay');
  const cartClose = document.getElementById('cart-close');
  const cartItemsEl = document.getElementById('cart-items');
  const cartCountEl = document.getElementById('cart-count');
  const cartTotalEl = document.getElementById('cart-total-amount');
  const cartSummaryEl = document.getElementById('cart-summary');
  const cartForm = document.getElementById('cart-checkout-form');
  const cartNameInput = document.getElementById('cart-name');
  const cartPhoneInput = document.getElementById('cart-phone');
  const cartAddressInput = document.getElementById('cart-address');
  const cartDeliveryToggle = document.getElementById('cart-delivery-toggle');
  const cartDeliveryDateInput = document.getElementById('cart-delivery-date');
  const cartDeliveryTimeInput = document.getElementById('cart-delivery-time');
  const cartDeliveryTimeWrapper = document.getElementById('cart-time-wrapper');
  const cartDeliveryCaption = document.querySelector('.cart-delivery .toggle-caption');
  const cartStatus = document.getElementById('cart-status');
  const cartSubmitBtn = cartForm ? cartForm.querySelector('button[type="submit"]') : null;

  const ORDER_LABEL = 'Заказать';
  const SAMPLE_ORDER_LABEL = 'Заказать образец';
  const IN_CART_LABEL = 'В корзине';
  const IN_CART_CHECKMARK = '✓';
  const PHONE_PREFIX = '+996';
  const PHONE_RE = /^\+996\d{9}$/;
  const SEPARATOR = ' · ';
  const CURRENCY = ' сом';
  const STORAGE_KEY = 'thebase:cart:v1';
  const ORDER_FLASH_MS = 3000;

  function formatInCartLabel(label) {
    const safe = typeof label === 'string' && label.trim() ? label.trim() : IN_CART_LABEL;
    return `${IN_CART_CHECKMARK} ${safe}`;
  }

  function setButtonDisabled(button, disabled) {
    if (!(button instanceof HTMLElement)) {
      return;
    }
    const shouldDisable = Boolean(disabled);
    if ('disabled' in button) {
      try {
        button.disabled = shouldDisable;
      } catch (error) {
        /* ignore inability to toggle disabled */
      }
    }
    if (shouldDisable) {
      button.classList.add('is-temporary-disabled');
      button.setAttribute('aria-disabled', 'true');
    } else {
      button.classList.remove('is-temporary-disabled');
      button.removeAttribute('aria-disabled');
    }
  }

  const modalRoot = document.getElementById('product-modal');
  const modalDialog = modalRoot ? modalRoot.querySelector('.product-modal__dialog') : null;
  const modalBackdrop = modalRoot ? modalRoot.querySelector('.product-modal__backdrop') : null;
  const modalTitle = document.getElementById('product-modal-title');
  const modalSubtitle = document.getElementById('product-modal-subtitle');
  const modalFlavors = document.getElementById('product-modal-flavors');
  const modalMessage = document.getElementById('product-modal-message');
  const modalVariantButtons = modalRoot ? Array.from(modalRoot.querySelectorAll('[data-variant]')) : [];
  const modalCloseButtons = modalRoot ? Array.from(modalRoot.querySelectorAll('[data-action="close-product-modal"]')) : [];
  const modalQuantityInput = document.getElementById('product-modal-quantity');
  let modalQuantitySection = null;
  if (modalQuantityInput) {
    let cursor = modalQuantityInput.parentElement;
    while (cursor) {
      if (cursor.classList && cursor.classList.contains('product-modal__section')) {
        modalQuantitySection = cursor;
        break;
      }
      cursor = cursor.parentElement;
    }
  }

  if (!cartPanel || !cartToggle || !cartItemsEl) {
    return;
  }

  if (modalQuantitySection && modalQuantitySection.parentNode) {
    modalQuantitySection.parentNode.removeChild(modalQuantitySection);
  }

  modalVariantButtons.forEach((button) => {
    const variant = button.dataset.variant === 'sample' ? 'sample' : 'pack';
    if (variant === 'pack') {
      button.dataset.defaultLabel = ORDER_LABEL;
      button.dataset.inCartLabel = IN_CART_LABEL;
      button.textContent = ORDER_LABEL;
    } else {
      button.dataset.defaultLabel = SAMPLE_ORDER_LABEL;
      button.dataset.inCartLabel = IN_CART_LABEL;
      button.textContent = SAMPLE_ORDER_LABEL;
    }
  });

  const cards = Array.from(document.querySelectorAll('.card'));
  const decoder = document.createElement('textarea');
  const catalog = new Map();

  cards.forEach((card) => {
    const titleEl = card.querySelector('h3');
    const name = titleEl && titleEl.textContent ? titleEl.textContent.trim() : '';
    if (!name) {
      return;
    }
    const productId = card.dataset.productId || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (!productId) {
      return;
    }
    const rawFlavors = (card.dataset.flavors || '')
      .split(';')
      .map((chunk) => {
        decoder.innerHTML = chunk.trim();
        return decoder.value.trim();
      })
      .filter(Boolean);
    const packPrice = Number(card.dataset.packPrice);
    const samplePrice = Number(card.dataset.samplePrice);
    const allowSample = card.dataset.allowSample !== 'false';
    const trigger = card.querySelector('.open-product') || card.querySelector('button');
    const defaultLabel = ORDER_LABEL;
    const inCartLabel = IN_CART_LABEL;

    if (trigger) {
      trigger.dataset.productId = productId;
      trigger.dataset.defaultLabel = defaultLabel;
      trigger.dataset.inCartLabel = inCartLabel;
      trigger.textContent = defaultLabel;
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        openProductModal(productId);
      });
    }

    catalog.set(productId, {
      id: productId,
      name,
      flavors: rawFlavors,
      packPrice: Number.isFinite(packPrice) ? packPrice : null,
      samplePrice: Number.isFinite(samplePrice) ? samplePrice : null,
      allowSample,
      trigger,
      defaultLabel,
      inCartLabel,
    });
  });

  const cart = new Map();
  const triggerHighlights = new Map();
  let modalOrderFeedbackTimer = null;
  let activeProduct = null;

  loadCart();

  const readInput = (input) => (input && typeof input.value === 'string' ? input.value.trim() : '');

  function attachPhoneMask(input) {
    if (!input) {
      return () => {};
    }

    const normalise = () => {
      const digits = input.value.replace(/\D/g, '');
      const suffix = digits.startsWith('996') ? digits.slice(3) : digits;
      input.value = PHONE_PREFIX + suffix.slice(0, 9);
      requestAnimationFrame(() => {
        const len = input.value.length;
        try {
          input.setSelectionRange(len, len);
        } catch (error) {
          /* ignore */
        }
      });
    };

    input.addEventListener('focus', () => {
      if (!input.value) {
        input.value = PHONE_PREFIX;
      }
      normalise();
    });
    input.addEventListener('input', normalise);
    input.addEventListener('blur', () => {
      if (input.value === PHONE_PREFIX) {
        input.value = '';
      }
    });
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') {
        return;
      }
      const selectionStart = typeof input.selectionStart === 'number' ? input.selectionStart : 0;
      const selectionEnd = typeof input.selectionEnd === 'number' ? input.selectionEnd : 0;
      if (selectionStart !== selectionEnd) {
        if (selectionStart < PHONE_PREFIX.length) {
          event.preventDefault();
        }
        return;
      }
      if (event.key === 'Backspace' && selectionStart <= PHONE_PREFIX.length) {
        event.preventDefault();
      }
      if (event.key === 'Delete' && selectionStart < PHONE_PREFIX.length) {
        event.preventDefault();
      }
    });
    input.addEventListener('paste', (event) => {
      event.preventDefault();
      const pasted = event.clipboardData ? event.clipboardData.getData('text') : '';
      const digits = pasted.replace(/\D/g, '');
      const suffix = digits.startsWith('996') ? digits.slice(3) : digits;
      input.value = PHONE_PREFIX + suffix.slice(0, 9);
      requestAnimationFrame(() => {
        const len = input.value.length;
        try {
          input.setSelectionRange(len, len);
        } catch (error) {
          /* ignore */
        }
      });
    });

    if (input.value) {
      normalise();
    }

    return normalise;
  }

  attachPhoneMask(cartPhoneInput);
  attachPhoneMask(document.getElementById('phone'));

  function variantLabel(variant) {
    return variant === 'sample' ? 'Образец' : 'Пачка';
  }

  function formatPrice(value) {
    return typeof value === 'number' && value > 0 ? `${value.toLocaleString('ru-RU')}${CURRENCY}` : '—';
  }

  function cartKey(productId, variant, flavors) {
    const flavorKey = flavors.length ? flavors.slice().sort().join('|') : 'plain';
    return `${productId}::${variant}::${flavorKey}`;
  }

  function showCartStatus(message) {
    if (cartStatus) {
      cartStatus.textContent = message;
    }
  }

  function clearTriggerHighlight(productId) {
    const timer = triggerHighlights.get(productId);
    if (typeof timer === 'number') {
      window.clearTimeout(timer);
    }
    triggerHighlights.delete(productId);
  }

  function applyTriggerDefault(product) {
    const trigger = product.trigger;
    if (!trigger) {
      return;
    }
    trigger.textContent = product.defaultLabel;
    trigger.classList.remove('is-in-cart');
    trigger.removeAttribute('aria-pressed');
    setButtonDisabled(trigger, false);
  }

  function applyTriggerHighlight(product) {
    const trigger = product.trigger;
    if (!trigger) {
      return;
    }
    trigger.textContent = formatInCartLabel(product.inCartLabel);
    trigger.classList.add('is-in-cart');
    trigger.setAttribute('aria-pressed', 'true');
    setButtonDisabled(trigger, true);
  }

  function flashTrigger(product) {
    const trigger = product.trigger;
    if (!trigger) {
      return;
    }
    clearTriggerHighlight(product.id);
    applyTriggerHighlight(product);
    const timer = window.setTimeout(() => {
      triggerHighlights.delete(product.id);
      applyTriggerDefault(product);
    }, ORDER_FLASH_MS);
    triggerHighlights.set(product.id, timer);
  }

  function syncCardStates() {
    const inCart = new Set();
    cart.forEach((item) => inCart.add(item.productId));
    catalog.forEach((product) => {
      if (!product.trigger) {
        return;
      }
      if (!inCart.has(product.id)) {
        clearTriggerHighlight(product.id);
        applyTriggerDefault(product);
        return;
      }
      if (triggerHighlights.has(product.id)) {
        applyTriggerHighlight(product);
      } else {
        applyTriggerDefault(product);
      }
    });
  }

  function renderChips() {
    const chipsContainer = document.getElementById('cart-chips');
    if (!chipsContainer) {
      return;
    }
    chipsContainer.innerHTML = '';
    cart.forEach((item, key) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      const parts = [item.name, variantLabel(item.variant)];
      if (item.flavors.length) {
        parts.push(item.flavors.join(', '));
      }
      const qty = Number(item.quantity || 0);
      if (Number.isFinite(qty) && qty > 1) {
        parts.push(`×${qty}`);
      }
      chip.textContent = parts.join(SEPARATOR);
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'chip-x';
      removeBtn.textContent = '×';
      removeBtn.setAttribute('aria-label', `Убрать ${item.name} из корзины`);
      removeBtn.addEventListener('click', () => removeFromCart(key));
      chip.appendChild(removeBtn);
      chipsContainer.appendChild(chip);
    });
  }

  function buildCartLine(item) {
    const parts = [variantLabel(item.variant)];
    if (item.flavors.length) {
      parts.push(item.flavors.join(', '));
    }
    const qty = Number(item.quantity || 0);
    parts.push(`×${Number.isFinite(qty) ? qty : 0}`);
    return parts.join(SEPARATOR);
  }

  function buildCartNote() {
    const lines = [];
    cart.forEach((item) => {
      const price = formatPrice(item.totalPrice);
      lines.push(`${item.name} — ${buildCartLine(item)}${price !== '—' ? `${SEPARATOR}${price}` : ''}`);
    });
    return lines.join('\n');
  }

  function updateCartSummary() {
    if (!cartSummaryEl) {
      return;
    }
    cartSummaryEl.innerHTML = '';
    cart.forEach((item, key) => {
      const row = document.createElement('div');
      row.className = 'cart-summary-item';
      row.dataset.cartKey = key;

      const header = document.createElement('div');
      header.className = 'cart-summary-header';

      const title = document.createElement('span');
      title.className = 'cart-summary-title';
      title.textContent = item.name;

      const price = document.createElement('span');
      price.className = 'cart-summary-price';
      price.textContent = formatPrice(item.totalPrice);

      header.appendChild(title);
      header.appendChild(price);

      const meta = document.createElement('div');
      meta.className = 'cart-summary-meta';
      meta.textContent = buildCartLine(item);

      row.appendChild(header);
      row.appendChild(meta);
      cartSummaryEl.appendChild(row);
    });
  }

  function resetCheckoutForm(resetFields = false) {
    if (cartForm && resetFields) {
      cartForm.reset();
      updateDeliveryControls();
      if (cartPhoneInput) {
        cartPhoneInput.value = '';
      }
    }
    showCartStatus('');
  }

  function clearModalOrderFeedback() {
    if (modalOrderFeedbackTimer !== null) {
      window.clearTimeout(modalOrderFeedbackTimer);
      modalOrderFeedbackTimer = null;
    }
    modalVariantButtons.forEach((button) => {
      if ((button.dataset.variant || '') === 'sample') {
        return;
      }
      const defaultLabel = button.dataset.defaultLabel || ORDER_LABEL;
      button.textContent = defaultLabel;
      button.classList.remove('is-in-cart');
      setButtonDisabled(button, false);
    });
  }

  function flashModalOrderFeedback(button) {
    if (!button || (button.dataset.variant || '') === 'sample') {
      return;
    }
    clearModalOrderFeedback();
    const label = button.dataset.inCartLabel || IN_CART_LABEL;
    button.textContent = formatInCartLabel(label);
    button.classList.add('is-in-cart');
    setButtonDisabled(button, true);
    modalOrderFeedbackTimer = window.setTimeout(() => {
      clearModalOrderFeedback();
    }, ORDER_FLASH_MS);
  }

  function syncModalStates() {
    if (!activeProduct || !modalFlavors) {
      return;
    }
    const rows = Array.from(modalFlavors.querySelectorAll('.product-modal__flavor-row'));
    rows.forEach((row) => {
      const flavor = row.dataset.flavor || null;
      const sampleBtn = row.querySelector('.product-modal__sample');
      if (!flavor || !(sampleBtn instanceof HTMLElement)) {
        return;
      }
      const sampleKey = cartKey(activeProduct.id, 'sample', [flavor]);
      const inCart = cart.has(sampleKey);
      if (inCart) {
        sampleBtn.classList.add('btn-in-cart');
        sampleBtn.textContent = formatInCartLabel(IN_CART_LABEL);
        setButtonDisabled(sampleBtn, true);
      } else {
        sampleBtn.classList.remove('btn-in-cart');
        sampleBtn.textContent = SAMPLE_ORDER_LABEL;
        setButtonDisabled(sampleBtn, !activeProduct.allowSample);
      }
    });
  }

  function saveCart() {
    try {
      const storage = typeof window !== 'undefined' ? window.localStorage : null;
      if (!storage) {
        return;
      }
      const snapshot = Array.from(cart.values()).map((item) => {
        const qty = Number(item.quantity || 0);
        return {
          productId: item.productId,
          variant: item.variant,
          flavors: item.flavors,
          quantity: Number.isFinite(qty) && qty > 0 ? qty : 0,
        };
      });
      storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      /* ignore persistence errors */
    }
  }

  function loadCart() {
    try {
      const storage = typeof window !== 'undefined' ? window.localStorage : null;
      if (!storage) {
        return;
      }
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const snapshot = JSON.parse(raw);
      if (!Array.isArray(snapshot)) {
        return;
      }
      snapshot.forEach((entry) => {
        if (!entry || typeof entry !== 'object') {
          return;
        }
        const product = catalog.get(entry.productId);
        if (!product) {
          return;
        }
        const variant = entry.variant === 'sample' ? 'sample' : 'pack';
        const quantity = Number(entry.quantity || 0);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          return;
        }
        const rawFlavors = Array.isArray(entry.flavors) ? entry.flavors : [];
        const normalizedFlavors = Array.from(
          new Set(
            rawFlavors
              .filter((value) => typeof value === 'string' && value)
              .map((value) => value.trim())
          )
        );
        const flavors = product.flavors.length
          ? normalizedFlavors.filter((value) => product.flavors.includes(value))
          : [];
        if (variant === 'sample' && !flavors.length) {
          return;
        }
        upsertCartItem(product, { variant, quantity, flavors });
      });
    } catch (error) {
      /* ignore corrupted storage */
    }
  }

  function renderCart() {
    if (!cartItemsEl) {
      return;
    }
    cartItemsEl.innerHTML = '';
    renderChips();

    if (!cart.size) {
      const empty = document.createElement('p');
      empty.className = 'cart-empty';
      empty.textContent = 'Корзина пустая';
      cartItemsEl.appendChild(empty);
    } else {
      cart.forEach((item, key) => {
        const qty = Number(item.quantity || 0);
        const baseLabel = item.flavors.length ? `${item.name} (${item.flavors.join(', ')})` : item.name;

        const entry = document.createElement('div');
        entry.className = 'cart-item';
        entry.dataset.cartKey = key;

        const name = document.createElement('div');
        name.className = 'cart-item-name';
        name.textContent = item.name;

        const meta = document.createElement('div');
        meta.className = 'cart-item-meta';
        meta.textContent = buildCartLine(item);

        const controls = document.createElement('div');
        controls.className = 'cart-item-qty';

        const minusBtn = document.createElement('button');
        minusBtn.type = 'button';
        minusBtn.className = 'cart-qty-btn';
        minusBtn.textContent = '-';
        minusBtn.setAttribute('aria-label', `Уменьшить количество ${baseLabel}`);
        minusBtn.disabled = qty <= 0;
        minusBtn.dataset.cartAction = 'decrement';
        minusBtn.dataset.cartKey = key;
        const qtyValue = document.createElement('span');
        qtyValue.className = 'cart-qty-value';
        qtyValue.textContent = String(qty);

        const plusBtn = document.createElement('button');
        plusBtn.type = 'button';
        plusBtn.className = 'cart-qty-btn';
        plusBtn.textContent = '+';
        plusBtn.setAttribute('aria-label', `Увеличить количество ${baseLabel}`);
        plusBtn.dataset.cartAction = 'increment';
        plusBtn.dataset.cartKey = key;

        controls.appendChild(minusBtn);
        controls.appendChild(qtyValue);
        controls.appendChild(plusBtn);

        const price = document.createElement('div');
        price.className = 'cart-item-price';
        price.textContent = formatPrice(item.totalPrice);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'cart-item-remove';
        removeBtn.textContent = '×';
        removeBtn.setAttribute('aria-label', `Убрать ${baseLabel} из корзины`);
        removeBtn.dataset.cartAction = 'remove';
        removeBtn.dataset.cartKey = key;

        entry.appendChild(name);
        entry.appendChild(meta);
        entry.appendChild(controls);
        entry.appendChild(price);
        entry.appendChild(removeBtn);

        cartItemsEl.appendChild(entry);
      });
    }

    const totalCount = Array.from(cart.values()).reduce((sum, item) => {
      const qty = Number(item.quantity || 0);
      return sum + (Number.isFinite(qty) ? qty : 0);
    }, 0);
    const totalPrice = Array.from(cart.values()).reduce((sum, item) => {
      const value = item.totalPrice;
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);

    if (cartCountEl) {
      cartCountEl.textContent = String(totalCount);
    }
    if (cartToggle) {
      if (totalCount > 0) {
        cartToggle.classList.add('has-items');
      } else {
        cartToggle.classList.remove('has-items');
      }
      cartToggle.setAttribute('aria-expanded', String(isCartOpen()));
    }
    if (cartTotalEl) {
      cartTotalEl.textContent = totalPrice > 0 ? `${totalPrice.toLocaleString('ru-RU')}${CURRENCY}` : '—';
    }

    if (cartSubmitBtn) {
      cartSubmitBtn.disabled = cart.size === 0;
    }

    if (cartForm) {
      if (cart.size > 0) {
        cartForm.removeAttribute('hidden');
        updateCartSummary();
        if (cartPhoneInput && !cartPhoneInput.value) {
          cartPhoneInput.value = PHONE_PREFIX;
        }
      } else {
        cartForm.setAttribute('hidden', 'hidden');
        resetCheckoutForm(true);
      }
    }

    syncCardStates();
    syncModalStates();
    saveCart();
  }

  function upsertCartItem(product, payload) {
    const variant = payload.variant === 'sample' ? 'sample' : 'pack';
    const quantity = Number(payload.quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return null;
    }

    const rawFlavors = Array.isArray(payload.flavors) ? payload.flavors : [];
    const normalizedFlavors = Array.from(
      new Set(
        rawFlavors
          .filter((value) => typeof value === 'string' && value)
          .map((value) => value.trim())
      )
    );
    const filteredFlavors = product.flavors.length
      ? normalizedFlavors.filter((value) => product.flavors.includes(value))
      : [];
    const flavors = filteredFlavors.slice().sort();
    const key = cartKey(product.id, variant, flavors);
    const pricePerUnit = variant === 'sample' ? product.samplePrice : product.packPrice;

    if (cart.has(key)) {
      const existing = cart.get(key);
      const baseQuantity = Number(existing.quantity || 0);
      const nextQuantity = Number.isFinite(baseQuantity) ? baseQuantity + quantity : quantity;
      existing.quantity = nextQuantity;
      if (typeof pricePerUnit === 'number') {
        existing.pricePerUnit = pricePerUnit;
        existing.totalPrice = nextQuantity * pricePerUnit;
      } else {
        existing.pricePerUnit = null;
        existing.totalPrice = null;
      }
      cart.set(key, existing);
    } else {
      cart.set(key, {
        key,
        productId: product.id,
        name: product.name,
        variant,
        flavors,
        quantity,
        pricePerUnit: typeof pricePerUnit === 'number' ? pricePerUnit : null,
        totalPrice: typeof pricePerUnit === 'number' ? pricePerUnit * quantity : null,
      });
    }

    return key;
  }

  function addToCart(product, payload, options = {}) {
    const { silent = false } = options;
    const key = upsertCartItem(product, payload);
    if (!key) {
      return;
    }

    renderCart();
    if (!silent) {
      flashTrigger(product);
      openCart();
      showCartStatus('Добавили набор в корзину.');
    }
  }

  function changeCartQuantity(key, delta) {
    const item = cart.get(key);
    if (!item) {
      return;
    }
    const currentQuantity = Number(item.quantity || 0);
    const step = Number(delta);
    if (!Number.isFinite(currentQuantity) || !Number.isFinite(step) || step === 0) {
      return;
    }
    const nextQuantity = currentQuantity + step;
    if (nextQuantity <= 0) {
      removeFromCart(key);
      return;
    }
    const product = catalog.get(item.productId);
    item.quantity = nextQuantity;
    if (typeof item.pricePerUnit === 'number') {
      item.totalPrice = item.pricePerUnit * nextQuantity;
    }
    cart.set(key, item);
    if (product) {
      clearTriggerHighlight(product.id);
      applyTriggerDefault(product);
    }
    renderCart();
  }

  function removeFromCart(key) {
    const item = cart.get(key);
    if (!item) {
      return;
    }
    const product = catalog.get(item.productId);
    cart.delete(key);
    if (product) {
      clearTriggerHighlight(product.id);
      applyTriggerDefault(product);
    }
    renderCart();
  }

  function handleCartControl(action, key) {
    if (!key) {
      return;
    }
    if (action === 'increment') {
      changeCartQuantity(key, 1);
    } else if (action === 'decrement') {
      changeCartQuantity(key, -1);
    } else if (action === 'remove') {
      removeFromCart(key);
    }
  }

  function resetCart() {
    cart.clear();
    renderCart();
    resetCheckoutForm(true);
    if (cartForm) {
      cartForm.setAttribute('hidden', 'hidden');
    }
  }

  function updateDeliveryControls() {
    if (!cartDeliveryToggle) {
      return;
    }
    const deliverNow = cartDeliveryToggle.checked;
    if (cartDeliveryTimeWrapper) {
      if (deliverNow) {
        cartDeliveryTimeWrapper.classList.add('disabled');
      } else {
        cartDeliveryTimeWrapper.classList.remove('disabled');
      }
    }
    if (cartDeliveryDateInput) {
      cartDeliveryDateInput.disabled = deliverNow;
      cartDeliveryDateInput.required = !deliverNow;
      if (deliverNow) {
        cartDeliveryDateInput.value = '';
      }
    }
    if (cartDeliveryTimeInput) {
      cartDeliveryTimeInput.disabled = deliverNow;
      cartDeliveryTimeInput.required = !deliverNow;
      if (deliverNow) {
        cartDeliveryTimeInput.value = '';
      }
    }
    if (cartDeliveryCaption) {
      if (!deliverNow) {
        cartDeliveryCaption.classList.add('is-inactive');
      } else {
        cartDeliveryCaption.classList.remove('is-inactive');
      }
    }
  }

  if (cartDeliveryToggle) {
    cartDeliveryToggle.addEventListener('change', updateDeliveryControls);
  }
  updateDeliveryControls();

  function isCartOpen() {
    return cartPanel ? !cartPanel.hasAttribute('hidden') : false;
  }

  function openCart() {
    if (cartPanel) {
      cartPanel.removeAttribute('hidden');
      cartPanel.setAttribute('aria-hidden', 'false');
    }
    if (cartOverlay) {
      cartOverlay.removeAttribute('hidden');
    }
    if (cartToggle) {
      cartToggle.setAttribute('aria-expanded', 'true');
    }
    if (document.body && document.body.classList) {
      document.body.classList.add('no-scroll');
    }
  }

  function closeCart() {
    if (cartPanel) {
      cartPanel.setAttribute('hidden', 'hidden');
      cartPanel.setAttribute('aria-hidden', 'true');
    }
    if (cartOverlay) {
      cartOverlay.setAttribute('hidden', 'hidden');
    }
    if (cartToggle) {
      cartToggle.setAttribute('aria-expanded', 'false');
    }
    if (document.body && document.body.classList) {
      document.body.classList.remove('no-scroll');
    }
  }

  if (cartItemsEl) {
    cartItemsEl.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const action = target.dataset.cartAction;
      if (!action) {
        return;
      }
      const key = target.dataset.cartKey;
      if (!key) {
        return;
      }
      event.preventDefault();
      handleCartControl(action, key);
    });
  }

  if (cartToggle) {
    cartToggle.addEventListener('click', (event) => {
      event.preventDefault();
      if (isCartOpen()) {
        closeCart();
      } else {
        if (cart.size === 0) {
          showCartStatus('Добавьте наборы в корзину.');
        }
        openCart();
      }
    });
  }
  if (cartClose) {
    cartClose.addEventListener('click', closeCart);
  }
  if (cartOverlay) {
    cartOverlay.addEventListener('click', closeCart);
  }

  function openProductModal(productId) {
    const product = catalog.get(productId);
    if (!product) {
      return;
    }
    if (!modalRoot) {
      addToCart(product, { variant: 'pack', quantity: 1, flavors: [] });
      return;
    }
    activeProduct = product;
    clearModalOrderFeedback();
    modalRoot.removeAttribute('hidden');
    modalRoot.setAttribute('aria-hidden', 'false');
    if (document.body && document.body.classList) {
      document.body.classList.add('no-scroll');
    }

    if (modalMessage) {
      modalMessage.textContent = '';
    }
    if (modalTitle) {
      modalTitle.textContent = product.name;
    }
    if (modalSubtitle) {
      const flavorInfo = product.flavors.length
        ? `Доступно вкусов: ${product.flavors.length}`
        : 'Без выбора вкусов';
      const priceInfo = typeof product.packPrice === 'number'
        ? `Пачка — ${product.packPrice.toLocaleString('ru-RU')}${CURRENCY}`
        : '';
      modalSubtitle.textContent = [flavorInfo, priceInfo].filter(Boolean).join(SEPARATOR);
    }
    if (modalFlavors) {
      modalFlavors.innerHTML = '';
      const hasFlavors = product.flavors.length > 0;
      if (hasFlavors) {
        product.flavors.forEach((flavor) => {
          const row = document.createElement('div');
          row.className = 'product-modal__flavor-row flavor-card';
          row.dataset.flavor = flavor;
          row.dataset.quantity = '0';

          const name = document.createElement('span');
          name.className = 'product-modal__flavor-name flavor-title';
          name.textContent = flavor;

          const controls = document.createElement('div');
          controls.className = 'product-modal__flavor-controls cart-qty';

          const minusBtn = document.createElement('button');
          minusBtn.type = 'button';
          minusBtn.className = 'cart-qty-btn';
          minusBtn.textContent = '-';
          minusBtn.setAttribute('aria-label', `Уменьшить количество вкуса ${flavor}`);

          const qtyValue = document.createElement('span');
          qtyValue.className = 'cart-qty-value';

          const plusBtn = document.createElement('button');
          plusBtn.type = 'button';
          plusBtn.className = 'cart-qty-btn';
          plusBtn.textContent = '+';
          plusBtn.setAttribute('aria-label', `Увеличить количество вкуса ${flavor}`);

          const setQty = (next, options = {}) => {
            const value = Math.max(0, next);
            row.dataset.quantity = String(value);
            qtyValue.textContent = String(value);
            minusBtn.disabled = value === 0;
            if (!options.silent) {
              clearModalOrderFeedback();
            }
          };

          minusBtn.addEventListener('click', () => setQty(Number(row.dataset.quantity || '0') - 1));
          plusBtn.addEventListener('click', () => setQty(Number(row.dataset.quantity || '0') + 1));

          setQty(Number(row.dataset.quantity || '0'), { silent: true });

          controls.appendChild(minusBtn);
          controls.appendChild(qtyValue);
          controls.appendChild(plusBtn);

          row.appendChild(name);
          row.appendChild(controls);

          if (product.allowSample) {
            const sampleWrapper = document.createElement('div');
            sampleWrapper.className = 'product-modal__flavor-sample';

            const sampleBtn = document.createElement('button');
            sampleBtn.type = 'button';
            sampleBtn.className = 'btn-sample-row product-modal__sample';
            sampleBtn.textContent = SAMPLE_ORDER_LABEL;
            sampleBtn.dataset.flavor = flavor;

            sampleBtn.addEventListener('click', () => {
              addToCart(product, { variant: 'sample', quantity: 1, flavors: [flavor] });
              syncModalStates();
            });

            sampleWrapper.appendChild(sampleBtn);
            row.appendChild(sampleWrapper);
          }

          modalFlavors.appendChild(row);
        });
      } else {
        const note = document.createElement('p');
        note.className = 'product-modal__note';
        note.textContent = 'Для этого товара выбор вкусов не требуется.';
        modalFlavors.appendChild(note);
      }
    }

    modalVariantButtons.forEach((button) => {
      const variant = button.dataset.variant;
      if (variant === 'sample') {
        if (product.flavors.length > 0) {
          button.style.display = 'none';
        } else {
          button.style.display = '';
        }
        setButtonDisabled(button, !product.allowSample);
      } else {
        button.style.display = '';
        setButtonDisabled(button, false);
      }
    });

    syncModalStates();
    requestAnimationFrame(() => {
      const focusTarget = modalDialog ? modalDialog.querySelector('input, button') : null;
      if (focusTarget && typeof focusTarget.focus === 'function') {
        try {
          focusTarget.focus({ preventScroll: true });
        } catch (error) {
          focusTarget.focus();
        }
      }
    });
  }

  function closeProductModal() {
    if (!modalRoot) {
      return;
    }
    modalRoot.setAttribute('hidden', 'hidden');
    modalRoot.setAttribute('aria-hidden', 'true');
    if (document.body && document.body.classList) {
      document.body.classList.remove('no-scroll');
    }
    clearModalOrderFeedback();
    activeProduct = null;
    if (modalMessage) {
      modalMessage.textContent = '';
    }
  }

  function collectModalSelection() {
    if (!activeProduct) {
      return null;
    }
    const hasFlavors = activeProduct.flavors.length > 0;
    if (hasFlavors) {
      const rows = modalFlavors ? Array.from(modalFlavors.querySelectorAll('.product-modal__flavor-row')) : [];
      const selections = rows
        .map((row) => {
          const qty = Number(row.dataset.quantity || '0');
          if (qty <= 0) {
            return null;
          }
          const flavor = row.dataset.flavor || null;
          return { quantity: qty, flavors: flavor ? [flavor] : [] };
        })
        .filter(Boolean);
      if (!selections.length) {
        if (modalMessage) {
          modalMessage.textContent = 'Выберите хотя бы один вкус.';
        }
        return null;
      }
      if (modalMessage) {
        modalMessage.textContent = '';
      }
      return selections;
    }

    if (modalMessage) {
      modalMessage.textContent = '';
    }
    return [{ quantity: 1, flavors: [] }];
  }

  modalVariantButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (!activeProduct) {
        return;
      }
      const variant = button.dataset.variant === 'sample' ? 'sample' : 'pack';
      const selections = collectModalSelection();
      if (!selections) {
        return;
      }
      selections.forEach((payload) => {
        addToCart(activeProduct, { variant, quantity: payload.quantity, flavors: payload.flavors });
      });
      if (variant !== 'sample') {
        flashModalOrderFeedback(button);
      }
    });
  });

  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', closeProductModal);
  }
  modalCloseButtons.forEach((btn) => btn.addEventListener('click', closeProductModal));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (isCartOpen()) {
        closeCart();
      }
      if (modalRoot && !modalRoot.hasAttribute('hidden')) {
        closeProductModal();
      }
    }
  });

  if (cartForm) {
    cartForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!cart.size) {
        showCartStatus('Корзина пустая.');
        return;
      }
      if (!cartForm.reportValidity()) {
        return;
      }

      const name = readInput(cartNameInput);
      const phone = readInput(cartPhoneInput);
      const address = readInput(cartAddressInput);
      const deliverNow = cartDeliveryToggle ? cartDeliveryToggle.checked !== false : true;
      const deliverDate = readInput(cartDeliveryDateInput);
      const deliverTime = readInput(cartDeliveryTimeInput);

      if (!name) {
        if (cartNameInput && typeof cartNameInput.focus === 'function') {
          cartNameInput.focus();
        }
        showCartStatus('Введите ваше имя.');
        return;
      }

      if (!PHONE_RE.test(phone)) {
        if (cartPhoneInput && typeof cartPhoneInput.focus === 'function') {
          cartPhoneInput.focus();
        }
        showCartStatus('Введите номер в формате +996XXXXXXXXX.');
        return;
      }

      const noteParts = [];
      const orderLines = buildCartNote();
      if (orderLines) {
        noteParts.push('Заказ:');
        noteParts.push(orderLines);
      }
      if (address) {
        noteParts.push(`Адрес: ${address}`);
      }
      if (deliverNow) {
        noteParts.push('Доставка: сейчас');
      } else if (deliverDate || deliverTime) {
        noteParts.push(`Доставка: ${[deliverDate, deliverTime].filter(Boolean).join(' ')}`);
      }

      try {
        showCartStatus('Отправляем заказ...');
        if (cartSubmitBtn) {
          cartSubmitBtn.disabled = true;
        }
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            phone,
            note: noteParts.join('\n') || null,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const detail = err.error || err.detail || res.status;
          showCartStatus(`Ошибка: ${detail}`);
          return;
        }
        resetCart();
        showCartStatus('Заказ отправлен. Мы свяжемся с вами.');
      } catch (error) {
        showCartStatus('Не удалось отправить заказ. Попробуйте ещё раз.');
      } finally {
        if (cartSubmitBtn) {
          cartSubmitBtn.disabled = cart.size === 0;
        }
      }
    });
  }

  renderCart();
})();
