/**
 * При смяна на "Browse by Category" синхронизира transmission / fuel / seats
 * с избраната категория (или ги изчиства при "All"), за да не остават стари
 * стойности в GET/POST заявката с предимство над новата категория.
 */
(function () {
  'use strict';

  function applyCategoryToFilterFields(category, form) {
    const tr = form.querySelector('[name="transmission"]');
    const fuel = form.querySelector('[name="fuelType"]');
    const smin = form.querySelector('[name="seatsMin"]');
    const smax = form.querySelector('[name="seatsMax"]');
    const cat = String(category || '').trim().toLowerCase();

    function setSelect(el, val) {
      if (el) el.value = val == null ? '' : String(val);
    }
    function setInput(el, val) {
      if (el) el.value = val == null ? '' : String(val);
    }

    setSelect(tr, '');
    setSelect(fuel, '');
    setInput(smin, '');
    setInput(smax, '');

    if (!cat) return;

    if (cat === 'automatic' || cat === 'manual') {
      setSelect(tr, cat);
      return;
    }
    if (cat === 'petrol' || cat === 'diesel' || cat === 'hybrid' || cat === 'electric') {
      setSelect(fuel, cat);
      return;
    }
    if (cat === 'seats-2-3') {
      setInput(smin, '2');
      setInput(smax, '3');
      return;
    }
    if (cat === 'seats-4-5') {
      setInput(smin, '4');
      setInput(smax, '5');
      return;
    }
    if (cat === 'seats-6-9') {
      setInput(smin, '6');
      setInput(smax, '9');
    }
  }

  function init() {
    const cat = document.getElementById('flt-category');
    if (!cat) return;
    const form = cat.closest('form');
    if (!form || !form.classList.contains('filters-aside-form')) return;

    cat.addEventListener('change', function () {
      applyCategoryToFilterFields(cat.value, form);
      if (typeof window.reinitCustomDropdowns === 'function') {
        window.reinitCustomDropdowns();
      }
      form.submit();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
