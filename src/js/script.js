/* ── UTILS ─────────────────────────────────────────── */
function nameToId(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/* ── CURSOR ─────────────────────────────────────────── */
(function() {
  const cursor = document.getElementById('cursor');
  const follower = document.getElementById('cursorFollower');
  let mouseX = 0, mouseY = 0;
  let followerX = 0, followerY = 0;

  document.addEventListener('mousemove', function(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursor.style.left = mouseX + 'px';
    cursor.style.top  = mouseY + 'px';
  });

  function animateFollower() {
    followerX += (mouseX - followerX) * 0.1;
    followerY += (mouseY - followerY) * 0.1;
    follower.style.left = followerX + 'px';
    follower.style.top  = followerY + 'px';
    requestAnimationFrame(animateFollower);
  }
  animateFollower();

  // Expand on hover
  var hoverables = document.querySelectorAll('a, button, .hoverable');
  hoverables.forEach(function(el) {
    el.addEventListener('mouseenter', function() {
      cursor.style.width  = '20px';
      cursor.style.height = '20px';
      cursor.style.background = 'var(--gold)';
      follower.style.width  = '52px';
      follower.style.height = '52px';
    });
    el.addEventListener('mouseleave', function() {
      cursor.style.width  = '10px';
      cursor.style.height = '10px';
      cursor.style.background = 'var(--espresso)';
      follower.style.width  = '34px';
      follower.style.height = '34px';
    });
  });
})();

/* --------------------------------------------------------------------------
   SUNNY FURNITURE API BRIDGE
   Keeps the existing storefront UI, but prefers the production API whenever
   the Express backend is running.
-------------------------------------------------------------------------- */
(function() {
  const API_BASE = window.SUNNY_API_BASE || '/api';
  let currentUser = null;
  let csrfToken = null;
  let apiAvailable = true;
  try {
    const storedUser = JSON.parse(localStorage.getItem('sf_user') || 'null');
    if (storedUser?.email) currentUser = storedUser;
  } catch (_err) {}

  const categoryPages = {
    'living-room': 'living-room.html',
    bedroom: 'bedroom.html',
    dining: 'dining.html',
    storage: 'storage.html',
    outdoor: 'outdoor.html',
    study: 'study.html',
    decor: 'newdecor.html'
  };

  const pageCategories = {
    'living-room.html': 'living-room',
    'bedroom.html': 'bedroom',
    'dining.html': 'dining',
    'storage.html': 'storage',
    'outdoor.html': 'outdoor',
    'study.html': 'study',
    'newdecor.html': 'decor'
  };

  function getCookie(name) {
    return document.cookie
      .split('; ')
      .find(row => row.startsWith(name + '='))
      ?.split('=')
      .slice(1)
      .join('=');
  }

  async function ensureCsrf() {
    csrfToken = csrfToken || decodeURIComponent(getCookie('sf_csrf') || '');
    if (csrfToken) return csrfToken;
    try {
      const res = await fetch(API_BASE + '/auth/csrf', { credentials: 'include' });
      const data = await res.json();
      csrfToken = data.csrfToken;
    } catch (_err) {
      apiAvailable = false;
    }
    return csrfToken;
  }

  async function api(path, options) {
    const opts = options || {};
    const method = (opts.method || 'GET').toUpperCase();
    const headers = new Headers(opts.headers || {});
    if (!(opts.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const token = await ensureCsrf();
      if (token) headers.set('x-csrf-token', token);
    }
    const res = await fetch(API_BASE + path, {
      credentials: 'include',
      ...opts,
      headers,
      body: opts.body && !(opts.body instanceof FormData) ? JSON.stringify(opts.body) : opts.body
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.message || 'Something went wrong');
    }
    apiAvailable = true;
    return data;
  }

  function money(paise) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(Math.round((paise || 0) / 100));
    return '₹' + Math.round((paise || 0) / 100).toLocaleString('en-IN');
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  function updateCartBadge(cart) {
    const count = (cart?.items || []).reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.querySelector('.cart-badge');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  }

  function setCurrentUser(user) {
    currentUser = user || null;
    const accountButton = document.querySelector('[aria-label="Account"]');
    if (currentUser) {
      localStorage.setItem('sf_user', JSON.stringify({
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        phone: currentUser.phone
      }));
      if (accountButton) accountButton.setAttribute('title', currentUser.name || currentUser.email);
    } else {
      localStorage.removeItem('sf_user');
      if (accountButton) accountButton.removeAttribute('title');
    }
  }

  async function fetchCart() {
    return (await api('/cart')).cart;
  }

  async function renderApiCart() {
    const body = document.getElementById('cartDrawerBody');
    const footer = document.getElementById('cartDrawerFooter');
    if (!body || !footer) return null;
    const cart = await fetchCart();
    updateCartBadge(cart);

    if (!cart.items.length) {
      body.innerHTML = `
        <div class="cart-empty">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M10 10h4l4 18h16l4-12H16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="38" r="2" fill="currentColor"/><circle cx="34" cy="38" r="2" fill="currentColor"/></svg>
          <h3>Your bag is empty</h3>
          <p>Looks like you haven't added any pieces to your bag yet.</p>
          <a href="living-room.html" class="checkout-btn" style="background:var(--walnut)">Start Shopping</a>
        </div>`;
      footer.style.display = 'none';
      return cart;
    }

    footer.style.display = 'block';
    body.innerHTML = cart.items.map(item => `
      <div class="cart-item" data-item-id="${escapeHtml(item.id)}">
        <div class="cart-item-img"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}"></div>
        <div class="cart-item-info">
          <div>
            <div class="cart-item-name">${escapeHtml(item.name)}</div>
            <div class="cart-item-price">${escapeHtml(item.price)}</div>
          </div>
          <div class="cart-item-controls">
            <div class="qty-control">
              <button class="qty-btn dec" data-api-cart="dec">-</button>
              <span class="qty-val">${item.quantity}</span>
              <button class="qty-btn inc" data-api-cart="inc">+</button>
            </div>
            <button class="cart-item-remove" data-api-cart="remove">Remove</button>
          </div>
        </div>
      </div>
    `).join('');

    const subtotalEl = document.getElementById('cartSubtotal');
    const totalEl = document.getElementById('cartTotal');
    const discountLine = document.getElementById('cartDiscountLine');
    const discountAmountEl = document.getElementById('cartDiscountAmount');
    const promoInput = document.getElementById('cartPromoInput');
    const promoMsg = document.getElementById('cartPromoMsg');

    if (subtotalEl) subtotalEl.textContent = cart.totals.subtotal;
    if (totalEl) totalEl.textContent = cart.totals.total;
    if (discountLine) discountLine.style.display = cart.totals.discountPaise > 0 ? 'flex' : 'none';
    if (discountAmountEl) discountAmountEl.textContent = '-' + cart.totals.discount;
    if (promoInput && cart.totals.coupon?.code) promoInput.value = cart.totals.coupon.code;
    if (promoMsg && cart.totals.coupon?.code) {
      promoMsg.textContent = 'Code applied successfully!';
      promoMsg.style.color = 'var(--sage)';
    }
    return cart;
  }

  async function openApiCart() {
    try {
      await renderApiCart();
      document.getElementById('cartDrawerOverlay')?.classList.add('open');
      document.getElementById('cartDrawer')?.classList.add('open');
    } catch (err) {
      console.warn('Cart API unavailable, using local cart fallback.', err);
      apiAvailable = false;
    }
  }

  async function addToCartApi(name, _price, _img) {
    try {
      await api('/cart/add', { method: 'POST', body: { name, quantity: 1 } });
      await openApiCart();
    } catch (err) {
      alert(err.message || 'Unable to add item to cart');
    }
  }

  function installLateOverrides() {
    window.addToCart = addToCartApi;
  }

  function ensureCheckoutFields() {
    const grid = document.querySelector('.checkout-main .checkout-section .checkout-grid');
    if (!grid || document.getElementById('checkoutEmail')) return;
    const inputs = grid.querySelectorAll('input');
    if (inputs[0]) inputs[0].id = 'checkoutName';
    if (inputs[1]) inputs[1].id = 'checkoutStreet';
    if (inputs[2]) inputs[2].id = 'checkoutCity';
    if (inputs[3]) inputs[3].id = 'checkoutPincode';
    grid.insertAdjacentHTML('beforeend', `
      <input type="email" class="auth-input" id="checkoutEmail" placeholder="Email">
      <input type="tel" class="auth-input" id="checkoutPhone" placeholder="Phone number">
    `);
  }

  async function openApiCheckout() {
    const cart = await renderApiCart();
    if (!cart || !cart.items.length) {
      alert('Your bag is empty!');
      return;
    }
    ensureCheckoutFields();
    if (currentUser) {
      const nameInput = document.getElementById('checkoutName');
      const emailInput = document.getElementById('checkoutEmail');
      const phoneInput = document.getElementById('checkoutPhone');
      if (nameInput && !nameInput.value) nameInput.value = currentUser.name || '';
      if (emailInput && !emailInput.value) emailInput.value = currentUser.email || '';
      if (phoneInput && !phoneInput.value) phoneInput.value = currentUser.phone || '';
    }
    const itemsContainer = document.getElementById('checkoutItems');
    if (itemsContainer) {
      itemsContainer.innerHTML = cart.items.map(item => `
        <div class="order-item">
          <div class="order-item-img"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}"></div>
          <div class="order-item-info">
            <div class="order-item-name">${escapeHtml(item.name)} x${item.quantity}</div>
            <div class="order-item-price">${escapeHtml(item.lineTotal)}</div>
          </div>
        </div>
      `).join('');
    }
    document.getElementById('coSubtotal').textContent = cart.totals.subtotal;
    document.getElementById('coTotal').textContent = cart.totals.total;
    const discountLine = document.getElementById('coDiscountLine');
    if (discountLine) discountLine.style.display = cart.totals.discountPaise > 0 ? 'flex' : 'none';
    const discount = document.getElementById('coDiscount');
    if (discount) discount.textContent = '-' + cart.totals.discount;
    document.getElementById('checkoutOverlay')?.classList.add('open');
    document.getElementById('cartDrawer')?.classList.remove('open');
    document.getElementById('cartDrawerOverlay')?.classList.remove('open');
  }

  function checkoutPayload() {
    const name = document.getElementById('checkoutName')?.value.trim();
    const email = document.getElementById('checkoutEmail')?.value.trim();
    const phone = document.getElementById('checkoutPhone')?.value.trim();
    return {
      contact: { name, email, phone },
      shippingAddress: {
        fullName: name,
        phone,
        street: document.getElementById('checkoutStreet')?.value.trim(),
        city: document.getElementById('checkoutCity')?.value.trim(),
        pincode: document.getElementById('checkoutPincode')?.value.trim()
      }
    };
  }

  function finishApiOrder(order) {
    const successOrderId = document.getElementById('successOrderId');
    if (successOrderId) successOrderId.textContent = order.orderNumber;
    document.getElementById('upiAppOverlay')?.classList.remove('open');
    document.getElementById('checkoutOverlay')?.classList.remove('open');
    document.getElementById('successOverlay')?.classList.add('open');
    renderApiCart().catch(() => {});
  }

  async function loadRazorpayCheckout() {
    if (window.Razorpay) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function completeApiCheckout() {
    const errorEl = document.getElementById('checkoutError');
    const completeBtn = document.getElementById('completeOrder');
    try {
      if (errorEl) errorEl.style.display = 'none';
      if (completeBtn) {
        completeBtn.disabled = true;
        completeBtn.textContent = 'Processing...';
      }

      const selected = document.querySelector('.pay-method.active')?.dataset.method || 'upi';
      const payload = checkoutPayload();
      if (selected === 'cod') {
        const data = await api('/orders/checkout/cod', { method: 'POST', body: payload });
        finishApiOrder(data.order);
        return;
      }

      const created = await api('/payments/create-order', { method: 'POST', body: payload });
      if (created.razorpay.testMode) {
        const verified = await api('/payments/verify', {
          method: 'POST',
          body: {
            orderNumber: created.order.orderNumber,
            razorpayOrderId: created.razorpay.orderId,
            razorpayPaymentId: 'pay_test_' + Date.now(),
            razorpaySignature: 'test_signature'
          }
        });
        finishApiOrder(verified.order);
        return;
      }

      await loadRazorpayCheckout();
      const checkout = new window.Razorpay({
        key: created.razorpay.key,
        amount: created.razorpay.amount,
        currency: created.razorpay.currency,
        name: 'Sunny Furniture',
        description: created.order.orderNumber,
        order_id: created.razorpay.orderId,
        prefill: payload.contact,
        handler: async response => {
          const verified = await api('/payments/verify', {
            method: 'POST',
            body: {
              orderNumber: created.order.orderNumber,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            }
          });
          finishApiOrder(verified.order);
        }
      });
      checkout.open();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message || 'Checkout failed';
        errorEl.style.display = 'block';
      } else {
        alert(err.message || 'Checkout failed');
      }
    } finally {
      if (completeBtn) {
        completeBtn.disabled = false;
        completeBtn.textContent = 'Complete Purchase';
      }
    }
  }

  async function loginFromOverlay() {
    const email = document.querySelector('#loginForm input[type="email"]')?.value.trim();
    const password = document.querySelector('#loginForm input[type="password"]')?.value;
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    setCurrentUser(data.user);
    document.getElementById('authOverlay')?.classList.remove('open');
    await renderApiCart();
  }

  async function registerFromOverlay() {
    const data = await api('/auth/register', {
      method: 'POST',
      body: {
        name: document.getElementById('signupName')?.value.trim(),
        email: document.getElementById('signupEmail')?.value.trim(),
        phone: document.getElementById('signupPhone')?.value.trim(),
        password: document.getElementById('signupPass')?.value
      }
    });
    setCurrentUser(data.user);
    document.getElementById('authOverlay')?.classList.remove('open');
    await renderApiCart();
  }

  function formatCategory(category) {
    return String(category || '')
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function currentCatalogPath() {
    const file = location.pathname.split('/').pop() || 'index.html';
    if (file === 'sale.html') return '/products?sale=true&limit=60';
    if (file === 'index.html' || file === '') return '/products?featured=true&limit=16';
    const category = pageCategories[file];
    return category ? '/products?category=' + encodeURIComponent(category) + '&limit=60' : null;
  }

  function productImage(product) {
    return product.image || product.images?.[0]?.url || '/aura3seater.jpg';
  }

  function buildProductCard(product, index) {
    const img = productImage(product);
    const available = Number(product.availableStock ?? product.stock ?? 0);
    const material = product.materials?.summary || 'Premium materials';
    const size = product.dimensions?.summary || 'Standard dimensions';
    const desc = product.description || 'A handcrafted piece designed for modern Indian homes.';
    const price = product.price || money(product.pricePaise);
    const compareAt = product.compareAtPrice || (product.compareAtPricePaise ? money(product.compareAtPricePaise) : '');
    const badges = [
      product.isOnSale ? '<span class="badge badge-sale">Sale</span>' : '',
      product.isFeatured ? '<span class="badge badge-new">Featured</span>' : '',
      available <= 3 ? '<span class="badge badge-low">Low stock</span>' : ''
    ].filter(Boolean).join('');

    return `
      <article id="${escapeHtml(product.slug)}" class="prod-card hoverable${index >= 8 ? ' hidden-product' : ''}" role="listitem"
        data-api-product="true"
        data-api-slug="${escapeHtml(product.slug)}"
        data-category="${escapeHtml(product.category)}"
        data-material="${escapeHtml(material)}"
        data-size="${escapeHtml(size)}"
        data-desc="${escapeHtml(desc)}">
        <div class="prod-img-wrap" data-img="${escapeHtml(img)}">
          <div class="prod-img-inner">
            <img src="${escapeHtml(img)}" alt="${escapeHtml(product.images?.[0]?.alt || product.name)}" loading="${index < 4 ? 'eager' : 'lazy'}">
          </div>
          ${badges ? `<div class="prod-badges">${badges}</div>` : ''}
          <button class="wish-btn hoverable" aria-label="Add to wishlist" aria-pressed="false">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M9 15.5S2 10.8 2 6.5a4 4 0 0 1 7-2.64A4 4 0 0 1 16 6.5c0 4.3-7 9-7 9z" stroke="#9C8265" stroke-width="1.2" stroke-linejoin="round" />
            </svg>
          </button>
          <button class="view-item-btn quick-add-btn hoverable" aria-label="View ${escapeHtml(product.name)}">View Product</button>
        </div>
        <div class="prod-info">
          <div class="prod-cat">${escapeHtml(product.category)}</div>
          <div class="prod-name">${escapeHtml(product.name)}</div>
          <div class="prod-bottom">
            <div class="prod-price-wrap">
              <div class="prod-price">${escapeHtml(price)}</div>
              ${compareAt ? `<div class="prod-compare">${escapeHtml(compareAt)}</div>` : ''}
            </div>
          </div>
        </div>
      </article>`;
  }

  function openApiProductModal(card) {
    const modal = document.getElementById('productModal');
    if (!modal || !card) return false;

    const name = card.querySelector('.prod-name')?.textContent || '';
    const cat = card.querySelector('.prod-cat')?.textContent || '';
    const price = card.querySelector('.prod-price')?.textContent || '';
    const imgWrap = card.querySelector('.prod-img-wrap');
    const img = imgWrap?.getAttribute('data-img') || imgWrap?.querySelector('img')?.getAttribute('src') || '';

    const nameEl = document.getElementById('pmName');
    const catEl = document.getElementById('pmCat');
    const priceEl = document.getElementById('pmPrice');
    const imgWrapEl = document.getElementById('pmImageWrap');
    const matEl = document.getElementById('pmMaterial');
    const sizeEl = document.getElementById('pmSize');
    const descEl = document.getElementById('pmDesc');

    if (nameEl) nameEl.textContent = name;
    if (catEl) catEl.textContent = cat;
    if (priceEl) priceEl.textContent = price;
    if (matEl) matEl.textContent = card.getAttribute('data-material') || 'Premium materials';
    if (sizeEl) sizeEl.textContent = card.getAttribute('data-size') || 'Standard dimensions';
    if (descEl) descEl.textContent = card.getAttribute('data-desc') || 'A handcrafted piece designed for modern Indian homes.';
    if (imgWrapEl && img) {
      imgWrapEl.innerHTML = `<img src="${escapeHtml(img)}" style="width: 100%; height: auto; display: block;" alt="${escapeHtml(name)}">`;
    }

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    void modal.offsetWidth;
    modal.classList.add('show');
    return true;
  }

  function refreshLoadMoreState(grid) {
    const loadMoreBtn = grid.closest('section')?.querySelector('#loadMoreBtn') || document.getElementById('loadMoreBtn');
    if (!loadMoreBtn) return;
    loadMoreBtn.style.display = grid.querySelector('.prod-card.hidden-product') ? '' : 'none';
  }

  function openProductFromHash(grid) {
    const hash = decodeURIComponent(location.hash.slice(1));
    if (!hash) return;
    const card = document.getElementById(hash) || Array.from(grid.querySelectorAll('.prod-card')).find(item => item.dataset.apiSlug === hash);
    if (!card) return;
    card.classList.remove('hidden-product');
    card.style.display = 'flex';
    refreshLoadMoreState(grid);
    setTimeout(() => {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      openApiProductModal(card);
    }, 120);
  }

  async function hydrateProductGrid() {
    const path = currentCatalogPath();
    const grid = document.querySelector('.products-grid[role="list"]:not(#wishlistGrid)');
    if (!path || !grid) return;

    try {
      let data = await api(path);
      if ((location.pathname.endsWith('/') || location.pathname.endsWith('index.html') || location.pathname === '/') && !data.products?.length) {
        data = await api('/products?limit=16');
      }
      if (!data.products?.length) return;
      grid.dataset.apiProducts = 'true';
      document.body.dataset.apiProductsHydrated = 'true';
      grid.innerHTML = data.products.map(buildProductCard).join('');
      refreshLoadMoreState(grid);
      openProductFromHash(grid);
    } catch (err) {
      console.warn('Product API unavailable, keeping static catalog.', err);
      apiAvailable = false;
    }
  }

  function applyProductFilter(filterValue) {
    const grid = document.querySelector('.products-grid[data-api-products="true"]');
    if (!grid) return false;
    const filter = String(filterValue || 'all').trim().toLowerCase();
    grid.querySelectorAll('.prod-card').forEach(card => {
      const cat = card.dataset.category || card.querySelector('.prod-cat')?.textContent?.trim().toLowerCase() || '';
      const isSale = Boolean(card.querySelector('.badge-sale'));
      const matches = filter === 'all' || cat === filter || cat + 's' === filter || filter === cat + 's' || (filter === 'sale' && isSale);
      card.style.display = matches ? 'flex' : 'none';
    });
    return true;
  }

  function openAuthOverlay() {
    const overlay = document.getElementById('authOverlay');
    if (overlay) overlay.classList.add('open');
  }

  function ensureAccountOverlay() {
    if (!document.getElementById('accountOverlay')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="account-overlay" id="accountOverlay">
          <aside class="account-panel" aria-label="Customer account">
            <button class="account-close hoverable" id="accountClose" aria-label="Close account">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" stroke-width="1.2"/><line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" stroke-width="1.2"/></svg>
            </button>
            <div class="account-profile">
              <div class="section-eyebrow">Account</div>
              <h2 id="accountName">Your account</h2>
              <p id="accountEmail"></p>
              <p id="accountPhone"></p>
            </div>
            <div class="account-stats">
              <div><strong id="accountOrderCount">0</strong><span>Orders</span></div>
              <div><strong id="accountWishlistCount">0</strong><span>Wishlist</span></div>
            </div>
            <div class="account-section">
              <div class="section-eyebrow">Recent orders</div>
              <div id="accountOrders" class="account-orders"></div>
            </div>
            <button class="account-logout hoverable" id="accountLogout">Log out</button>
          </aside>
        </div>
      `);
    }

    const overlay = document.getElementById('accountOverlay');
    if (!overlay.dataset.bound) {
      overlay.dataset.bound = 'true';
      document.getElementById('accountClose')?.addEventListener('click', () => overlay.classList.remove('open'));
      overlay.addEventListener('click', event => {
        if (event.target === overlay) overlay.classList.remove('open');
      });
      document.getElementById('accountLogout')?.addEventListener('click', async () => {
        await api('/auth/logout', { method: 'POST' }).catch(() => {});
        setCurrentUser(null);
        overlay.classList.remove('open');
        renderApiCart().catch(() => {});
      });
    }
    return overlay;
  }

  function renderAccountOrders(orders) {
    const ordersEl = document.getElementById('accountOrders');
    const countEl = document.getElementById('accountOrderCount');
    if (countEl) countEl.textContent = String(orders.length);
    if (!ordersEl) return;
    if (!orders.length) {
      ordersEl.innerHTML = '<div class="account-empty">No orders yet. Your future purchases will appear here.</div>';
      return;
    }
    ordersEl.innerHTML = orders.map(order => {
      const created = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      const items = (order.items || []).slice(0, 3).map(item => `<span>${escapeHtml(item.name)} x${item.quantity}</span>`).join('');
      return `
        <article class="account-order">
          <div>
            <strong>${escapeHtml(order.orderNumber)}</strong>
            <small>${escapeHtml(created)}</small>
          </div>
          <div class="account-order-total">${escapeHtml(order.total)}</div>
          <div class="account-order-items">${items}</div>
          <div class="account-order-status">
            <span>${escapeHtml(order.paymentStatus)}</span>
            <span>${escapeHtml(order.fulfillmentStatus)}</span>
          </div>
        </article>`;
    }).join('');
  }

  async function openAccountPanel() {
    if (!currentUser?.email) {
      openAuthOverlay();
      return;
    }

    const overlay = ensureAccountOverlay();
    let wishlist = [];
    try {
      wishlist = JSON.parse(localStorage.getItem('sf_wishlist') || '[]');
    } catch (_err) {}
    document.getElementById('accountName').textContent = currentUser.name || 'Sunny customer';
    document.getElementById('accountEmail').textContent = currentUser.email || '';
    document.getElementById('accountPhone').textContent = currentUser.phone || '';
    document.getElementById('accountWishlistCount').textContent = String(wishlist.length || 0);
    document.getElementById('accountOrders').innerHTML = '<div class="account-empty">Loading your orders...</div>';
    overlay.classList.add('open');

    try {
      const data = await api('/orders');
      renderAccountOrders(data.orders || []);
    } catch (err) {
      if (err.message === 'Authentication required') {
        setCurrentUser(null);
        overlay.classList.remove('open');
        openAuthOverlay();
      } else {
        document.getElementById('accountOrders').innerHTML = `<div class="account-empty">${escapeHtml(err.message)}</div>`;
      }
    }
  }

  async function apiSearch(query) {
    if (!query) return;
    const resultsEl = document.getElementById('searchResults');
    const quickEl = document.getElementById('searchQuick');
    if (!resultsEl) return;
    const data = await api('/products/search?q=' + encodeURIComponent(query));
    if (quickEl) quickEl.style.display = 'none';
    if (!data.products.length) {
      resultsEl.innerHTML = '<div class="search-empty">No products found. Try a different search.</div>';
      return;
    }
    resultsEl.innerHTML = data.products.map(product => `
      <div class="search-result-item" data-api-slug="${escapeHtml(product.slug)}" data-api-category="${escapeHtml(product.category)}">
        <div>
          <div class="sr-name">${escapeHtml(product.name)}</div>
          <div class="sr-cat">${escapeHtml(product.category)}</div>
        </div>
        <div class="sr-price">${escapeHtml(product.price)}</div>
      </div>
    `).join('');
  }

  function ensureTrackContactField() {
    const wrap = document.querySelector('.track-search');
    if (!wrap || document.getElementById('trackContact')) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'trackContact';
    input.placeholder = 'Email or phone used at checkout';
    input.setAttribute('aria-label', 'Email or phone used at checkout');
    wrap.insertBefore(input, document.getElementById('trackBtn'));
  }

  async function trackOrder() {
    ensureTrackContactField();
    const orderNumber = document.getElementById('trackInput')?.value.trim();
    const contact = document.getElementById('trackContact')?.value.trim();
    const data = await api('/orders/track?orderNumber=' + encodeURIComponent(orderNumber) + '&contact=' + encodeURIComponent(contact));
    const existing = document.getElementById('trackResult');
    if (existing) existing.remove();
    document.querySelector('.track-hero')?.insertAdjacentHTML('beforeend', `
      <div id="trackResult" class="reveal in-view" style="max-width:640px;margin:28px auto 0;padding:22px;border:1px solid var(--linen);background:var(--warm-white);text-align:left;">
        <div class="section-eyebrow">Order ${escapeHtml(data.order.orderNumber)}</div>
        <h3 style="font-family:var(--serif);font-size:1.6rem;margin:8px 0;">${escapeHtml(data.order.fulfillmentStatus)}</h3>
        <p style="color:var(--tan);margin:0 0 12px;">Payment: ${escapeHtml(data.order.paymentStatus)} · Total: ${escapeHtml(data.order.total)}</p>
        <div>${data.order.items.map(item => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid var(--linen);"><span>${escapeHtml(item.name)} x${item.quantity}</span><span>${escapeHtml(item.price)}</span></div>`).join('')}</div>
      </div>
    `);
  }

  let searchTimer;
  document.addEventListener('input', event => {
    if (event.target?.id !== 'searchInput') return;
    clearTimeout(searchTimer);
    const query = event.target.value.trim();
    if (!query) return;
    searchTimer = setTimeout(() => apiSearch(query).catch(() => {}), 180);
  });

  document.addEventListener('click', event => {
    const apiResult = event.target.closest('.search-result-item[data-api-slug]');
    if (!apiResult) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const page = categoryPages[apiResult.dataset.apiCategory] || 'living-room.html';
    window.location.href = page + '#' + apiResult.dataset.apiSlug;
  }, true);

  document.addEventListener('click', async event => {
    const accountButton = event.target.closest('[aria-label="Account"]');
    if (accountButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await openAccountPanel();
      return;
    }

    const filterTab = event.target.closest('.filter-tab');
    if (filterTab && document.body.dataset.apiProductsHydrated === 'true') {
      const applied = applyProductFilter(filterTab.dataset.filter || filterTab.textContent);
      if (applied) {
        event.preventDefault();
        event.stopImmediatePropagation();
        document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
        filterTab.classList.add('active');
        return;
      }
    }

    const productCard = event.target.closest('.prod-card[data-api-product="true"]');
    if (productCard && !event.target.closest('.wish-btn, .prod-swatches')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openApiProductModal(productCard);
      return;
    }

    const cartButton = event.target.closest('.cart-wrap');
    if (cartButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await openApiCart();
      return;
    }

    const checkoutButton = event.target.closest('.checkout-btn');
    if (checkoutButton && !checkoutButton.href) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await openApiCheckout().catch(err => alert(err.message));
      return;
    }

    const promoButton = event.target.closest('#cartPromoApply');
    if (promoButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const code = document.getElementById('cartPromoInput')?.value.trim();
      try {
        await api('/cart/coupon', { method: 'POST', body: { code } });
        await renderApiCart();
      } catch (err) {
        const msg = document.getElementById('cartPromoMsg');
        if (msg) {
          msg.textContent = err.message;
          msg.style.color = 'var(--terra)';
        }
      }
      return;
    }

    const cartAction = event.target.closest('[data-api-cart], .cart-item-remove');
    const cartItem = event.target.closest('.cart-item[data-item-id]');
    if (cartAction && cartItem) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const itemId = cartItem.dataset.itemId;
      const currentQty = Number(cartItem.querySelector('.qty-val')?.textContent || 1);
      if (cartAction.dataset.apiCart === 'remove' || cartAction.classList.contains('cart-item-remove')) {
        await api('/cart/items/' + itemId, { method: 'DELETE' });
      } else {
        const nextQty = cartAction.dataset.apiCart === 'inc' ? currentQty + 1 : Math.max(1, currentQty - 1);
        await api('/cart/items/' + itemId, { method: 'PUT', body: { quantity: nextQty } });
      }
      await renderApiCart();
      return;
    }

    if (event.target.closest('#completeOrder')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      await completeApiCheckout();
      return;
    }

    if (event.target.closest('#loginSubmit')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      loginFromOverlay().catch(err => {
        const authError = document.getElementById('authError');
        if (authError) {
          authError.textContent = err.message;
          authError.style.display = 'block';
        }
      });
      return;
    }

    if (event.target.closest('#signupSubmit')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      registerFromOverlay().catch(err => {
        const authError = document.getElementById('authError');
        if (authError) {
          authError.textContent = err.message;
          authError.style.display = 'block';
        }
      });
      return;
    }

    if (event.target.closest('#trackBtn')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      trackOrder().catch(err => alert(err.message));
    }
  }, true);

  document.addEventListener('DOMContentLoaded', () => {
    ensureCsrf().catch(() => {});
    api('/auth/me')
      .then(data => {
        setCurrentUser(data.user);
      })
      .catch(() => {})
      .finally(() => {
        if (apiAvailable) renderApiCart().catch(() => {});
      });
    hydrateProductGrid();
    ensureTrackContactField();
  });

  window.SunnyApiBridge = {
    installLateOverrides,
    addToCart: addToCartApi,
    openCart: openApiCart,
    renderCart: renderApiCart,
    refreshProducts: hydrateProductGrid,
    openAccount: openAccountPanel
  };
  installLateOverrides();
})();

/* ── SCROLL REVEAL ──────────────────────────────────── */
(function() {
  var revealEls = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  window.revealObserver = observer;
  revealEls.forEach(function(el) { observer.observe(el); });
})();

/* ── NAV SCROLL ─────────────────────────────────────── */
(function() {
  var nav = document.getElementById('mainNav');
  window.addEventListener('scroll', function() {
    if (window.scrollY > 20) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }, { passive: true });
})();

/* ── FILTER TABS ────────────────────────────────────── */
(function() {
  var tabs = document.querySelectorAll('.filter-tab');
  var cards = document.querySelectorAll('.products-grid .prod-card');
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      tabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      var filter = tab.textContent.trim().toLowerCase();
      
      cards.forEach(function(card) {
        var catEl = card.querySelector('.prod-cat');
        if (catEl) {
          var cat = catEl.textContent.trim().toLowerCase();
          var isSale = card.querySelector('.badge-sale') !== null;
          var match = (filter === 'all' || cat === filter || cat + 's' === filter || filter === cat + 's');
          
          if (filter === 'sale' && isSale) {
            match = true;
          }
          
          if (match) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        }
      });
    });
  });
})();

/* ── SWATCH SELECTION ───────────────────────────────── */
(function() {
  document.querySelectorAll('.prod-swatches').forEach(function(group) {
    group.querySelectorAll('.swatch').forEach(function(sw) {
      sw.addEventListener('click', function(e) {
        e.stopPropagation();
        group.querySelectorAll('.swatch').forEach(function(s) {
          s.classList.remove('active');
          s.setAttribute('aria-checked', 'false');
        });
        sw.classList.add('active');
        sw.setAttribute('aria-checked', 'true');
      });
    });
  });
})();

/* ── ANIMATED NUMBER COUNTER ────────────────────────── */
(function() {
  var statEls = document.querySelectorAll('.stat-num[data-target]');

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      var target  = parseFloat(el.getAttribute('data-target'));
      var suffix  = el.getAttribute('data-suffix') || '';
      var isDecimal = el.getAttribute('data-decimal') === 'true';
      var duration = 2400; // Increased duration for visible counting
      var startTime = null;

      // Smoother easing that doesn't rush the beginning too much
      function easeOutQuad(t) {
        return t * (2 - t);
      }

      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1);
        var easedProgress = easeOutQuad(progress);
        var current = easedProgress * target;
        
        if (isDecimal) {
          el.textContent = current.toFixed(1) + suffix;
        } else {
          el.textContent = Math.floor(current).toLocaleString('en-IN') + suffix;
        }
        
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          if (isDecimal) {
            el.textContent = target.toFixed(1) + suffix;
          } else {
            el.textContent = target.toLocaleString('en-IN') + suffix;
          }
        }
      }

      // Delay starting slightly so the CSS opacity reveal transition can manifest first
      setTimeout(function() {
        requestAnimationFrame(step);
      }, 150);
      
      observer.unobserve(el);
    });
  }, { threshold: 0.15 });

  statEls.forEach(function(el) { observer.observe(el); });
})();

/* ── NEWSLETTER FORM ────────────────────────────────── */
(function() {
  var form = document.querySelector('.nl-form');
  var btn  = document.querySelector('.nl-btn');
  var inp  = document.querySelector('.nl-input');

  if (!form) return;

  btn.addEventListener('click', function(e) {
    e.preventDefault();
    var email = inp.value.trim();
    if (!email || !email.includes('@')) {
      inp.style.borderColor = 'rgba(200,133,106,0.7)';
      inp.focus();
      return;
    }
    inp.style.borderColor = 'rgba(122,140,110,0.6)';
    btn.textContent = 'Subscribed ✓';
    btn.style.background = 'var(--sage)';
    inp.value = '';
    setTimeout(function() {
      btn.textContent = 'Subscribe';
      btn.style.background = '';
      inp.style.borderColor = '';
    }, 3000);
  });
})();

/* ── WISH BUTTON SYNC ─────────────────────────────── */
(function() {
  // This section handles the visual state of wish buttons across the site
  // based on what's saved in the global wishlist.
  function syncWishButtons() {
    const list = JSON.parse(localStorage.getItem('sf_wishlist') || '[]');
    const savedNames = new Set(list.map(item => item.name));
    
    document.querySelectorAll('.wish-btn').forEach(btn => {
      const card = btn.closest('.prod-card');
      if (!card) return;
      const name = card.querySelector('.prod-name')?.textContent?.trim();
      if (name && savedNames.has(name)) {
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('is-active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });
  }
  
  // Initial sync
  window.addEventListener('DOMContentLoaded', syncWishButtons);
  // Re-sync after any click that might affect wishlist (since listeners are delegated/added elsewhere)
  document.addEventListener('click', (e) => {
    if (e.target.closest('.wish-btn') || e.target.closest('.wl-item-remove')) {
      setTimeout(syncWishButtons, 50);
    }
  });
})();

/* ── PRODUCT MODAL OPEN ─────────────────────────────── */
(function() {
  const modal = document.getElementById('productModal');
  const closeBtn = document.getElementById('pmClose');
  const overlay = document.getElementById('pmOverlay');
  if (!modal) return;

  const nameEl = document.getElementById('pmName');
  const catEl = document.getElementById('pmCat');
  const priceEl = document.getElementById('pmPrice');
  const imgWrapEl = document.getElementById('pmImageWrap');

  function closeModal() {
    modal.classList.remove('show');
    setTimeout(() => {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }, 500);
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (overlay) overlay.addEventListener('click', closeModal);

  console.log("Modal IIFE started, cards found: ", document.querySelectorAll('.prod-card').length);
  function openModalForCard(card) {
      const name = card.querySelector('.prod-name')?.textContent || '';
      const cat = card.querySelector('.prod-cat')?.textContent || '';
      const price = card.querySelector('.prod-price')?.textContent || '';
      const imgWrap = card.querySelector('.prod-img-wrap');
      const imgSvg = imgWrap ? imgWrap.getAttribute('data-img') : null;
      const material = card.getAttribute('data-material') || 'Premium Wood / Upholstery';
      const size = card.getAttribute('data-size') || 'Standard Dimensions';
      const desc = card.getAttribute('data-desc') || 'A beautiful handcrafted piece designed for modern Indian homes.';
      
      if (nameEl) nameEl.textContent = name;
      if (catEl) catEl.textContent = cat;
      if (priceEl) priceEl.textContent = price;
      
      const matEl = document.getElementById('pmMaterial');
      const sizeEl = document.getElementById('pmSize');
      const descEl = document.getElementById('pmDesc');
      if (matEl) matEl.textContent = material;
      if (sizeEl) sizeEl.textContent = size;
      if (descEl) descEl.textContent = desc;
      
      if (imgWrapEl) {
        if (imgSvg && (imgSvg.includes('.jpg') || imgSvg.includes('.jpeg') || imgSvg.includes('.png') || imgSvg.includes('.webp') || imgSvg.includes('.avif') || imgSvg.includes('.gif'))) {
          imgWrapEl.innerHTML = `<img src="${imgSvg}" style="width: 100%; height: auto; display: block;" alt="Product Image">`;
        } else if (imgSvg) {
          imgWrapEl.innerHTML = imgSvg;
        } else {
          const innerSvg = imgWrap ? imgWrap.querySelector('.prod-img-inner svg') : null;
          if (innerSvg) imgWrapEl.innerHTML = innerSvg.outerHTML;
        }
        const s = imgWrapEl.querySelector('svg');
        if (s) { s.style.width = '100%'; s.style.height = 'auto'; s.style.maxWidth = '400px'; }
      }

      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
      void modal.offsetWidth;
      modal.classList.add('show');
  }

  document.querySelectorAll('.prod-card').forEach(card => {
    // 'View Product' button (view-item-btn) explicitly opens the modal
    const viewBtn = card.querySelector('.view-item-btn');
    if (viewBtn) {
      viewBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        openModalForCard(card);
      });
    }

    card.addEventListener('click', function(e) {
      if (e.target.closest('.prod-swatches') || e.target.closest('.wish-btn') || e.target.closest('.quick-add-btn')) {
         return;
      }
      
      openModalForCard(card);
    });
    
    // Handle Quick Add buttons (Direct add to cart)
    // Handle Quick Add buttons (Direct add to cart)
    const quickAddBtn = card.querySelector('.quick-add-btn:not(.view-item-btn)');

    if (quickAddBtn) {
      quickAddBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        
        const name = card.querySelector('.prod-name')?.textContent?.trim() || '';
        const price = card.querySelector('.prod-price')?.textContent?.trim() || '';
        const imgWrap = card.querySelector('.prod-img-wrap');
        const img = imgWrap?.getAttribute('data-img') || card.querySelector('.prod-img-wrap img')?.src || '';

        if (window.addToCart) {
          window.addToCart(name, price, img);
          
          const originalText = quickAddBtn.textContent;
          quickAddBtn.textContent = 'Added ✓';
          quickAddBtn.style.background = '#7A8C6E'; 
          quickAddBtn.style.color = '#fff';
          
          setTimeout(() => {
            quickAddBtn.textContent = originalText;
            quickAddBtn.style.background = '';
            quickAddBtn.style.color = '';
          }, 2000);
        }
      });
    }
  });
  
  // Add to Cart button logic inside Modal
  const pmAddCart = document.querySelector('.pm-add-cart');
  if (pmAddCart) {
    pmAddCart.addEventListener('click', function(e) {
      e.stopPropagation();
      
      const name = document.getElementById('pmName')?.textContent || '';
      const price = document.getElementById('pmPrice')?.textContent || '';
      const imgWrap = document.getElementById('pmImageWrap');
      const img = imgWrap?.querySelector('img')?.src || '';

      if (window.addToCart) {
        window.addToCart(name, price, img);
        
        const originalText = pmAddCart.textContent;
        pmAddCart.textContent = 'Added ✓';
        pmAddCart.style.background = '#7A8C6E';
        
        setTimeout(() => {
          pmAddCart.textContent = originalText;
          pmAddCart.style.background = '';
        }, 2000);
      }
    });
  }

  // ── HASH HANDLING (Deep Linking) ──
  function handleHash() {
    const hash = window.location.hash.substring(1);
    if (!hash) return;

    // Give the page a moment to settle
    setTimeout(() => {
      const cards = document.querySelectorAll('.prod-card');
      let foundCard = null;

      // 1. Try to find by direct ID match
      foundCard = document.getElementById(hash);

      // 2. Try to find by name match (slugified)
      if (!foundCard) {
        for (const card of cards) {
          const name = card.querySelector('.prod-name')?.textContent?.trim();
          if (name && nameToId(name) === hash) {
            foundCard = card;
            break;
          }
        }
      }

      if (foundCard) {
        // If it's a hidden product (Load More), reveal it
        if (foundCard.classList.contains('hidden-product')) {
          foundCard.classList.remove('hidden-product');
          if (window.revealObserver) window.revealObserver.observe(foundCard);
        }

        const isProductCard = foundCard.classList.contains('prod-card');

        if (isProductCard) {
          // Ensure it's visible (filter tabs might have hidden it)
          foundCard.style.display = 'flex';

          foundCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Highlight briefly
          const originalShadow = foundCard.style.boxShadow;
          foundCard.style.boxShadow = '0 0 0 2px var(--gold)';
          setTimeout(() => foundCard.style.boxShadow = originalShadow, 3000);

          // Open modal
          openModalForCard(foundCard);
        } else {
          foundCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }, 600);
  }

  window.addEventListener('load', handleHash);
  window.addEventListener('hashchange', handleHash);
})();

/* ── LOAD MORE FUNCTIONALITY ───────────────────────── */
(function() {
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (!loadMoreBtn) return;

  loadMoreBtn.addEventListener('click', function() {
    // Look for hidden products in the current page
    const grid = loadMoreBtn.closest('section')?.querySelector('.products-grid') || document.querySelector('.products-grid');
    if (!grid) return;

    const hiddenCards = grid.querySelectorAll('.prod-card.hidden-product');
    const batchSize = 8;
    
    for (let i = 0; i < Math.min(batchSize, hiddenCards.length); i++) {
      hiddenCards[i].classList.remove('hidden-product');
      // Trigger reveal animation
      if (window.revealObserver) {
        window.revealObserver.observe(hiddenCards[i]);
      }
    }

  if (grid.querySelectorAll('.prod-card.hidden-product').length === 0) {
      loadMoreBtn.parentElement.style.display = 'none';
    }
  });
})();

/* ── SEARCH OVERLAY ────────────────────────────────── */
(function() {
  // ── Global product catalog (all pages) ──
  const GLOBAL_CATALOG = [
    {name:'Aura 3-seater sofa',price:'₹42,000',cat:'Living',page:'living-room.html'},
    {name:'Mesa coffee table',price:'₹18,000',cat:'Living',page:'living-room.html'},
    {name:'Aero floor lamp',price:'₹8,500',cat:'Living',page:'living-room.html'},
    {name:'Loom accent chair',price:'₹28,000',cat:'Living',page:'living-room.html'},
    {name:'Solis TV unit',price:'₹35,000',cat:'Living',page:'living-room.html'},
    {name:'Terra jute rug',price:'₹12,000',cat:'Living',page:'living-room.html'},
    {name:'Nyla end table',price:'₹8,500',cat:'Living',page:'living-room.html'},
    {name:'Crescent lounge chair',price:'₹19,600',cat:'Living',page:'living-room.html'},
    {name:'Orbit Sofa',price:'₹15,000',cat:'Living',page:'living-room.html'},
    {name:'Sona bookshelf',price:'₹24,000',cat:'Living',page:'living-room.html'},
    {name:'Vero nesting tables',price:'₹14,000',cat:'Living',page:'living-room.html'},
    {name:'Aura 2-seater sofa',price:'₹22,400',cat:'Living',page:'living-room.html'},
    {name:'Rattan pouf',price:'₹4,500',cat:'Living',page:'living-room.html'},
    {name:'Lyra Armchair',price:'₹18,500',cat:'Living',page:'living-room.html'},
    {name:'Celeste Sofa',price:'₹45,000',cat:'Living',page:'living-room.html'},
    {name:'Stella Coffee Table',price:'₹22,000',cat:'Living',page:'living-room.html'},
    {name:'Atlas Rug',price:'₹15,000',cat:'Living',page:'living-room.html'},
    {name:'Oasis TV Unit',price:'₹32,500',cat:'Living',page:'living-room.html'},
    {name:'Haven Bookshelf',price:'₹26,000',cat:'Living',page:'living-room.html'},
    {name:'Lumina Lamp',price:'₹7,500',cat:'Living',page:'living-room.html'},
    {name:'Echo Pouf',price:'₹5,000',cat:'Living',page:'living-room.html'},
    {name:'Zen End Table',price:'₹11,000',cat:'Living',page:'living-room.html'},
    {name:'Nova Lounge Chair',price:'₹29,500',cat:'Living',page:'living-room.html'},
    {name:'Alto queen bed',price:'₹55,500',cat:'Bedroom',page:'bedroom.html'},
    {name:'Loom nightstand',price:'₹8,400',cat:'Bedroom',page:'bedroom.html'},
    {name:'Cove dresser',price:'₹38,000',cat:'Bedroom',page:'bedroom.html'},
    {name:'Lyra King Bed',price:'₹65,000',cat:'Bedroom',page:'bedroom.html'},
    {name:'Celeste Nightstand',price:'₹14,500',cat:'Bedroom',page:'bedroom.html'},
    {name:'Stella Dresser',price:'₹32,000',cat:'Bedroom',page:'bedroom.html'},
    {name:'Atlas Wardrobe',price:'₹58,000',cat:'Bedroom',page:'bedroom.html'},
    {name:'Oasis Bench',price:'₹18,500',cat:'Bedroom',page:'bedroom.html'},
    {name:'Haven Lamp',price:'₹6,000',cat:'Bedroom',page:'bedroom.html'},
    {name:'Lumina Mirror',price:'₹22,500',cat:'Bedroom',page:'bedroom.html'},
    {name:'Echo Dresser',price:'₹40,000',cat:'Bedroom',page:'bedroom.html'},
    {name:'Zen Nightstand',price:'₹7,700',cat:'Bedroom',page:'bedroom.html'},
    {name:'Nova Queen Bed',price:'₹60,500',cat:'Bedroom',page:'bedroom.html'},
    {name:'Aero Bench',price:'₹16,000',cat:'Bedroom',page:'bedroom.html'},
    {name:'Mesa King Bed',price:'₹75,000',cat:'Bedroom',page:'bedroom.html'},
    {name:'Mesa round table',price:'₹12,600',cat:'Dining',page:'dining.html'},
    {name:'Forma dining chair',price:'₹7,500',cat:'Dining',page:'dining.html'},
    {name:'Arc pendant light',price:'₹14,200',cat:'Dining',page:'dining.html'},
    {name:'Aura Dining Table',price:'₹42,000',cat:'Dining',page:'dining.html'},
    {name:'Nyla Sideboard',price:'₹36,500',cat:'Dining',page:'dining.html'},
    {name:'Orbit Bar Stool',price:'₹14,000',cat:'Dining',page:'dining.html'},
    {name:'Haven Cabinet',price:'₹28,000',cat:'Dining',page:'dining.html'},
    {name:'Lyra Bench',price:'₹12,500',cat:'Dining',page:'dining.html'},
    {name:'Celeste Pendant Light',price:'₹8,000',cat:'Dining',page:'dining.html'},
    {name:'Stella Dining Chair',price:'₹16,000',cat:'Dining',page:'dining.html'},
    {name:'Terra Cabinet',price:'₹34,000',cat:'Dining',page:'dining.html'},
    {name:'Apex tall cabinet',price:'₹31,500',cat:'Storage',page:'storage.html'},
    {name:'Linear sideboard',price:'₹36,000',cat:'Storage',page:'storage.html'},
    {name:'Block wall shelf',price:'₹3,800',cat:'Storage',page:'storage.html'},
    {name:'Rattan Bookshelf',price:'₹24,000',cat:'Storage',page:'storage.html'},
    {name:'Echo Console Table',price:'₹18,500',cat:'Storage',page:'storage.html'},
    {name:'Zen Shoe Rack',price:'₹12,000',cat:'Storage',page:'storage.html'},
    {name:'Lumina Display Unit',price:'₹45,000',cat:'Storage',page:'storage.html'},
    {name:'Nova Chest of Drawers',price:'₹32,500',cat:'Storage',page:'storage.html'},
    {name:'Mesa Cabinet',price:'₹28,000',cat:'Storage',page:'storage.html'},
    {name:'Solis Sideboard',price:'₹42,000',cat:'Storage',page:'storage.html'},
    {name:'Crescent Bookshelf',price:'₹13,300',cat:'Storage',page:'storage.html'},
    {name:'Atlas Console Table',price:'₹15,500',cat:'Storage',page:'storage.html'},
    {name:'Oasis Sideboard',price:'₹38,000',cat:'Storage',page:'storage.html'},
    {name:'Terra lounge chair',price:'₹22,000',cat:'Outdoor',page:'outdoor.html'},
    {name:'Sol side table',price:'₹4,550',cat:'Outdoor',page:'outdoor.html'},
    {name:'Oasis planter',price:'₹2,940',cat:'Outdoor',page:'outdoor.html'},
    {name:'Rattan Patio Chair',price:'₹12,950',cat:'Outdoor',page:'outdoor.html'},
    {name:'Echo Outdoor Table',price:'₹28,000',cat:'Outdoor',page:'outdoor.html'},
    {name:'Solis Lounger',price:'₹32,500',cat:'Outdoor',page:'outdoor.html'},
    {name:'Terra Planter',price:'₹6,000',cat:'Outdoor',page:'outdoor.html'},
    {name:'Volta writing desk',price:'₹28,000',cat:'Study',page:'study.html'},
    {name:'Ergo chair',price:'₹15,000',cat:'Study',page:'study.html'},
    {name:'Silo bookshelf',price:'₹32,000',cat:'Study',page:'study.html'},
    {name:'Aura Desk',price:'₹34,000',cat:'Study',page:'study.html'},
    {name:'Loom Office Chair',price:'₹18,500',cat:'Study',page:'study.html'},
    {name:'Mesa Bookshelf',price:'₹26,000',cat:'Study',page:'study.html'},
    {name:'Nyla Table Lamp',price:'₹6,500',cat:'Study',page:'study.html'},
    {name:'Solis Filing Cabinet',price:'₹14,000',cat:'Study',page:'study.html'},
    {name:'Lumina floor mirror',price:'₹12,500',cat:'Decor',page:'newdecor.html'},
    {name:'Atlas Wool Rug',price:'₹18,000',cat:'Decor',page:'newdecor.html'},
    {name:'Oasis Large Planter',price:'₹4,500',cat:'Decor',page:'newdecor.html'},
    {name:'Terra Mood Lamp',price:'₹6,800',cat:'Decor',page:'newdecor.html'},
    {name:'Block Wall Shelf',price:'₹3,200',cat:'Decor',page:'newdecor.html'},
    {name:'Jute Textured Rug',price:'₹8,500',cat:'Decor',page:'newdecor.html'},
    {name:'Natural Rattan Pouf',price:'₹5,200',cat:'Decor',page:'newdecor.html'},
    {name:'Echo Velvet Pouf',price:'₹6,400',cat:'Decor',page:'newdecor.html'},
    {name:'Lumina Task Lamp',price:'₹7,200',cat:'Decor',page:'newdecor.html'},
    {name:'Woven Cotton Rug',price:'₹9,800',cat:'Decor',page:'newdecor.html'},
    {name:'Loom Nightstand (Clearance)',price:'₹8,400',cat:'Sale',page:'sale.html'},
    {name:'Oasis Planter (Set of 2)',price:'₹2,940',cat:'Sale',page:'sale.html'},
    {name:'Solis Side Table',price:'₹4,550',cat:'Sale',page:'sale.html'},
    {name:'Zen Stone Nightstand',price:'₹7,700',cat:'Sale',page:'sale.html'},
    {name:'Apex Storage Cabinet',price:'₹31,500',cat:'Sale',page:'sale.html'},
  ];

  // Inject search HTML if not present
  if (!document.getElementById('searchOverlay')) {
    const html = `
      <div class="search-overlay" id="searchOverlay"></div>
      <div class="search-panel" id="searchPanel">
        <button class="search-close hoverable" id="searchClose" aria-label="Close search">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        </button>
        <div class="search-inner">
          <span class="search-label">Search</span>
          <div class="search-input-wrap">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.2"/><line x1="13.5" y1="13.5" x2="18" y2="18" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            <input class="search-input" id="searchInput" type="text" placeholder="What are you looking for?" autocomplete="off">
          </div>
          <div id="searchResults" class="search-results"></div>
          <div class="search-quick" id="searchQuick">
            <a href="living-room.html" class="search-quick-tag hoverable">Living</a>
            <a href="bedroom.html" class="search-quick-tag hoverable">Bedroom</a>
            <a href="dining.html" class="search-quick-tag hoverable">Dining</a>
            <a href="storage.html" class="search-quick-tag hoverable">Storage</a>
            <a href="outdoor.html" class="search-quick-tag hoverable">Outdoor</a>
            <a href="sale.html" class="search-quick-tag hoverable">Sale</a>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  const overlay = document.getElementById('searchOverlay');
  const panel = document.getElementById('searchPanel');
  const input = document.getElementById('searchInput');
  const closeBtn = document.getElementById('searchClose');
  const resultsEl = document.getElementById('searchResults');
  const quickEl = document.getElementById('searchQuick');
  const searchBtn = document.querySelector('[aria-label="Search"]');

  // Map local cards by name for quick lookup
  const localCards = {};
  document.querySelectorAll('.prod-card').forEach(card => {
    const name = card.querySelector('.prod-name')?.textContent?.trim();
    if (name) localCards[name] = card;
  });

  // Get current page filename
  const currentPage = location.pathname.split('/').pop() || 'index.html';

  function openSearch() {
    overlay.classList.add('open');
    panel.classList.add('open');
    setTimeout(() => input.focus(), 400);
  }

  function closeSearch() {
    overlay.classList.remove('open');
    panel.classList.remove('open');
    input.value = '';
    resultsEl.innerHTML = '';
    quickEl.style.display = '';
  }

  // Open product modal for a card (reusing existing modal system)
  function openModalForCard(card) {
    const modal = document.getElementById('productModal');
    if (!modal) return false;

    const name = card.querySelector('.prod-name')?.textContent || '';
    const cat = card.querySelector('.prod-cat')?.textContent || '';
    const price = card.querySelector('.prod-price')?.textContent || '';
    const imgWrap = card.querySelector('.prod-img-wrap');
    const imgSvg = imgWrap ? imgWrap.getAttribute('data-img') : null;
    const material = card.getAttribute('data-material') || 'Premium Wood / Upholstery';
    const size = card.getAttribute('data-size') || 'Standard Dimensions';
    const desc = card.getAttribute('data-desc') || 'A beautiful handcrafted piece designed for modern Indian homes.';

    const nameEl = document.getElementById('pmName');
    const catEl = document.getElementById('pmCat');
    const priceEl = document.getElementById('pmPrice');
    const imgWrapEl = document.getElementById('pmImageWrap');
    const matEl = document.getElementById('pmMaterial');
    const sizeEl = document.getElementById('pmSize');
    const descEl = document.getElementById('pmDesc');

    if (nameEl) nameEl.textContent = name;
    if (catEl) catEl.textContent = cat;
    if (priceEl) priceEl.textContent = price;
    if (matEl) matEl.textContent = material;
    if (sizeEl) sizeEl.textContent = size;
    if (descEl) descEl.textContent = desc;

    if (imgWrapEl) {
      if (imgSvg && (imgSvg.includes('.jpg') || imgSvg.includes('.jpeg') || imgSvg.includes('.png') || imgSvg.includes('.webp') || imgSvg.includes('.avif') || imgSvg.includes('.gif'))) {
        imgWrapEl.innerHTML = `<img src="${imgSvg}" style="width: 100%; height: auto; display: block;" alt="${name}">`;
      } else if (imgSvg) {
        imgWrapEl.innerHTML = imgSvg;
      } else {
        const innerSvg = imgWrap ? imgWrap.querySelector('.prod-img-inner svg') : null;
        if (innerSvg) imgWrapEl.innerHTML = innerSvg.outerHTML;
      }
      const s = imgWrapEl.querySelector('svg');
      if (s) { s.style.width = '100%'; s.style.height = 'auto'; s.style.maxWidth = '400px'; }
    }

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    void modal.offsetWidth;
    modal.classList.add('show');
    return true;
  }

  if (searchBtn) searchBtn.addEventListener('click', openSearch);
  if (closeBtn) closeBtn.addEventListener('click', closeSearch);
  if (overlay) overlay.addEventListener('click', closeSearch);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel.classList.contains('open')) closeSearch();
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
  });

  if (input) {
    input.addEventListener('input', function() {
      const q = this.value.trim().toLowerCase();
      if (!q) { resultsEl.innerHTML = ''; quickEl.style.display = ''; return; }
      quickEl.style.display = 'none';

      // Search global catalog + local page cards
      const seen = new Set();
      const matches = [];

      // Search global catalog
      GLOBAL_CATALOG.forEach(p => {
        if (p.name.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q)) {
          if (!seen.has(p.name + p.page)) {
            seen.add(p.name + p.page);
            matches.push(p);
          }
        }
      });

      // Also include local page products not in catalog
      Object.keys(localCards).forEach(name => {
        if (name.toLowerCase().includes(q) && !seen.has(name + currentPage)) {
          const card = localCards[name];
          matches.push({
            name,
            price: card.querySelector('.prod-price')?.textContent?.trim() || '',
            cat: card.querySelector('.prod-cat')?.textContent?.trim() || '',
            page: currentPage
          });
        }
      });

      if (matches.length === 0) {
        resultsEl.innerHTML = '<div class="search-empty">No products found. Try a different search.</div>';
        return;
      }

      // Show up to 12 results
      const shown = matches.slice(0, 12);
      const pageName = f => {
        const map = {'living-room.html':'Living Room','bedroom.html':'Bedroom','dining.html':'Dining','storage.html':'Storage','outdoor.html':'Outdoor','study.html':'Study','sale.html':'Sale','newdecor.html':'Decor','index.html':'Home'};
        return map[f] || f;
      };

      resultsEl.innerHTML = shown.map(p => {
        const isLocal = p.page === currentPage;
        return `
        <div class="search-result-item" data-name="${p.name}" data-page="${p.page}">
          <div>
            <div class="sr-name">${p.name}</div>
            <div class="sr-cat">${p.cat}${!isLocal ? ' · <span style="color:var(--gold)">' + pageName(p.page) + '</span>' : ''}</div>
          </div>
          <div class="sr-price">${p.price}</div>
        </div>`;
      }).join('') + (matches.length > 12 ? '<div class="search-empty" style="padding:12px 0;font-size:.82rem">+ ' + (matches.length - 12) + ' more results</div>' : '');

      resultsEl.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          const name = item.dataset.name;
          const page = item.dataset.page;

          // If product is on current page, open modal or scroll to it
          if (page === currentPage || localCards[name]) {
            const card = localCards[name];
            closeSearch();
            if (card) {
              // Try to open product modal
              const modalOpened = openModalForCard(card);
              if (!modalOpened) {
                // Fallback: scroll to card
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.style.boxShadow = '0 0 0 2px var(--gold)';
                setTimeout(() => card.style.boxShadow = '', 2000);
              }
            }
          } else {
            // Navigate to the page — the product will be there
            const id = nameToId(name);
            window.location.href = page + '#' + id;
          }
        });
      });
    });
  }
})();

