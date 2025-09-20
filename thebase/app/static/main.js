// ===== Анимация чашек (центр под словом "Бишкек") =====
(() => {
  const lane = document.querySelector('.lane');
  const path = document.querySelector('.path');
  const cups = document.querySelectorAll('.cup');
  if (!lane || !path || !cups.length) return;

  const PAD = 8;
  let anims = [];

  function layout(){
    const cities = lane.querySelectorAll('.city');
    if (cities.length < 2) return 0;
    const laneRect = lane.getBoundingClientRect();
    const aRect = cities[0].getBoundingClientRect();
    const bNode = lane.querySelector('.city .city-txt-bishkek') || cities[1];
    const bRect = bNode.getBoundingClientRect();

    const startX = aRect.left + aRect.width/2 - laneRect.left;
    const endX   = bRect.left  + bRect.width /2 - laneRect.left;
    const y = Math.max(aRect.bottom, bRect.bottom) - laneRect.top + 50;
    const widthRaw = Math.max(0, endX - startX);

    path.style.left  = `${startX - PAD}px`;
    path.style.top   = `${y}px`;
    path.style.width = `${widthRaw + PAD*2}px`;

    const rt = path.querySelector('svg.route');
    if (rt) rt.setAttribute('viewBox', `0 0 ${Math.max(100, Math.round(widthRaw + PAD*2))} 30`);

    const ln = path.querySelector('line');
    if (ln){ ln.setAttribute('x1', PAD); ln.setAttribute('x2', Math.round(widthRaw + PAD)); }
    const circles = path.querySelectorAll('circle.point');
    if (circles.length >= 2){
      circles[0].setAttribute('cx', PAD);
      circles[1].setAttribute('cx', Math.round(widthRaw + PAD));
    }
    return widthRaw + PAD*2;
  }

  function animate(width){
    const travel = Math.max(0, width - 36);
    const dur = 3584; // ускорено на 20% дважды
    const step = dur / cups.length, fadePad = 20;
    anims.forEach(a=>a.cancel()); anims = [];
    cups.forEach((cup,i)=>{
      cup.style.opacity = '1';
      const anim = cup.animate([
        { transform:'translate(-18px,-50%) translateX(0)', opacity:0 },
        { offset:0.12, transform:`translate(-18px,-50%) translateX(${fadePad}px)`, opacity:1 },
        { offset:0.88, transform:`translate(-18px,-50%) translateX(${Math.max(0, travel - fadePad)}px)`, opacity:1 },
        { transform:`translate(-18px,-50%) translateX(${travel}px)`, opacity:0 }
      ], { duration:dur, delay:i*step, iterations:Infinity, easing:'linear', fill:'both' });
      anims.push(anim);
    });
  }

  let tries=0;
  function start(){ const w=layout(); if(w<=0 && tries<20){tries++;return setTimeout(start,60);} if(w>0) animate(w); }
  if (document.readyState!=='complete') window.addEventListener('load', start); else start();
  document.fonts?.ready?.then(start);
  new ResizeObserver(start).observe(lane);

  const pauseAll=()=>anims.forEach(a=>a.pause());
  const playAll =()=>anims.forEach(a=>a.play());
  path.addEventListener('mouseenter', pauseAll);
  path.addEventListener('mouseleave', playAll);
  path.addEventListener('touchstart', ()=>{ pauseAll(); setTimeout(playAll,1200); }, {passive:true});
})();

