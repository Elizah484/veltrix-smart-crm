import { useEffect, useId, useRef, useState } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { api } from '../services/api';
import { fullName } from '../utils/format';

/** Type to search active customers, click one to select it. Value is the customer id. */
export default function CustomerPicker({ label, value, onChange, error, required, disabled }) {
  const id = useId();
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const dq = useDebounce(q.trim(), 250);
  const box = useRef(null);

  // Show the name of a customer chosen earlier (for example from ?customerId=)
  useEffect(() => {
    let alive = true;
    if (value && (!selected || selected.id !== Number(value))) {
      api.get('/customers/' + value).then((r) => { if (alive) setSelected(r.data); }).catch(() => {});
    }
    if (!value) setSelected(null);
    return () => { alive = false; };
    // eslint-disable-next-line
  }, [value]);

  useEffect(() => {
    let alive = true;
    if (dq.length < 2) { setResults([]); return undefined; }
    api.get('/customers', { q: dq, status: 'Active', pageSize: 8 }).then((r) => { if (alive) { setResults(r.data); setOpen(true); } }).catch(() => {});
    return () => { alive = false; };
  }, [dq]);

  useEffect(() => {
    const onDoc = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (c) => { setSelected(c); setQ(''); setResults([]); setOpen(false); onChange(c.id, c); };

  return (
    <div className="field" ref={box} style={{ position: 'relative' }}>
      <label htmlFor={id}>{label || 'Customer'}{required && <i> *</i>}</label>
      {selected ? (
        <div className="inline-form" style={{ alignItems: 'center' }}>
          <div className="badge" style={{ padding: '8px 12px', fontSize: 14 }}><b>{fullName(selected)}</b>&nbsp;<span className="mono muted">{selected.code}</span></div>
          {!disabled && <button type="button" className="btn sm" onClick={() => { setSelected(null); onChange('', null); }}>Change</button>}
        </div>
      ) : (
        <>
          <input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email, phone or ID"
            aria-invalid={error ? 'true' : 'false'} autoComplete="off" disabled={disabled} />
          {open && (
            <div className="drop" style={{ left: 0, right: 0, top: '100%' }} role="listbox">
              {results.length === 0 && <div className="row muted">No active customers match.</div>}
              {results.map((c) => (
                <a key={c.id} href={'/customers/' + c.id} role="option" onClick={(e) => { e.preventDefault(); pick(c); }}>
                  {fullName(c)}<small>{c.code} · {c.email || c.phone || 'no contact'}</small>
                </a>
              ))}
            </div>
          )}
        </>
      )}
      {error && <span className="err" role="alert">{error}</span>}
    </div>
  );
}