/* ── WISHLIST DRAWER ───────────────────────────────── */
(function() {
  // Inject wishlist drawer HTML if not present
  if (!document.getElementById('wlDrawerOverlay')) {
    const html = `
      <div class="wl-drawer-overlay" id="wlDrawerOverlay"></div>
      <div class="wl-drawer" id="wlDrawer">
        <div class="wl-drawer-header">
          <div>
            <span class="wl-drawer-title">Wishlist</span>
            <span class="wl-drawer-count" id="wlDrawerCount">0 items</span>
          </div>
          <button class="wl-drawer-close hoverable" id="wlDrawerClose" aria-label="Close wishlist">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><line x1="3" y1="3" x2="15" y2="15" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="15" y1="3" x2="3" y2="15" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="wl-drawer-body" id="wlDrawerBody"></div>
        <div class="wl-drawer-footer">
          <a href="living-room.html" class="wl-browse-btn hoverable">Continue shopping</a>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  const drawerOverlay = document.getElementById('wlDrawerOverlay');
  const drawer = document.getElementById('wlDrawer');
  const drawerClose = document.getElementById('wlDrawerClose');
  const drawerBody = document.getElementById('wlDrawerBody');
  const drawerCount = document.getElementById('wlDrawerCount');

  function getWishlist() {
    try { return JSON.parse(localStorage.getItem('sf_wishlist') || '[]'); } catch { return []; }
  }
  function saveWishlist(list) {
    localStorage.setItem('sf_wishlist', JSON.stringify(list));
    updateGlobalBadge(list.length);
  }

  function updateGlobalBadge(count) {
    const badge = document.querySelector('.wishlist-badge');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
      if (count > 0) {
        badge.style.animation = 'none';
        void badge.offsetWidth;
        badge.style.animation = 'badgePop 0.4s var(--ease-out) both';
      }
    }
  }

  function openDrawer() {
    if (!drawer || !drawerOverlay) {
        const d = document.getElementById('wlDrawer');
        const o = document.getElementById('wlDrawerOverlay');
        if (d && o) {
            renderDrawer();
            o.classList.add('open');
            d.classList.add('open');
        }
        return;
    }
    renderDrawer();
    drawerOverlay.classList.add('open');
    drawer.classList.add('open');
  }
  function closeDrawer() {
    if (drawerOverlay) drawerOverlay.classList.remove('open');
    if (drawer) drawer.classList.remove('open');
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('.wish-wrap') || e.target.closest('[aria-label*="Wishlist"]');
    if (btn && !btn.classList.contains('wish-btn')) { 
      e.preventDefault();
      openDrawer();
    }
  });

  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
  });

  function renderDrawer() {
    const list = getWishlist();
    if (drawerCount) drawerCount.textContent = list.length + ' item' + (list.length !== 1 ? 's' : '');
    updateGlobalBadge(list.length);

    if (list.length === 0) {
      drawerBody.innerHTML = `
        <div class="wl-empty">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M24 42S6 30 6 18a10 10 0 0 1 18-6 10 10 0 0 1 18 6c0 12-18 24-18 24z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
          <h3>Your wishlist is empty</h3>
          <p>Save pieces you love by tapping the heart icon on any product.</p>
        </div>`;
      return;
    }

    drawerBody.innerHTML = list.map((item, i) => `
      <div class="wl-item" data-idx="${i}">
        <div class="wl-item-img">
          ${item.img ? '<img src="'+item.img+'" alt="'+item.name+'">' : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#C8B49A" stroke-width="1"/></svg>'}
        </div>
        <div class="wl-item-info">
          <div class="wl-item-name">${item.name}</div>
          <div class="wl-item-price">${item.price}</div>
        </div>
        <div class="wl-item-actions">
          <button class="wl-item-add hoverable" title="Move to Cart" aria-label="Add to cart">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 2h1.8L6 10.5h7.5l2-7H5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7.5" cy="14" r="1" fill="currentColor"/><circle cx="12.5" cy="14" r="1" fill="currentColor"/></svg>
          </button>
          <button class="wl-item-remove hoverable" title="Remove from Wishlist" aria-label="Remove from wishlist">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="13" y1="3" x2="3" y2="13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    `).join('');

    // Remove item
    drawerBody.querySelectorAll('.wl-item-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.closest('.wl-item').dataset.idx);
        const list = getWishlist();
        list.splice(idx, 1);
        saveWishlist(list);
        renderDrawer();
      });
    });

    // Move to cart
    drawerBody.querySelectorAll('.wl-item-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.closest('.wl-item').dataset.idx);
        const list = getWishlist();
        const item = list[idx];
        
        if (window.addToCart) {
          window.addToCart(item.name, item.price, item.img);
          
          // Remove from wishlist after adding to cart
          list.splice(idx, 1);
          saveWishlist(list);
          renderDrawer();
          
          // Close wishlist drawer so cart can be seen
          closeDrawer();
        }
      });
    });
  }

  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.wish-btn');
    if (!btn) return;
    
    e.stopPropagation();
    e.preventDefault();

    const card = btn.closest('.prod-card');
    if (!card) return;
    const name = card.querySelector('.prod-name')?.textContent?.trim() || '';
    const price = card.querySelector('.prod-price')?.textContent?.trim() || '';
    const imgWrap = card.querySelector('.prod-img-wrap');
    const imgSrc = imgWrap?.getAttribute('data-img') || card.querySelector('.prod-img-wrap img')?.src || '';

    const list = getWishlist();
    const idx = list.findIndex(i => i.name === name);
    
    if (idx > -1) {
      list.splice(idx, 1);
      btn.classList.remove('is-active');
    } else {
      list.push({ name, price, img: imgSrc });
      btn.classList.add('is-active');
    }
    saveWishlist(list);
  });

  updateGlobalBadge(getWishlist().length);
})();

