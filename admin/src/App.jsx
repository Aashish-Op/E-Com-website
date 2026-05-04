import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Image,
  Percent,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X
} from 'lucide-react';
import './styles.css';

const API_BASE = '/api';
const CATEGORIES = ['living-room', 'bedroom', 'dining', 'storage', 'outdoor', 'study', 'decor'];
const STATUSES = ['active', 'draft', 'archived'];

let csrfToken = null;

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
  const response = await fetch(API_BASE + '/auth/csrf', { credentials: 'include' });
  const data = await response.json().catch(() => ({}));
  csrfToken = data.csrfToken || '';
  return csrfToken;
}

async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = await ensureCsrf();
    if (token) headers.set('x-csrf-token', token);
  }

  const response = await fetch(API_BASE + path, {
    credentials: 'include',
    ...options,
    headers,
    body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.message || 'Request failed');
  return data;
}

function formatINR(paise = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Math.round((paise || 0) / 100));
}

function formatCategory(category = '') {
  return category.split('-').map(word => word[0]?.toUpperCase() + word.slice(1)).join(' ');
}

function emptyProductForm() {
  return {
    id: '',
    name: '',
    slug: '',
    category: 'living-room',
    status: 'active',
    pricePaise: '',
    compareAtPricePaise: '',
    stock: '10',
    description: '',
    imageUrl: '',
    imageAlt: '',
    materialsSummary: '',
    dimensionsSummary: '',
    tags: '',
    isFeatured: false,
    isOnSale: false
  };
}

function formFromProduct(product) {
  if (!product) return emptyProductForm();
  return {
    id: product.id,
    name: product.name || '',
    slug: product.slug || '',
    category: product.category || 'living-room',
    status: product.status || 'active',
    pricePaise: String(product.pricePaise ?? ''),
    compareAtPricePaise: product.compareAtPricePaise ? String(product.compareAtPricePaise) : '',
    stock: String(product.stock ?? 0),
    description: product.description || '',
    imageUrl: product.image || product.images?.[0]?.url || '',
    imageAlt: product.images?.[0]?.alt || product.name || '',
    materialsSummary: product.materials?.summary || '',
    dimensionsSummary: product.dimensions?.summary || '',
    tags: (product.tags || []).join(', '),
    isFeatured: Boolean(product.isFeatured),
    isOnSale: Boolean(product.isOnSale)
  };
}

function payloadFromForm(form) {
  const tags = form.tags
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
  const imageUrl = form.imageUrl.trim();

  return {
    name: form.name.trim(),
    slug: form.slug.trim() || undefined,
    category: form.category,
    status: form.status,
    pricePaise: Number(form.pricePaise || 0),
    compareAtPricePaise: form.compareAtPricePaise === '' ? null : Number(form.compareAtPricePaise),
    stock: Number(form.stock || 0),
    description: form.description.trim(),
    images: imageUrl ? [{ url: imageUrl, alt: form.imageAlt.trim() || form.name.trim() }] : [],
    materials: { summary: form.materialsSummary.trim() },
    dimensions: { summary: form.dimensionsSummary.trim() },
    tags,
    isFeatured: Boolean(form.isFeatured),
    isOnSale: Boolean(form.isOnSale)
  };
}

function Login({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await request('/auth/login', { method: 'POST', body: form });
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <form className="login-panel" onSubmit={submit}>
        <p className="eyebrow">Sunny Furniture</p>
        <h1>Admin sign in</h1>
        <label>Email</label>
        <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" />
        <label>Password</label>
        <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} type="password" />
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={loading}><Save size={16} /> {loading ? 'Signing in' : 'Sign in'}</button>
      </form>
    </main>
  );
}

