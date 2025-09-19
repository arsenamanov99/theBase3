from pathlib import Path

new_js = """// ===== Анимация чашек (центр под словом \"Бишкек\") =====
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
  document.fonts?.ready?.then(start);
  new ResizeObserver(start).observe(lane);

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

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
      return;
    }

    const name = nameInput?.value.trim() || '';
    const phone = phoneInput?.value.trim() || '';
    const address = addressInput?.value.trim() || '';
    const time = timeInput?.value.trim() || '';
    const note = noteInput?.value.trim() || '';

    if (!PHONE_RE.test(phone)) {
      showStatus('Введите номер в формате +996XXXXXXXXX.');
      phoneInput?.focus();
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
          note: noteParts.join('\\n') || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showStatus(`Ошибка: ${err.error || err.detail || res.status}`);
        return;
      }
      form.reset();
      showStatus('Спасибо! Мы свяжемся с вами.');
    } catch {
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

  const modalRoot = document.getElementById('product-modal');
  const modalDialog = modalRoot?.querySelector('.product-modal__dialog');
  const modalBackdrop = modalRoot?.querySelector('.product-modal__backdrop');
  const modalTitle = document.getElementById('product-modal-title');
  const modalSubtitle = document.getElementById('product-modal-subtitle');
  const modalFlavors = document.getElementById('product-modal-flavors');
  const modalMessage = document.getElementById('product-modal-message');
  const modalVariantButtons = Array.from(modalRoot?.querySelectorAll('[data-variant]') ?? []);
  const modalCloseButtons = Array.from(modalRoot?.querySelectorAll('[data-action="close-product-modal"]') ?? []);
  const modalQuantitySection = document.getElementById('product-modal-quantity')?.closest('.product-modal__section');

  if (!cartPanel || !cartToggle || !cartItemsEl) {
    return;
  }

  if (modalQuantitySection) {
    modalQuantitySection.setAttribute('hidden', 'hidden');
  }

  const PHONE_PREFIX = '+996';
  const PHONE_RE = /^\+996\d{9}$/;
  const SEPARATOR = ' · ';
  const CURRENCY = ' сом';

  const cards = Array.from(document.querySelectorAll('.card'));
  const decoder = document.createElement('textarea');
  const catalog = new Map();

  cards.forEach((card) => {
    const name = card.querySelector('h3')?.textContent?.trim();
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
    const defaultLabel = trigger?.textContent?.trim() ?? '';
    const inCartLabel = trigger?.dataset.inCartLabel || 'В корзине';

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

    if (trigger) {
      trigger.dataset.productId = productId;
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        openProductModal(productId);
      });
    }
  });

  const cart = new Map();
  let activeProduct = null;

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
        } catch {
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
      const selectionStart = input.selectionStart ?? 0;
      const selectionEnd = input.selectionEnd ?? 0;
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
      const pasted = event.clipboardData?.getData('text') ?? '';
      const digits = pasted.replace(/\D/g, '');
      const suffix = digits.startsWith('996') ? digits.slice(3) : digits;
      input.value = PHONE_PREFIX + suffix.slice(0, 9);
      requestAnimationFrame(() => {
        const len = input.value.length;
        try {
          input.setSelectionRange(len, len);
        } catch {
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

  function syncCardStates() {
    const inCart = new Set();
    cart.forEach((item) => inCart.add(item.productId));
    catalog.forEach((product) => {
      const trigger = product.trigger;
      if (!trigger) {
        return;
      }
      if (inCart.has(product.id)) {
        trigger.classList.add('in-cart');
        trigger.setAttribute('aria-disabled', 'true');
        trigger.textContent = product.inCartLabel;
      } else {
        trigger.classList.remove('in-cart');
        trigger.removeAttribute('aria-disabled');
        trigger.textContent = product.defaultLabel;
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
      if (item.quantity > 1) {
        parts.push(`×${item.quantity}`);
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
    parts.push(`×${item.quantity}`);
    return parts.join(SEPARATOR);
  }

  function buildCartNote() {
    const lines = [];
    cart.forEach((item) => {
      const price = formatPrice(item.totalPrice);
      lines.push(`${item.name} — ${buildCartLine(item)}${price !== '—' ? `${SEPARATOR}${price}` : ''}`);
    });
    return lines.join('\\n');
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

  function renderCart() {
    if (!cartItemsEl) {
      return;
    }
    cartItemsEl.innerHTML = '';
    renderChips();

    const groups = new Map();
    cart.forEach((item, key) => {
      const list = groups.get(item.productId);
      if (list) {
        list.push({ key, item });
      } else {
        groups.set(item.productId, [{ key, item }]);
      }
    });

    if (!groups.size) {
      const empty = document.createElement('p');
      empty.className = 'cart-empty';
      empty.textContent = 'Корзина пустая';
      cartItemsEl.appendChild(empty);
    } else {
      groups.forEach((entries) => {
        const groupEl = document.createElement('div');
        groupEl.className = 'cart-item-group';

        const header = document.createElement('div');
        header.className = 'cart-item-group__header';

        const title = document.createElement('span');
        title.className = 'cart-item-group__title';
        title.textContent = entries[0].item.name;

        const totalValue = entries.reduce((sum, entry) => {
          const value = entry.item.totalPrice;
          return sum + (typeof value === 'number' ? value : 0);
        }, 0);
        const totalEl = document.createElement('span');
        totalEl.className = 'cart-item-group__total';
        totalEl.textContent = totalValue > 0 ? `${totalValue.toLocaleString('ru-RU')}${CURRENCY}` : '';

        header.appendChild(title);
        header.appendChild(totalEl);
        groupEl.appendChild(header);

        const lines = document.createElement('div');
        lines.className = 'cart-item-group__lines';

        entries.forEach(({ key, item }) => {
          const line = document.createElement('div');
          line.className = 'cart-item-line';
          line.dataset.cartKey = key;

          const info = document.createElement('div');
          info.className = 'cart-item-line__info';
          info.textContent = buildCartLine(item);

          const controls = document.createElement('div');
          controls.className = 'cart-item-line__controls';

          const baseLabel = item.flavors.length ? `${item.name} (${item.flavors.join(', ')})` : item.name;

          const minusBtn = document.createElement('button');
          minusBtn.type = 'button';
          minusBtn.className = 'cart-qty-btn';
          minusBtn.textContent = '-';
          minusBtn.setAttribute('aria-label', `Уменьшить количество ${baseLabel}`);
          minusBtn.disabled = item.quantity <= 1;
          minusBtn.addEventListener('click', () => changeCartQuantity(key, -1));

          const qtyValue = document.createElement('span');
          qtyValue.className = 'cart-qty-value';
          qtyValue.textContent = String(item.quantity);

          const plusBtn = document.createElement('button');
          plusBtn.type = 'button';
          plusBtn.className = 'cart-qty-btn';
          plusBtn.textContent = '+';
          plusBtn.setAttribute('aria-label', `Увеличить количество ${baseLabel}`);
          plusBtn.addEventListener('click', () => changeCartQuantity(key, 1));

          controls.appendChild(minusBtn);
          controls.appendChild(qtyValue);
          controls.appendChild(plusBtn);

          const price = document.createElement('div');
          price.className = 'cart-item-line__price';
          price.textContent = formatPrice(item.totalPrice);

          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'cart-item-remove';
          removeBtn.textContent = '×';
          removeBtn.setAttribute('aria-label', `Убрать ${baseLabel} из корзины`);
          removeBtn.addEventListener('click', () => removeFromCart(key));

          line.appendChild(info);
          line.appendChild(controls);
          line.appendChild(price);
          line.appendChild(removeBtn);

          lines.appendChild(line);
        });

        groupEl.appendChild(lines);
        cartItemsEl.appendChild(groupEl);
      });
    }

    const totalCount = Array.from(cart.values()).reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = Array.from(cart.values()).reduce((sum, item) => {
      const value = item.totalPrice;
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);

    if (cartCountEl) {
      cartCountEl.textContent = String(totalCount);
    }
    if (cartToggle) {
      cartToggle.classList.toggle('has-items', totalCount > 0);
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
  }

  function addToCart(product, payload) {
    const flavors = payload.flavors.slice().sort();
    const key = cartKey(product.id, payload.variant, flavors);
    const pricePerUnit = payload.variant === 'sample' ? product.samplePrice : product.packPrice;

    if (cart.has(key)) {
      const existing = cart.get(key);
      existing.quantity += payload.quantity;
      existing.totalPrice = typeof pricePerUnit === 'number' ? existing.quantity * pricePerUnit : null;
      cart.set(key, existing);
    } else {
      cart.set(key, {
        key,
        productId: product.id,
        name: product.name,
        variant: payload.variant,
        flavors,
        quantity: payload.quantity,
        pricePerUnit: typeof pricePerUnit === 'number' ? pricePerUnit : null,
        totalPrice: typeof pricePerUnit === 'number' ? pricePerUnit * payload.quantity : null,
      });
    }

    renderCart();
    openCart();
    showCartStatus('Добавили набор в корзину.');
  }

  function changeCartQuantity(key, delta) {
    const item = cart.get(key);
    if (!item) {
      return;
    }
    const nextQuantity = item.quantity + delta;
    if (nextQuantity <= 0) {
      removeFromCart(key);
      return;
    }
    item.quantity = nextQuantity;
    if (typeof item.pricePerUnit === 'number') {
      item.totalPrice = item.pricePerUnit * nextQuantity;
    }
    cart.set(key, item);
    renderCart();
  }

  function removeFromCart(key) {
    if (!cart.has(key)) {
      return;
    }
    cart.delete(key);
    renderCart();
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
    cartDeliveryTimeWrapper?.classList.toggle('disabled', deliverNow);
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
    cartDeliveryCaption?.classList.toggle('is-inactive', !deliverNow);
  }

  cartDeliveryToggle?.addEventListener('change', updateDeliveryControls);
  updateDeliveryControls();

  function isCartOpen() {
    return cartPanel ? !cartPanel.hasAttribute('hidden') : false;
  }

  function openCart() {
    cartPanel?.removeAttribute('hidden');
    cartPanel?.setAttribute('aria-hidden', 'false');
    cartOverlay?.removeAttribute('hidden');
    cartToggle?.setAttribute('aria-expanded', 'true');
    document.body?.classList.add('no-scroll');
  }

  function closeCart() {
    cartPanel?.setAttribute('hidden', 'hidden');
    cartPanel?.setAttribute('aria-hidden', 'true');
    cartOverlay?.setAttribute('hidden', 'hidden');
    cartToggle?.setAttribute('aria-expanded', 'false');
    document.body?.classList.remove('no-scroll');
  }

  cartToggle?.addEventListener('click', (event) => {
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
  cartClose?.addEventListener('click', closeCart);
  cartOverlay?.addEventListener('click', closeCart);

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
    modalRoot.removeAttribute('hidden');
    modalRoot.setAttribute('aria-hidden', 'false');
    document.body?.classList.add('no-scroll');

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
        product.flavors.forEach((flavor, index) => {
          const row = document.createElement('div');
          row.className = 'product-modal__flavor-row';
          row.dataset.flavor = flavor;
          row.dataset.quantity = String(index === 0 ? 1 : 0);

          const name = document.createElement('span');
          name.className = 'product-modal__flavor-name';
          name.textContent = flavor;

          const controls = document.createElement('div');
          controls.className = 'product-modal__flavor-controls';

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

          const setQty = (next) => {
            const value = Math.max(0, next);
            row.dataset.quantity = String(value);
            qtyValue.textContent = String(value);
            minusBtn.disabled = value === 0;
          };

          minusBtn.addEventListener('click', () => setQty(Number(row.dataset.quantity || '0') - 1));
          plusBtn.addEventListener('click', () => setQty(Number(row.dataset.quantity || '0') + 1));

          setQty(Number(row.dataset.quantity || '0'));

          controls.appendChild(minусBtn);
          controls.appendChild(qtyValue);
          controls.appendChild(plusBtn);

          row.appendChild(name);
          row.appendChild(controls);
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
      if (variant === 'sample' && !product.allowSample) {
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
      } else {
        button.disabled = false;
        button.removeAttribute('aria-disabled');
      }
    });

    requestAnimationFrame(() => {
      const focusTarget = modalDialog?.querySelector('input, button');
      focusTarget?.focus({ preventScroll: true });
    });
  }

  function closeProductModal() {
    if (!modalRoot) {
      return;
    }
    modalRoot.setAttribute('hidden', 'hidden');
    modalRoot.setAttribute('aria-hidden', 'true');
    document.body?.classList.remove('no-scroll');
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
      closeProductModal();
    });
  });

  modalBackdrop?.addEventListener('click', closeProductModal);
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

  cartForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!cart.size) {
      showCartStatus('Корзина пустая.');
      return;
    }
    if (!cartForm.reportValidity()) {
      return;
    }

    const name = cartNameInput?.value.trim() || '';
    const phone = cartPhoneInput?.value.trim() || '';
    const address = cartAddressInput?.value.trim() || '';
    const deliverNow = cartDeliveryToggle?.checked !== false;
    const deliverDate = cartDeliveryDateInput?.value.trim() || '';
    const deliverTime = cartDeliveryTimeInput?.value.trim() || '';

    if (!name) {
      cartNameInput?.focus();
      showCartStatus('Введите ваше имя.');
      return;
    }

    if (!PHONE_RE.test(phone)) {
      cartPhoneInput?.focus();
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
          note: noteParts.join('\\n') || null,
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
    } catch {
      showCartStatus('Не удалось отправить заказ. Попробуйте ещё раз.');
    } finally {
      if (cartSubmitBtn) {
        cartSubmitBtn.disabled = cart.size === 0;
      }
    }
  });

  renderCart();
})();
"""

Path('static/main.js').write_text(new_js, encoding='utf-8')