/* ── CART DRAWER ───────────────────────────────────── */
(function() {
  // Inject cart drawer HTML if not present
  if (!document.getElementById('cartDrawerOverlay')) {
    const html = `
      <div class="cart-drawer-overlay" id="cartDrawerOverlay"></div>
      <div class="cart-drawer" id="cartDrawer">
        <div class="cart-drawer-header">
          <span class="cart-drawer-title">Shopping Bag</span>
          <button class="cart-drawer-close hoverable" id="cartDrawerClose" aria-label="Close cart">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><line x1="3" y1="3" x2="15" y2="15" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="15" y1="3" x2="3" y2="15" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="cart-drawer-body" id="cartDrawerBody"></div>
        <div class="cart-drawer-footer" id="cartDrawerFooter">
          <div class="cart-promo-section" style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid var(--linen);">
            <div style="font-size: 0.85rem; color: var(--tan); margin-bottom: 8px;">Have a promo code?</div>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="cartPromoInput" placeholder="Enter code" style="flex: 1; padding: 10px; border: 1px solid var(--linen); font-family: var(--sans); font-size: 0.85rem; background: #fff;">
              <button id="cartPromoApply" class="hoverable" style="padding: 0 16px; background: var(--walnut); color: #fff; border: none; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; transition: background 0.3s;">Apply</button>
            </div>
            <div id="cartPromoMsg" style="font-size: 0.75rem; margin-top: 6px; min-height: 1em;"></div>
          </div>
          <div class="cart-summary-line">
            <span>Subtotal</span>
            <span id="cartSubtotal">₹0</span>
          </div>
          <div id="cartDiscountLine" class="cart-summary-line" style="display: none; color: var(--terra);">
            <span>Discount (10%)</span>
            <span id="cartDiscountAmount">-₹0</span>
          </div>
          <div class="cart-summary-line">
            <span>Delivery</span>
            <span style="color:var(--sage)">FREE</span>
          </div>
          <div class="cart-summary-line total">
            <span>Total</span>
            <span id="cartTotal">₹0</span>
          </div>
          <button class="checkout-btn hoverable">Checkout</button>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  const overlay = document.getElementById('cartDrawerOverlay');
  const drawer = document.getElementById('cartDrawer');
  const closeBtn = document.getElementById('cartDrawerClose');
  const body = document.getElementById('cartDrawerBody');
  const footer = document.getElementById('cartDrawerFooter');
  const subtotalEl = document.getElementById('cartSubtotal');
  const totalEl = document.getElementById('cartTotal');
  const cartNavBtn = document.querySelector('.cart-wrap');
  
  // New Promo elements
  const promoInput = document.getElementById('cartPromoInput');
  const promoApplyBtn = document.getElementById('cartPromoApply');
  const promoMsg = document.getElementById('cartPromoMsg');
  const discountLine = document.getElementById('cartDiscountLine');
  const discountAmountEl = document.getElementById('cartDiscountAmount');

  function getCart() {
    try { return JSON.parse(localStorage.getItem('sf_cart') || '[]'); } catch { return []; }
  }
  function saveCart(list) {
    localStorage.setItem('sf_cart', JSON.stringify(list));
    updateGlobalBadge();
    if (drawer.classList.contains('open')) renderCart();
  }

  function updateGlobalBadge() {
    const list = getCart();
    const count = list.reduce((sum, item) => sum + item.qty, 0);
    const badge = document.querySelector('.cart-badge');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
      if (count > 0) {
        badge.style.animation = 'none';
        void badge.offsetWidth;
        badge.style.animation = 'badgePop 0.4s var(--ease-out) both';
      }
    }
  }

  window.addToCart = function(name, price, img) {
    const list = getCart();
    const idx = list.findIndex(i => i.name === name);
    if (idx > -1) {
      list[idx].qty += 1;
    } else {
      list.push({ name, price, img, qty: 1 });
    }
    saveCart(list);
    openCart();
  };

  function openCart() {
    renderCart();
    overlay.classList.add('open');
    drawer.classList.add('open');
  }
  function closeCart() {
    overlay.classList.remove('open');
    drawer.classList.remove('open');
  }

  if (cartNavBtn) cartNavBtn.addEventListener('click', e => { e.preventDefault(); openCart(); });
  if (closeBtn) closeBtn.addEventListener('click', closeCart);
  if (overlay) overlay.addEventListener('click', closeCart);
  
  // Promo logic
  if (promoApplyBtn) {
    promoApplyBtn.addEventListener('click', () => {
      const code = promoInput.value.trim().toUpperCase();
      if (code === 'WELCOME10') {
        localStorage.setItem('sf_cart_promo', 'WELCOME10');
        promoMsg.textContent = 'Code applied successfully!';
        promoMsg.style.color = 'var(--sage)';
        renderCart();
      } else {
        promoMsg.textContent = 'Invalid promo code';
        promoMsg.style.color = 'var(--terra)';
      }
    });
  }

  function renderCart() {
    const list = getCart();
    if (list.length === 0) {
      body.innerHTML = `
        <div class="cart-empty">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M10 10h4l4 18h16l4-12H16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="38" r="2" fill="currentColor"/><circle cx="34" cy="38" r="2" fill="currentColor"/></svg>
          <h3>Your bag is empty</h3>
          <p>Looks like you haven't added any pieces to your bag yet.</p>
          <a href="living-room.html" class="checkout-btn" style="background:var(--walnut)">Start Shopping</a>
        </div>`;
      footer.style.display = 'none';
      return;
    }

    footer.style.display = 'block';
    body.innerHTML = list.map((item, i) => `
      <div class="cart-item">
        <div class="cart-item-img">
          <img src="${item.img}" alt="${item.name}">
        </div>
        <div class="cart-item-info">
          <div>
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">${item.price}</div>
          </div>
          <div class="cart-item-controls">
            <div class="qty-control">
              <button class="qty-btn dec" data-idx="${i}">-</button>
              <span class="qty-val">${item.qty}</span>
              <button class="qty-btn inc" data-idx="${i}">+</button>
            </div>
            <button class="cart-item-remove" data-idx="${i}">Remove</button>
          </div>
        </div>
      </div>
    `).join('');

    // Calculate total
    let subtotal = 0;
    list.forEach(item => {
      const p = parseInt(item.price.replace(/[^\d]/g, '')) || 0;
      subtotal += p * item.qty;
    });
    
    const appliedPromo = localStorage.getItem('sf_cart_promo');
    let discount = 0;
    if (appliedPromo === 'WELCOME10') {
      discount = Math.round(subtotal * 0.1);
      discountLine.style.display = 'flex';
      discountAmountEl.textContent = '-₹' + discount.toLocaleString('en-IN');
      promoInput.value = 'WELCOME10';
      promoMsg.textContent = 'Code applied successfully!';
      promoMsg.style.color = 'var(--sage)';
    } else {
      discountLine.style.display = 'none';
    }

    subtotalEl.textContent = '₹' + subtotal.toLocaleString('en-IN');
    totalEl.textContent = '₹' + (subtotal - discount).toLocaleString('en-IN');

    // Bind events
    body.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = btn.dataset.idx;
        if (btn.classList.contains('inc')) {
          list[idx].qty += 1;
        } else {
          if (list[idx].qty > 1) list[idx].qty -= 1;
        }
        saveCart(list);
      });
    });
    body.querySelectorAll('.cart-item-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        list.splice(btn.dataset.idx, 1);
        saveCart(list);
      });
    });
  }

  // Init
  updateGlobalBadge();
})();

/* ── AUTH SYSTEM ──────────────────────────────────── */
(function() {
  if (!document.getElementById('authOverlay')) {
    const html = `
      <div class="auth-overlay" id="authOverlay">
        <div class="auth-card">
          <button class="auth-close hoverable" id="authClose" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><line x1="4" y1="4" x2="16" y2="16" stroke="currentColor" stroke-width="1.2"/><line x1="16" y1="4" x2="4" y2="16" stroke="currentColor" stroke-width="1.2"/></svg>
          </button>
          <div class="auth-tabs">
            <div class="auth-tab active" data-target="loginForm">Log In</div>
            <div class="auth-tab" data-target="signupForm">Sign Up</div>
          </div>
          
          <div class="auth-form active" id="loginForm">
            <div class="auth-group">
              <label class="auth-label">Email Address</label>
              <input type="email" class="auth-input" placeholder="name@example.com">
            </div>
            <div class="auth-group">
              <label class="auth-label">Password</label>
              <input type="password" class="auth-input" placeholder="••••••••">
            </div>
            <button class="auth-btn hoverable" id="loginSubmit">Log In</button>
          </div>

          <div class="auth-form" id="signupForm">
            <div class="auth-group">
              <label class="auth-label">Full Name</label>
              <input type="text" class="auth-input" id="signupName" placeholder="John Doe">
            </div>
            <div class="auth-group">
              <label class="auth-label">Email Address</label>
              <input type="email" class="auth-input" id="signupEmail" placeholder="name@example.com">
            </div>
            <div class="auth-group">
              <label class="auth-label">Phone Number</label>
              <input type="tel" class="auth-input" id="signupPhone" placeholder="+91 00000 00000">
            </div>
            <div class="auth-group">
              <label class="auth-label">Password</label>
              <input type="password" class="auth-input" id="signupPass" placeholder="••••••••">
            </div>
            <button class="auth-btn hoverable" id="signupSubmit">Create Account</button>
          </div>

          <div class="auth-form" id="otpForm">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="font-family: var(--serif); font-size: 1.4rem; margin-bottom: 8px;">Verify your details</div>
              <p style="font-size: 0.85rem; color: var(--tan);">We've sent a 6-digit code to your email and phone.</p>
            </div>
            <div class="auth-group">
              <label class="auth-label">Enter OTP</label>
              <input type="text" class="auth-input" id="otpInput" placeholder="000000" style="text-align: center; letter-spacing: 0.5em; font-weight: 600;">
            </div>
            <button class="auth-btn hoverable" id="otpVerifySubmit">Verify & Create Account</button>
            <div style="text-align: center; margin-top: 16px;">
              <button style="background:none; border:none; color:var(--walnut); font-size:0.75rem; cursor:pointer; text-decoration:underline;" onclick="alert('OTP Resent!')">Resend OTP</button>
            </div>
          </div>

          <div id="authError" style="color: var(--terra); font-size: 0.8rem; margin-top: 16px; text-align: center; display: none;"></div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  const overlay = document.getElementById('authOverlay');
  const closeBtn = document.getElementById('authClose');
  const tabs = document.querySelectorAll('.auth-tab');
  const forms = document.querySelectorAll('.auth-form');
  const accountBtn = document.querySelector('[aria-label="Account"]');
  const authError = document.getElementById('authError');

  function openAuth() { overlay.classList.add('open'); }
  function closeAuth() { overlay.classList.remove('open'); }

  if (accountBtn) accountBtn.addEventListener('click', e => { e.preventDefault(); openAuth(); });
  if (closeBtn) closeBtn.addEventListener('click', closeAuth);
  if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeAuth(); });

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.target === 'otpForm') return; // Can't switch to OTP manually
      tabs.forEach(t => t.classList.remove('active'));
      forms.forEach(f => f.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.target).classList.add('active');
      authError.style.display = 'none';
    });
  });

  const loginBtn = document.getElementById('loginSubmit');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      const email = loginBtn.closest('.auth-form').querySelector('input[type="email"]').value;
      if (email) {
        localStorage.setItem('sf_user', JSON.stringify({ email, name: email.split('@')[0] }));
        alert('Welcome back, ' + email.split('@')[0] + '!');
        closeAuth();
      }
    });
  }

  const signupSubmit = document.getElementById('signupSubmit');
  if (signupSubmit) {
    signupSubmit.addEventListener('click', () => {
      const name = document.getElementById('signupName').value.trim();
      const email = document.getElementById('signupEmail').value.trim();
      const phone = document.getElementById('signupPhone').value.trim().replace(/\s/g, '');
      const pass = document.getElementById('signupPass').value.trim();

      if (!name || !email || !phone || !pass) {
        authError.textContent = 'Please fill all fields';
        authError.style.display = 'block';
        return;
      }

      // Strict Email Validation (Regex)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        authError.textContent = 'Please enter a valid email address';
        authError.style.display = 'block';
        return;
      }

      // Strict Phone Validation (10 Digits)
      const phoneDigits = phone.replace(/\D/g, ''); // Extract only digits
      if (phoneDigits.length !== 10) {
        authError.textContent = 'Please enter a valid 10-digit phone number';
        authError.style.display = 'block';
        return;
      }

      // Transition to OTP
      forms.forEach(f => f.classList.remove('active'));
      document.getElementById('otpForm').classList.add('active');
      authError.style.display = 'none';
      
      // Store temp data
      window._tempSignup = { name, email, phone: phoneDigits };
    });
  }

  const otpVerifySubmit = document.getElementById('otpVerifySubmit');
  if (otpVerifySubmit) {
    otpVerifySubmit.addEventListener('click', () => {
      const otp = document.getElementById('otpInput').value.trim();
      if (otp === '123456') {
        const user = window._tempSignup || { name: 'User', email: 'user@example.com' };
        localStorage.setItem('sf_user', JSON.stringify(user));
        alert('Account created successfully! Welcome to Sunny Furniture, ' + user.name + '.');
        closeAuth();
      } else {
        authError.textContent = 'Invalid OTP. Please try 123456';
        authError.style.display = 'block';
      }
    });
  }
})();

