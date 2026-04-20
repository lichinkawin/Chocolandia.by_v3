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
    let price = 0;
    if (item.customData) {
      price = item.customData.price;
    } else {
      const product = State.data.products.find(p => p.id === item.productId);
      if (product) {
        if (item.variantId && product.variants) {
          const variant = product.variants.find(v => v.id === item.variantId);
          price = variant ? variant.price : product.price;
        } else {
          price = product.price;
        }
      }
    }
    return sum + (price * item.qty);
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

function addToCart(productId, qty = 1, variantId = null) {
  const existing = State.cart.find(i => i.productId === productId && i.variantId === variantId);
  if (existing) {
    existing.qty += qty;
  } else {
    State.cart.push({ productId, qty, variantId });
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
    body.innerHTML = State.cart.map((item, index) => {
      let name, price, weight, imgSrc, slug;

      if (item.customData) {
        name   = item.customData.name;
        price  = item.customData.price;
        weight = item.customData.weight;
        imgSrc = item.customData.image;
        slug   = 'constructor'; 
      } else {
        const product = State.data?.products.find(p => p.id === item.productId);
        if (!product) return '';
        
        let variant = null;
        if (item.variantId && product.variants) {
          variant = product.variants.find(v => v.id === item.variantId);
        }
        
        price = variant ? variant.price : product.price;
        weight = variant ? variant.weight : product.weight;
        name = product.name + (variant ? ` (${variant.name})` : '');
        imgSrc = imgPath(product.image);
        slug = product.slug;
      }
      
      const lineTotal = (price * item.qty).toFixed(2).replace('.', ',');
      
      return `
      <div class="cart-item" data-cart-index="${index}">
        <div class="cart-item-img">
          <img src="${imgSrc}"
               alt="${escapeHtml(name)}"
               onerror="this.src='/assets/images/hero_banner.png'" />
        </div>
        <div class="cart-item-info">
          <span class="cart-item-name"
                data-route="/product/${escapeHtml(slug)}"
                onclick="closeCartDrawer();navigate('/product/${escapeHtml(slug)}')">
            ${escapeHtml(name)}
          </span>
          ${weight ? `<span class="cart-item-weight">${escapeHtml(weight)}</span>` : ''}
          <div class="cart-item-price-row">
            <span class="cart-item-price">${lineTotal} BYN</span>
          </div>
          <div class="cart-item-qty">
            <button class="cart-item-qty-btn"
                    data-cart-dec="${index}"
                    aria-label="Уменьшить количество">−</button>
            <span class="cart-item-qty-val">${item.qty}</span>
            <button class="cart-item-qty-btn"
                    data-cart-inc="${index}"
                    aria-label="Увеличить количество">+</button>
          </div>
        </div>
        <button class="cart-item-remove"
                data-cart-remove="${index}"
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
    let p = State.data?.products.find(pr => pr.id === item.productId);
    
    // Handle custom products from constructor
    if (!p && item.customData) {
      p = item.customData;
    }
    
    if (!p) return null;
    
    let variantDetails = '';
    let price = p.price;
    if (item.variantId && p.variants) {
      const v = p.variants.find(v => v.id === item.variantId);
      if (v) {
        variantDetails = ` (${v.name})`;
        price = v.price;
      }
    }
    
    return {
      name:      p.name + variantDetails,
      weight:    p.weight || '',
      qty:       item.qty,
      lineTotal: (price * item.qty).toFixed(2).replace('.', ','),
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
    const res = await fetch('/send-order.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, phone, address, comment, items, total }),
    });

    const data = await res.json();

    if (data.status === 'success') {
      // Success — clear cart and show confirmation
      State.cart = [];
      State.checkoutMode = false;
      saveCart();
      updateCartBadge();
      closeCartDrawer();
      showToast('\u2705 \u0417\u0430\u043a\u0430\u0437 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d! \u041c\u044b \u0441\u0432\u044f\u0436\u0435\u043c\u0441\u044f \u0441 \u0432\u0430\u043c\u0438.');
    } else {
      showToast('\u274c \u041e\u0448\u0438\u0431\u043a\u0430: ' + (data.message || '\u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0441\u043d\u043e\u0432\u0430'));
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
      const index = parseInt(btn.getAttribute('data-cart-dec'));
      cartChangeQtyByIndex(index, -1);
    });
  });
  body.querySelectorAll('[data-cart-inc]').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.getAttribute('data-cart-inc'));
      cartChangeQtyByIndex(index, 1);
    });
  });
  body.querySelectorAll('[data-cart-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.getAttribute('data-cart-remove'));
      cartRemoveByIndex(index);
    });
  });
}

function cartChangeQtyByIndex(index, delta) {
  const item = State.cart[index];
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    State.cart.splice(index, 1);
  }
  saveCart();
  updateCartBadge();
  renderCartDrawer();
  bindCartDrawerEvents();
}

function cartRemoveByIndex(index) {
  State.cart.splice(index, 1);
  saveCart();
  updateCartBadge();
  renderCartDrawer();
  bindCartDrawerEvents();
}


/* ============================================================
   ROUTER
   ============================================================ */
const routes = [
  { pattern: /^\/?$/, handler: renderHome },
  { pattern: /^\/constructor\/?$/, handler: renderConstructor },
  { pattern: /^\/collections\/?$/, handler: renderCollections },
  { pattern: /^\/collections\/([^/]+)\/?$/, handler: (m) => renderCollectionPage(m[1]) },
  { pattern: /^\/product\/([^/]+)\/?$/, handler: (m) => renderProductPage(m[1]) },
  { pattern: /^\/privacy\/?$/, handler: renderPrivacy },
  { pattern: /^\/b2b\/?$/, handler: renderB2B },
];

async function renderPrivacy() {
  return `
<div>
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

async function navigate(fullPath, pushState = true, force = false, noScroll = false) {
  // Извлекаем хэш (#...) из пути
  const hashIndex = fullPath.indexOf('#');
  let path = fullPath;
  let hash = '';
  if (hashIndex !== -1) {
    hash = fullPath.substring(hashIndex);
    path = fullPath.substring(0, hashIndex) || '/';
  }

  if (pushState && fullPath !== window.location.pathname + window.location.hash) {
    history.pushState({}, '', fullPath);
  }
  
  // Если мы уже находимся на этой странице, просто скроллим до нужного элемента
  if (!force && State.currentPath === path && document.getElementById('app').innerHTML.trim() !== '') {
    updateNavActive(fullPath);
    updateBottomNavActive(path);
    closeSidebar();
    if (hash) {
      const el = document.querySelector(hash);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    return;
  }

  State.currentPath = path;
  updateNavActive(fullPath);
  updateBottomNavActive(path);

  const app = document.getElementById('app');
  if (!app) return;

  // Show loading state
  // Removed skeleton loader that caused flickering
  // We now keep the current page visible until the new one is ready
  await loadData();

  // Match route
  let matched = false;
  for (const route of routes) {
    const m = path.match(route.pattern);
    if (m) {
      const html = await route.handler(m);
      app.innerHTML = html;
      if (!force) app.firstElementChild?.classList.add('page-transition-enter');
      bindPageEvents(path, m);
      matched = true;
      break;
    }
  }

  if (!matched) {
    app.innerHTML = renderNotFound();
    if (!force) app.firstElementChild?.classList.add('page-transition-enter');
  }

  if (!noScroll) {
    if (hash) {
      setTimeout(() => {
        const el = document.querySelector(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  // Close mobile sidebar if open
  closeSidebar();

  // Update SEO title
  updatePageTitle(path);
}

function updatePageTitle(path) {
  const titleMap = {
    '/': 'Chocolandia.by — Шоколад ручной работы с доставкой по Беларуси',
    '/collections': 'Все коллекции — Chocolandia.by',
    '/b2b': 'Корпоративным клиентам — Chocolandia.by',
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
  if (path === '/') {
    initHeroSlider();
  } else if (path === '/constructor' || (match && match[1] === 'truffles') || (match && State.data?.products?.find(p => p.slug === match[1])?.isConstructor)) {
    bindConstructorEvents();
  } else if (path === '/collections') {
    // Fall through to general add-to-cart binding
  }

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
      const variantId = document.querySelector('input[name="product-variant"]:checked')?.value || null;
      addToCart(productId, qty, variantId);
    });

    document.getElementById('mobile-add-btn')?.addEventListener('click', () => {
      const productId = document.getElementById('mobile-add-btn').getAttribute('data-product-id');
      const variantId = document.querySelector('input[name="product-variant"]:checked')?.value || null;
      addToCart(productId, qty, variantId);
    });
  }

  // Variant selector price update
  document.querySelectorAll('input[name="product-variant"]').forEach(input => {
    input.addEventListener('change', () => {
      const price = parseFloat(input.getAttribute('data-price'));
      const weight = input.getAttribute('data-weight');
      const priceEl = document.getElementById('display-price');
      const mobileBtn = document.getElementById('mobile-add-btn');
      
      if (priceEl) {
        priceEl.innerHTML = `${price.toFixed(2).replace('.', ',')} <span class="currency">BYN</span>
                             <span class="display-weight" style="font-size:0.875rem;font-family:var(--font-body);font-weight:400;opacity:0.5;margin-left:0.25rem">
                               · ${weight}
                             </span>`;
      }
      if (mobileBtn) {
        mobileBtn.innerHTML = `В корзину · ${price.toFixed(2).replace('.', ',')} BYN`;
      }
    });
  });

  // Gallery switching
  document.querySelectorAll('.gallery-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
      const imgSrc = thumb.querySelector('img').src;
      const mainImg = document.getElementById('main-prod-img');
      if (mainImg) mainImg.src = imgSrc;
    });
  });

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

  // Hero Slider initialization
  initHeroSlider();

  // Newsletter form
  document.getElementById('newsletter-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const input = e.target.querySelector('input[type="email"]');
    if (input?.value) {
      showToast('Спасибо! Вы подписались на новости 🍫');
      input.value = '';
    }
  });

  // B2B Form handling
  if (path === '/b2b') {
    bindB2BEvents();
  }

  // FAQ accordion toggle

  // FAQ accordion toggle
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.faq-item');
      if (!parent) return;
      const isActive = parent.classList.contains('active');
      document.querySelectorAll('.faq-item').forEach(item => item.classList.remove('active'));
      if (!isActive) {
        parent.classList.add('active');
      }
    });
  });
}

