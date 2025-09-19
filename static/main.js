// ===== Cup Animation =====
(() => {
  const lane = document.querySelector('.lane');
  const path = document.querySelector('.path');
  const cups = document.querySelectorAll('.cup');
  if (!lane || !path || !cups.length) {
    return;
  }

  const PAD = 8;
  let animations = [];

  function layout() {
    const cities = lane.querySelectorAll('.city');
    if (cities.length < 2) {
      return 0;
    }
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

    const route = path.querySelector('svg.route');
    if (route) {
      route.setAttribute('viewBox', `0 0 ${Math.max(100, Math.round(widthRaw + PAD * 2))} 30`);
    }

    const line = path.querySelector('line');
    if (line) {
      line.setAttribute('x1', PAD);
      line.setAttribute('x2', Math.round(widthRaw + PAD));
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
    const duration = 3584;
    const step = duration / cups.length;
    const fadePad = 20;

    animations.forEach((anim) => anim.cancel());
    animations = [];

    cups.forEach((cup, index) => {
      cup.style.opacity = '1';
      const anim = cup.animate(
        [
          { transform: 'translate(-18px,-50%) translateX(0)', opacity: 0 },
          { offset: 0.12, transform: `translate(-18px,-50%) translateX(${fadePad}px)`, opacity: 1 },
          { offset: 0.88, transform: `translate(-18px,-50%) translateX(${Math.max(0, travel - fadePad)}px)`, opacity: 1 },
          { transform: `translate(-18px,-50%) translateX(${travel}px)`, opacity: 0 },
        ],
        {
          duration,
          delay: index * step,
          iterations: Infinity,
          easing: 'linear',
          fill: 'both',
        },
      );
      animations.push(anim);
    });
  }

  let retries = 0;
  function start() {
    const width = layout();
    if (width <= 0 && retries < 20) {
      retries += 1;
      setTimeout(start, 60);
      return;
    }
    if (width > 0) {
      animate(width);
    }
  }

  if (document.readyState !== 'complete') {
    window.addEventListener('load', start);
  } else {
    start();
  }
  document.fonts?.ready?.then(start);
  new ResizeObserver(start).observe(lane);

  const pauseAll = () => animations.forEach((anim) => anim.pause());
  const playAll = () => animations.forEach((anim) => anim.play());

  path.addEventListener('mouseenter', pauseAll);
  path.addEventListener('mouseleave', playAll);
  path.addEventListener(
    'touchstart',
    () => {
      pauseAll();
      setTimeout(playAll, 1200);
    },
    { passive: true },
  );
})();

// ===== Lead Form =====
(() => {
  const form = document.getElementById('lead-form');
  const status = document.getElementById('form-status');
  const productSelect = document.getElementById('product-select');
  const chips = document.getElementById('product-chips');
  if (!form || !productSelect || !chips) {
    return;
  }

  const PHONE_RE = /^(?:\+996\d{9}|0\d{9})$/;
  const MAX_PRODUCTS = 6;
  const chosen = new Set();

  const cards = Array.from(document.querySelectorAll('.cards .card'));
  const productNames = cards
    .map((card) => card.querySelector('h3')?.textContent?.trim())
    .filter(Boolean);

  productSelect.innerHTML =
    '<option value="" disabled selected>Выберите товар</option>' +
    productNames.map((name) => `<option value="${name.replace(/"/g, '&quot;')}">${name}</option>`).join('');

  function renderChips() {
    chips.innerHTML = '';
    chosen.forEach((name) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = name;
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'chip-x';
      removeBtn.textContent = '';
      chip.appendChild(removeBtn);
      chips.appendChild(chip);
    });
  }

  function markCard(name, inCart) {
    const card = cards.find((item) => item.querySelector('h3')?.textContent?.trim() === name);
    if (!card) {
      return;
    }
    const cta = card.querySelector('.cta');
    if (!cta) {
      return;
    }
    if (inCart) {
      cta.classList.add('in-cart');
      cta.setAttribute('aria-disabled', 'true');
      cta.textContent = 'Уже в корзине';
    } else {
      cta.classList.remove('in-cart');
      cta.removeAttribute('aria-disabled');
      cta.textContent = 'Заказать бесплатный образец';
    }
  }

  function addProduct(name) {
    if (!name || chosen.has(name) || chosen.size >= MAX_PRODUCTS) {
      return;
    }
    chosen.add(name);
    renderChips();
    markCard(name, true);
    productSelect.value = '';
  }

  function removeProduct(name) {
    if (!chosen.has(name)) {
      return;
    }
    chosen.delete(name);
    renderChips();
    markCard(name, false);
  }

  productSelect.addEventListener('change', () => addProduct(productSelect.value));

  cards.forEach((card) => {
    const cta = card.querySelector('.cta');
    const name = card.querySelector('h3')?.textContent?.trim();
    if (!cta || !name) {
      return;
    }
    cta.addEventListener('click', (event) => {
      event.preventDefault();
      addProduct(name);
    });
  });

  function showStatus(message) {
    if (status) {
      status.textContent = message;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
      return;
    }

    const name = (document.getElementById('name')?.value || '').trim();
    const phone = (document.getElementById('phone')?.value || '').trim();
    const place = (document.getElementById('place')?.value || '').trim();
    const message = (document.getElementById('msg')?.value || '').trim();

    if (!PHONE_RE.test(phone)) {
      showStatus('Введите номер в формате +996XXXXXXXXX.');
      document.getElementById('phone')?.focus();
      return;
    }

    const noteParts = [];
    if (chosen.size) {
      noteParts.push(`Выбранные наборы: ${Array.from(chosen).join(', ')}`);
    }
    if (place) {
      noteParts.push(`Адрес: ${place}`);
    }
    if (message) {
      noteParts.push(message);
    }

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
      chosen.forEach((item) => markCard(item, false));
      chosen.clear();
      renderChips();
      showStatus('Спасибо! Мы свяжемся с вами.');
    } catch (error) {
      showStatus('Не удалось отправить сообщение. Попробуйте позже.');
    }
  });
})();