function MetricCard({ icon, label, value }) {
  return (
    <div className="metric">
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProductEditor({ product, onSaved, onDeleted, onCancel }) {
  const [form, setForm] = useState(emptyProductForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(formFromProduct(product));
    setError('');
  }, [product?.id]);

  const editing = Boolean(form.id);
  const previewUrl = form.imageUrl.trim();

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = payloadFromForm(form);
      if (!payload.name) throw new Error('Product name is required');
      const data = editing
        ? await request('/admin/products/' + form.id, { method: 'PUT', body: payload })
        : await request('/admin/products', { method: 'POST', body: payload });
      await onSaved(data.product);
      if (!editing) setForm(emptyProductForm());
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!editing) return;
    const ok = window.confirm('Delete this product from the storefront? It will be archived, not permanently removed.');
    if (!ok) return;
    setError('');
    setSaving(true);
    try {
      const data = await request('/admin/products/' + form.id, { method: 'DELETE' });
      await onDeleted(data.product);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="product-editor" onSubmit={save}>
      <div className="editor-head">
        <div>
          <p className="eyebrow">{editing ? 'Edit product' : 'New product'}</p>
          <h3>{editing ? form.name || 'Untitled product' : 'Add inventory item'}</h3>
        </div>
        {editing && <button type="button" className="icon-button muted" onClick={onCancel} aria-label="New product"><X size={16} /></button>}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="editor-grid two">
        <label>
          Product name
          <input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Aura 3-seater sofa" />
        </label>
        <label>
          Slug
          <input value={form.slug} onChange={e => update('slug', e.target.value)} placeholder="auto-generated if blank" />
        </label>
      </div>

      <div className="editor-grid three">
        <label>
          Category
          <select value={form.category} onChange={e => update('category', e.target.value)}>
            {CATEGORIES.map(category => <option key={category} value={category}>{formatCategory(category)}</option>)}
          </select>
        </label>
        <label>
          Status
          <select value={form.status} onChange={e => update('status', e.target.value)}>
            {STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <label>
          Stock
          <input type="number" min="0" value={form.stock} onChange={e => update('stock', e.target.value)} />
        </label>
      </div>

      <div className="editor-grid two">
        <label>
          Price in paise
          <input type="number" min="0" value={form.pricePaise} onChange={e => update('pricePaise', e.target.value)} placeholder="4200000" />
        </label>
        <label>
          Compare at price in paise
          <input type="number" min="0" value={form.compareAtPricePaise} onChange={e => update('compareAtPricePaise', e.target.value)} placeholder="optional" />
        </label>
      </div>

      <label>
        Description
        <textarea value={form.description} onChange={e => update('description', e.target.value)} rows={4} placeholder="Short storefront description" />
      </label>

      <div className="image-editor">
        <div className="image-preview">
          {previewUrl ? <img src={previewUrl} alt="" /> : <Image size={28} />}
        </div>
        <div>
          <label>
            Primary image URL
            <input value={form.imageUrl} onChange={e => update('imageUrl', e.target.value)} placeholder="/aura3seater.jpg or https://..." />
          </label>
          <label>
            Image alt text
            <input value={form.imageAlt} onChange={e => update('imageAlt', e.target.value)} placeholder="Accessible image description" />
          </label>
        </div>
      </div>

      <div className="editor-grid two">
        <label>
          Materials summary
          <input value={form.materialsSummary} onChange={e => update('materialsSummary', e.target.value)} placeholder="Kiln-dried wood, linen fabric" />
        </label>
        <label>
          Dimensions summary
          <input value={form.dimensionsSummary} onChange={e => update('dimensionsSummary', e.target.value)} placeholder="210 cm x 90 cm" />
        </label>
      </div>

      <label>
        Tags
        <input value={form.tags} onChange={e => update('tags', e.target.value)} placeholder="sofa, living room, fabric" />
      </label>

      <div className="toggle-row">
        <label className="check">
          <input type="checkbox" checked={form.isFeatured} onChange={e => update('isFeatured', e.target.checked)} />
          Featured on storefront
        </label>
        <label className="check">
          <input type="checkbox" checked={form.isOnSale} onChange={e => update('isOnSale', e.target.checked)} />
          Sale product
        </label>
      </div>

      <div className="editor-actions">
        <button type="submit" disabled={saving}><Save size={16} /> {saving ? 'Saving' : editing ? 'Save changes' : 'Add product'}</button>
        {editing && <button type="button" className="danger" disabled={saving} onClick={archive}><Trash2 size={16} /> Delete</button>}
      </div>
    </form>
  );
}

function Products({ products, refresh }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [selectedId, setSelectedId] = useState('');

  const selected = useMemo(() => products.find(product => product.id === selectedId) || null, [products, selectedId]);
  const filtered = useMemo(() => products.filter(product => {
    const text = [product.name, product.slug, product.category, product.status, ...(product.tags || [])].join(' ').toLowerCase();
    const matchesQuery = !query || text.includes(query.toLowerCase());
    const matchesStatus = status === 'all' || product.status === status;
    const matchesCategory = category === 'all' || product.category === category;
    return matchesQuery && matchesStatus && matchesCategory;
  }), [products, query, status, category]);

  async function saveAndRefresh(product) {
    setSelectedId(product.id);
    await refresh();
  }

  async function deleteAndRefresh(product) {
    setSelectedId(product.id);
    await refresh();
  }

  return (
    <section className="products-workspace">
      <section className="panel products-list-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Inventory</p>
            <h2>Products</h2>
          </div>
          <div className="search"><Search size={16} /><input placeholder="Search products" value={query} onChange={e => setQuery(e.target.value)} /></div>
        </div>

        <div className="toolbar">
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {STATUSES.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {CATEGORIES.map(item => <option key={item} value={item}>{formatCategory(item)}</option>)}
          </select>
          <button type="button" onClick={() => setSelectedId('')}><Plus size={16} /> New product</button>
        </div>

        <div className="product-table">
          {filtered.map(product => (
            <div className={`product-row ${selectedId === product.id ? 'selected' : ''}`} key={product.id}>
              <button className="row-main" type="button" onClick={() => setSelectedId(product.id)}>
                <img src={product.image || '/aura3seater.jpg'} alt="" />
                <span>
                  <strong>{product.name}</strong>
                  <small>{formatCategory(product.category)} | {product.status}</small>
                </span>
              </button>
              <span className="money">{formatINR(product.pricePaise)}</span>
              <span>{product.availableStock ?? product.stock} available</span>
              <span className={`pill ${product.status}`}>{product.status}</span>
              <button className="icon-button" type="button" onClick={() => setSelectedId(product.id)} aria-label={`Edit ${product.name}`}>
                <Edit3 size={16} />
              </button>
            </div>
          ))}
          {!filtered.length && <div className="empty-state">No products match these filters.</div>}
        </div>
      </section>

      <ProductEditor
        product={selected}
        onSaved={saveAndRefresh}
        onDeleted={deleteAndRefresh}
        onCancel={() => setSelectedId('')}
      />
    </section>
  );
}

function Orders({ orders, refresh }) {
  async function setStatus(order, status) {
    await request('/admin/orders/' + order.id + '/status', { method: 'PATCH', body: { status } });
    refresh();
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Fulfillment</p>
          <h2>Orders</h2>
        </div>
      </div>
      <div className="table order-table">
        {orders.map(order => (
          <div className="row" key={order.id}>
            <div>
              <strong>{order.orderNumber}</strong>
              <span>{order.contact?.email} | {order.total}</span>
            </div>
            <span>{order.paymentMethod} / {order.paymentStatus}</span>
            <select value={order.fulfillmentStatus} onChange={e => setStatus(order, e.target.value)}>
              {['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'].map(item => <option key={item}>{item}</option>)}
            </select>
          </div>
        ))}
      </div>
    </section>
  );
}

function Coupons({ coupons, refresh }) {
  const [draft, setDraft] = useState({ code: '', type: 'percent', value: 10 });

  async function createCoupon(event) {
    event.preventDefault();
    await request('/admin/coupons', { method: 'POST', body: draft });
    setDraft({ code: '', type: 'percent', value: 10 });
    refresh();
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Promotions</p>
          <h2>Coupons</h2>
        </div>
      </div>
      <form className="create-grid coupons" onSubmit={createCoupon}>
        <input placeholder="Code" value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value.toUpperCase() })} />
        <select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })}>
          <option value="percent">percent</option>
          <option value="fixed">fixed</option>
        </select>
        <input type="number" value={draft.value} onChange={e => setDraft({ ...draft, value: Number(e.target.value) })} />
        <button><Percent size={16} /> Create</button>
      </form>
      <div className="coupon-list">
        {coupons.map(coupon => <div key={coupon._id}>{coupon.code}<span>{coupon.type} | {coupon.value} | {coupon.active ? 'active' : 'inactive'}</span></div>)}
      </div>
    </section>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [data, setData] = useState({ metrics: {}, products: [], orders: [], coupons: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setError('');
    setLoading(true);
    try {
      const [metrics, products, orders, coupons] = await Promise.all([
        request('/admin/metrics'),
        request('/admin/products'),
        request('/admin/orders'),
        request('/admin/coupons')
      ]);
      setData({
        metrics: metrics.metrics,
        products: products.products,
        orders: orders.orders,
        coupons: coupons.coupons
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    request('/auth/me').then(result => {
      if (['admin', 'super_admin'].includes(result.user?.role)) setUser(result.user);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (!user) return <Login onLogin={setUser} />;

  return (
    <main className="admin-shell">
      <aside>
        <h1>Sunny</h1>
        <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}><BarChart3 size={18} /> Dashboard</button>
        <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}><Boxes size={18} /> Products</button>
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}><ClipboardList size={18} /> Orders</button>
        <button className={tab === 'coupons' ? 'active' : ''} onClick={() => setTab('coupons')}><Percent size={18} /> Coupons</button>
      </aside>
      <section className="content">
        <header>
          <div>
            <p className="eyebrow">Admin dashboard</p>
            <h1>Welcome, {user.name}</h1>
          </div>
          <button onClick={load} disabled={loading}><RefreshCw size={16} /> {loading ? 'Refreshing' : 'Refresh'}</button>
        </header>
        {error && <div className="error">{error}</div>}
        {tab === 'dashboard' && (
          <>
            <div className="metrics-grid">
              <MetricCard icon={<ClipboardList size={20} />} label="Orders" value={data.metrics.orders || 0} />
              <MetricCard icon={<Boxes size={20} />} label="Products" value={data.metrics.products || 0} />
              <MetricCard icon={<BarChart3 size={20} />} label="Revenue" value={formatINR(data.metrics.revenuePaise || 0)} />
              <MetricCard icon={<CheckCircle2 size={20} />} label="Low stock" value={data.metrics.lowStock || 0} />
            </div>
            <Orders orders={data.orders.slice(0, 8)} refresh={load} />
          </>
        )}
        {tab === 'products' && <Products products={data.products} refresh={load} />}
        {tab === 'orders' && <Orders orders={data.orders} refresh={load} />}
        {tab === 'coupons' && <Coupons coupons={data.coupons} refresh={load} />}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
