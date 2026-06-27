// Advanced mobile menu: overlay, search filter, submenus, focus, swipe
(function initMobileMenu(){
  function init(){
    // Desktop mega menu click-to-open with one-at-a-time behavior
    const desktopSubmenus = document.querySelectorAll('.desktop-nav .submenu');
    if (desktopSubmenus.length) {
      function closeAll(){ desktopSubmenus.forEach(li => li.classList.remove('open')); }
      function syncScrollLock(){
        const anyOpen = Array.from(desktopSubmenus).some(li => li.classList.contains('open'));
        document.documentElement.style.overflow = anyOpen ? 'hidden' : '';
        document.body.style.overflow = anyOpen ? 'hidden' : '';
      }
      desktopSubmenus.forEach(li => {
        const trigger = li.querySelector(':scope > a');
        const panel = li.querySelector(':scope > .submenu-list');
        if (!trigger || !panel) return;
        trigger.addEventListener('click', (e) => { e.preventDefault(); const isOpen = li.classList.contains('open'); closeAll(); if (!isOpen) li.classList.add('open'); syncScrollLock(); });
        // Toggle via keyboard (Enter/Space)
        trigger.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const isOpen = li.classList.contains('open');
            closeAll();
            if (!isOpen) li.classList.add('open');
            syncScrollLock();
          }
        });
      });
      // Close when clicking outside
      document.addEventListener('click', (e) => {
        if (!(e.target.closest && e.target.closest('.desktop-nav .submenu'))) {
          closeAll();
          syncScrollLock();
        }
      });
      // Close on Escape
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeAll(); syncScrollLock(); } });
      // Recompute header height gap so panel sticks just under header without gap
      function computeHeaderHeight(){
        const announce = document.querySelector('.header-announcement');
        const header = document.querySelector('.header');
        const ah = announce ? announce.getBoundingClientRect().height : 0;
        const hh = header ? header.getBoundingClientRect().height : 0;
        const total = Math.round(ah + hh);
        document.documentElement.style.setProperty('--announcement-height', ah + 'px');
        document.documentElement.style.setProperty('--header-height', hh + 'px');
        document.documentElement.style.setProperty('--header-total', total + 'px');
      }
      computeHeaderHeight();
      window.addEventListener('resize', () => { computeHeaderHeight(); syncScrollLock(); });
    }

    const toggle = document.getElementById('menuToggle');
    const menu = document.getElementById('mobileMenu');
    const closeBtn = document.getElementById('mobileClose');
    const overlay = document.querySelector('.mobile-overlay');
    const search = document.getElementById('mobileSearch');
    if(!toggle || !menu || !overlay) return;

    // Robust scroll lock state
    let scrollY = 0;
    let scrollLocked = false;

    function open(){
      menu.hidden = false;
      menu.classList.add('open');
      toggle.setAttribute('aria-expanded','true');
      overlay.classList.add('show');
      lockScroll();
      // Removed auto-focus on search input to prevent keyboard from opening automatically
    }

    function close(force = false){
      // Always reset aria and classes first
      toggle.setAttribute('aria-expanded','false');
      menu.classList.remove('open');
      overlay.classList.remove('show');

      // If forcing or we're on desktop, hide immediately with no animation
      if (force || window.innerWidth >= 1280) {
        menu.hidden = true;
        unlockScroll();
        return;
      }

      let handled = false;
      const onEnd = () => {
        if (handled) return;
        handled = true;
        menu.hidden = true;
        menu.removeEventListener('transitionend', onEnd);
        unlockScroll();
      };

      // Normal animated close path
      menu.addEventListener('transitionend', onEnd);
      // Fallback in case transitionend never fires
      setTimeout(onEnd, 250);
    }

    function toggleMenu(){
      if (menu.classList.contains('open') && !menu.hidden) {
        close();
      } else {
        open();
      }
    }

    toggle.addEventListener('click', toggleMenu);
    if (closeBtn) closeBtn.addEventListener('click', () => close());
    overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      close(true); // force immediate close, no animation or leftover overlay
    });
    menu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => close(true));
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 1280) {
        // Hard reset mobile state when moving to full desktop width
        close(true);
      }
    });

    // Submenu toggles
    menu.querySelectorAll('.submenu-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const controls = btn.getAttribute('aria-controls');
        const list = controls ? document.getElementById(controls) : null;
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        if (list) list.hidden = expanded;
      });
    });

    // Search filter
    if (search) {
      search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        menu.querySelectorAll('.menu-list > li').forEach(item => {
          const label = (item.getAttribute('data-label') || '').toLowerCase();
          const text = item.textContent.toLowerCase();
          const match = !q || label.includes(q) || text.includes(q);
          item.style.display = match ? '' : 'none';
        });
      });
    }

    // Focus trap (simple)
    function trapFocus(e){
      if (!menu.classList.contains('open')) return;
      const focusable = menu.querySelectorAll('a[href], button:not([disabled]), input');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      trapFocus(e);
    });

    // Swipe to close
    let startY = null, currentY = null, dragging = false;
    function onTouchStart(e){ startY = e.touches[0].clientY; dragging = true; }
    function onTouchMove(e){ if(!dragging) return; currentY = e.touches[0].clientY; const delta = currentY - startY; if (delta > 0) menu.style.transform = `translateY(${Math.min(delta, window.innerHeight)}px)`; }
    function onTouchEnd(){ if(!dragging) return; dragging = false; const delta = (currentY ?? startY) - startY; menu.style.transform = ''; if (delta > 80) close(); }
    menu.addEventListener('touchstart', onTouchStart, { passive: true });
    menu.addEventListener('touchmove', onTouchMove, { passive: true });
    menu.addEventListener('touchend', onTouchEnd);

    // Robust scroll lock using position:fixed (prevents mobile scroll bleed)
    function lockScroll() {
      if (scrollLocked) return;
      scrollY = window.scrollY || window.pageYOffset || 0;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      scrollLocked = true;
    }

    function unlockScroll() {
      if (!scrollLocked) return;
      const y = scrollY;
      // Clear all fixed styles
      document.documentElement.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      scrollLocked = false;
      // Restore scroll position
      window.scrollTo(0, y);
    }

    // Prevent touch scroll bleed on background/overlay (mobile)
    document.addEventListener('touchmove', (e) => {
      if (!menu.classList.contains('open')) return;
      // Allow scrolling inside the menu
      if (e.target.closest('#mobileMenu')) return;
      // Prevent all other scrolling
      e.preventDefault();
    }, { passive: false });

    // Prevent wheel scroll bleed on background/overlay (desktop trackpads)
    document.addEventListener('wheel', (e) => {
      if (!menu.classList.contains('open')) return;
      // Allow scrolling inside the menu
      if (e.target.closest('#mobileMenu')) return;
      // Prevent all other scrolling
      e.preventDefault();
    }, { passive: false });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();