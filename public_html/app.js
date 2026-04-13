/**
 * Chocolandia.by — Static SPA
 * Client-side router + page renderers
 * Pure vanilla JS — no dependencies
 */

'use strict';

/* Base path for assets — absolute so it works from any route depth */
const BASE = window.location.origin;

/** Convert any relative asset path to absolute root-relative */
function imgPath(p) {
  if (!p) return '/assets/images/hero_banner.png';
  if (p.startsWith('http') || p.startsWith('/')) return p;
  return '/' + p;
}

/* ============================================================
   STATE
   ============================================================ */
const State = {
  data: null,         // loaded from products.json
  cart: [],           // { productId, qty }
  currentPath: '/',
  checkoutMode: false, // UI toggle for order form
};

/* ============================================================
   UTILITIES
   ============================================================ */
function slugify(str) {
  const map = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh',
    'з':'z','и':'i','й':'j','к':'k','л':'l','м':'m','н':'n','о':'o',
    'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts',
    'ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
  };
  return str.toLowerCase()
    .replace(/[а-яё]/gi, c => map[c] || c)
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatPrice(price) {
  return price.toFixed(2).replace('.', ',') + ' BYN';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getCartTotal() {
  if (!State.data) return 0;
  return State.cart.reduce((sum, item) => {
    const product = State.data.products.find(p => p.id === item.productId);
    return sum + (product ? product.price * item.qty : 0);
  }, 0);
}

function getCartCount() {
  return State.cart.reduce((sum, item) => sum + item.qty, 0);
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

function addToCart(productId) {
  const existing = State.cart.find(i => i.productId === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    State.cart.push({ productId, qty: 1 });
  }
  saveCart();
  updateCartBadge();
  showToast('Добавлено в корзину');
}

function saveCart() {
  try { localStorage.setItem('choc_cart', JSON.stringify(State.cart)); } catch (e) {}
}

function loadCart() {
  try {
    const saved = localStorage.getItem('choc_cart');
    if (saved) State.cart = JSON.parse(saved);
  } catch (e) { State.cart = []; }
}

function updateCartBadge() {
  const count = getCartCount();
  const badge = document.getElementById('cart-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

/* ============================================================
   DATA LOADING
   ============================================================ */
async function loadData() {
  if (State.data) return State.data;
  try {
    const res = await fetch('/data/products.json');
    if (!res.ok) throw new Error('Could not fetch products.json');
    State.data = await res.json();
    return State.data;
  } catch (e) {
    console.error('Data load error:', e);
    return null;
  }
}

/* ============================================================
   CART DRAWER
   ============================================================ */
function openCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  if (!drawer || !overlay) return;

  // Ensure data is loaded before rendering cart items
  const doOpen = () => {
    renderCartDrawer();
    drawer.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    bindCartDrawerEvents();
  };

  if (!State.data && State.cart.length > 0) {
    loadData().then(doOpen);
  } else {
    doOpen();
  }
}

function closeCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  if (!drawer || !overlay) return;
  drawer.classList.remove('open');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  // Reset checkout mode when closed
  State.checkoutMode = false;
}

function renderCartDrawer() {
  const body   = document.getElementById('cart-drawer-body');
  const footer = document.getElementById('cart-drawer-footer');
  const countEl = document.getElementById('cart-drawer-count');
  const totalEl = document.getElementById('cart-summary-total');

  const count = getCartCount();
  if (countEl) countEl.textContent = count;

  if (!body) return;

  if (State.cart.length === 0) {
    // Empty state
    State.checkoutMode = false; // reset
    body.innerHTML = `
    <div class="cart-empty">
      <div class="cart-empty-icon">
        <span class="material-symbols-outlined" style="font-size:32px">shopping_bag</span>
      </div>
      <div>
        <p class="cart-empty-title">Корзина пуста</p>
        <p class="cart-empty-desc">Добавьте что-нибудь вкусное из нашего каталога 🍫</p>
      </div>
      <a href="/collections" data-route="/collections"
         class="btn btn-outline"
         onclick="closeCartDrawer()"
         style="margin-top:0.5rem">
        Перейти в каталог
      </a>
    </div>`;
    if (footer) footer.classList.add('hidden');
  } else if (State.checkoutMode) {
    // Checkout form view
    renderCheckoutForm(body, footer);
  } else {
    // Items list
    body.innerHTML = State.cart.map(item => {
      const product = State.data?.products.find(p => p.id === item.productId);
      if (!product) return '';
      const imgSrc = imgPath(product.image);
      const lineTotal = (product.price * item.qty).toFixed(2).replace('.', ',');
      return `
      <div class="cart-item" data-cart-item="${escapeHtml(item.productId)}">
        <div class="cart-item-img">
          <img src="${imgSrc}"
               alt="${escapeHtml(product.name)}"
               onerror="this.src='/assets/images/hero_banner.png'" />
        </div>
        <div class="cart-item-info">
          <span class="cart-item-name"
                data-route="/product/${escapeHtml(product.slug)}"
                onclick="closeCartDrawer();navigate('/product/${escapeHtml(product.slug)}')">
            ${escapeHtml(product.name)}
          </span>
          ${product.weight ? `<span class="cart-item-weight">${escapeHtml(product.weight)}</span>` : ''}
          <div class="cart-item-price-row">
            <span class="cart-item-price">${lineTotal} BYN</span>
          </div>
          <div class="cart-item-qty">
            <button class="cart-item-qty-btn"
                    data-cart-dec="${escapeHtml(item.productId)}"
                    aria-label="Уменьшить количество">−</button>
            <span class="cart-item-qty-val">${item.qty}</span>
            <button class="cart-item-qty-btn"
                    data-cart-inc="${escapeHtml(item.productId)}"
                    aria-label="Увеличить количество">+</button>
          </div>
        </div>
        <button class="cart-item-remove"
                data-cart-remove="${escapeHtml(item.productId)}"
                aria-label="Удалить из корзины">
          <span class="material-symbols-outlined" style="font-size:18px">delete_outline</span>
        </button>
      </div>`;
    }).join('');

    if (footer) {
      footer.classList.remove('hidden');
      footer.innerHTML = `
      <div class="cart-summary">
        <div class="cart-summary-row">
          <span class="cart-summary-label">Итого</span>
          <span class="cart-summary-total" id="cart-summary-total">
            ${getCartTotal().toFixed(2).replace('.', ',')} BYN
          </span>
        </div>
        <p class="cart-summary-note">Доставка рассчитывается при оформлении заказа</p>
      </div>
      <div class="cart-checkout-actions">
        <button class="btn btn-primary cart-checkout-btn" onclick="toggleCheckout(true)">
          Оформить заказ
        </button>
      </div>`;
    }
  }
}

function renderCheckoutForm(body, footer) {
  body.innerHTML = `
  <div class="checkout-view">
    <div class="checkout-back-btn" onclick="toggleCheckout(false)">
      <span class="material-symbols-outlined" style="font-size:16px">arrow_back</span>
      Назад к покупкам
    </div>
    <h3 class="checkout-title">Данные для заказа</h3>
    <div class="checkout-form">
      <div class="form-group">
        <label for="checkout-name">Ваше имя <span class="required-asterisk">*</span></label>
        <input type="text" id="checkout-name" class="form-input" placeholder="Иван Иванов" required>
      </div>
      <div class="form-group">
        <label for="checkout-phone">Телефон <span class="required-asterisk">*</span></label>
        <input type="tel" id="checkout-phone" class="form-input" placeholder="+375 (__) ___-__-__" required>
      </div>
      <div class="form-group">
        <label for="checkout-address">Адрес доставки <span class="required-asterisk">*</span></label>
        <textarea id="checkout-address" class="form-textarea" placeholder="Город, улица, дом, квартира" required></textarea>
      </div>
      <div class="form-group">
        <label for="checkout-comment">Комментарий</label>
        <textarea id="checkout-comment" class="form-textarea" placeholder="Ваши пожелания"></textarea>
      </div>
    </div>
  </div>`;

  if (footer) {
    footer.innerHTML = `
    <div class="cart-summary" style="margin-bottom: 0.5rem">
      <div class="cart-summary-row">
        <span class="cart-summary-label">К оплате (без доставки)</span>
        <span class="cart-summary-total" style="font-size: 1.25rem">
          ${getCartTotal().toFixed(2).replace('.', ',')} BYN
        </span>
      </div>
    </div>
    <div class="cart-checkout-actions">
      <button class="btn btn-primary cart-checkout-btn" onclick="sendOrderTelegram()">
        <span class="material-symbols-outlined" style="font-size:18px">send</span>
        Отправить заказ
      </button>
    </div>`;
  }
}

function toggleCheckout(toCheckout) {
  State.checkoutMode = toCheckout;
  renderCartDrawer();
  if (!toCheckout) {
    bindCartDrawerEvents();
  }
}

async function sendOrderTelegram() {
  const nameEl    = document.getElementById('checkout-name');
  const phoneEl   = document.getElementById('checkout-phone');
  const addressEl = document.getElementById('checkout-address');
  const commentEl = document.getElementById('checkout-comment');

  const name    = nameEl?.value.trim() || '';
  const phone   = phoneEl?.value.trim() || '';
  const address = addressEl?.value.trim() || '';
  const comment = commentEl?.value.trim() || '';

  let hasError = false;

  [nameEl, phoneEl, addressEl].forEach(el => {
    if (el) {
      if (!el.value.trim()) {
        el.classList.add('error');
        hasError = true;
        // remove error when user types
        el.addEventListener('input', () => el.classList.remove('error'), { once: true });
      } else {
        el.classList.remove('error');
      }
    }
  });

  if (hasError) {
    showToast('\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0437\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u043f\u043e\u043b\u044f, \u0432\u044b\u0434\u0435\u043b\u0435\u043d\u043d\u044b\u0435 \u043a\u0440\u0430\u0441\u043d\u044b\u043c.');
    return;
  }

  // Build items array for PHP backend (no raw Telegram formatting here)
  const items = State.cart.map(item => {
    const p = State.data.products.find(pr => pr.id === item.productId);
    if (!p) return null;
    return {
      name:      p.name,
      weight:    p.weight || '',
      qty:       item.qty,
      lineTotal: (p.price * item.qty).toFixed(2).replace('.', ','),
      url:       `${window.location.origin}/product/${p.slug}`
    };
  }).filter(Boolean);

  const total = getCartTotal().toFixed(2).replace('.', ',');

  // Show loading state on submit button
  const btn = document.querySelector('[onclick*="sendOrderTelegram"]');
  const originalHTML = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px">' +
                    'hourglass_empty</span> \u041e\u0442\u043f\u0440\u0430\u0432\u043b\u044f\u0435\u043c...';
  }

  try {
    const res = await fetch('/api/order.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, phone, address, comment, items, total }),
    });

    const data = await res.json();

    if (data.ok) {
      // Success — clear cart and show confirmation
      State.cart = [];
      State.checkoutMode = false;
      saveCart();
      updateCartBadge();
      closeCartDrawer();
      showToast('\u2705 \u0417\u0430\u043a\u0430\u0437 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d! \u041c\u044b \u0441\u0432\u044f\u0436\u0435\u043c\u0441\u044f \u0441 \u0432\u0430\u043c\u0438.');
    } else {
      showToast('\u274c \u041e\u0448\u0438\u0431\u043a\u0430: ' + (data.error || '\u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0441\u043d\u043e\u0432\u0430'));
      if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
    }
  } catch (err) {
    showToast('\u274c \u041d\u0435\u0442 \u0441\u043e\u0435\u0434\u0438\u043d\u0435\u043d\u0438\u044f. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442 \u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435 \u043f\u043e\u043f\u044b\u0442\u043a\u0443.');
    if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
  }
}


