// public/js/siteSearch.js

// Static index of site pages/sections for header autocomplete.
// IMPORTANT: URLs must match real routes in this project.
const SITE_PAGES = [
  {
    id: 'home',
    title: 'Home',
    url: '/',
    category: 'Public',
    keywords: ['home', 'index', 'cars', 'booking', 'start'],
  },
  {
    id: 'gallery',
    title: 'Gallery',
    url: '/#fleet',
    category: 'Public',
    keywords: ['gallery', 'photos', 'images', 'cars', 'fleet'],
  },
  {
    id: 'pricing',
    title: 'Pricing',
    url: '/#pricing',
    category: 'Public',
    keywords: ['pricing', 'prices', 'rates'],
  },
  {
    id: 'about',
    title: 'About',
    url: '/about',
    category: 'Public',
    keywords: ['company', 'about', 'info', 'mission', 'identity'],
  },
  {
    id: 'contacts',
    title: 'Contact',
    url: '/contacts',
    category: 'Public',
    keywords: ['support', 'help', 'contact', 'email', 'phone'],
  },
  {
    id: 'support-phone',
    title: 'Phone Support',
    url: '/support/phone',
    category: 'Support',
    keywords: ['support', 'phone', 'call', 'help'],
  },
  {
    id: 'support-email',
    title: 'Contact Us',
    url: '/contacts',
    category: 'Support',
    keywords: ['support', 'email', 'contact', 'help'],
  },
  {
    id: 'support-chat',
    title: 'Live Chat',
    url: '/support/chat',
    category: 'Support',
    keywords: ['support', 'chat', 'live', 'help'],
  },
  {
    id: 'support-visit',
    title: 'Visit Showroom',
    url: '/support/visit',
    category: 'Support',
    keywords: ['visit', 'showroom', 'location'],
  },
  {
    id: 'faq',
    title: 'FAQ',
    url: '/faq',
    category: 'Support',
    keywords: ['faq', 'questions', 'help'],
  },
  {
    id: 'roadside',
    title: 'Roadside Assistance',
    url: '/roadside',
    category: 'Support',
    keywords: ['roadside', 'assistance', 'breakdown'],
  },
  {
    id: 'privacy',
    title: 'Privacy Policy',
    url: '/privacy',
    category: 'Legal',
    keywords: ['legal', 'privacy', 'policy', 'gdpr'],
  },
  {
    id: 'cookies',
    title: 'Cookie Policy',
    url: '/cookies',
    category: 'Legal',
    keywords: ['legal', 'cookies', 'policy'],
  },
  {
    id: 'terms',
    title: 'Terms of Service',
    url: '/terms',
    category: 'Legal',
    keywords: ['legal', 'terms', 'tos'],
  },
  {
    id: 'blog',
    title: 'Blog',
    url: '/blog',
    category: 'Public',
    keywords: ['blog', 'articles', 'news'],
  },
  {
    id: 'careers',
    title: 'Careers',
    url: '/careers',
    category: 'Public',
    keywords: ['careers', 'jobs', 'hiring'],
  },
  {
    id: 'login',
    title: 'Login',
    url: '/login',
    category: 'Public',
    keywords: ['login', 'sign in', 'account', 'admin'],
  },
  {
    id: 'signup',
    title: 'Sign Up',
    url: '/signup',
    category: 'Public',
    keywords: ['signup', 'register', 'account'],
  },
  // ADMIN (only as links, auth stays as-is)
  {
    id: 'admin-dashboard',
    title: 'Admin Dashboard',
    url: '/admin-dashboard',
    category: 'Admin',
    keywords: ['admin', 'dashboard', 'panel'],
  },
  {
    id: 'admin-orders',
    title: 'Admin Orders',
    url: '/admin/orders',
    category: 'Admin',
    keywords: ['admin', 'orders', 'reservations', 'bookings'],
  },
  {
    id: 'admin-cars',
    title: 'Admin Cars',
    url: '/admin/cars',
    category: 'Admin',
    keywords: ['admin', 'cars', 'fleet'],
  },
];

function filterPages(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];

  const primaryMatches = [];   // items where title/keyword starts with q
  const secondaryMatches = []; // items where title/category/keyword only includes q

  SITE_PAGES.forEach((item) => {
    const title = (item.title || '').toLowerCase();
    const category = (item.category || '').toLowerCase();
    const keywords = (item.keywords || []).map((k) => k.toLowerCase());

    const startsWithMatch =
      title.startsWith(q) ||
      keywords.some((k) => k.startsWith(q));

    const includesMatch =
      title.includes(q) ||
      category.includes(q) ||
      keywords.some((k) => k.includes(q));

    if (startsWithMatch) {
      primaryMatches.push(item);
    } else if (includesMatch) {
      secondaryMatches.push(item);
    }
  });

  // First all “starts with …” results, then the weaker matches
  return [...primaryMatches, ...secondaryMatches];
}

function initHeaderSearchAutocomplete() {
  const input = document.querySelector('.header-search__input');
  if (!input) return;

  // Create dropdown container under the search input
  let dropdown = document.querySelector('.header-search__dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.className = 'header-search__dropdown hidden';
    // append after the input wrapper (form or div)
    const parent = input.parentNode;
    parent.appendChild(dropdown);
  }

  let activeIndex = -1;
  let lastItems = [];

  function renderDropdown(items) {
    dropdown.innerHTML = '';
    activeIndex = -1;

    if (!items.length) {
      dropdown.classList.add('hidden');
      return;
    }

    const list = document.createElement('ul');
    list.className = 'header-search__list';

    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'header-search__item';
      li.dataset.url = item.url;

      li.innerHTML = `
        <span class="header-search__item-title">${item.title}</span>
        ${item.category ? `<span class="header-search__item-badge">${item.category}</span>` : ''}
      `;

      // mousedown instead of click to avoid blur before navigation
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        window.location.href = item.url;
      });

      list.appendChild(li);
    });

    dropdown.appendChild(list);
    dropdown.classList.remove('hidden');
  }

  function updateActiveItem(items, newIndex) {
    const nodes = dropdown.querySelectorAll('.header-search__item');
    nodes.forEach((node, idx) => {
      if (idx === newIndex) {
        node.classList.add('is-active');
      } else {
        node.classList.remove('is-active');
      }
    });
    activeIndex = newIndex;
  }

  input.addEventListener('input', () => {
    const value = input.value;
    lastItems = filterPages(value);
    renderDropdown(lastItems);
  });

  input.addEventListener('keydown', (e) => {
    if (!lastItems.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex =
        activeIndex < lastItems.length - 1 ? activeIndex + 1 : 0;
      updateActiveItem(lastItems, nextIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex =
        activeIndex > 0 ? activeIndex - 1 : lastItems.length - 1;
      updateActiveItem(lastItems, prevIndex);
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < lastItems.length) {
        e.preventDefault();
        window.location.href = lastItems[activeIndex].url;
      }
      // if no active item -> let the form submit normally (if there is /search)
    } else if (e.key === 'Escape') {
      dropdown.classList.add('hidden');
    }
  });

  // Hide dropdown on click outside
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== input) {
      dropdown.classList.add('hidden');
    }
  });

  // Hide on blur (slight delay to allow click/mousedown)
  input.addEventListener('blur', () => {
    setTimeout(() => {
      dropdown.classList.add('hidden');
    }, 150);
  });
}

document.addEventListener('DOMContentLoaded', initHeaderSearchAutocomplete);