// ===== Заявка: один селект + чипы, «уже в корзине» =====
(() => {
  const form   = document.getElementById('lead-form');
  const status = document.getElementById('form-status');
  const select = document.getElementById('product-select');
  const chips  = document.getElementById('product-chips');
  if (!form || !select || !chips) return;

  const PHONE_RE = /^(?:\+996\d{9}|0\d{9})$/;
  const MAX = 6; // максимум товаров
  const chosen = new Set();

  // собрать имена из карточек
  const cards = Array.from(document.querySelectorAll('.cards .card'));
  const NAMES = cards.map(c => c.querySelector('h3')?.textContent?.trim()).filter(Boolean);

  // опции селекта
  select.innerHTML = `<option value="" disabled selected>Выберите товар</option>` +
    NAMES.map(n => `<option value="${n.replace(/"/g,'&quot;')}">${n}</option>`).join('');

  // отрисовка чипов
  function renderChips(){
    chips.innerHTML = '';
    [...chosen].forEach(name => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = name;
      const x = document.createElement('button');
      x.type='button'; x.className='chip-x'; x.textContent='×';
      x.onclick = () => removeProduct(name);
      chip.appendChild(x);
      chips.appendChild(chip);
    });
  }

  function markCard(name, inCart){
    const card = cards.find(c => c.querySelector('h3')?.textContent?.trim() === name);
    if (!card) return;
    const btn = card.querySelector('.cta');
    if (!btn) return;
    if (inCart){
      btn.classList.add('in-cart');
      btn.setAttribute('aria-disabled','true');
      btn.textContent = 'Уже в корзине';
    } else {
      btn.classList.remove('in-cart');
      btn.removeAttribute('aria-disabled');
      btn.textContent = 'Заказать бесплатный образец';
    }
  }

  function addProduct(name){
    if (!name) return;
    if (chosen.has(name)) return;
    if (chosen.size >= MAX) return;
    chosen.add(name);
    renderChips();
    markCard(name, true);
    // лёгкая подсветка карты
    const card = cards.find(c => c.querySelector('h3')?.textContent?.trim() === name);
    if (card){ card.classList.add('added'); setTimeout(()=>card.classList.remove('added'), 900); }
    // сброс селекта
    select.value = '';
  }

  function removeProduct(name){
    if (!chosen.has(name)) return;
    chosen.delete(name);
    renderChips();
    markCard(name, false);
  }

  // выбор из селекта
  select.addEventListener('change', e => addProduct(select.value));

  // клик по кнопке карточки → добавить, НЕ скроллить к форме
  cards.forEach(card => {
    const btn = card.querySelector('.cta');
    const name = card.querySelector('h3')?.textContent?.trim();
    if (!btn || !name) return;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      addProduct(name);
    });
  });

  // отправка формы
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    const name  = document.getElementById('name')?.value.trim();
    const phone = document.getElementById('phone')?.value.trim();
    const place = document.getElementById('place')?.value.trim();
    const msg   = document.getElementById('msg')?.value.trim();

    if (!PHONE_RE.test(phone)){
      if (status) status.textContent = 'Номер в формате +996XXXXXXXXX или 0XXXXXXXXX';
      document.getElementById('phone')?.focus();
      return;
    }

<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
    const products = Array.from(chosen.entries()).map(([name, info]) => {
      const qty = Number(info?.quantity || 0);
      return qty > 1 ? `${name} × ${qty}` : name;
    });
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs

    const payload = { name, phone, place: place || null, msg: msg || null, products };

    if (isStaticDemo){
      if (status) status.textContent = 'Демо-режим: заявка не отправляется, но данные записаны в консоль.';
      console.info('THEBASE lead (demo mode):', payload);
      finalizeSubmission('Демо-режим: данные формы собраны.');
      return;
    }
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
    const products = [...chosen];
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
    const products = [...chosen];
>>>>>>> theirs

    try{
      if (status) status.textContent = 'Отправляем...';
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ name, phone, place: place || null, msg: msg || null, products })
      });
      if (!res.ok){
        const err = await res.json().catch(()=>({}));
        if (status) status.textContent = `Ошибка: ${err.error || err.detail || res.status}`;
        return;
      }
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
      if (status) status.textContent = 'Готово. Мы свяжемся с вами.';
      form.reset();
      // очистить корзину
      const names = Array.from(chosen.keys());
      chosen.clear();
      renderChips();
      names.forEach(n => markCard(n, 0));
    }catch{
=======
      finalizeSubmission();
    }catch(err){
      console.info('THEBASE lead (ошибка сети):', payload, err);
>>>>>>> theirs
=======
      finalizeSubmission();
    }catch(err){
      console.info('THEBASE lead (ошибка сети):', payload, err);
>>>>>>> theirs
=======
=======
>>>>>>> theirs
      if (status) status.textContent = 'Готово. Мы свяжемся с вами.';
      form.reset();
      // очистить корзину
      [...chosen].forEach(n => markCard(n, false));
      chosen.clear(); renderChips();
    }catch{
<<<<<<< ours
>>>>>>> theirs
=======
      finalizeSubmission();
    }catch(err){
      console.info('THEBASE lead (ошибка сети):', payload, err);
>>>>>>> theirs
=======
      finalizeSubmission();
    }catch(err){
      console.info('THEBASE lead (ошибка сети):', payload, err);
>>>>>>> theirs
=======
      finalizeSubmission();
    }catch(err){
      console.info('THEBASE lead (ошибка сети):', payload, err);
>>>>>>> theirs
=======
      finalizeSubmission();
    }catch(err){
      console.info('THEBASE lead (ошибка сети):', payload, err);
>>>>>>> theirs
=======
      finalizeSubmission();
    }catch(err){
      console.info('THEBASE lead (ошибка сети):', payload, err);
>>>>>>> theirs
=======
      finalizeSubmission();
    }catch(err){
      console.info('THEBASE lead (ошибка сети):', payload, err);
>>>>>>> theirs
=======
      finalizeSubmission();
    }catch(err){
      console.info('THEBASE lead (ошибка сети):', payload, err);
>>>>>>> theirs
=======
      finalizeSubmission();
    }catch(err){
      console.info('THEBASE lead (ошибка сети):', payload, err);
>>>>>>> theirs
=======
      finalizeSubmission();
    }catch(err){
      console.info('THEBASE lead (ошибка сети):', payload, err);
>>>>>>> theirs
=======
>>>>>>> theirs
      if (status) status.textContent = 'Сбой сети. Попробуйте ещё раз.';
    }
  });
})();