function updateCheckoutLinks() {
  if (!State.data || State.cart.length === 0) return;
  const lines = State.cart.map(item => {
    const p = State.data.products.find(pr => pr.id === item.productId);
    if (!p) return '';
    return `• ${p.name}${p.weight ? ' (' + p.weight + ')' : ''} × ${item.qty} = ${(p.price * item.qty).toFixed(2).replace('.', ',')} BYN`;
  }).filter(Boolean);
  const total = getCartTotal().toFixed(2).replace('.', ',');
  const msg = `Добрый день! Хочу сделать заказ:\n\n${lines.join('\n')}\n\nИтого: ${total} BYN`;

  const igBtn = document.getElementById('cart-checkout-instagram');
  const tgBtn = document.getElementById('cart-checkout-telegram');

  if (tgBtn) {
    tgBtn.href = `https://t.me/maryiskrova?text=${encodeURIComponent(msg)}`;
  }
  if (igBtn) {
    igBtn.href = 'https://www.instagram.com/chocolandia.by/';
  }
}

/* ============================================================
   MOBILE SIDEBAR
   ============================================================ */
function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar || !overlay) return;
  sidebar.classList.add('open');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar || !overlay) return;
  sidebar.classList.remove('open');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function bindCartDrawerEvents() {
  const body = document.getElementById('cart-drawer-body');
  if (!body) return;
  // Event delegation on the drawer body
  body.querySelectorAll('[data-cart-dec]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-cart-dec');
      cartChangeQty(id, -1);
    });
  });
  body.querySelectorAll('[data-cart-inc]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-cart-inc');
      cartChangeQty(id, 1);
    });
  });
  body.querySelectorAll('[data-cart-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-cart-remove');
      cartRemoveItem(id);
    });
  });
}

