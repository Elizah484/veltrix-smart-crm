import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Badge from '../components/Badge';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { useFetch } from '../hooks/useFetch';
import { api } from '../services/api';
import { fmtDate, fmtDateTime, money } from '../utils/format';

export default function OrderDetails() {
  const { id } = useParams();
  const { can } = useAuth();
  const { confirm, toast } = useUi();
  const [busy, setBusy] = useState(false);
  const { data: o, error, loading, reload } = useFetch(() => api.get('/orders/' + id), [id]);

  if (loading && !o) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} onRetry={reload} title={error.status === 404 ? 'Order not found' : undefined} />;
  if (!o) return null;

  async function move(status) {
    const cancelling = status === 'Cancelled';
    const ok = await confirm({
      title: cancelling ? 'Cancel this order?' : 'Move order to ' + status + '?',
      message: cancelling ? 'A cancelled order cannot be reopened and is left out of sales totals.' : 'The change is recorded in the order history.',
      confirmLabel: cancelling ? 'Cancel order' : 'Move to ' + status, danger: cancelling,
    });
    if (!ok) return;
    setBusy(true);
    try { await api.patch('/orders/' + id + '/status', { status, version: o.version }); toast('Order is now ' + status + '.'); reload(); } catch (e) { toast(e.message, 'bad'); reload(); } finally { setBusy(false); }
  }

  async function pay(paymentStatus) {
    if (!paymentStatus || paymentStatus === o.paymentStatus) return;
    setBusy(true);
    try { await api.patch('/orders/' + id + '/payment', { paymentStatus, version: o.version }); toast('Payment marked as ' + paymentStatus + '.'); reload(); } catch (e) { toast(e.message, 'bad'); reload(); } finally { setBusy(false); }
  }

  const payOptions = ['Unpaid', 'Partially paid', 'Paid', ...(o.canRefund ? ['Refunded'] : [])];
  const closed = o.status === 'Cancelled';

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="mono">{o.code}</h1>
          <p><Badge value={o.status} /> <Badge value={o.paymentStatus} /> · <Link to={'/customers/' + o.customerId}>{o.customerName}</Link> · placed {fmtDate(o.orderDate)}</p>
        </div>
        <div className="actions">
          {o.allowedStatuses.map((s) => (
            <button key={s} className={'btn' + (s === 'Cancelled' ? ' danger' : ' primary')} disabled={busy} onClick={() => move(s)}>{s === 'Cancelled' ? 'Cancel order' : 'Mark ' + s.toLowerCase()}</button>
          ))}
        </div>
      </div>

      <div className="detail-grid">
        <div className="stack">
          <section className="card">
            <header><h2>Summary</h2></header>
            <dl className="dl">
              <dt>Customer</dt><dd><Link to={'/customers/' + o.customerId}>{o.customerName}</Link> <span className="mono muted">{o.customerCode}</span></dd>
              <dt>Created by</dt><dd>{o.createdByName}</dd>
              <dt>Shipping</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{o.shippingDetails || '—'}</dd>
              <dt>Payment</dt>
              <dd>
                {can('orders.view') && !closed ? (
                  <select aria-label="Payment status" value={o.paymentStatus} disabled={busy} onChange={(e) => pay(e.target.value)}>
                    {payOptions.map((s) => <option key={s}>{s}</option>)}
                  </select>
                ) : <Badge value={o.paymentStatus} />}
              </dd>
            </dl>
          </section>
          <section className="card">
            <header><h2>Status history</h2></header>
            <ol className="timeline">
              {o.history.map((h) => (
                <li key={h.id}>
                  <div className="t"><b>{h.kind === 'payment' ? 'Payment' : 'Status'}: {h.from ? h.from + ' → ' : ''}{h.to}</b><span className="when">{fmtDateTime(h.at)} · {h.userName}</span></div>
                  {h.note && <p>{h.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section className="card">
          <header><h2>Items</h2></header>
          <div className="tablewrap">
            <table className="data">
              <thead><tr><th>Product</th><th className="r">Qty</th><th className="r">Unit price</th><th className="r">Line total</th></tr></thead>
              <tbody>
                {o.items.map((it) => (
                  <tr key={it.id}><td>{it.productName}</td><td className="r num">{it.quantity}</td><td className="r num">{money(it.unitPrice)}</td><td className="r num">{money(it.lineTotal)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="totals">
            <div><span className="muted">Subtotal</span><span>{money(o.subtotal)}</span></div>
            <div><span className="muted">Discount ({o.discountPercent}%)</span><span>− {money(o.discountAmount)}</span></div>
            <div className="grand"><span>Total</span><span>{money(o.total)}</span></div>
          </div>
        </section>
      </div>
    </>
  );
}
