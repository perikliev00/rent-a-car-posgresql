(function initDatePickers() {
  function init() {
    const pickupDateEl = document.getElementById('pickup-date');
    const returnDateEl = document.getElementById('return-date');

    if (!pickupDateEl || !returnDateEl) return;

    const pad2 = (n) => String(n).padStart(2, '0');
    const toIsoDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const fromIsoDate = (s) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
      if (!m) return null;
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const normalize = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const addDays = (d, n) => {
      const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      copy.setDate(copy.getDate() + n);
      return copy;
    };

    const today = normalize(new Date());

    const minFor = (input) => {
      if (input === pickupDateEl) return today;
      const pickup = fromIsoDate(pickupDateEl.value);
      return pickup ? addDays(pickup, 1) : addDays(today, 1);
    };

    const ensureConstraints = () => {
      const pickup = fromIsoDate(pickupDateEl.value);
      if (!pickup || pickup < today) pickupDateEl.value = toIsoDate(today);
      const ret = fromIsoDate(returnDateEl.value);
      const minReturn = addDays(fromIsoDate(pickupDateEl.value) || today, 1);
      if (!ret || ret < minReturn) returnDateEl.value = toIsoDate(minReturn);
    };

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
      'September', 'October', 'November', 'December'];
    const weekNames = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

    const pop = document.createElement('div');
    pop.className = 'lr-calendar';
    pop.hidden = true;
    pop.innerHTML = `
      <div class="lr-calendar__head">
        <button type="button" class="lr-calendar__nav" data-nav="-1" aria-label="Previous month">‹</button>
        <div class="lr-calendar__title"></div>
        <button type="button" class="lr-calendar__nav" data-nav="1" aria-label="Next month">›</button>
      </div>
      <div class="lr-calendar__week"></div>
      <div class="lr-calendar__grid"></div>
    `;
    document.body.appendChild(pop);

    const titleEl = pop.querySelector('.lr-calendar__title');
    const weekEl = pop.querySelector('.lr-calendar__week');
    const gridEl = pop.querySelector('.lr-calendar__grid');
    weekNames.forEach((w) => {
      const div = document.createElement('div');
      div.className = 'lr-calendar__weekday';
      div.textContent = w;
      weekEl.appendChild(div);
    });

    let activeInput = null;
    let viewMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const position = () => {
      if (!activeInput) return;
      const rect = activeInput.getBoundingClientRect();
      const width = Math.max(rect.width, 280);
      pop.style.width = `${Math.round(width)}px`;
      pop.style.left = `${Math.round(rect.left)}px`;
      pop.style.top = `${Math.round(rect.bottom + 6)}px`;
      if (rect.left + width > window.innerWidth - 10) {
        pop.style.left = `${Math.max(10, window.innerWidth - width - 10)}px`;
      }
    };

    const render = () => {
      if (!activeInput) return;
      const minDate = minFor(activeInput);
      const selected = fromIsoDate(activeInput.value);
      titleEl.textContent = `${monthNames[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`;
      gridEl.innerHTML = '';

      const firstDay = (viewMonth.getDay() + 6) % 7;
      const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();

      for (let i = 0; i < firstDay; i += 1) {
        const empty = document.createElement('div');
        empty.className = 'lr-calendar__cell is-empty';
        gridEl.appendChild(empty);
      }

      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lr-calendar__cell';
        btn.textContent = String(day);
        btn.dataset.value = toIsoDate(date);
        if (date < minDate) btn.disabled = true;
        if (toIsoDate(date) === toIsoDate(today)) btn.classList.add('is-today');
        if (selected && toIsoDate(date) === toIsoDate(selected)) btn.classList.add('is-selected');
        gridEl.appendChild(btn);
      }
      position();
    };

    const close = () => {
      pop.hidden = true;
      activeInput = null;
    };

    const openFor = (input) => {
      activeInput = input;
      const selected = fromIsoDate(input.value) || minFor(input);
      viewMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
      pop.hidden = false;
      render();
    };

    pop.addEventListener('click', (e) => {
      const nav = e.target.closest('.lr-calendar__nav');
      if (nav) {
        viewMonth.setMonth(viewMonth.getMonth() + Number(nav.dataset.nav || 0));
        render();
        return;
      }
      const cell = e.target.closest('.lr-calendar__cell');
      if (!cell || !activeInput || cell.disabled || !cell.dataset.value) return;
      activeInput.value = cell.dataset.value;
      if (activeInput === pickupDateEl) {
        const minReturn = addDays(fromIsoDate(pickupDateEl.value) || today, 1);
        const returnVal = fromIsoDate(returnDateEl.value);
        if (!returnVal || returnVal < minReturn) {
          returnDateEl.value = toIsoDate(minReturn);
        }
      }
      close();
    });

    [pickupDateEl, returnDateEl].forEach((el) => {
      el.addEventListener('click', () => openFor(el));
      el.addEventListener('focus', () => openFor(el));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openFor(el);
        } else if (e.key === 'Escape') {
          close();
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (!pop.hidden && !pop.contains(e.target) && e.target !== pickupDateEl && e.target !== returnDateEl) {
        close();
      }
    });
    window.addEventListener('resize', () => { if (!pop.hidden) position(); });
    window.addEventListener('scroll', () => { if (!pop.hidden) position(); }, true);

    ensureConstraints();
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

