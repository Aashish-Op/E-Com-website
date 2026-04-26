import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BarChart3, Boxes, ClipboardList, Percent, Plus, Save, Search, Upload } from 'lucide-react';
import './styles.css';

const API_BASE = '/api';

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
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
  return '₹' + Math.round(paise / 100).toLocaleString('en-IN');
}

function Login({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const data = await request('/auth/login', { method: 'POST', body: form });
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
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
        <button type="submit"><Save size={16} /> Sign in</button>
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

function Products({ products, refresh }) {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState({
    name: '',
    category: 'living-room',
    pricePaise: 0,
    stock: 10,
    description: ''
  });

  const filtered = useMemo(() => products.filter(product =>
    product.name.toLowerCase().includes(query.toLowerCase()) ||
    product.category.toLowerCase().includes(query.toLowerCase())
  ), [products, query]);

  async function createProduct(event) {
    event.preventDefault();
    await request('/admin/products', { method: 'POST', body: draft });
    setDraft({ name: '', category: 'living-room', pricePaise: 0, stock: 10, description: '' });
    refresh();
  }

  async function updateProduct(product, patch) {
    await request('/admin/products/' + product.id, { method: 'PUT', body: patch });
    refresh();
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Inventory</p>
          <h2>Products</h2>
        </div>
        <div className="search"><Search size={16} /><input placeholder="Search products" value={query} onChange={e => setQuery(e.target.value)} /></div>
      </div>
      <form className="create-grid" onSubmit={createProduct}>
        <input placeholder="Product name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
        <select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>
          {['living-room', 'bedroom', 'dining', 'storage', 'outdoor', 'study', 'decor'].map(category => <option key={category}>{category}</option>)}
        </select>
        <input placeholder="Price in paise" type="number" value={draft.pricePaise} onChange={e => setDraft({ ...draft, pricePaise: Number(e.target.value) })} />
        <input placeholder="Stock" type="number" value={draft.stock} onChange={e => setDraft({ ...draft, stock: Number(e.target.value) })} />
        <button type="submit"><Plus size={16} /> Add</button>
      </form>
      <div className="table">
        {filtered.map(product => (
          <div className="row" key={product.id}>
            <img src={product.image || '/aura3seater.jpg'} alt="" />
            <div>
              <strong>{product.name}</strong>
              <span>{product.category} · {product.status}</span>
            </div>
            <input type="number" defaultValue={product.pricePaise} onBlur={e => updateProduct(product, { pricePaise: Number(e.target.value) })} />
            <input type="number" defaultValue={product.stock} onBlur={e => updateProduct(product, { stock: Number(e.target.value) })} />
            <button onClick={() => updateProduct(product, { isFeatured: !product.isFeatured })}>{product.isFeatured ? 'Featured' : 'Feature'}</button>
          </div>
        ))}
      </div>
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
              <span>{order.contact?.email} · {order.total}</span>
            </div>
            <span>{order.paymentMethod} / {order.paymentStatus}</span>
            <select value={order.fulfillmentStatus} onChange={e => setStatus(order, e.target.value)}>
              {['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'].map(status => <option key={status}>{status}</option>)}
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
        {coupons.map(coupon => <div key={coupon._id}>{coupon.code}<span>{coupon.type} · {coupon.value} · {coupon.active ? 'active' : 'inactive'}</span></div>)}
      </div>
    </section>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [data, setData] = useState({ metrics: {}, products: [], orders: [], coupons: [] });
  const [error, setError] = useState('');

  async function load() {
    setError('');
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
          <button onClick={load}><Upload size={16} /> Refresh</button>
        </header>
        {error && <div className="error">{error}</div>}
        {tab === 'dashboard' && (
          <>
            <div className="metrics-grid">
              <MetricCard icon={<ClipboardList size={20} />} label="Orders" value={data.metrics.orders || 0} />
              <MetricCard icon={<Boxes size={20} />} label="Products" value={data.metrics.products || 0} />
              <MetricCard icon={<BarChart3 size={20} />} label="Revenue" value={formatINR(data.metrics.revenuePaise || 0)} />
              <MetricCard icon={<Upload size={20} />} label="Low stock" value={data.metrics.lowStock || 0} />
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