function cartChangeQty(productId, delta) {
  const item = State.cart.find(i => i.productId === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    State.cart = State.cart.filter(i => i.productId !== productId);
  }
  saveCart();
  updateCartBadge();
  renderCartDrawer();
  bindCartDrawerEvents();
}

function cartRemoveItem(productId) {
  State.cart = State.cart.filter(i => i.productId !== productId);
  saveCart();
  updateCartBadge();
  renderCartDrawer();
  bindCartDrawerEvents();
}


/* ============================================================
   ROUTER
   ============================================================ */
const routes = [
  { pattern: /^\/$/, handler: renderHome },
  { pattern: /^\/collections$/, handler: renderCollections },
  { pattern: /^\/collections\/([^/]+)$/, handler: (m) => renderCollectionPage(m[1]) },
  { pattern: /^\/product\/([^/]+)$/, handler: (m) => renderProductPage(m[1]) },
  { pattern: /^\/privacy$/, handler: renderPrivacy },
];

async function renderPrivacy() {
  return `
<div class="page-transition-enter">
  <div class="page-wrapper">
    <div class="container" style="padding-top:4rem; padding-bottom:6rem; max-width:800px">
      <h1 class="text-headline-md" style="margin-bottom:2rem">Политика конфиденциальности</h1>
      <div class="product-desc" style="font-size:1rem; opacity:0.8">
        <p style="margin-bottom:1.5rem">Ваша конфиденциальность важна для нас. Мы собираем только те данные, которые необходимы для обработки вашего заказа (имя, телефон, адрес).</p>
        <p style="margin-bottom:1.5rem">Мы не передаем ваши данные третьим лицам, за исключением служб доставки (Белпочта/Европочта) для выполнения вашего заказа.</p>
        <p style="margin-bottom:1.5rem">Ваши данные хранятся в безопасности и используются только для связи с вами по поводу заказов в Chocolandia.by.</p>
      </div>
      <a href="/" data-route="/" class="btn btn-outline" style="margin-top:2rem">На главную</a>
    </div>
  </div>
</div>`;
}

async function navigate(path, pushState = true) {
  if (pushState && path !== window.location.pathname) {
    history.pushState({}, '', path);
  }
  State.currentPath = path;
  updateNavActive(path);
  updateBottomNavActive(path);

  const app = document.getElementById('app');
  if (!app) return;

  // Show loading state
  app.innerHTML = `<div style="min-height:60vh;display:flex;align-items:center;justify-content:center;">
    <div class="skeleton" style="width:200px;height:24px;border-radius:4px;"></div>
  </div>`;

  await loadData();

  // Match route
  let matched = false;
  for (const route of routes) {
    const m = path.match(route.pattern);
    if (m) {
      const html = await route.handler(m);
      app.innerHTML = html;
      app.firstElementChild?.classList.add('page-transition-enter');
      bindPageEvents(path, m);
      matched = true;
      break;
    }
  }

  if (!matched) {
    app.innerHTML = renderNotFound();
    app.firstElementChild?.classList.add('page-transition-enter');
  }

  window.scrollTo({ top: 0, behavior: 'instant' });

  // Close mobile sidebar if open
  closeSidebar();

  // Update SEO title
  updatePageTitle(path);

  // Handle hash if present in original path (e.g. from data-route)
  const hash = window.location.hash;
  if (hash) {
    const el = document.querySelector(hash);
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }
}

function updatePageTitle(path) {
  const titleMap = {
    '/': 'Chocolandia.by — Шоколад ручной работы',
    '/collections': 'Все коллекции — Chocolandia.by',
  };
  if (titleMap[path]) {
    document.title = titleMap[path];
    return;
  }
  const collMatch = path.match(/^\/collections\/([^/]+)$/);
  if (collMatch && State.data) {
    const coll = State.data.collections.find(c => c.slug === collMatch[1]);
    if (coll) document.title = `${coll.name} — Chocolandia.by`;
  }
  const prodMatch = path.match(/^\/product\/([^/]+)$/);
  if (prodMatch && State.data) {
    const prod = State.data.products.find(p => p.slug === prodMatch[1]);
    if (prod) document.title = `${prod.name} — Chocolandia.by`;
  }
}

function updateNavActive(path) {
  document.querySelectorAll('.nav-links a').forEach(a => {
    const route = a.getAttribute('data-route');
    const isActive = path === route || (route !== '/' && path.startsWith(route));
    a.classList.toggle('active', isActive);
  });
}

function updateBottomNavActive(path) {
  const items = {
    'bnav-home': '/',
    'bnav-collections': '/collections',
    'bnav-gifts': '/collections/gifts',
  };
  Object.entries(items).forEach(([id, route]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const isActive = path === route || (route !== '/' && path.startsWith(route));
    el.classList.toggle('active', isActive);
  });
}

/* ============================================================
   EVENT DELEGATION — intercept all <a data-route> clicks
   ============================================================ */