/* ── CHECKOUT SYSTEM ───────────────────────────────── */
(function() {
  if (!document.getElementById('checkoutOverlay')) {
    const html = `
      <div class="checkout-overlay" id="checkoutOverlay">
        <div class="checkout-container">
          <div class="checkout-main">
            <button class="checkout-back hoverable" id="checkoutBack">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M15 9H3m0 0l4-4m-4 4l4 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg> Back to shop
            </button>
            <h2>Checkout</h2>
            
            <div class="checkout-section">
              <div class="checkout-section-title"><span>1</span> Shipping Address</div>
              <div class="checkout-grid">
                <div class="full"><input type="text" class="auth-input" placeholder="Full Name"></div>
                <div class="full"><input type="text" class="auth-input" placeholder="Street Address"></div>
                <input type="text" class="auth-input" placeholder="City">
                <input type="text" class="auth-input" placeholder="PIN Code">
              </div>
            </div>

            <div class="checkout-section">
              <div class="checkout-section-title"><span>2</span> Payment Method</div>
              <div class="pay-methods">
                <div class="pay-method active" data-method="upi">
                  <div class="pay-method-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M7 15h.01"/><path d="M11 15h2"/></svg></div>
                  <div class="pay-method-name">UPI / PhonePe</div>
                </div>
                <div class="pay-method" data-method="card">
                  <div class="pay-method-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div>
                  <div class="pay-method-name">Credit / Debit Card</div>
                </div>
                <div class="pay-method" data-method="cod">
                  <div class="pay-method-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
                  <div class="pay-method-name">Cash on Delivery</div>
                </div>
              </div>

              <!-- Payment Details Forms -->
              <div id="upiDetails" class="checkout-section" style="margin-top: 24px; animation: fadeIn 0.4s ease;">
                <div class="checkout-section-title"><span>?</span> UPI Information</div>
                <div class="checkout-grid">
                  <div class="full"><input type="text" class="auth-input" id="upiId" placeholder="Enter UPI ID (e.g., username@bank)"></div>
                </div>
              </div>

              <div id="cardDetails" class="checkout-section" style="margin-top: 24px; display: none; animation: fadeIn 0.4s ease;">
                <div class="checkout-section-title"><span>?</span> Card Information</div>
                <div class="checkout-grid">
                  <div class="full"><input type="text" class="auth-input" id="cardNumber" placeholder="Card Number (0000 0000 0000 0000)"></div>
                  <input type="text" class="auth-input" id="cardExpiry" placeholder="MM/YY">
                  <input type="password" class="auth-input" id="cardCvv" placeholder="CVV">
                </div>
              </div>
            </div>
          </div>

          <div class="checkout-side">
            <div class="order-summary-title">Order Summary</div>
            <div id="checkoutItems"></div>
            <div style="border-top:1px solid var(--linen); margin-top:24px; padding-top:24px;">
              <div class="cart-summary-line"><span>Subtotal</span><span id="coSubtotal">₹0</span></div>
              <div class="cart-summary-line" style="color:var(--terra); display:none;" id="coDiscountLine"><span>Discount</span><span id="coDiscount">₹0</span></div>
              <div class="cart-summary-line"><span>Delivery</span><span style="color:var(--sage)">FREE</span></div>
              <div class="cart-summary-line total"><span>Total</span><span id="coTotal">₹0</span></div>
            </div>
            <button class="checkout-final-btn hoverable" id="completeOrder">Complete Purchase</button>
            <div id="checkoutError" style="color: var(--terra); font-size: 0.8rem; margin-top: 12px; text-align: center; display: none;"></div>
          </div>
        </div>
      </div>
      
      <div class="success-overlay" id="successOverlay">
        <div class="success-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 style="font-family:var(--serif); font-size:2rem; margin-bottom:12px;">Order Confirmed!</h2>
        <p style="color:var(--tan); margin-bottom:12px;">Thank you for shopping with Sunny Furniture. Your furniture is on its way!</p>
        <div style="background: var(--cream); padding: 12px 24px; border: 1px dashed var(--walnut); margin-bottom: 32px; font-family: var(--sans); font-size: 0.9rem;">
          Order ID: <span id="successOrderId" style="font-weight: 600; color: var(--espresso);">SF-000000</span>
        </div>
        <button class="auth-btn hoverable" style="max-width:200px;" onclick="location.reload()">Back to Home</button>
      </div>

      <!-- Simulated UPI App Overlay -->
      <div class="success-overlay" id="upiAppOverlay" style="background: rgba(255,255,255,0.98); z-index: 13000;">
        <div style="text-align: center; max-width: 320px;">
          <div style="margin-bottom: 24px;"><svg width="60" height="60" viewBox="0 0 24 24" fill="var(--espresso)"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
          <h3 style="font-family: var(--serif); margin-bottom: 12px;">Redirecting to UPI App</h3>
          <p style="font-size: 0.85rem; color: var(--tan); margin-bottom: 24px;">Please complete the payment in your linked UPI app to confirm your order.</p>
          <div id="upiTimer" style="font-family: var(--sans); font-weight: 600; font-size: 1.2rem; color: var(--walnut); margin-bottom: 32px;">00:05</div>
          <button class="auth-btn hoverable" id="simPaymentSuccess">Simulate Successful Payment</button>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  const overlay = document.getElementById('checkoutOverlay');
  const backBtn = document.getElementById('checkoutBack');
  const itemsContainer = document.getElementById('checkoutItems');
  const completeBtn = document.getElementById('completeOrder');
  const successOverlay = document.getElementById('successOverlay');
  const checkoutError = document.getElementById('checkoutError');
  const upiAppOverlay = document.getElementById('upiAppOverlay');
  const successOrderId = document.getElementById('successOrderId');
  
  const upiDetails = document.getElementById('upiDetails');
  const cardDetails = document.getElementById('cardDetails');

  function generateOrderId() {
    return 'SF-' + Math.floor(100000 + Math.random() * 900000);
  }

  function openCheckout() {
    const list = JSON.parse(localStorage.getItem('sf_cart') || '[]');
    if (list.length === 0) return alert('Your bag is empty!');
    
    // Fill items
    itemsContainer.innerHTML = list.map(item => `
      <div class="order-item">
        <div class="order-item-img"><img src="${item.img}"></div>
        <div class="order-item-info">
          <div class="order-item-name">${item.name} x${item.qty}</div>
          <div class="order-item-price">${item.price}</div>
        </div>
      </div>
    `).join('');

    // Totals
    let subtotal = 0;
    list.forEach(i => subtotal += (parseInt(i.price.replace(/[^\d]/g, '')) || 0) * i.qty);
    const promo = localStorage.getItem('sf_cart_promo');
    let discount = promo === 'WELCOME10' ? Math.round(subtotal * 0.1) : 0;
    
    document.getElementById('coSubtotal').textContent = '₹' + subtotal.toLocaleString('en-IN');
    if (discount > 0) {
      document.getElementById('coDiscountLine').style.display = 'flex';
      document.getElementById('coDiscount').textContent = '-₹' + discount.toLocaleString('en-IN');
    }
    document.getElementById('coTotal').textContent = '₹' + (subtotal - discount).toLocaleString('en-IN');

    overlay.classList.add('open');
    document.getElementById('cartDrawer').classList.remove('open');
    document.getElementById('cartDrawerOverlay').classList.remove('open');
  }

  // Hook into Checkout button in Cart Drawer
  document.addEventListener('click', e => {
    if (e.target.classList.contains('checkout-btn') && !e.target.href) {
      openCheckout();
    }
  });

  if (backBtn) backBtn.addEventListener('click', () => overlay.classList.remove('open'));

  // Payment selection
  let selectedMethod = 'upi';
  document.querySelectorAll('.pay-method').forEach(m => {
    m.addEventListener('click', () => {
      document.querySelectorAll('.pay-method').forEach(x => x.classList.remove('active'));
      m.classList.add('active');
      selectedMethod = m.dataset.method;
      
      upiDetails.style.display = selectedMethod === 'upi' ? 'block' : 'none';
      cardDetails.style.display = selectedMethod === 'card' ? 'block' : 'none';
      checkoutError.style.display = 'none';
      
      if (selectedMethod === 'upi') {
        completeBtn.textContent = 'Continue to Payment';
      } else {
        completeBtn.textContent = 'Complete Purchase';
      }
    });
  });

  if (completeBtn) {
    completeBtn.addEventListener('click', () => {
      checkoutError.style.display = 'none';
      
      // Verification Logic
      if (selectedMethod === 'upi') {
        const upiId = document.getElementById('upiId').value.trim();
        if (!upiId.includes('@')) {
          checkoutError.textContent = 'Please enter a valid UPI ID (e.g. user@bank)';
          checkoutError.style.display = 'block';
          return;
        }
        
        // Show UPI App Simulation
        upiAppOverlay.classList.add('open');
        let timeLeft = 5;
        const timerEl = document.getElementById('upiTimer');
        const interval = setInterval(() => {
          timeLeft--;
          timerEl.textContent = '00:0' + timeLeft;
          if (timeLeft === 0) {
            clearInterval(interval);
            finishOrder();
          }
        }, 1000);
        
        document.getElementById('simPaymentSuccess').onclick = () => {
          clearInterval(interval);
          finishOrder();
        };

      } else if (selectedMethod === 'card') {
        const num = document.getElementById('cardNumber').value.replace(/\s/g, '');
        const exp = document.getElementById('cardExpiry').value.trim();
        const cvv = document.getElementById('cardCvv').value.trim();
        
        if (num.length < 16) {
          checkoutError.textContent = 'Enter a valid 16-digit card number';
          checkoutError.style.display = 'block';
          return;
        }
        if (!exp.includes('/') || exp.length < 5) {
          checkoutError.textContent = 'Enter valid expiry (MM/YY)';
          checkoutError.style.display = 'block';
          return;
        }
        if (cvv.length < 3) {
          checkoutError.textContent = 'Enter valid 3-digit CVV';
          checkoutError.style.display = 'block';
          return;
        }
        
        completeBtn.textContent = 'Verifying Card...';
        completeBtn.disabled = true;
        setTimeout(finishOrder, 2000);

      } else {
        // COD
        completeBtn.textContent = 'Placing Order...';
        completeBtn.disabled = true;
        setTimeout(finishOrder, 1500);
      }
    });
  }

  function finishOrder() {
    const orderId = generateOrderId();
    successOrderId.textContent = orderId;
    localStorage.removeItem('sf_cart');
    localStorage.removeItem('sf_cart_promo');
    
    // Close any simulated overlays
    upiAppOverlay.classList.remove('open');
    successOverlay.classList.add('open');
  }
})();

if (window.SunnyApiBridge) {
  window.SunnyApiBridge.installLateOverrides();
}