function filterProducts(filter) {
  const grid = document.getElementById('product-grid');
  if (!grid) return;
  const cards = grid.querySelectorAll('[data-badge]');
  cards.forEach(card => {
    const badge = card.getAttribute('data-badge');
    if (filter === 'all' || badge === filter) {
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
      <h3 class="product-card-name">${escapeHtml(product.name)}</h3>
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

  const mockReviews = [
    {
      name: 'Екатерина Семенова',
      text: 'Брали дубайский шоколад на подарок — это просто восторг! Очень вкусная фисташковая начинка, хрустит невероятно.'
    },
    {
      name: 'Максим',
      text: 'Заказывал клубнику в шоколаде девушке. Ягоды огромные, сладкие, а шоколад тает во рту. Оформление топ.'
    },
    {
      name: 'Ольга',
      text: 'Трюфели невероятные. Чувствуется, что сделано из хорошего бельгийского шоколада. Буду заказывать еще!'
    },
    {
      name: 'Анна В.',
      text: 'Все идеально: от упаковки до вкуса. Заказывали подарочный набор маме на День Рождения, она в восторге.'
    }
  ];

  const faqs = [
    {
      q: 'Как сделать заказ?',
      a: 'Вы можете оформить заказ через корзину на нашем сайте, после чего мы свяжемся с вами для подтверждения деталей.'
    },
    {
      q: 'За сколько дней нужно делать заказ?',
      a: 'Желательно оформлять заказ за 2-3 дня до нужной даты. В преддверии праздников сроки могут увеличиваться.'
    },
    {
      q: 'Осуществляете ли вы доставку в другие города?',
      a: 'Да, мы отправляем наши наборы Европочтой и Белпочтой по всей территории Беларуси. Сроки доставки обычно составляют 1-3 дня.'
    },
    {
      q: 'Какой срок годности у вашей продукции?',
      a: 'Срок годности клубники в шоколаде — 24 часа. Трюфели и дубайский шоколад хранятся до 1 месяца при температуре от +15 до +20 °C.'
    },
    {
      q: 'Есть ли у вас подарочная упаковка?',
      a: 'Все наши изделия по умолчанию упакованы в стильные фирменные коробки с лентами. Это уже готовый подарок!'
    }
  ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": f.a
      }
    }))
  };
  const faqJsonLd = `<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>`;

  return `
<div>

  <!-- ── HERO SLIDER ── -->
  <section class="hero-slider" id="hero-slider">
    <div class="slider-wrapper">
      
      <!-- Slide 1 -->
      <div class="hero-slide active" data-slide="0">
        <div class="hero-bg">
          <img src="/assets/images/hero_slider_1.png" alt="Chocolandia — шоколад ручной работы" />
        </div>
        <div class="hero-content">
          <h1 class="hero-title">
            Эксклюзивный шоколад ручной работы
          </h1>
          <p class="hero-subtitle" style="font-size: 1.125rem; opacity: 0.9;">
            Шоколадные наборы, трюфели, клубника и финики в шоколаде
          </p>
          <div class="hero-actions">
            <button class="btn btn-primary" data-route="/collections">Смотреть коллекции</button>
            <button class="btn btn-outline-white" id="hero-process">О нас</button>
          </div>
        </div>
      </div>

      <!-- Slide 2 -->
      <div class="hero-slide" data-slide="1">
        <div class="hero-bg">
          <img src="/assets/images/finiki/IMG_9840.webp" alt="Финики с орехами в шоколаде" />
        </div>
        <div class="hero-content">
          <div class="hero-badge">Полезное лакомство</div>
          <div class="hero-title">
            Финики <em>в шоколаде</em>
          </div>
          <p class="hero-subtitle">
            Трио премиального шоколада и хрустящие орехи: миндаль, фундук и грецкий орех в сердце каждого финика. Совершенство вкуса и текстуры.
          </p>
          <div class="hero-actions">
            <button class="btn btn-primary" data-route="/collections/finiki">Попробовать</button>
          </div>
        </div>
      </div>

      <!-- Slide 3 -->
      <div class="hero-slide" data-slide="2">
        <div class="hero-bg">
          <img src="/assets/images/finiki/IMG_9834.webp" alt="Изысканные трюфели" />
        </div>
        <div class="hero-content">
          <div class="hero-badge">Премиальное качество</div>
          <div class="hero-title">
            Изысканные <em>трюфели</em>
          </div>
          <p class="hero-subtitle">
            Французская классика в авторском исполнении. Каждый трюфель — это гармония вкуса и текстуры, созданная вручную.
          </p>
          <div class="hero-actions">
            <button class="btn btn-primary" data-route="/collections/truffles">Заказать трюфели</button>
          </div>
        </div>
      </div>

    </div>

    <!-- Slider controls -->
    <div class="slider-controls">
      <div class="slider-dots">
        <span class="dot active" data-goto="0"></span>
        <span class="dot" data-goto="1"></span>
        <span class="dot" data-goto="2"></span>
      </div>
    </div>

    <div class="hero-overlay-bottom"></div>
  </section>

  ${renderTeaser()}

  <!-- Removed 'Why choose us' section -->

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
        <a href="/collections/${escapeHtml(sideColl.slug || 'finiki')}"
           data-route="/collections/${escapeHtml(sideColl.slug || 'finiki')}"
           class="bento-card bento-side">
          <img src="${imgPath(sideColl.image || 'assets/images/finiki/IMG_9840.webp')}"
               alt="${escapeHtml(sideColl.name || '')}"
               loading="lazy"
               onerror="this.src='/assets/images/hero_banner.png'" />
          <div class="bento-card-overlay"></div>
          <div class="bento-card-content">
            <span class="bento-card-eyebrow">Коллекция</span>
            <h3 class="bento-card-title" style="font-size:1.5rem">${escapeHtml(sideColl.name || 'Финики в шоколаде')}</h3>
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
          <h2 class="text-headline-lg" style="color:var(--color-primary);margin-bottom:1.5rem;margin-top:0.5rem; font-family: var(--font-display);">
            CHOCOLANDIA.BY —<br />Больше, чем просто шоколад
          </h2>
          <p style="color:var(--color-on-surface-variant);line-height:1.75;font-size:1rem;margin-bottom:1.5rem">
            Мы создаем эксклюзивный шоколад ручной работы для тех, кто ценит эстетику и безупречное качество.
          </p>
          <p style="color:var(--color-on-surface-variant);line-height:1.75;font-size:1rem;margin-bottom:1.5rem">
            Вручную создаем изысканные коллекции из лучшего итальянского и бельгийского шоколада, чтобы вы могли дарить по-настоящему особенные эмоции.
          </p>
          <p style="color:var(--color-on-surface-variant);line-height:1.75;font-size:1rem;margin-bottom:2rem">
            Трюфели с характером, нежная клубника в шоколаде и эксклюзивные подарочные наборы — в каждом кусочке скрыта наша преданность делу и стремление к совершенству.
          </p>

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

  <!-- ── REVIEWS ── -->
  <section class="section-pad reviews-section" id="reviews-section">
    <div class="container">
      <div class="reviews-header">
        <div>
          <p class="section-eyebrow">Отзывы (Social Proof)</p>
          <h2 class="section-title">Что говорят клиенты</h2>
        </div>
        <a href="https://www.instagram.com/chocolandia.by/" target="_blank" class="btn btn-primary">Оставить отзыв</a>
      </div>
      <div class="reviews-carousel">
        ${mockReviews.map(r => `
        <div class="review-card">
          <div class="review-card-header">
            <div>
              <div class="review-author">${escapeHtml(r.name)}</div>
              <div class="review-stars">
                <span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">star</span>
                <span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">star</span>
                <span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">star</span>
                <span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">star</span>
                <span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">star</span>
              </div>
            </div>
          </div>
          <div class="review-text">${escapeHtml(r.text)}</div>
        </div>
        `).join('')}
      </div>
    </div>
  </section>

  <!-- ── FAQ ── -->
  <section class="section-pad faq-section" id="faq-section">
    <div class="container">
      <div class="text-center" style="margin-bottom:3rem">
        <p class="section-eyebrow">Вопрос - Ответ</p>
        <h2 class="section-title">Часто задаваемые вопросы</h2>
      </div>
      <div class="faq-list">
        ${faqs.map((f) => `
        <div class="faq-item">
          <button class="faq-question">
            <span>${escapeHtml(f.q)}</span>
            <span class="material-symbols-outlined faq-question-icon">expand_more</span>
          </button>
          <div class="faq-answer-wrapper">
            <div class="faq-answer-content">
              <div class="faq-answer-text">${escapeHtml(f.a)}</div>
            </div>
          </div>
        </div>
        `).join('')}
      </div>
    </div>
  </section>
  ${faqJsonLd}

  <!-- ── SEO TEXT BLOCK ── -->
  <section class="section-pad bg-surface" id="seo-section">
    <div class="container">
      <div style="max-width: 900px; margin: 0 auto;">
        <h2 class="text-headline-md" style="margin-bottom: 2rem; color: var(--color-primary);">Почему выбирают Chocolandia?</h2>
        
        <p style="margin-bottom: 1.5rem; line-height: 1.8; color: var(--color-on-surface-variant);">
          Добро пожаловать в Chocolandia — мастерскую, где мы создаем настоящий <strong>бельгийский шоколад</strong> с любовью и вниманием к каждой детали. Наша миссия — дарить незабываемые эмоции через изысканный вкус и премиальное оформление. Если вы ищете, где <strong>купить финики в шоколаде в Беларуси</strong>, вы попали по адресу. Мы используем лучшие сорта фиников и отборные орехи, чтобы вы могли насладиться неповторимым вкусом.
        </p>

        <p style="margin-bottom: 1.5rem; line-height: 1.8; color: var(--color-on-surface-variant);">
          Наша гордость — это <strong>шоколад ручной работы Минск</strong> и другие города Беларуси выбирают нас за качество ингредиентов и авторский подход. В каталоге вы найдете нежные трюфели, уникальные фигурки и роскошные <strong>подарочные наборы</strong>, которые идеально подойдут для любого повода: от дня рождения до корпоративного праздника. Мы гарантируем, что каждый заказ станет особенным подарком для ваших близких.
        </p>

        <div style="background: var(--color-surface-container-low); padding: 2rem; border-radius: 1.5rem; margin-bottom: 2rem;">
          <h3 style="margin-bottom: 1.25rem; font-family: var(--font-headline); color: var(--color-secondary);">Преимущества заказа у нас:</h3>
          <ul style="list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
            <li style="display: flex; gap: 0.75rem; align-items: flex-start;">
              <span class="material-symbols-outlined" style="color: var(--color-secondary); font-size: 20px;">check_circle</span>
              <span>Только премиальный бельгийский шоколад Callebaut.</span>
            </li>
            <li style="display: flex; gap: 0.75rem; align-items: flex-start;">
              <span class="material-symbols-outlined" style="color: var(--color-secondary); font-size: 20px;">check_circle</span>
              <span>Уникальный дизайн и ручное исполнение каждого изделия.</span>
            </li>
            <li style="display: flex; gap: 0.75rem; align-items: flex-start;">
              <span class="material-symbols-outlined" style="color: var(--color-secondary); font-size: 20px;">check_circle</span>
              <span>Быстрая <strong>доставка шоколада</strong> в любую точку страны.</span>
            </li>
            <li style="display: flex; gap: 0.75rem; align-items: flex-start;">
              <span class="material-symbols-outlined" style="color: var(--color-secondary); font-size: 20px;">check_circle</span>
              <span>Фирменная упаковка, включенная в стоимость.</span>
            </li>
          </ul>
        </div>

        <p style="margin-bottom: 1.5rem; line-height: 1.8; color: var(--color-on-surface-variant);">
          Мы максимально расширили географию нашей заботы. Теперь наш фирменный шоколад и трюфели доступны каждому жителю страны: <strong>доставка по Беларуси</strong> осуществляется через сервисы «Европочта» и «Белпочта». Мы надежно упаковываем ваши заказы, чтобы они доехали в идеальном состоянии в Минск, Брест, Гродно, Витебск, Гомель или любой другой населенный пункт.
        </p>

        <p style="line-height: 1.8; color: var(--color-on-surface-variant); font-weight: 500; border-left: 4px solid var(--color-secondary); padding-left: 1.5rem;">
          Важное уточнение по логистике: свежая <strong>клубника в шоколаде</strong> доставляется исключительно в пределах города Могилёв (курьером или самовывозом), так как этот продукт требует особых условий хранения и максимальной свежести. Шоколадную продукцию и наборы мы с радостью отправим в любой уголок Беларуси.
        </p>
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
<div>
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
  if (slug === 'truffles') {
    return renderConstructor();
  }
  const data = State.data;
  const collection = data?.collections.find(c => c.slug === slug);
  const allProducts = data?.products.filter(p => p.collectionId === slug) || [];

  if (!collection) return renderNotFound();

  return `