function initRouter() {
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-route]');
    if (!a) return;
    e.preventDefault();
    const route = a.getAttribute('data-route');
    if (route) navigate(route);
  });

  window.addEventListener('popstate', () => {
    navigate(window.location.pathname, false);
  });

  // Cart buttons — open drawer
  document.getElementById('bnav-cart')?.addEventListener('click', openCartDrawer);
  document.getElementById('cart-btn')?.addEventListener('click', openCartDrawer);

  // Close drawer
  document.getElementById('cart-drawer-close')?.addEventListener('click', closeCartDrawer);
  document.getElementById('cart-overlay')?.addEventListener('click', closeCartDrawer);

  // Mobile sidebar
  document.getElementById('hamburger-btn')?.addEventListener('click', openSidebar);
  document.getElementById('sidebar-close')?.addEventListener('click', closeSidebar);
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);

  // Close all on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeCartDrawer();
      closeSidebar();
    }
  });

  // Handle hash links for sections on the same page
  handleInitialHash();
}

function handleInitialHash() {
  if (window.location.hash) {
    setTimeout(() => {
      const el = document.querySelector(window.location.hash);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 500);
  }
}

/* ============================================================
   BIND PAGE EVENTS (called after each render)
   ============================================================ */
function bindPageEvents(path, match) {
  // Add-to-cart buttons
  document.querySelectorAll('[data-add-to-cart]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-add-to-cart');
      addToCart(id);
    });
  });

  // Qty controls on product detail
  const qtyDec = document.getElementById('qty-dec');
  const qtyInc = document.getElementById('qty-inc');
  const qtyVal = document.getElementById('qty-val');

  if (qtyDec && qtyInc && qtyVal) {
    let qty = 1;
    qtyDec.addEventListener('click', () => {
      if (qty > 1) qty--;
      qtyVal.textContent = qty;
    });
    qtyInc.addEventListener('click', () => {
      qty++;
      qtyVal.textContent = qty;
    });

    // Main add-to-cart on product detail
    document.getElementById('detail-add-btn')?.addEventListener('click', () => {
      const productId = document.getElementById('detail-add-btn').getAttribute('data-product-id');
      for (let i = 0; i < qty; i++) addToCart(productId);
    });

    document.getElementById('mobile-add-btn')?.addEventListener('click', () => {
      const productId = document.getElementById('mobile-add-btn').getAttribute('data-product-id');
      for (let i = 0; i < qty; i++) addToCart(productId);
    });
  }

  // Collection filter chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const filter = chip.getAttribute('data-filter');
      filterProducts(filter);
    });
  });

  // Hero CTA
  document.getElementById('hero-cta')?.addEventListener('click', () => navigate('/collections'));
  document.getElementById('hero-process')?.addEventListener('click', () => {
    document.getElementById('about-section')?.scrollIntoView({ behavior: 'smooth' });
  });

  // Newsletter form
  document.getElementById('newsletter-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const input = e.target.querySelector('input[type="email"]');
    if (input?.value) {
      showToast('Спасибо! Вы подписались на новости 🍫');
      input.value = '';
    }
  });
}

