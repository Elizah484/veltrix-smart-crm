import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import CustomerPicker from '../components/CustomerPicker';
import ErrorMessage from '../components/ErrorMessage';
import { SelectField, TextArea, TextField } from '../components/Form';
import { useUi } from '../context/UiContext';
import { api } from '../services/api';
import { money } from '../utils/format';

const newKey = () => (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : 'k' + Date.now() + Math.random().toString(36).slice(2));
const blankItem = () => ({ productName: '', quantity: '1', unitPrice: '' });

export default function OrderForm() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { toast } = useUi();
  const [customerId, setCustomerId] = useState(sp.get('customerId') || '');
  const [items, setItems] = useState([blankItem()]);
  const [discount, setDiscount] = useState('0');
  const [payment, setPayment] = useState('Unpaid');
  const [shipping, setShipping] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // One key per form: if the person double-clicks or the network retries, the server returns the same order
  const idemKey = useRef(newKey());

  const setItem = (i, k, v) => setItems((list) => list.map((it, n) => (n === i ? { ...it, [k]: v } : it)));

  const totals = useMemo(() => {
    const cents = (v) => Math.round((Number(v) || 0) * 100);
    const subtotal = items.reduce((s, it) => s + (Number(it.quantity) || 0) * cents(it.unitPrice), 0);
    const pct = Math.min(100, Math.max(0, Number(discount) || 0));
    const disc = Math.round((subtotal * pct) / 100);
    return { subtotal: subtotal / 100, discount: disc / 100, total: (subtotal - disc) / 100 };
  }, [items, discount]);

  async function submit(e) {
    e.preventDefault();
    setError(null); setErrors({}); setBusy(true);
    const body = {
      customerId: customerId ? Number(customerId) : undefined,
      items: items.map((it) => ({ productName: it.productName, quantity: it.quantity === '' ? undefined : Number(it.quantity), unitPrice: it.unitPrice === '' ? undefined : Number(it.unitPrice) })),
      discountPercent: Number(discount) || 0, paymentStatus: payment, shippingDetails: shipping,
    };
    try {
      const res = await api.post('/orders', body, { 'Idempotency-Key': idemKey.current });
      toast(res.meta && res.meta.replayed ? 'This order was already saved.' : 'Order created.');
      nav('/orders/' + res.data.id);
    } catch (err) { setError(err); setErrors(err.fields || {}); } finally { setBusy(false); }
  }

  const itemErr = (i, k) => errors['items.' + i + '.' + k];

  return (
    <>
      <div className="page-head"><div><h1>Create order</h1><p>Totals are worked out automatically. Orders start as Pending.</p></div></div>
      <ErrorMessage error={error && !error.fields ? error : null} />
      <form className="stack" onSubmit={submit} noValidate>
        <section className="card">
          <CustomerPicker value={customerId} onChange={(id) => { setCustomerId(id ? String(id) : ''); setErrors((x) => ({ ...x, customerId: undefined })); }} error={errors.customerId} required />
        </section>

        <section className="card">
          <header><h2>Items</h2><button type="button" className="btn sm" onClick={() => setItems((l) => [...l, blankItem()])}>Add item</button></header>
          {errors.items && <div className="err" role="alert" style={{ marginBottom: 8 }}>{errors.items}</div>}
          <div className="stack">
            {items.map((it, i) => (
              <div className="fgrid" key={i} style={{ gridTemplateColumns: 'minmax(0,3fr) minmax(0,1fr) minmax(0,1.3fr) auto', alignItems: 'end' }}>
                <TextField name="productName" label={i === 0 ? 'Product' : undefined} aria-label={'Product ' + (i + 1)} value={it.productName} onChange={(k, v) => setItem(i, k, v)} error={itemErr(i, 'productName')} maxLength={150} />
                <TextField name="quantity" label={i === 0 ? 'Qty' : undefined} aria-label={'Quantity ' + (i + 1)} type="number" min="1" max="999" value={it.quantity} onChange={(k, v) => setItem(i, k, v)} error={itemErr(i, 'quantity')} />
                <TextField name="unitPrice" label={i === 0 ? 'Unit price' : undefined} aria-label={'Unit price ' + (i + 1)} type="number" min="0.01" step="0.01" value={it.unitPrice} onChange={(k, v) => setItem(i, k, v)} error={itemErr(i, 'unitPrice')} />
                <button type="button" className="btn sm danger" disabled={items.length === 1} onClick={() => setItems((l) => l.filter((_, n) => n !== i))} aria-label={'Remove item ' + (i + 1)}>Remove</button>
              </div>
            ))}
          </div>
          <div className="totals">
            <div><span className="muted">Subtotal</span><span>{money(totals.subtotal)}</span></div>
            <div><span className="muted">Discount</span><span>− {money(totals.discount)}</span></div>
            <div className="grand"><span>Total</span><span>{money(totals.total)}</span></div>
          </div>
        </section>

        <section className="card">
          <div className="fgrid">
            <TextField name="discount" label="Discount (%)" type="number" min="0" max="100" step="0.01" value={discount} onChange={(k, v) => setDiscount(v)} error={errors.discountPercent} />
            <SelectField name="payment" label="Payment status" value={payment} onChange={(k, v) => setPayment(v)} options={['Unpaid', 'Partially paid', 'Paid']} error={errors.paymentStatus} />
            <TextArea name="shipping" label="Shipping details" value={shipping} onChange={(k, v) => setShipping(v)} error={errors.shippingDetails} maxLength={500} full />
          </div>
          <div className="form-foot">
            <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Create order'}</button>
            <Link className="btn ghost" to="/orders">Cancel</Link>
          </div>
        </section>
      </form>
    </>
  );
}