<div>
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

    <div style="background:var(--color-surface);padding:1.5rem 0 0">
      <div class="filter-bar">
        <button class="filter-chip active" data-filter="all">Все</button>
        ${[...new Set(allProducts.filter(p => p.badge).map(p => p.badge))]
          .sort()
          .slice(0, 8)
          .map(badge =>
          `<button class="filter-chip" data-filter="${escapeHtml(badge)}">${escapeHtml(badge)}</button>`
        ).join('')}
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
            `<div data-badge="${escapeHtml(p.badge || '')}" data-collection="${escapeHtml(p.id)}">${buildProductCard(p)}</div>`
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
  
  // If it's a constructor product, render the constructor instead
  if (product.isConstructor) {
    return renderConstructor();
  }

  const collection = data?.collections.find(c => c.id === product.collectionId);
  const related = data?.products
    .filter(p => p.collectionId === product.collectionId && p.id !== product.id)
    .slice(0, 4) || [];

  return `
<div>
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
        <div class="product-gallery-main" id="gallery-main">
          <img src="${imgPath(product.image)}"
               alt="${escapeHtml(product.name)}"
               id="main-prod-img"
               onerror="this.src='/assets/images/hero_banner.png'" />
        </div>
        ${product.images && product.images.length > 1 ? `
        <div class="product-gallery-thumbs">
          ${product.images.map((img, i) => `
            <div class="gallery-thumb ${i === 0 ? 'active' : ''}" data-gallery-index="${i}">
              <img src="${imgPath(img)}" alt="thumb ${i}" />
            </div>
          `).join('')}
        </div>` : ''}
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
          <div class="product-price" id="display-price">
            ${product.price.toFixed(2).replace('.', ',')}
            <span class="currency">BYN</span>
            <span class="display-weight" style="font-size:0.875rem;font-family:var(--font-body);font-weight:400;opacity:0.5;margin-left:0.25rem">
              ${product.weight ? `· ${escapeHtml(product.weight)}` : ''}
            </span>
          </div>
        </div>

        <!-- Variants (Size Selection) -->
        ${product.variants ? `
        <div class="product-info-block">
          <p class="product-info-label">Выберите размер</p>
          <div class="variant-selector">
            ${product.variants.map((v, i) => `
              <label class="variant-chip">
                <input type="radio" name="product-variant" value="${v.id}" ${i === 0 ? 'checked' : ''} 
                       data-price="${v.price}" data-weight="${escapeHtml(v.weight)}">
                <span class="variant-chip-label">${escapeHtml(v.name)}</span>
              </label>
            `).join('')}
          </div>
        </div>` : ''}

        <!-- Description -->
        <p class="product-desc">${escapeHtml(product.description)}</p>



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
   HERO SLIDER LOGIC
   ============================================================ */
function initHeroSlider() {
  const slider = document.getElementById('hero-slider');
  if (!slider) return;

  const slides = slider.querySelectorAll('.hero-slide');
  const dots   = slider.querySelectorAll('.dot');
  let current  = 0;
  let timer    = null;
  const interval = 6000; // 6 seconds

  function showSlide(index) {
    slides.forEach(s => s.classList.remove('active'));
    dots.forEach(d => d.classList.remove('active'));

    slides[index].classList.add('active');
    dots[index].classList.add('active');
    current = index;
  }

  function nextSlide() {
    let next = (current + 1) % slides.length;
    showSlide(next);
    resetTimer();
  }

  function resetTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(nextSlide, interval);
  }

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      const target = parseInt(dot.getAttribute('data-goto'));
      showSlide(target);
      resetTimer();
    });
  });

  // Start initial timer
  resetTimer();
}

/* ============================================================
   PAGE: 404
   ============================================================ */
function renderNotFound() {
  return `