// ===== Cart & Checkout =====
(() => {
  let cartToggle = null;
  let cartPanel = null;
  let cartOverlay = null;
  let cartClose = null;
  let cartItemsEl = null;
  let cartCountEl = null;
  let cartTotalEl = null;
  let cartSummaryEl = null;
  let cartForm = null;
  let cartNameInput = null;
  let cartPhoneInput = null;
  let cartAddressInput = null;
  let cartDeliveryToggle = null;
  let cartDeliveryDateInput = null;
  let cartDeliveryTimeInput = null;
  let cartDeliveryTimeWrapper = null;
  let cartDeliveryCaption = null;
  let cartStatus = null;
  let cartSubmitBtn = null;

  function ensureCartElements() {
    cartToggle = document.getElementById('cart-toggle') || cartToggle || null;
    cartPanel = document.getElementById('cart-panel') || cartPanel || null;
    cartOverlay = document.getElementById('cart-overlay') || cartOverlay || null;
    cartClose = document.getElementById('cart-close') || cartClose || null;
    cartItemsEl = document.getElementById('cart-items') || cartItemsEl || null;
    cartCountEl = document.getElementById('cart-count') || cartCountEl || null;
    cartTotalEl = document.getElementById('cart-total-amount') || cartTotalEl || null;
    cartSummaryEl = document.getElementById('cart-summary') || cartSummaryEl || null;
    const nextForm = document.getElementById('cart-checkout-form');
    if (nextForm && nextForm !== cartForm) {
      cartForm = nextForm;
      cartSubmitBtn = cartForm.querySelector('button[type="submit"]');
    } else if (!nextForm) {
      cartForm = null;
      cartSubmitBtn = null;
    }
    cartNameInput = document.getElementById('cart-name') || cartNameInput || null;
    cartPhoneInput = document.getElementById('cart-phone') || cartPhoneInput || null;
    cartAddressInput = document.getElementById('cart-address') || cartAddressInput || null;
    cartDeliveryToggle = document.getElementById('cart-delivery-toggle') || cartDeliveryToggle || null;
    cartDeliveryDateInput = document.getElementById('cart-delivery-date') || cartDeliveryDateInput || null;
    cartDeliveryTimeInput = document.getElementById('cart-delivery-time') || cartDeliveryTimeInput || null;
    cartDeliveryTimeWrapper = document.getElementById('cart-time-wrapper') || cartDeliveryTimeWrapper || null;
    cartDeliveryCaption = document.querySelector('.cart-delivery .toggle-caption') || cartDeliveryCaption || null;
    cartStatus = document.getElementById('cart-status') || cartStatus || null;
    if (!cartSubmitBtn && cartForm) {
      cartSubmitBtn = cartForm.querySelector('button[type="submit"]');
    }
  }

  function bindCartControls() {
    ensureCartElements();

    if (cartToggle && !cartToggle.dataset.cartToggleBound) {
      cartToggle.addEventListener('click', onCartToggleClick);
      cartToggle.dataset.cartToggleBound = 'true';
    }

    if (cartClose && !cartClose.dataset.cartCloseBound) {
      cartClose.addEventListener('click', closeCart);
      cartClose.dataset.cartCloseBound = 'true';
    }

    if (cartOverlay && !cartOverlay.dataset.cartOverlayBound) {
      cartOverlay.addEventListener('click', closeCart);
      cartOverlay.dataset.cartOverlayBound = 'true';
    }

    if (cartSummaryEl && !cartSummaryEl.dataset.cartSummaryBound) {
      cartSummaryEl.addEventListener('click', onCartSummaryClick);
      cartSummaryEl.dataset.cartSummaryBound = 'true';
    }

    if (cartItemsEl && !cartItemsEl.dataset.cartItemsBound) {
      cartItemsEl.addEventListener('click', onCartItemsClick);
      cartItemsEl.dataset.cartItemsBound = 'true';
    }

    if (cartDeliveryToggle && !cartDeliveryToggle.dataset.cartDeliveryBound) {
      cartDeliveryToggle.addEventListener('change', updateDeliveryControls);
      cartDeliveryToggle.dataset.cartDeliveryBound = 'true';
    }

    if (cartForm && !cartForm.dataset.cartFormBound) {
      cartForm.addEventListener('submit', onCartFormSubmit);
      cartForm.dataset.cartFormBound = 'true';
    }

    if (cartPhoneInput && !cartPhoneInput.dataset.cartMaskBound) {
      attachPhoneMask(cartPhoneInput);
      cartPhoneInput.dataset.cartMaskBound = 'true';
    }
  }

  let modalRoot = null;
  let modalDialog = null;
  let modalBackdrop = null;
  let modalTitle = null;
  let modalSubtitle = null;
  let modalFlavors = null;
  let modalMessage = null;
  let modalVariantButtons = [];
  let modalCloseButtons = [];
  let modalQuantitySection = null;
  let modalHandlersBound = false;

  function ensureModalElements() {
    const root = document.getElementById('product-modal');
    if (!root) {
      modalRoot = null;
      modalDialog = null;
      modalBackdrop = null;
      modalTitle = null;
      modalSubtitle = null;
      modalFlavors = null;
      modalMessage = null;
      modalVariantButtons = [];
      modalCloseButtons = [];
      modalQuantitySection = null;
      modalHandlersBound = false;
      return null;
    }

    if (root !== modalRoot) {
      modalHandlersBound = false;
    }

    modalRoot = root;
    modalDialog = modalRoot.querySelector('.product-modal__dialog');
    modalBackdrop = modalRoot.querySelector('.product-modal__backdrop');
    modalTitle = document.getElementById('product-modal-title');
    modalSubtitle = document.getElementById('product-modal-subtitle');
    modalFlavors = document.getElementById('product-modal-flavors');
    modalMessage = document.getElementById('product-modal-message');
    modalVariantButtons = Array.from(modalRoot.querySelectorAll('[data-variant]'));
    modalCloseButtons = Array.from(modalRoot.querySelectorAll('[data-action="close-product-modal"]'));
    modalQuantitySection = document.getElementById('product-modal-quantity')?.closest('.product-modal__section') || null;

    if (!modalHandlersBound) {
      modalQuantitySection?.remove();

      modalBackdrop?.addEventListener('click', closeProductModal);
      modalCloseButtons.forEach((btn) => {
        if (!btn.dataset.modalCloseBound) {
          btn.addEventListener('click', closeProductModal);
          btn.dataset.modalCloseBound = 'true';
        }
      });

      if (!modalRoot.dataset.modalPackInterceptor) {
        modalRoot.addEventListener('click', interceptOrderPackClick, true);
        modalRoot.dataset.modalPackInterceptor = 'true';
      }

      modalVariantButtons.forEach((button) => {
        if (!button.dataset.modalVariantBound) {
          if (!button.dataset.defaultLabel) {
            button.dataset.defaultLabel = (button.textContent || '').trim();
          }
          button.addEventListener('click', onModalVariantButtonClick);
          button.dataset.modalVariantBound = 'true';
        }
      });

      modalHandlersBound = true;
    }

    return modalRoot;
  }

  ensureModalElements();

  // Order button temporary state helpers
  let orderBtnTimer = null;
  function clearOrderBtnTimer() {
    if (orderBtnTimer) {
      clearTimeout(orderBtnTimer);
      orderBtnTimer = null;
    }
  }
  function resetOrderBtn() {
    clearOrderBtnTimer();
    const root = ensureModalElements();
    const btn = root?.querySelector('[data-variant="pack"]');
    if (!btn) return;
    btn.classList.remove('btn-in-cart');
    btn.removeAttribute('aria-pressed');
    const def = btn.dataset.defaultLabel || btn.getAttribute('data-default-label') || (btn.textContent || '');
    btn.textContent = def;
  }
  function setOrderBtnInCart(btn, inCartText) {
    if (!btn) return;
    clearOrderBtnTimer();
    if (!btn.dataset.defaultLabel) {
      btn.dataset.defaultLabel = (btn.textContent || '').trim();
    }
    btn.classList.add('btn-in-cart');
    btn.setAttribute('aria-pressed', 'true');
    btn.innerHTML = `${inCartText} <span class="checkmark" aria-hidden="true">✔</span>`;
    orderBtnTimer = setTimeout(() => { resetOrderBtn(); }, 5000);
  }

  // === ORDER-PACK HELPERS START ===
  let orderPackResetTimer = null;
<<<<<<< ours

  function getOrderPackBtn() {
    const root = ensureModalElements();
    if (!root) {
      return null;
    }
    return root.querySelector('[data-action="order-pack"], .js-pack-btn, .btn-primary');
  }

  function clearOrderPackTimer() {
    if (orderPackResetTimer) {
      clearTimeout(orderPackResetTimer);
      orderPackResetTimer = null;
    }
<<<<<<< ours
  }

  function resetOrderPackButton() {
    clearOrderPackTimer();
    const btn = getOrderPackBtn();
    if (!btn) return;
    btn.classList.remove('btn-in-cart');
    btn.removeAttribute('aria-pressed');
    btn.textContent = 'Заказать пачку';
  }

  function markInCart(btn, text) {
    if (!btn) return;
    clearOrderPackTimer();
    btn.classList.add('btn-in-cart');
    btn.setAttribute('aria-pressed', 'true');
    btn.innerHTML = `${text} <span class="checkmark" aria-hidden="true">✓</span>`;
    orderPackResetTimer = setTimeout(() => {
      resetOrderPackButton();
    }, 5000);
=======
=======

  function getOrderPackBtn() {
    const root = ensureModalElements();
    if (!root) {
      return null;
    }
    return root.querySelector('[data-action="order-pack"], .js-pack-btn, .btn-primary');
  }

  function clearOrderPackTimer() {
    if (orderPackResetTimer) {
      clearTimeout(orderPackResetTimer);
      orderPackResetTimer = null;
    }
>>>>>>> theirs
  }

  function resetOrderPackButton() {
    clearOrderPackTimer();
    const btn = getOrderPackBtn();
    if (!btn) return;
    btn.classList.remove('btn-in-cart');
    btn.removeAttribute('aria-pressed');
    btn.textContent = 'Заказать пачку';
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
  }
  // === ORDER-PACK HELPERS END ===

<<<<<<< ours
<<<<<<< ours
  function interceptOrderPackClick(event) {
    return; // disabled interceptor to allow normal add-to-cart flow
    const target = event.target instanceof HTMLElement ? event.target.closest('button') : null;
    if (!target) return;

    const isOrderPack =
      target.matches('[data-action="order-pack"]') ||
      /заказать пачку/i.test((target.textContent || ''));

    if (!isOrderPack) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

=======
  function markInCart(btn, text) {
    if (!btn) return;
    clearOrderPackTimer();
    btn.classList.add('btn-in-cart');
    btn.setAttribute('aria-pressed', 'true');
    btn.innerHTML = `${text} <span class="checkmark" aria-hidden="true">✓</span>`;
    orderPackResetTimer = setTimeout(() => {
      resetOrderPackButton();
    }, 5000);
  }
  // === ORDER-PACK HELPERS END ===

  function interceptOrderPackClick(event) {
    return; // disabled interceptor to allow normal add-to-cart flow
    const target = event.target instanceof HTMLElement ? event.target.closest('button') : null;
    if (!target) return;

    const isOrderPack =
      target.matches('[data-action="order-pack"]') ||
      /заказать пачку/i.test((target.textContent || ''));

=======
  function markInCart(btn, text) {
    if (!btn) return;
    clearOrderPackTimer();
    btn.classList.add('btn-in-cart');
    btn.setAttribute('aria-pressed', 'true');
    btn.innerHTML = `${text} <span class="checkmark" aria-hidden="true">✓</span>`;
    orderPackResetTimer = setTimeout(() => {
      resetOrderPackButton();
    }, 5000);
  }
  // === ORDER-PACK HELPERS END ===

  function interceptOrderPackClick(event) {
    return; // disabled interceptor to allow normal add-to-cart flow
    const target = event.target instanceof HTMLElement ? event.target.closest('button') : null;
    if (!target) return;

    const isOrderPack =
      target.matches('[data-action="order-pack"]') ||
      /заказать пачку/i.test((target.textContent || ''));

>>>>>>> theirs
    if (!isOrderPack) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
    const flavors =
      (typeof collectSelectedFlavors === 'function' && collectSelectedFlavors()) ||
      (typeof getSelectedFlavors === 'function' && getSelectedFlavors()) ||
      null;

    if (typeof addPackToCart === 'function') {
      addPackToCart(product, flavors);
    }

    markInCart(target, 'в корзине');
  }

  // Continue initialisation even if some elements are missing at parse time

  const PHONE_PREFIX = '+996';
  const PHONE_RE = /^\+996\d{9}$/;
  const SEPARATOR = ' · ';
  const CURRENCY = ' сом';

  const cards = Array.from(document.querySelectorAll('.cards .card'));
  const decoder = document.createElement('textarea');
  const catalog = new Map();

  // === Card button temporary state helpers (outside modal) ===
  const cardBtnTimers = new Map();
  function getCardTrigger(pid) {
    const p = catalog.get(pid);
    return p?.trigger || null;
  }
  function clearCardBtnTimer(pid) {
    const t = cardBtnTimers.get(pid);
    if (t) {
      clearTimeout(t);
      cardBtnTimers.delete(pid);
    }
  }
  function resetCardBtn(pid) {
    clearCardBtnTimer(pid);
    const trigger = getCardTrigger(pid);
    if (!trigger) return;
    trigger.classList.remove('btn-in-cart', 'in-cart');
    trigger.removeAttribute('aria-pressed');
    trigger.removeAttribute('aria-disabled');
    const def = trigger.dataset.defaultLabel || (trigger.textContent || '');
    trigger.textContent = def;
  }
  function setCardBtnInCart(pid) {
    const trigger = getCardTrigger(pid);
    if (!trigger) return;
    if (!trigger.dataset.defaultLabel) {
      trigger.dataset.defaultLabel = (trigger.textContent || '').trim();
    }
    const text = trigger.dataset.inCartLabel || 'В корзине';
    trigger.classList.add('btn-in-cart');
    trigger.setAttribute('aria-pressed', 'true');
    trigger.removeAttribute('aria-disabled');
    trigger.innerHTML = `${text} <span class="checkmark" aria-hidden="true">✔</span>`;
    clearCardBtnTimer(pid);
    cardBtnTimers.set(pid, setTimeout(() => resetCardBtn(pid), 5000));
  }

  cards.forEach((card) => {
    const name = card.querySelector('h3')?.textContent?.trim();
    if (!name) {
      return;
    }
    const productId = card.dataset.productId || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (!productId) {
      return;
    }
    const rawFlavors = (() => {
      const raw = card.getAttribute('data-flavors') || '';
      decoder.innerHTML = raw;
      const decoded = decoder.value || '';
      return decoded
        .split(';')
        .map((v) => v.trim())
        .filter(Boolean);
    })();
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
  const STORAGE_KEY = 'cart.v1';

  function saveCart() {
    try {
      const data = Array.from(cart.values()).map((item) => ({
        key: item.key,
        productId: item.productId,
        name: item.name,
        variant: item.variant,
        flavors: item.flavors,
        quantity: item.quantity,
        pricePerUnit: typeof item.pricePerUnit === 'number' ? item.pricePerUnit : null,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }

  function loadCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      cart.clear();
      arr.forEach((item) => {
        const product = catalog.get(item.productId);
        const pricePerUnit = item.variant === 'sample' ? product?.samplePrice : product?.packPrice;
        const flavors = Array.isArray(item.flavors) ? item.flavors.slice().sort() : [];
        const key = cartKey(item.productId, item.variant, flavors);
        const qty = Math.max(1, Number(item.quantity || 1));
        cart.set(key, {
          key,
          productId: item.productId,
          name: item.name || product?.name || '',
          variant: item.variant,
          flavors,
          quantity: qty,
          pricePerUnit: Number.isFinite(pricePerUnit) ? pricePerUnit : (Number.isFinite(item.pricePerUnit) ? item.pricePerUnit : null),
          totalPrice: Number.isFinite(pricePerUnit) ? pricePerUnit * qty : (Number.isFinite(item.pricePerUnit) ? item.pricePerUnit * qty : null),
        });
      });
    } catch {}
  }
  let activeProduct = null;

  // Fallback global handlers in case per-element listeners fail
  document.addEventListener('click', (event) => {
    const t = event.target instanceof HTMLElement ? event.target : null;
    if (!t) return;

    // Open product modal by any element inside a trigger carrying data-product-id
    const prodBtn = t.closest('[data-product-id].open-product, .open-product');
    if (prodBtn) {
      const pid = prodBtn.getAttribute('data-product-id');
      if (pid) {
        event.preventDefault();
        openProductModal(pid);
        return;
      }
    }

    // Cart toggle (support multiple possible selectors used in header)
    const ct = t.closest('#cart-toggle, #cart-count, [aria-controls="cart-panel"], [data-action="toggle-cart"], .js-cart-toggle, .cart-toggle, .header-cart');
    if (ct) {
      event.preventDefault();
      if (isCartOpen()) { closeCart(); } else { openCart(); }
      return;
    }
  });
  function handleCartActionClick(event, container) {
    const root = container instanceof HTMLElement ? container : null;
    if (!root) {
      return;
    }
    const target = event.target instanceof HTMLElement ? event.target.closest('button') : null;
    if (!target || !root.contains(target)) {
      return;
    }
    const { cartAction, cartKey } = target.dataset;
    if (!cartKey || !cartAction) {
      return;
    }
    if (cartAction === 'increment') {
      changeCartQuantity(cartKey, 1);
    } else if (cartAction === 'decrement') {
      changeCartQuantity(cartKey, -1);
    } else if (cartAction === 'remove') {
      removeFromCart(cartKey);
    }
  }

  function onCartSummaryClick(event) {
    handleCartActionClick(event, event.currentTarget);
  }

  function onCartItemsClick(event) {
    handleCartActionClick(event, event.currentTarget);
  }

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
          // ignore
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
          // ignore
        }
      });
    });

    if (input.value) {
      normalise();
    }

    return normalise;
  }

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
    ensureCartElements();
    if (cartStatus) {
      cartStatus.textContent = message;
    }
  }

  function syncCardStates() {
    catalog.forEach((product) => {
      const trigger = product.trigger;
      if (!trigger) return;
      // Preserve temporary "in cart" state if active
      if (trigger.classList.contains('btn-in-cart')) return;
      trigger.classList.remove('in-cart');
      trigger.removeAttribute('aria-disabled');
      trigger.textContent = product.defaultLabel;
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
      removeBtn.textContent = '';
      removeBtn.setAttribute('aria-label', `Убрать ${item.name} из корзины`);
          removeBtn.dataset.cartAction = 'remove';
          removeBtn.dataset.cartKey = key;
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
      const line = `${item.name} — ${buildCartLine(item)}`;
      lines.push(price !== '—' ? `${line}${SEPARATOR}${price}` : line);
    });
    return lines.join('\n');
  }

  function updateCartSummary() {
    ensureCartElements();
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

      const controls = document.createElement('div');
      controls.className = 'cart-summary-controls';
      const minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'cart-qty-btn';
      minusBtn.textContent = '−';
      minusBtn.dataset.cartAction = 'decrement';
      minusBtn.dataset.cartKey = key;
      minusBtn.disabled = item.quantity <= 1;

      const qtyValue = document.createElement('span');
      qtyValue.className = 'cart-qty-value';
      qtyValue.textContent = String(item.quantity);

      const plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'cart-qty-btn';
      plusBtn.textContent = '+';
      plusBtn.dataset.cartAction = 'increment';
      plusBtn.dataset.cartKey = key;

      controls.appendChild(minusBtn);
      controls.appendChild(qtyValue);
      controls.appendChild(plusBtn);

      row.appendChild(header);
      row.appendChild(meta);
      row.appendChild(controls);
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'cart-item-remove';
      removeBtn.textContent = '';
      removeBtn.setAttribute('aria-label', `?????? ${item.name} ?? ???????`);
      removeBtn.addEventListener('click', () => removeFromCart(key));

      row.appendChild(removeBtn);

      cartSummaryEl.appendChild(row);
    });
  }

  function resetCheckoutForm(resetFields = false) {
    ensureCartElements();
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
    ensureCartElements();
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

        const linesContainer = document.createElement('div');
        linesContainer.className = 'cart-item-group__lines';

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
          minusBtn.textContent = '−';
          minusBtn.setAttribute('aria-label', `Уменьшить количество ${baseLabel}`);
          minusBtn.disabled = item.quantity <= 1;const qtyValue = document.createElement('span');
          qtyValue.className = 'cart-qty-value';
          qtyValue.textContent = String(item.quantity);

          const plusBtn = document.createElement('button');
          plusBtn.type = 'button';
          plusBtn.className = 'cart-qty-btn';
          plusBtn.textContent = '+';
          plusBtn.setAttribute('aria-label', `Увеличить количество ${baseLabel}`);controls.appendChild(minusBtn);
          controls.appendChild(qtyValue);
          controls.appendChild(plusBtn);

          const price = document.createElement('div');
          price.className = 'cart-item-line__price';
          price.textContent = formatPrice(item.totalPrice);

          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'cart-item-remove';
          removeBtn.textContent = '';
          removeBtn.setAttribute('aria-label', `Убрать ${baseLabel} из корзины`);
          removeBtn.dataset.cartAction = 'remove';
          removeBtn.dataset.cartKey = key;
          removeBtn.addEventListener('click', () => removeFromCart(key));

          line.appendChild(info);
          line.appendChild(controls);
          line.appendChild(price);
          line.appendChild(removeBtn);

          linesContainer.appendChild(line);
        });

        groupEl.appendChild(linesContainer);
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
    saveCart();
    openCart();
    setCardBtnInCart(product.id);
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
    saveCart();
  }

  function removeFromCart(key) {
    if (!cart.has(key)) {
      return;
    }
    cart.delete(key);
    renderCart();
    saveCart();
  }

  function resetCart() {
    ensureCartElements();
    cart.clear();
    renderCart();
    saveCart();
    resetCheckoutForm(true);
    if (cartForm) {
      cartForm.setAttribute('hidden', 'hidden');
    }
  }

  function updateDeliveryControls() {
    ensureCartElements();
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

  bindCartControls();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindCartControls);
  }
  updateDeliveryControls();

  function isCartOpen() {
    ensureCartElements();
    return cartPanel ? !cartPanel.hasAttribute('hidden') : false;
  }

  function openCart() {
    ensureCartElements();
    cartPanel?.removeAttribute('hidden');
    cartPanel?.setAttribute('aria-hidden', 'false');
    cartOverlay?.removeAttribute('hidden');
    cartToggle?.setAttribute('aria-expanded', 'true');
    document.body?.classList.add('no-scroll');
  }

  function closeCart() {
    ensureCartElements();
    cartPanel?.setAttribute('hidden', 'hidden');
    cartPanel?.setAttribute('aria-hidden', 'true');
    cartOverlay?.setAttribute('hidden', 'hidden');
    cartToggle?.setAttribute('aria-expanded', 'false');
    document.body?.classList.remove('no-scroll');
  }

  function onCartToggleClick(event) {
    event.preventDefault();
    ensureCartElements();
    if (isCartOpen()) {
      closeCart();
    } else {
      if (cart.size === 0) {
        showCartStatus('Добавьте наборы в корзину.');
      }
      openCart();
    }
  }

  function openProductModal(productId) {
    const product = catalog.get(productId);
    if (!product) {
      return;
    }
    const root = ensureModalElements();
    if (!root) {
      addToCart(product, { variant: 'pack', quantity: 1, flavors: [] });
      return;
    }
    activeProduct = product;
    // Reset order button state on each open
    resetOrderBtn();
    const hasFlavors = product.flavors.length > 0;
    root.removeAttribute('hidden');
    root.setAttribute('aria-hidden', 'false');
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
      if (hasFlavors) {
        product.flavors.forEach((flavor, index) => {
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
minusBtn.textContent = '−';
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
            // Any change to selection should bring button back to default
            resetOrderBtn();
          };

          minusBtn.addEventListener('click', () => setQty(Number(row.dataset.quantity || '0') - 1));
          plusBtn.addEventListener('click', () => setQty(Number(row.dataset.quantity || '0') + 1));
          setQty(Number(row.dataset.quantity || '0'));

          controls.appendChild(minusBtn);
          controls.appendChild(qtyValue);
          controls.appendChild(plusBtn);

          row.appendChild(name);
          row.appendChild(controls);
        
          if (product.allowSample) {
            const sampleWrap = document.createElement('div');
            sampleWrap.className = 'product-modal__flavor-sample';
            const sampleBtn = document.createElement('button');
            sampleBtn.type = 'button';
            sampleBtn.className = 'btn-sample-row';
            sampleBtn.textContent = 'Заказать образец';
            sampleBtn.addEventListener('click', () => {
  addToCart(activeProduct, { variant: 'sample', quantity: 1, flavors: [flavor] });
  sampleBtn.disabled = true;
  sampleBtn.textContent = 'образец в корзине';
  let check = sampleWrap.querySelector('.flavor-check');
  if (!check) {
    check = document.createElement('span');
    check.className = 'flavor-check';
    sampleWrap.appendChild(check);
  }
});
sampleWrap.appendChild(sampleBtn);
            row.appendChild(sampleWrap);
          }

          modalFlavors.appendChild(row);
        });
      } else {
        const note = document.createElement('p');
        note.className = 'product-modal__note';
        note.textContent = 'Для этого варианта образцы недоступны.';
        modalFlavors.appendChild(note);
      }
    }



    modalVariantButtons.forEach((button) => {
      const variant = button.dataset.variant;
      if (variant === 'sample') {
        button.style.display = hasFlavors ? 'none' : '';
      }
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
    const root = ensureModalElements();
    if (!root) {
      return;
    }
    clearOrderBtnTimer();
    resetOrderBtn();
    root.setAttribute('hidden', 'hidden');
    root.setAttribute('aria-hidden', 'true');
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
    if (activeProduct.flavors.length > 0) {
      const rows = modalFlavors ? Array.from(modalFlavors.querySelectorAll('.product-modal__flavor-row')) : [];
      const selections = rows
        .map((row) => {
          const qty = Number(row.dataset.quantity || '0');
          if (qty <= 0) {
            return null;
          }
          const flavor = row.dataset.flavor || null;
          return { quantity: qty, flavors: flavor ? [flavor] : [], row };
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

  function onModalVariantButtonClick(event) {
    const button = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    if (!button || !activeProduct) {
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
    if (variant === 'pack' && modalFlavors) {
      selections.forEach(({ row }) => {
        if (!row) return;
        row.dataset.quantity = '0';
        const qtyValue = row.querySelector('.cart-qty-value');
        if (qtyValue) qtyValue.textContent = '0';
        const minusBtn = row.querySelector('.cart-qty-btn');
        if (minusBtn) minusBtn.disabled = true;
      });
    }
    if (variant === 'pack') {
      setOrderBtnInCart(button, button.dataset.inCartLabel || 'В корзине');
    } else {
      closeProductModal();
    }
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (isCartOpen()) {
        closeCart();
      }
      const root = ensureModalElements();
      if (root && !root.hasAttribute('hidden')) {
        closeProductModal();
      }
    }
  });

  async function onCartFormSubmit(event) {
    event.preventDefault();
    ensureCartElements();
    if (!cart.size) {
      showCartStatus('Корзина пустая.');
      return;
    }
    if (!cartForm || !cartForm.reportValidity()) {
      return;
    }

    const name = (cartNameInput?.value || '').trim();
    const phone = (cartPhoneInput?.value || '').trim();
    const address = (cartAddressInput?.value || '').trim();
    const deliverNow = cartDeliveryToggle?.checked !== false;
    const deliverDate = (cartDeliveryDateInput?.value || '').trim();
    const deliverTime = (cartDeliveryTimeInput?.value || '').trim();

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
  }

  loadCart();
  renderCart();
  saveCart();
})();








