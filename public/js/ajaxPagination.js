(() => {
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const isSearchResults = document.body.classList.contains('search-results');
  const isHome = !isSearchResults && (qs('.home-cars-grid') && qs('.home-pagination-bar'));

  // Guard against IO triggers from initial render/layout shifts:
  // only auto-load when the user actually scrolled recently AND is near the bottom.
  let lastUserScrollTs = 0;
  window.addEventListener('scroll', () => {
    lastUserScrollTs = Date.now();
  }, { passive: true });

  function nearBottom(px = 150) {
    const doc = document.documentElement;
    return (window.innerHeight + window.scrollY) >= (doc.scrollHeight - px);
  }

  function parseHtml(htmlText) {
    return new DOMParser().parseFromString(htmlText, 'text/html');
  }

  function makeSentinel(afterEl, id) {
    if (!afterEl) return null;
    const existing = document.getElementById(id);
    if (existing) return existing;
    const s = document.createElement('div');
    s.id = id;
    s.style.width = '1px';
    s.style.height = '1px';
    s.style.margin = '1px 0';
    afterEl.insertAdjacentElement('afterend', s);
    return s;
  }

  function initSwipe(container, { onLeft, onRight }) {
    if (!container) return () => {};
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const threshold = 60; // px
    const maxOffAxis = 55; // px (mostly horizontal)

    function onTouchStart(e) {
      if (!e.touches || e.touches.length !== 1) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
    }

    function onTouchMove(e) {
      if (!tracking || !e.touches || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      // Ignore mostly vertical gestures
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > maxOffAxis) {
        tracking = false;
      }
    }

    function onTouchEnd(e) {
      if (!tracking) return;
      tracking = false;
      const t = (e.changedTouches && e.changedTouches[0]) || null;
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dy) > maxOffAxis) return;
      if (dx <= -threshold) onLeft && onLeft();
      if (dx >= threshold) onRight && onRight();
    }

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }

  // -----------------------------
  // HOME (GET): click + scroll + swipe + popstate
  // -----------------------------
  function initHomeAjaxPager() {
    const grid = qs('.home-cars-grid');
    const pagerBar = qs('.home-pagination-bar');
    if (!grid || !pagerBar) return;

    let loading = false;
    let lastLoadedUrl = null;
    let abortCtrl = null;

    const sentinel = makeSentinel(pagerBar, 'homePagerSentinel');
    let io = null;

    function getNextUrl(root = document) {
      const a = qs('.home-pagination-bar a.next:not([disabled])', root);
      return a ? a.getAttribute('href') : null;
    }

    function getPrevUrl(root = document) {
      const a = qs('.home-pagination-bar a.prev:not([disabled])', root);
      return a ? a.getAttribute('href') : null;
    }

    async function loadUrl(url, { push = true, scrollToGrid = false } = {}) {
      if (!url || loading) return;
      if (url === lastLoadedUrl) return;
      loading = true;
      const yBefore = window.scrollY;

      // Blur active element to prevent browser focus scroll oddities
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }

      grid.classList.add('ajax-fade');
      pagerBar.classList.add('ajax-fade');
      grid.classList.add('is-loading');
      pagerBar.classList.add('is-loading');

      try {
        if (abortCtrl) abortCtrl.abort();
        abortCtrl = new AbortController();

        const res = await fetch(url, {
          method: 'GET',
          headers: { 'X-Requested-With': 'fetch' },
          signal: abortCtrl.signal,
        });
        const html = await res.text();
        const doc = parseHtml(html);

        const newGrid = qs('.home-cars-grid', doc);
        const newPager = qs('.home-pagination-bar', doc);
        if (!newGrid || !newPager) return;

        grid.innerHTML = newGrid.innerHTML;
        pagerBar.innerHTML = newPager.innerHTML;
        lastLoadedUrl = url;

        if (push) history.pushState(null, '', url);
        
        // Preserve exact scroll position (avoid jump) - do it twice for mobile reflow
        window.scrollTo(0, yBefore);
        requestAnimationFrame(() => {
          window.scrollTo(0, yBefore);
          // Fade new content in
          grid.classList.remove('is-loading');
          pagerBar.classList.remove('is-loading');
        });
      } catch (e) {
        // ignore aborts; log others
        if (!(e && e.name === 'AbortError')) console.error(e);
      } finally {
        // Ensure we never get stuck faded out on errors
        grid.classList.remove('is-loading');
        pagerBar.classList.remove('is-loading');
        loading = false;
      }
    }

    // Click interception (event delegation)
    document.addEventListener('click', (e) => {
      const a = e.target && e.target.closest && e.target.closest('.home-pagination-bar a[href]');
      if (!a) return;
      if (a.hasAttribute('disabled')) {
        e.preventDefault();
        return;
      }
      const href = a.getAttribute('href');
      if (!href) return;
      e.preventDefault();
      loadUrl(href, { push: true, scrollToGrid: false });
    });

    // Infinite scroll (next page)
    if (sentinel && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (!entry || !entry.isIntersecting) return;
        if (!nearBottom(150)) return;
        if (Date.now() - lastUserScrollTs > 1200) return;
        if (loading) return;
        const nextUrl = getNextUrl(document);
        if (!nextUrl) return;

        // Pause while loading to avoid rapid accidental paging
        io.unobserve(sentinel);
        loadUrl(nextUrl, { push: true, scrollToGrid: false })
          .finally(() => requestAnimationFrame(() => io && io.observe(sentinel)));
      }, { rootMargin: '0px 0px 120px 0px' });
      io.observe(sentinel);
    }

    // Swipe on the cars area
    initSwipe(grid, {
      onLeft: () => {
        const nextUrl = getNextUrl(document);
        if (nextUrl) loadUrl(nextUrl, { push: true, scrollToGrid: false });
      },
      onRight: () => {
        const prevUrl = getPrevUrl(document);
        if (prevUrl) loadUrl(prevUrl, { push: true, scrollToGrid: false });
      },
    });

    // Back/forward support
    window.addEventListener('popstate', () => {
      const url = window.location.href;
      loadUrl(url, { push: false, scrollToGrid: false });
    });
  }

  // -----------------------------
  // SEARCH RESULTS (POST): click + scroll + swipe
  // -----------------------------
  function initSearchResultsAjaxPager() {
    const main = qs('.search-results-main');
    const form = qs('#resultsPagingForm');
    if (!main || !form) return;

    let loading = false;
    let lastPage = null;

    // Sentinel must live OUTSIDE of main.innerHTML (main is replaced on each AJAX load)
    const sentinel = makeSentinel(main, 'resultsPagerSentinel');
    let io = null;

    function getCurrentPage() {
      const el = qs('[data-current-page]', main);
      const n = el ? Number(el.getAttribute('data-current-page')) : NaN;
      return Number.isFinite(n) ? n : 1;
    }
    function getTotalPages() {
      const el = qs('[data-total-pages]', main);
      const n = el ? Number(el.getAttribute('data-total-pages')) : NaN;
      return Number.isFinite(n) ? n : 1;
    }

    async function postLoadPage(pageNum, { scrollToTop = false } = {}) {
      const p = Number(pageNum);
      if (!Number.isFinite(p)) return;
      if (loading) return;
      if (p === lastPage) return;

      loading = true;
      const yBefore = window.scrollY;
      
      // Blur active element to prevent browser focus scroll oddities
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      
      main.classList.add('ajax-fade');
      main.classList.add('is-loading');

      try {
        const params = new URLSearchParams(new FormData(form));
        params.set('page', String(p));

        const res = await fetch('/postSearchCars', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'fetch',
          },
          body: params.toString(),
        });

        const html = await res.text();
        const doc = parseHtml(html);
        const newMain = qs('.search-results-main', doc);
        const newForm = qs('#resultsPagingForm', doc);
        if (!newMain || !newForm) return;

        // Replace results area + update hidden form values (filters/search params persist)
        main.innerHTML = newMain.innerHTML;
        form.innerHTML = newForm.innerHTML;
        lastPage = p;

        // Preserve exact scroll position (avoid jump) - do it twice for mobile reflow
        window.scrollTo(0, yBefore);
        requestAnimationFrame(() => {
          window.scrollTo(0, yBefore);
          // Fade new content in
          main.classList.remove('is-loading');
        });
      } catch (e) {
        console.error(e);
      } finally {
        main.classList.remove('is-loading');
        loading = false;
      }
    }

    // Click interception for pager links
    document.addEventListener('click', (e) => {
      const a = e.target && e.target.closest && e.target.closest('.results-pagination-bar a[data-page]');
      if (!a) return;
      e.preventDefault();
      if (a.getAttribute('aria-disabled') === 'true') return;
      const p = Number(a.getAttribute('data-page'));
      if (Number.isFinite(p)) postLoadPage(p, { scrollToTop: false });
    });

    // Infinite scroll: auto-load next page
    if (sentinel && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (!entry || !entry.isIntersecting) return;
        if (!nearBottom(150)) return;
        if (Date.now() - lastUserScrollTs > 1200) return;
        if (loading) return;
        const cur = getCurrentPage();
        const total = getTotalPages();
        if (cur >= total) return;

        io.unobserve(sentinel);
        postLoadPage(cur + 1, { scrollToTop: false })
          .finally(() => requestAnimationFrame(() => io && io.observe(sentinel)));
      }, { rootMargin: '0px 0px 120px 0px' });
      io.observe(sentinel);
    }

    // Swipe on the cars grid
    const grid = qs('.grid.cars', main) || main;
    initSwipe(grid, {
      onLeft: () => {
        const cur = getCurrentPage();
        const total = getTotalPages();
        if (cur < total) postLoadPage(cur + 1, { scrollToTop: false });
      },
      onRight: () => {
        const cur = getCurrentPage();
        if (cur > 1) postLoadPage(cur - 1, { scrollToTop: false });
      },
    });
  }

  if (isHome) initHomeAjaxPager();
  if (isSearchResults) initSearchResultsAjaxPager();
})();