<div>
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
   PAGE: B2B LANDING
   ============================================================ */
async function renderB2B() {
  return `
  <div>
    <!-- Hero B2B -->
    <section class="b2b-hero">
      <div class="b2b-hero-bg">
        <img src="/assets/images/b2b_hero.png" alt="Corporate Gifts" />
      </div>
      <div class="b2b-hero-content">
        <div class="container">
          <p class="section-eyebrow" style="color:var(--color-secondary-fixed)">Для бизнеса</p>
          <h1 class="b2b-hero-title">Премиальные сладкие подарки <br>для вашего бизнеса</h1>
          <p class="b2b-hero-subtitle">
            Эксклюзивные наборы ручной работы с логотипом вашей компании. 
            Создаем сладкую репутацию вашего бренда.
          </p>
          <div class="b2b-hero-actions">
            <button class="btn btn-primary btn-lg" onclick="document.getElementById('b2b-form-section').scrollIntoView({behavior:'smooth'})">
              Получить коммерческое предложение
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Advantages -->
    <section class="section-pad bg-surface">
      <div class="container">
        <div class="text-center" style="margin-bottom:4rem">
          <p class="section-eyebrow">Почему выбирают нас</p>
          <h2 class="section-title">Наши преимущества</h2>
        </div>
        <div class="b2b-advantages-grid">
          <div class="advantage-card">
            <span class="material-symbols-outlined advantage-icon">account_balance</span>
            <h3 class="advantage-title">Безналичный расчет</h3>
            <p class="advantage-desc">Работаем официально с оформлением всех необходимых документов и договоров.</p>
          </div>
          <div class="advantage-card">
            <span class="material-symbols-outlined advantage-icon">branding_watermark</span>
            <h3 class="advantage-title">Свой логотип</h3>
            <p class="advantage-desc">Кастомизация упаковки, брендированные ленты и открытки в корпоративном стиле.</p>
          </div>
          <div class="advantage-card">
            <span class="material-symbols-outlined advantage-icon">percent</span>
            <h3 class="advantage-title">Гибкие скидки</h3>
            <p class="advantage-desc">Специальные условия и прогрессивная шкала скидок при оптовых заказах.</p>
          </div>
          <div class="advantage-card">
            <span class="material-symbols-outlined advantage-icon">description</span>
            <h3 class="advantage-title">Закрывающие документы</h3>
            <p class="advantage-desc">Предоставляем полный пакет документов согласно законодательству РБ.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Form Section -->
    <section class="section-pad" id="b2b-form-section" style="background:var(--color-surface-container-low)">
      <div class="container">
        <div class="b2b-form-container">
          <div class="b2b-form-info">
            <h2 class="text-headline-lg" style="margin-bottom:1.5rem">Оставьте заявку</h2>
            <p style="margin-bottom:2rem; opacity:0.8">
              Заполните форму, и наш менеджер свяжется с вами в течение 30 минут для обсуждения деталей и подготовки индивидуального предложения.
            </p>
            <div class="b2b-form-info-items">
              <div style="display:flex; align-items:center; gap:1rem">
                <span class="material-symbols-outlined" style="color:var(--color-secondary)">call</span>
                <span>+37529 545 77 49</span>
              </div>
              <div style="display:flex; align-items:center; gap:1rem">
                <span class="material-symbols-outlined" style="color:var(--color-secondary)">mail</span>
                <span>hello@chocolandia.by</span>
              </div>
            </div>

          </div>

          <form class="b2b-form" id="b2b-request-form">
            <div class="form-group">
              <label for="b2b-name">Ваше имя</label>
              <input type="text" id="b2b-name" name="name" placeholder="Иван Иванов" required>
            </div>
            <div class="form-group">
              <label for="b2b-company">Название компании</label>
              <input type="text" id="b2b-company" name="company" placeholder="ООО 'Ваша Компания'" required>
            </div>
            <div class="form-group-row">
              <div class="form-group">
                <label for="b2b-phone">Телефон</label>
                <input type="tel" id="b2b-phone" name="phone" placeholder="+375 (__) ___-__-__" required>
              </div>
              <div class="form-group">
                <label for="b2b-email">Email</label>
                <input type="email" id="b2b-email" name="email" placeholder="example@mail.com" required>
              </div>
            </div>
            <div class="form-group">
              <label for="b2b-quantity">Ориентировочное количество наборов</label>
              <select id="b2b-quantity" name="quantity">
                <option value="до 20">До 20 наборов</option>
                <option value="20-50">От 20 до 50 наборов</option>
                <option value="50-100">От 50 до 100 наборов</option>
                <option value="свыше 100">Свыше 100 наборов</option>
                <option value="не уверен">Пока не уверен (-а)</option>
              </select>
            </div>
            <button type="submit" class="btn btn-primary btn-lg" style="width:100%; margin-top:1rem" id="b2b-submit-btn">
              Оставить заявку
            </button>
          </form>

          <!-- Success Message (initially hidden) -->
          <div class="b2b-success" id="b2b-success-msg" style="display:none">
            <span class="material-symbols-outlined" style="font-size:64px; color:var(--color-secondary); margin-bottom:1.5rem">check_circle</span>
            <h2 class="text-headline-md">Заявка успешно отправлена!</h2>
            <p style="margin-top:1rem; opacity:0.8; max-width:400px; margin-left:auto; margin-right:auto">
              Спасибо за интерес к нашей продукции. Мы подготовим лучшее предложение для вашей компании и свяжемся с вами в ближайшее время.
            </p>
            <button class="btn btn-outline" style="margin-top:2rem" onclick="location.reload()">Отправить еще одну</button>
          </div>
        </div>
      </div>
    </section>
  </div>
  `;
}

