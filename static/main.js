// ===== Анимация чашек (центр под словом "Бишкек") =====
(() => {
  const lane = document.querySelector('.lane');
  const path = document.querySelector('.path');
  const cups = document.querySelectorAll('.cup');
  if (!lane || !path || !cups.length) {
    return;
  }

  const PAD = 8;
  let anims = [];

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

    const rt = path.querySelector('svg.route');
    if (rt) {
      rt.setAttribute('viewBox', `0 0 ${Math.max(100, Math.round(widthRaw + PAD * 2))} 30`);
    }

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
    if (width > 0) {
      animate(width);
    }
    return undefined;
  }

  if (document.readyState !== 'complete') {
    window.addEventListener('load', start);
  } else {
    start();
  }
  if (document.fonts?.ready) {
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

// ===== Заявка: один селект + чипы, «уже в корзине» =====
(() => {
  const form = document.getElementById('lead-form');
  const status = document.getElementById('form-status');
  const select = document.getElementById('product-select');
  const chips = document.getElementById('product-chips');
  if (!form || !select || !chips) {
    return;
  }

  const PHONE_RE = /^(?:\+996\d{9}|0\d{9})$/;
  const MAX_UNIQUE = 6; // максимум разных товаров
  const chosen = new Map();

  const cards = Array.from(document.querySelectorAll('.cards .card'));
  const NAMES = cards
    .map((card) => card.querySelector('h3')?.textContent?.trim())
    .filter(Boolean);

  select.innerHTML =
    '<option value="" disabled selected>Выберите товар</option>' +
    NAMES.map((name) => `<option value="${name.replace(/"/g, '&quot;')}">${name}</option>`).join('');

  function renderChips() {
    chips.innerHTML = '';
    if (!chosen.size) {
      return;
    }

    const fragment = document.createDocumentFragment();
    chosen.forEach((info, name) => {
      const quantity = Number(info?.quantity) || 0;
      const chip = document.createElement('div');
      chip.className = 'chip chip-cart';

      const title = document.createElement('span');
      title.className = 'chip-title';
      title.textContent = name;

      const controls = document.createElement('div');
      controls.className = 'chip-controls';

      const minus = document.createElement('button');
      minus.type = 'button';
      minus.className = 'chip-qty-btn';
      minus.textContent = '−';
      minus.setAttribute('aria-label', `Уменьшить количество ${name}`);
      minus.disabled = quantity <= 1;
      minus.addEventListener('click', () => changeQuantity(name, -1));

      const qtyValue = document.createElement('span');
      qtyValue.className = 'chip-qty-value';
      qtyValue.textContent = String(Math.max(quantity, 0));

      const plus = document.createElement('button');
      plus.type = 'button';
      plus.className = 'chip-qty-btn';
      plus.textContent = '+';
      plus.setAttribute('aria-label', `Увеличить количество ${name}`);
      plus.addEventListener('click', () => changeQuantity(name, 1));

      controls.appendChild(minus);
      controls.appendChild(qtyValue);
      controls.appendChild(plus);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'chip-remove';
      removeBtn.innerHTML = '<span aria-hidden="true">×</span>';
      removeBtn.setAttribute('aria-label', `Удалить ${name} из корзины`);
      removeBtn.addEventListener('click', () => removeProduct(name));

      chip.appendChild(title);
      chip.appendChild(controls);
      chip.appendChild(removeBtn);
      fragment.appendChild(chip);
    });

    chips.appendChild(fragment);
  }

  function markCard(name, quantity) {
    const card = cards.find((c) => c.querySelector('h3')?.textContent?.trim() === name);
    if (!card) {
      return;
    }
    const btn = card.querySelector('.cta');
    if (!btn) {
      return;
    }
    if (quantity > 0) {
      btn.classList.add('in-cart');
      btn.setAttribute('aria-disabled', 'true');
      btn.textContent = quantity > 1 ? `В корзине — ${quantity} шт.` : 'Уже в корзине';
    } else {
      btn.classList.remove('in-cart');
      btn.removeAttribute('aria-disabled');
      btn.textContent = 'Заказать бесплатный образец';
    }
  }

  function addProduct(name) {
    if (!name) {
      return;
    }
    const entry = chosen.get(name);
    if (entry) {
      entry.quantity = Number(entry.quantity || 0) + 1;
      chosen.set(name, entry);
    } else {
      if (chosen.size >= MAX_UNIQUE) {
        return;
      }
      chosen.set(name, { quantity: 1 });
    }
    renderChips();
    markCard(name, chosen.get(name)?.quantity || 0);

    const card = cards.find((c) => c.querySelector('h3')?.textContent?.trim() === name);
    if (card) {
      card.classList.add('added');
      setTimeout(() => card.classList.remove('added'), 900);
    }

    select.value = '';
  }

  function removeProduct(name) {
    if (!chosen.has(name)) {
      return;
    }
    chosen.delete(name);
    renderChips();
    markCard(name, 0);
  }

  function changeQuantity(name, delta) {
    const entry = chosen.get(name);
    if (!entry) {
      return;
    }
    const current = Number(entry.quantity || 0);
    if (!Number.isFinite(current)) {
      return;
    }
    const next = current + delta;
    if (next <= 0) {
      removeProduct(name);
      return;
    }
    entry.quantity = next;
    chosen.set(name, entry);
    renderChips();
    markCard(name, next);
  }

  select.addEventListener('change', () => addProduct(select.value));

  cards.forEach((card) => {
    const btn = card.querySelector('.cta');
    const name = card.querySelector('h3')?.textContent?.trim();
    if (!btn || !name) {
      return;
    }
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      addProduct(name);
    });
  });

  const finalizeSubmission = (message = 'Готово. Мы свяжемся с вами.') => {
    if (status) {
      status.textContent = message;
    }
    form.reset();
    const names = Array.from(chosen.keys());
    chosen.clear();
    renderChips();
    names.forEach((n) => markCard(n, 0));
  };

  const isStaticDemo = window.location.protocol === 'file:';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
      return;
    }

    const name = document.getElementById('name')?.value.trim();
    const phone = document.getElementById('phone')?.value.trim();
    const place = document.getElementById('place')?.value.trim();
    const msg = document.getElementById('msg')?.value.trim();

    if (!PHONE_RE.test(phone)) {
      if (status) {
        status.textContent = 'Номер в формате +996XXXXXXXXX или 0XXXXXXXXX';
      }
      document.getElementById('phone')?.focus();
      return;
    }

    const products = Array.from(chosen.entries()).map(([productName, info]) => {
      const qty = Number(info?.quantity || 0);
      return qty > 1 ? `${productName} × ${qty}` : productName;
    });

    const payload = {
      name,
      phone,
      place: place || null,
      msg: msg || null,
      products,
    };

    if (isStaticDemo) {
      if (status) {
        status.textContent = 'Демо-режим: заявка не отправляется, но данные записаны в консоль.';
      }
      console.info('THEBASE lead (demo mode):', payload);
      finalizeSubmission('Демо-режим: данные формы собраны.');
      return;
    }

    try {
      if (status) {
        status.textContent = 'Отправляем...';
      }
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 404) {
          console.info('THEBASE lead (backend недоступен, данные в консоли):', payload);
          finalizeSubmission('Сервер заявок не запущен. Данные сохранены в консоли.');
          return;
        }
        if (status) {
          status.textContent = `Ошибка: ${err.error || err.detail || res.status}`;
        }
        return;
      }
      finalizeSubmission();
    } catch (error) {
      console.info('THEBASE lead (ошибка сети):', payload, error);
      if (status) {
        status.textContent = 'Сбой сети. Попробуйте ещё раз.';
      }
    }
  });
})();