function filterProducts(filter) {
  const grid = document.getElementById('product-grid');
  if (!grid) return;
  const cards = grid.querySelectorAll('[data-collection]');
  cards.forEach(card => {
    if (filter === 'all' || card.getAttribute('data-collection') === filter) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}

/* ============================================================
   COMPONENT BUILDERS
   ============================================================ */
function buildBadge(text, type = 'primary') {
  if (!text) return '';
  return `<span class="badge badge-${type}">${escapeHtml(text)}</span>`;
}

function buildProductCard(product) {
  const imgSrc = imgPath(product.image);
  const fallback = '/assets/images/hero_banner.png';
  return `
  <a href="/product/${escapeHtml(product.slug)}"
     data-route="/product/${escapeHtml(product.slug)}"
     class="product-card"
     id="prod-card-${escapeHtml(product.id)}">
    <div class="product-card-img-wrap">
      <img src="${imgSrc}"
           alt="${escapeHtml(product.name)}"
           loading="lazy"
           onerror="this.src='${fallback}'" />
      ${product.badge ? `<div class="product-card-badge">${buildBadge(product.badge)}</div>` : ''}
    </div>
    <div class="product-card-body">
      <div class="product-card-name">${escapeHtml(product.name)}</div>
      ${product.weight ? `<div class="product-card-sub">${escapeHtml(product.weight)}</div>` : ''}
      <div class="product-card-footer">
        <div class="product-card-price">
          ${product.price.toFixed(2).replace('.', ',')}
          <span class="currency">BYN</span>
        </div>
        <button class="product-card-action-btn"
                data-add-to-cart="${escapeHtml(product.id)}"
                aria-label="Добавить в корзину">
          <span class="material-symbols-outlined" style="font-size:18px">add_shopping_cart</span>
          <span>В корзину</span>
        </button>
      </div>
    </div>
  </a>`;
}

function buildCollectionCard(collection) {
  const imgSrc = imgPath(collection.image);
  const fallback = '/assets/images/hero_banner.png';
  return `
  <a href="/collections/${escapeHtml(collection.slug)}"
     data-route="/collections/${escapeHtml(collection.slug)}"
     class="collection-card"
     id="coll-card-${escapeHtml(collection.id)}">
    <img src="${imgSrc}"
         alt="${escapeHtml(collection.name)}"
         loading="lazy"
         onerror="this.src='${fallback}'" />
    <div class="collection-card-overlay"></div>
    <div class="collection-card-body">
      ${collection.badge ? `<div style="margin-bottom:0.75rem">${buildBadge(collection.badge, 'white')}</div>` : ''}
      <h3 style="font-family:var(--font-headline);color:white;font-size:clamp(1.25rem,2.5vw,1.875rem);line-height:1.1;margin-bottom:0.5rem">
        ${escapeHtml(collection.name)}
      </h3>
      <p style="color:rgba(255,255,255,0.72);font-size:0.8125rem;line-height:1.55;margin-bottom:1rem">
        ${escapeHtml(collection.description)}
      </p>
      <span class="btn-ghost" style="font-size:0.5625rem">
        Смотреть
        <span class="material-symbols-outlined" style="font-size:14px">arrow_forward</span>
      </span>
    </div>
  </a>`;
}

/* ============================================================
   PAGE: HOME
   ============================================================ */
async function renderHome() {
  const data = State.data;
  const featured = data?.collections.filter(c => c.featured) || [];
  const mainColl = featured[0] || {};
  const sideColl = featured[1] || {};
  const extraA   = featured[2] || {};
  const extraB   = featured[3] || {};
  const bestProducts = data?.products.filter(p => p.badge === 'Хит' || p.badge === 'Тренд').slice(0, 4) || [];

  return `
<div class="page-transition-enter">

  <!-- ── HERO ── -->
  <section class="hero" id="hero">
    <div class="hero-bg">
      <img src="/assets/images/hero_banner.png" alt="Chocolandia — шоколад ручной работы" />
    </div>
    <div class="hero-overlay"></div>
    <div class="hero-overlay-bottom"></div>
    <div class="hero-content">
      <div style="max-width:600px">
        <div class="hero-badge">Ручная работа · Беларусь</div>
        <h1 class="hero-title">
          Шоколад,<br />который <em>создан с душой</em>
        </h1>
        <p class="hero-subtitle">
          Авторский шоколад ручной работы — дубайский шоколад, клубника, трюфели и уникальные фигурки. Доставка по Беларуси.
        </p>
        <div class="hero-actions">
          <button class="btn btn-primary" id="hero-cta">Смотреть коллекции</button>
          <button class="btn btn-outline-white" id="hero-process">О нас</button>
        </div>
      </div>
    </div>
  </section>

  <!-- ── BENTO GRID ── -->
  <section class="section-pad bg-surface" id="collections-section">
    <div class="container">
      <div class="section-header">
        <div>
          <p class="section-eyebrow">Наши коллекции</p>
          <h2 class="section-title">Вкусы, которые <br />запоминаются</h2>
        </div>
        <div class="section-divider"></div>
        <a href="/collections" data-route="/collections"
           class="btn-ghost" style="white-space:nowrap;font-size:0.625rem">
          Все коллекции
          <span class="material-symbols-outlined" style="font-size:14px">arrow_forward</span>
        </a>
      </div>

      <div class="bento-grid">
        <!-- Main large card -->
        <a href="/collections/${escapeHtml(mainColl.slug || 'strawberry')}"
           data-route="/collections/${escapeHtml(mainColl.slug || 'strawberry')}"
           class="bento-card bento-main">
          <img src="${imgPath(mainColl.image || 'assets/images/strawberry_chocolate.png')}"
               alt="${escapeHtml(mainColl.name || '')}"
               loading="lazy"
               onerror="this.src='/assets/images/hero_banner.png'" />
          <div class="bento-card-overlay"></div>
          <div class="bento-card-content">
            <span class="bento-card-eyebrow">Коллекция</span>
            <h3 class="bento-card-title">${escapeHtml(mainColl.name || 'Клубника в шоколаде')}</h3>
            <p class="bento-card-desc">${escapeHtml(mainColl.description || '')}</p>
          </div>
        </a>

        <!-- Side card -->
        <a href="/collections/${escapeHtml(sideColl.slug || 'dubai')}"
           data-route="/collections/${escapeHtml(sideColl.slug || 'dubai')}"
           class="bento-card bento-side">
          <img src="${imgPath(sideColl.image || 'assets/images/dubai_chocolate.png')}"
               alt="${escapeHtml(sideColl.name || '')}"
               loading="lazy"
               onerror="this.src='/assets/images/hero_banner.png'" />
          <div class="bento-card-overlay"></div>
          <div class="bento-card-content">
            <span class="bento-card-eyebrow">Коллекция</span>
            <h3 class="bento-card-title" style="font-size:1.5rem">${escapeHtml(sideColl.name || 'Дубайский шоколад')}</h3>
          </div>
        </a>

        <!-- Mini A -->
        <a href="/collections/${escapeHtml(extraA.slug || 'truffles')}"
           data-route="/collections/${escapeHtml(extraA.slug || 'truffles')}"
           class="bento-card bento-mini">
          <img src="${imgPath(extraA.image || 'assets/images/truffles.png')}"
               alt="${escapeHtml(extraA.name || '')}"
               loading="lazy"
               onerror="this.src='/assets/images/hero_banner.png'" />
          <div class="bento-card-overlay"></div>
          <div class="bento-card-content">
            <span class="bento-card-eyebrow">Коллекция</span>
            <h3 class="bento-card-title" style="font-size:1.375rem">${escapeHtml(extraA.name || 'Трюфели')}</h3>
          </div>
        </a>

        <!-- Featured dark card -->
        <a href="/collections/${escapeHtml(extraB.slug || 'gifts')}"
           data-route="/collections/${escapeHtml(extraB.slug || 'gifts')}"
           class="bento-featured-card bento-featured">
          <div class="bento-featured-badge">Популярное</div>
          <div class="bento-featured-text">
            <h3>${escapeHtml(extraB.name || 'Подарочные наборы')}</h3>
            <p>${escapeHtml(extraB.description || 'Изысканные подарочные наборы в фирменной упаковке.')}</p>
            <span class="btn-ghost">
              Смотреть наборы
              <span class="material-symbols-outlined" style="font-size:14px">arrow_forward</span>
            </span>
          </div>
          <div class="bento-featured-img">
            <img src="${imgPath(extraB.image || 'assets/images/gift_box.png')}"
                 alt="${escapeHtml(extraB.name || '')}"
                 loading="lazy"
                 onerror="this.src='/assets/images/hero_banner.png'" />
          </div>
        </a>
      </div>
    </div>
  </section>

  <!-- ── BESTSELLERS ── -->
  ${bestProducts.length > 0 ? `
  <section class="section-pad" style="background:var(--color-surface-container-low)">
    <div class="container">
      <div class="section-header">
        <div>
          <p class="section-eyebrow">Хиты продаж</p>
          <h2 class="section-title">Самое популярное</h2>
        </div>
        <div class="section-divider"></div>
        <a href="/collections" data-route="/collections" class="btn-ghost" style="white-space:nowrap;font-size:0.625rem">
          Все товары
          <span class="material-symbols-outlined" style="font-size:14px">arrow_forward</span>
        </a>
      </div>
      <div class="product-grid">
        ${bestProducts.map(buildProductCard).join('')}
      </div>
    </div>
  </section>` : ''}

  <!-- ── ABOUT / HERITAGE ── -->
  <section class="heritage-section" id="about-section">
    <div class="container">
      <div class="heritage-grid">
        <div class="heritage-img-wrap">
          <div class="heritage-img-main">
            <img src="/assets/images/truffles.png"
                 alt="Chocolandia — шоколад ручной работы"
                 loading="lazy" />
          </div>
          <div class="heritage-quote-card">
            <p>«Каждая конфета — это маленькое произведение искусства, сделанное с любовью.»</p>
          </div>
        </div>
        <div style="padding-top:2rem">
          <p class="section-eyebrow">О нас</p>
          <h2 class="text-headline-lg" style="color:var(--color-primary);margin-bottom:1.5rem;margin-top:0.5rem">
            Шоколад — это <br />наша страсть
          </h2>
          <p style="color:var(--color-on-surface-variant);line-height:1.75;font-size:1rem;margin-bottom:1.5rem">
            Chocolandia — это небольшая мастерская авторского шоколада в Беларуси. Мы создаём шоколадные изделия вручную, используя только лучший бельгийский шоколад и натуральные ингредиенты.
          </p>
          <p style="color:var(--color-on-surface-variant);line-height:1.75;font-size:1rem;margin-bottom:2rem">
            От трендового дубайского шоколада до классических трюфелей и неповторимых пасхальных фигурок — каждое изделие создаётся с вниманием к деталям и любовью к своему делу.
          </p>
          <div class="heritage-stats">
            <div class="heritage-stat">
              <h4>100%</h4>
              <p>Ручная работа</p>
            </div>
            <div class="heritage-stat">
              <h4>Бельг.</h4>
              <p>Шоколад</p>
            </div>
            <div class="heritage-stat">
              <h4>Любые</h4>
              <p>Поводы</p>
            </div>
            <div class="heritage-stat">
              <h4>Доставка</h4>
              <p>По Беларуси</p>
            </div>
          </div>
          <a href="/collections" data-route="/collections" class="btn btn-outline" style="margin-top:0.5rem">
            Смотреть все коллекции
          </a>
        </div>
      </div>
    </div>
  </section>

  <!-- ── NEWSLETTER ── -->
  <section class="newsletter-section" id="contact-section">
    <div class="container" style="max-width:600px">
      <p class="section-eyebrow" style="color:var(--color-secondary-fixed);margin-bottom:0.75rem">Контакты</p>
      <h2>Будьте на связи</h2>
      <p>Следите за новинками в Instagram или пишите нам напрямую в Telegram.</p>
      <div style="display:flex;gap:1rem;justify-content:center;margin-bottom:3rem">
         <a href="https://www.instagram.com/chocolandia.by/" target="_blank" class="btn btn-secondary">Instagram</a>
         <a href="https://t.me/maryiskrova" target="_blank" class="btn btn-outline-white">Telegram</a>
      </div>
      <p style="opacity:0.6;font-size:0.875rem">Подпишитесь на нашу рассылку:</p>
      <form class="newsletter-form" id="newsletter-form" novalidate>
        <input type="email" class="newsletter-input" placeholder="Ваш email" required aria-label="Email адрес" />
        <button type="submit" class="btn btn-secondary" style="white-space:nowrap;padding:1rem 1.875rem">
          Подписаться
        </button>
      </form>
    </div>
  </section>

  <!-- ── DELIVERY INFO ── -->
  <section class="section-pad bg-surface-low" id="delivery-section">
    <div class="container text-center">
       <p class="section-eyebrow">Доставка</p>
       <h2 class="section-title">Как мы доставляем радость</h2>
       <div class="perks-grid" style="max-width:800px;margin:3rem auto;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr))">
          <div class="perk" style="flex-direction:column;text-align:center;gap:1rem">
             <span class="material-symbols-outlined" style="font-size:40px;color:var(--color-secondary)">local_shipping</span>
             <p style="font-weight:700">По всей Беларуси</p>
             <p style="font-size:0.875rem;opacity:0.7">Отправляем Европочтой или Белпочтой в любой город.</p>
          </div>
          <div class="perk" style="flex-direction:column;text-align:center;gap:1rem">
             <span class="material-symbols-outlined" style="font-size:40px;color:var(--color-secondary)">schedule</span>
             <p style="font-weight:700">Сроки 1-3 дня</p>
             <p style="font-size:0.875rem;opacity:0.7">Изготовление и отправка в кратчайшие сроки.</p>
          </div>
          <div class="perk" style="flex-direction:column;text-align:center;gap:1rem">
             <span class="material-symbols-outlined" style="font-size:40px;color:var(--color-secondary)">package_2</span>
             <p style="font-weight:700">Надежная упаковка</p>
             <p style="font-size:0.875rem;opacity:0.7">Каждое изделие бережно упаковывается для сохранности.</p>
          </div>
       </div>
    </div>
  </section>

</div>`;
}

/* ============================================================
   PAGE: COLLECTIONS OVERVIEW
   ============================================================ */
async function renderCollections() {
  const data = State.data;
  const collections = data?.collections.sort((a, b) => a.sortOrder - b.sortOrder) || [];

  return `
<div class="page-transition-enter">
  <div class="page-wrapper">

    <!-- Header strip -->
    <div style="background:var(--color-primary);padding:4rem 1.5rem 3rem">
      <div class="container">
        <div class="breadcrumbs" style="padding:0;margin-bottom:1.5rem;opacity:0.6">
          <a href="/" data-route="/" style="color:rgba(255,255,255,0.6)">Главная</a>
          <span class="material-symbols-outlined">chevron_right</span>
          <span style="color:white" class="active">Каталог</span>
        </div>
        <p class="section-eyebrow" style="color:var(--color-secondary-fixed);margin-bottom:0.5rem">Каталог</p>
        <h1 class="text-headline-lg" style="color:white;line-height:1">Все коллекции</h1>
        <p style="color:rgba(255,255,255,0.7);margin-top:0.875rem;max-width:480px;font-size:0.9375rem">
          Авторский шоколад для каждого вкуса и каждого повода.
        </p>
      </div>
    </div>

    <div class="section-pad" style="padding-top:3rem">
      <div class="collections-overview-grid">
        ${collections.map(buildCollectionCard).join('')}
      </div>
    </div>

  </div>
</div>`;
}

/* ============================================================
   PAGE: COLLECTION PRODUCT GRID
   ============================================================ */
async function renderCollectionPage(slug) {
  const data = State.data;
  const collection = data?.collections.find(c => c.slug === slug);
  const allProducts = data?.products.filter(p => p.collectionId === slug) || [];

  if (!collection) return renderNotFound();

  return `
<div class="page-transition-enter">
  <div class="page-wrapper">

    <!-- Collection Hero -->
    <div class="collection-hero">
      <div class="collection-hero-bg">
        <img src="${imgPath(collection.image)}"
             alt="${escapeHtml(collection.name)}"
             onerror="this.src='/assets/images/hero_banner.png'" />
      </div>
      <div class="container">
        <div class="breadcrumbs" style="padding:0;margin-bottom:1.5rem;opacity:0.6">
          <a href="/" data-route="/" style="color:rgba(255,255,255,0.6)">Главная</a>
          <span class="material-symbols-outlined">chevron_right</span>
          <a href="/collections" data-route="/collections" style="color:rgba(255,255,255,0.6)">Каталог</a>
          <span class="material-symbols-outlined">chevron_right</span>
          <span class="active" style="color:white">${escapeHtml(collection.name)}</span>
        </div>
        <div class="collection-hero-content">
          ${collection.badge ? `<div class="collection-hero-badge">${escapeHtml(collection.badge)}</div>` : ''}
          <h1 class="collection-hero-title">${escapeHtml(collection.name)}</h1>
          <p class="collection-hero-desc">${escapeHtml(collection.description)}</p>
        </div>
      </div>
    </div>

    <!-- Filter bar -->
    <div style="background:var(--color-surface);padding:1.5rem 0 0">
      <div class="filter-bar">
        <button class="filter-chip active" data-filter="all">Все</button>
        ${allProducts.filter(p => p.badge).map(p =>
          `<button class="filter-chip" data-filter="${escapeHtml(p.id)}">${escapeHtml(p.badge)}</button>`
        ).filter((v, i, a) => a.indexOf(v) === i).join('')}
      </div>
    </div>

    <!-- Product grid -->
    <div class="section-pad" style="padding-top:2rem;background:var(--color-surface)">
      <div class="container">
        ${allProducts.length > 0 ? `
        <p style="font-family:var(--font-label);font-size:0.625rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--color-on-surface-variant);margin-bottom:1.5rem">
          ${allProducts.length} ${allProducts.length === 1 ? 'товар' : allProducts.length < 5 ? 'товара' : 'товаров'}
        </p>
        <div class="product-grid" id="product-grid">
          ${allProducts.map(p =>
            `<div data-collection="${escapeHtml(p.id)}">${buildProductCard(p)}</div>`
          ).join('')}
        </div>
        ` : `
        <div class="not-found">
          <p style="color:var(--color-on-surface-variant)">Товары в этой коллекции скоро появятся</p>
          <a href="/collections" data-route="/collections" class="btn btn-outline" style="margin-top:1rem">
            Назад к каталогу
          </a>
        </div>`}
      </div>
    </div>

  </div>
</div>`;
}

/* ============================================================
   PAGE: PRODUCT DETAIL
   ============================================================ */
async function renderProductPage(slug) {
  const data = State.data;
  const product = data?.products.find(p => p.slug === slug);

  if (!product) return renderNotFound();

  const collection = data?.collections.find(c => c.id === product.collectionId);
  const related = data?.products
    .filter(p => p.collectionId === product.collectionId && p.id !== product.id)
    .slice(0, 4) || [];

  return `
<div class="page-transition-enter">
  <div class="page-wrapper">

    <!-- Breadcrumbs -->
    <div class="container" style="padding-top:2rem">
      <div class="breadcrumbs">
        <a href="/" data-route="/">Главная</a>
        <span class="material-symbols-outlined">chevron_right</span>
        <a href="/collections" data-route="/collections">Каталог</a>
        <span class="material-symbols-outlined">chevron_right</span>
        ${collection ? `<a href="/collections/${escapeHtml(collection.slug)}"
             data-route="/collections/${escapeHtml(collection.slug)}">${escapeHtml(collection.name)}</a>
          <span class="material-symbols-outlined">chevron_right</span>` : ''}
        <span class="active">${escapeHtml(product.name)}</span>
      </div>
    </div>

    <!-- Detail grid -->
    <div class="product-detail-grid container" style="padding-top:1rem">

      <!-- Image Gallery -->
      <div class="product-gallery">
        <div class="product-gallery-main">
          <img src="${imgPath(product.image)}"
               alt="${escapeHtml(product.name)}"
               onerror="this.src='/assets/images/hero_banner.png'" />
        </div>
      </div>

      <!-- Product Info Panel -->
      <div class="product-info-panel">

        <!-- Badge + Name + Price -->
        <div>
          <div class="product-badge-row">
            ${product.badge ? buildBadge(product.badge) : ''}
            ${product.inStock
              ? `<span class="badge" style="background:rgba(0,120,0,0.1);color:#1a6b1a">В наличии</span>`
              : `<span class="badge" style="background:rgba(186,26,26,0.1);color:var(--color-error)">Нет в наличии</span>`}
          </div>
          <h1 class="product-name" style="margin:1rem 0 0.75rem">${escapeHtml(product.name)}</h1>
          <div class="product-price">
            ${product.price.toFixed(2).replace('.', ',')}
            <span class="currency">BYN</span>
            ${product.weight ? `<span style="font-size:0.875rem;font-family:var(--font-body);font-weight:400;opacity:0.5;margin-left:0.25rem">· ${escapeHtml(product.weight)}</span>` : ''}
          </div>
        </div>

        <!-- Description -->
        <p class="product-desc">${escapeHtml(product.description)}</p>

        <!-- Tasting Notes -->
        ${product.tastingNotes?.length > 0 ? `
        <div class="product-info-block">
          <p class="product-info-label">Вкусовые нотки</p>
          <ul class="tasting-notes">
            ${product.tastingNotes.map(n => `<li>${escapeHtml(n)}</li>`).join('')}
          </ul>
        </div>` : ''}

        <!-- Ingredients -->
        ${product.ingredients ? `
        <div class="product-info-block">
          <p class="product-info-label">Состав</p>
          <p style="font-size:0.8125rem;color:var(--color-on-surface-variant);font-style:italic;line-height:1.65">
            ${escapeHtml(product.ingredients)}
          </p>
        </div>` : ''}

        <!-- Qty + Add to Cart (desktop) -->
        <div class="product-info-block">
          <div class="qty-row" style="margin-bottom:1rem">
            <div class="qty-control">
              <button class="qty-btn" id="qty-dec" aria-label="Уменьшить">
                <span class="material-symbols-outlined" style="font-size:18px">remove</span>
              </button>
              <span class="qty-val" id="qty-val">1</span>
              <button class="qty-btn" id="qty-inc" aria-label="Увеличить">
                <span class="material-symbols-outlined" style="font-size:18px">add</span>
              </button>
            </div>
            <span class="in-stock-label">Готово к отправке</span>
          </div>

          <div class="add-to-cart-row" style="display:none;" id="desktop-cart-row">
            <!-- shown via JS resize observer -->
          </div>

          <!-- Always show on desktop -->
          <div class="add-to-cart-row">
            <button class="btn-add-to-cart"
                    id="detail-add-btn"
                    data-product-id="${escapeHtml(product.id)}">
              Добавить в корзину
            </button>
            <button class="btn-wishlist" aria-label="В избранное">
              <span class="material-symbols-outlined" style="font-size:20px">favorite</span>
            </button>
          </div>
        </div>

        <!-- Perks -->
        <div class="perks-grid">
          <div class="perk">
            <span class="material-symbols-outlined">local_shipping</span>
            <span class="perk-label">Доставка по Беларуси</span>
          </div>
          <div class="perk">
            <span class="material-symbols-outlined">verified</span>
            <span class="perk-label">Ручная работа</span>
          </div>
          <div class="perk">
            <span class="material-symbols-outlined">eco</span>
            <span class="perk-label">Натуральный состав</span>
          </div>
          <div class="perk">
            <span class="material-symbols-outlined">card_giftcard</span>
            <span class="perk-label">Фирменная упаковка</span>
          </div>
        </div>

        <!-- Order via Instagram -->
        <div class="product-info-block">
          <a href="https://www.instagram.com/chocolandia.by/"
             target="_blank" rel="noopener"
             class="btn btn-secondary"
             style="width:100%;justify-content:center;gap:0.5rem">
            <span class="material-symbols-outlined" style="font-size:18px">photo_camera</span>
            Заказать в Instagram
          </a>
        </div>
      </div>
    </div>

    <!-- Related Products -->
    ${related.length > 0 ? `
    <div style="padding:3rem 0 4rem;background:var(--color-surface-container-low);margin-top:3rem">
      <div class="container">
        <div class="section-header" style="margin-bottom:2rem">
          <div>
            <p class="section-eyebrow">Также из коллекции</p>
            <h2 class="section-title" style="font-size:clamp(1.5rem,3vw,2.25rem)">Вам может понравиться</h2>
          </div>
          ${collection ? `
          <a href="/collections/${escapeHtml(collection.slug)}"
             data-route="/collections/${escapeHtml(collection.slug)}"
             class="btn-ghost" style="white-space:nowrap;font-size:0.625rem">
            Вся коллекция
            <span class="material-symbols-outlined" style="font-size:14px">arrow_forward</span>
          </a>` : ''}
        </div>
        <div class="related-scroll">
          ${related.map(p => `
          <a href="/product/${escapeHtml(p.slug)}"
             data-route="/product/${escapeHtml(p.slug)}"
             class="related-card product-card">
            <div class="product-card-img-wrap" style="aspect-ratio:4/5">
              <img src="${imgPath(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy"
                   onerror="this.src='/assets/images/hero_banner.png'" />
              ${p.badge ? `<div class="product-card-badge">${buildBadge(p.badge)}</div>` : ''}
            </div>
            <div class="product-card-name">${escapeHtml(p.name)}</div>
            <div class="product-card-footer">
              <div class="product-card-price">
                ${p.price.toFixed(2).replace('.', ',')}
                <span class="currency">BYN</span>
              </div>
            </div>
          </a>`).join('')}
        </div>
      </div>
    </div>` : ''}

  </div>

  <!-- Mobile sticky add-to-cart bar -->
  <div class="mobile-sticky-bar">
    <div class="qty-control">
      <button class="qty-btn" id="qty-dec" aria-label="Уменьшить">
        <span class="material-symbols-outlined" style="font-size:18px">remove</span>
      </button>
      <span class="qty-val" id="qty-val">1</span>
      <button class="qty-btn" id="qty-inc" aria-label="Увеличить">
        <span class="material-symbols-outlined" style="font-size:18px">add</span>
      </button>
    </div>
    <button class="btn-add-to-cart" style="flex:1"
            id="mobile-add-btn"
            data-product-id="${escapeHtml(product.id)}">
      В корзину · ${product.price.toFixed(2).replace('.', ',')} BYN
    </button>
  </div>

</div>`;
}

/* ============================================================
   PAGE: 404
   ============================================================ */
function renderNotFound() {
  return `
<div class="page-transition-enter">
  <div class="page-wrapper">
    <div class="not-found">
      <h2>404</h2>
      <h3 style="font-family:var(--font-headline);font-size:1.75rem;color:var(--color-primary);margin-bottom:0.75rem">
        Страница не найдена
      </h3>
      <p>Возможно, она была перемещена или не существует.</p>
      <a href="/" data-route="/" class="btn btn-primary">На главную</a>
    </div>
  </div>
</div>`;
}

/* ============================================================
   INIT
   ============================================================ */
async function init() {
  loadCart();
  updateCartBadge();
  initRouter();

  // Handle initial route
  await navigate(window.location.pathname, false);
}

// Boot when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