function bindB2BEvents() {
  const form = document.getElementById('b2b-request-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('b2b-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Отправка...';
    }

    const formData = new FormData(form);
    const data = {
      type: 'b2b',
      name: formData.get('name'),
      company: formData.get('company'),
      phone: formData.get('phone'),
      email: formData.get('email'),
      quantity: formData.get('quantity')
    };

    try {
      const res = await fetch('/send-order.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();

      if (result.status === 'success') {
        form.style.display = 'none';
        document.querySelector('.b2b-form-info').style.display = 'none';
        document.getElementById('b2b-success-msg').style.display = 'flex';
        window.scrollTo({
          top: document.getElementById('b2b-form-section').offsetTop - 100,
          behavior: 'smooth'
        });
      } else {
        throw new Error(result.message || 'Ошибка сервера');
      }
    } catch (err) {
      alert('Ошибка при отправке: ' + err.message);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Оставить заявку';
      }
    }
  });
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

/* ============================================================
   CONSTRUCTOR STATE & LOGIC
   ============================================================ */
const TEASER_ASSETS = {
  f0: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCYI-OoEj2vtPwOLRZ7UDUe_qWu6e4-AZ5s6cZRo-12kzWCKMz3fvldMBF-rkoYXrqtZl72HOuXbSJYx4SRaWCUjz0SddTaKGwJEg_Lim2Lhk2OugldOdgqkm3pBXyjBndVg4tCt-cYAwLjEt2BZvft-IfSlWD88jQuiB8-GvbLhuyJNlMWvOevn3gi9H-JLM2-M2l2CyZXngFNXZdBp7s7ttUkzKvcggU4vpvfH1lCq03UlCULDq1O3dz9G0xK0GLdD0JM8NlFmw',
  f1: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAHDtzyxGBWbsYScKBcIfz_ZmGXhyMalMCTDaPx_wMuxKr5y0ZmyemWhfI9KRt8wFtF8uTazIGxTyCRH5BsSmTPs44b19u5tM1ixbL4XUX1Bx7kMccjlTB773qtYMItTq4PieQw73WiiWUfFNjiPjoegwWe_8XlzqjIZdi5nm7W7kuY-hKPokSNMIbGG8XRlx7-Pc_kifxUGQitC0Yavnn32pHuGiN0vHr-xiLvePldwdzmkn4A5jMPoGJr7LSaiPyhvBBNZGYxOA',
  f2: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC5ItQRyZcLI_BsKA1mvrrZH1oaikEURuQuYQs4XfhwE0zd4ujGvV-AqFhjttqEPjF7ZI2xgWIAXzDm41raB8bzuuSjlLXMC8lD2LKRzLrhgyNlNa1osg0p3y80rJm8RhWBUuKdYLfGY6CfD1Y8OnJy0elmYvTRyjExTAzGrJoaLDQnYgFpKPDmwk-tsQrj5Y9e7CGFH88YaPrLg_a9UWUsfQLoc4Ycr0KQgF87DbEIRHyjAAqbwo4qsprI13NZRImVR2MtyCyEEA',
  f3: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCSlCxc7JfCaIzUInCgDEMJSz1e6P4j_RdL9wy9BXPE0HvvGkho_EqGH6NaeFt2qANfNO1n1e_CxyKCzzzI23kiHxOXbfT4Jb11rR6NYqMXGFQkW3o2eTG_Pa0mbBaRD35Itc8_yNtXUmvSeI1qgwsB0bFI20372wRhYBtFOQxev9ySq3ssAVGRCjGBQ-1OQiljLgal_Z6MLUhCigPxMB9xYpjWblY57U4AAJW8JOrXIJ-9QYvM1ZVlJAFYAm8vBScxUvuAeuLoLQ',
  f4: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAeaGnMvBPSo7XeR1lHrPbREaxK8ag1R4rXsriLqCwljYYbPNJxdbxIuCYvSB7KdzthvNenX6bTSCJ0eun5K9f-WYMGdc-W5c2Y3DNGagVOeh9gZsoRGiOXBincDWHH9J-2mzgWFqwSaGLAM1YVvItrkdtLvgRBVCk4XxtvDX7YS0VYTZHfD5mkMqStXAUUyN4LuqHZI5Hrxg49nE1Kf_Pe2E8C-IIG-ccM8--E-mubRIFxgdGGNIdWrNaG3f0IADmvmRzuKUC_Vw',
  f5: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD3c8EUCOu_bB8HCh65JanViNvg0ZKPLKGKI-zHtgYpYjTx9OqOaJHYggiwmoJHMVBBCsxkwxO2raODMMGOD7YNKuUDr9nprjLAuF3Yf21GzSH2wY135yo2xxJrfv9x6aqiR1vM-9dMuob-1__rIRPId3dM4DyiWMcv6vmeqktw_vim7Oo3l0pbwJ_dtCZDfqtPG5mx5QIOjkgRqakVeQS_IyKK25NUKawsYHQsznMgAinVkZLPp5xYtkaOfvYI2GxxFT2-rrzWOg',
  f6: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBb9nOd_o8BOF7qoWFkFoVrEgvaVCOi3UGcA0dAsi7_GQoBW5wQOvCPduvTtpP1ogEHC5PLF8aG9E4re7tWF-p8fvr-OHYoOOeboqcgVDhFHzmHb0AK2J_ET2smiV0NZ5950oRIIbum_NwUdsXjXZ0U3hxhk61sNNqsDLLXdy2ZKROsAVfy1fyoByh9MPCVXOh1F6W92pdefRc7_C6mQBw4874-gH3tP1GJsEub1UbUzlNwSFoftVukEaf01TRHdRsbImqNj9krOA'
};

let constructorState = {
  size: 9,
  flavors: [
    { id: 'hazelnut', name: 'Фундучный', desc: 'на молочном итальянском шоколаде в посыпке дробленного фундука.', img: '/assets/images/truffle/IMG_9790.jpg', count: 0 },
    { id: 'coconut', name: 'Кокосовый', desc: 'на белом бельгийском шоколаде в посыпке кокосовой стружки.', img: '/assets/images/truffle/IMG_9791.jpg', count: 0 },
    { id: 'pistachio', name: 'Фисташковый', desc: 'на белом бельгийском шоколаде в посыпке фисташковой муки.', img: '/assets/images/truffle/IMG_9794.jpg', count: 0 },
    { id: 'coffee', name: 'Кофейный', desc: 'на молочном итальянском шоколаде в посыпке вафельной крошке.', img: '/assets/images/truffle/IMG_9734.jpg', count: 0 },
    { id: 'currant', name: 'Смородина', desc: 'на белом бельгийском шоколаде в посыпке из сублимированной малины.', img: '/assets/images/truffle/IMG_9735.jpg', count: 0 },
    { id: 'classic', name: 'Классический', desc: 'на темном итальянском шоколаде в кондитерской посыпке.', img: '/assets/images/truffle/IMG_9732.jpg', count: 0 },
    { id: 'mojito', name: 'Мохито', desc: 'на белом бельгийском шоколаде в качестве посыпки какао.', img: '/assets/images/truffle/IMG_9736.jpg', count: 0 }
  ]
};

const BOX_SIZES = [
  { count: 5, price: 25 },
  { count: 9, price: 36 },
  { count: 12, price: 48 },
  { count: 16, price: 64 },
  { count: 25, price: 100 }
];

async function renderConstructor() {
  const currentTotal = constructorState.flavors.reduce((sum, f) => sum + f.count, 0);
  const currentSize = BOX_SIZES.find(s => s.count === constructorState.size);
  
  // Build preview grid
  let gridHtml = '';
  const slots = [];
  constructorState.flavors.forEach(f => {
    for (let i = 0; i < f.count; i++) slots.push(f);
  });
  
  for (let i = 0; i < constructorState.size; i++) {
    const f = slots[i];
    if (f) {
      gridHtml += `
        <div class="constructor-slot filled" onclick="removeFlavorFromSlot('${f.id}')">
          <img src="${f.img}" alt="${f.name}" />
          <div class="slot-remove"><span class="material-symbols-outlined">close</span></div>
        </div>`;
    } else {
      gridHtml += `<div class="constructor-slot empty"><span class="material-symbols-outlined">add</span></div>`;
    }
  }

  const columns = Math.ceil(Math.sqrt(constructorState.size));

  return `
<div>
  <div class="page-wrapper">
    <div class="container" style="padding-top:2rem; padding-bottom:6rem">
      <div class="constructor-layout">
        
        <!-- Left: Selection -->
        <div class="constructor-selection">
          <h1 class="text-headline-md" style="margin-bottom:2rem">Конструктор набора</h1>
          
          <!-- Size Selector -->
          <section style="margin-bottom:3rem">
            <h3 class="constructor-step-title">1. Выберите размер коробочки</h3>
            <div class="size-grid">
              ${BOX_SIZES.map(s => `
                <button class="size-card ${s.count === constructorState.size ? 'active' : ''}" 
                        onclick="setBoxSize(${s.count})">
                  <span class="size-count">${s.count}</span>
                  <span class="size-label">штук</span>
                  <span class="size-price">${s.price} BYN</span>
                </button>
              `).join('')}
            </div>
          </section>

          <!-- Flavor Picker -->
          <section>
            <h3 class="constructor-step-title">2. Выберите вкусы (${currentTotal} / ${constructorState.size})</h3>
            <div class="flavor-list">
              ${constructorState.flavors.map(f => `
                <div class="flavor-item">
                  <img src="${f.img}" alt="${f.name}" class="flavor-img" />
                  <div class="flavor-info">
                    <h4>${f.name}</h4>
                    <p>${f.desc}</p>
                  </div>
                  <div class="flavor-controls">
                    <button class="qty-btn-const" data-id="${f.id}" data-action="dec" ${f.count === 0 ? 'disabled' : ''}>-</button>
                    <span class="qty-val-const">${f.count}</span>
                    <button class="qty-btn-const" data-id="${f.id}" data-action="inc" ${currentTotal >= constructorState.size ? 'disabled' : ''}>+</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </section>
        </div>

        <!-- Right: Preview (Sticky) -->
        <div class="constructor-preview-wrap">
          <div class="constructor-preview-card">
            <h3 class="font-headline" style="font-size:1.25rem;color:var(--color-primary);margin-bottom:2rem;font-style:italic;position:relative;z-index:2">Ваш набор</h3>
            <div class="constructor-grid" style="grid-template-columns: repeat(${columns}, 1fr)">
              ${gridHtml}
            </div>
            <div style="margin-top:2rem;text-align:center;position:relative;z-index:2">
              <p class="text-label-sm" style="opacity:0.6;margin-bottom:0.5rem">Итого к оплате</p>
              <p class="text-headline-sm" style="color:var(--color-primary)">${currentSize.price} BYN</p>
            </div>
          </div>
          
          <div class="constructor-actions">
             <button class="btn btn-primary ${currentTotal < constructorState.size ? 'disabled' : ''}" 
                     id="add-const-to-cart"
                     style="width:100%">
               Добавить в корзину
             </button>
          </div>
        </div>

      </div>
    </div>
  </div>
</div>`;
}

function setBoxSize(size) {
  constructorState.size = size;
  // Reset flavors if total > new size
  let total = constructorState.flavors.reduce((sum, f) => sum + f.count, 0);
  if (total > size) {
    constructorState.flavors.forEach(f => f.count = 0);
  }
  navigate(window.location.pathname, false, true, true);
}

function removeFlavorFromSlot(id) {
  const flavor = constructorState.flavors.find(f => f.id === id);
  if (flavor && flavor.count > 0) {
    flavor.count--;
    navigate(window.location.pathname, false, true, true);
  }
}

function bindConstructorEvents() {
  // Handle inc/dec buttons via delegation or direct binding
  // This is called by navigate after rendering
  document.querySelectorAll('.qty-btn-const').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      const flavor = constructorState.flavors.find(f => f.id === id);
      const total = constructorState.flavors.reduce((sum, f) => sum + f.count, 0);

      if (action === 'inc' && total < constructorState.size) {
        flavor.count++;
      } else if (action === 'dec' && flavor.count > 0) {
        flavor.count--;
      }
      navigate(window.location.pathname, false, true, true);
    });
  });

  document.getElementById('add-const-to-cart')?.addEventListener('click', () => {
    const total = constructorState.flavors.reduce((sum, f) => sum + f.count, 0);
    if (total < constructorState.size) {
      showToast('Сначала заполните коробку полностью! 🍫');
      return;
    }

    const flavorsText = constructorState.flavors
      .filter(f => f.count > 0)
      .map(f => `${f.name} (x${f.count})`)
      .join(', ');

    const currentSize = BOX_SIZES.find(s => s.count === constructorState.size);

    const customProduct = {
      id: `custom-box-${Date.now()}`,
      name: `Набор трюфелей (${constructorState.size} шт)`,
      price: currentSize.price,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBCSmvFF2IsAnj5UMN0d_mlzJfAj7v_4Hj7TL7GJJY9mZFFf-lE2uWUTl6MF4nDXLqnXvEBldG6DUoLL7Rjlv49MCj1sRQJXOVS2h02-sZVNxrcfUCmVY0a6axP8OxZEQFaXT8KvOsvhkdfGdZ0ZUOZwW02bFzMYmgV1LQNUNn11rTDlDdlQVJv1t8mGXTvSMd-u6b5-IDBiHhnDFdaihIPbMLZJCHhiQhNtFFpxqWLpUyaMFY713o92xFIdv3HPs0w3rXeluYmCA',
      weight: flavorsText
    };

    State.cart.push({
      productId: customProduct.id,
      qty: 1,
      variantId: null,
      customData: customProduct // Store full custom data for display
    });

    saveCart();
    updateCartBadge();
    showToast('Набор добавлен в корзину! ✨');
    openCartDrawer();
  });
}

function renderTeaser() {
  return `
  <section class="teaser-section">
    <div class="container">
      <div class="antigravity-container">
        
        <div class="antigravity-visual">
          <div class="floating-box">
            <div class="constructor-slot filled"><img src="${TEASER_ASSETS.f0}" /></div>
            <div class="constructor-slot filled"><img src="${TEASER_ASSETS.f1}" /></div>
            <div class="constructor-slot filled"><img src="${TEASER_ASSETS.f2}" /></div>
            <div class="constructor-slot empty"></div>
            <div class="constructor-slot filled"><img src="${TEASER_ASSETS.f3}" /></div>
            <div class="constructor-slot empty"></div>
            <div class="constructor-slot filled"><img src="${TEASER_ASSETS.f4}" /></div>
            <div class="constructor-slot empty"></div>
            <div class="constructor-slot filled"><img src="${TEASER_ASSETS.f5}" /></div>
          </div>
          <img src="${TEASER_ASSETS.f0}" class="floating-truffle t1" />
          <img src="${TEASER_ASSETS.f2}" class="floating-truffle t2" />
          <img src="${TEASER_ASSETS.f4}" class="floating-truffle t3" />
          <img src="${TEASER_ASSETS.f6}" class="floating-truffle t4" />
        </div>

        <div class="antigravity-content">
          <p class="section-eyebrow" style="color:var(--color-secondary); margin-bottom: 0.5rem;">Эксклюзив</p>
          <h2 class="text-headline-md" style="margin-bottom:1rem">Ваш идеальный набор</h2>
          <p style="font-size:1rem; color:var(--color-on-surface-variant); margin-bottom:1.5rem; line-height:1.5">
            Соберите свою коробочку трюфелей вручную. Выбирайте любимые вкусы и создавайте уникальные сочетания.
          </p>
          <a href="/constructor" data-route="/constructor" class="btn btn-primary">Начать сборку</a>
        </div>

      </div>
    </div>
  </section>`;
}
