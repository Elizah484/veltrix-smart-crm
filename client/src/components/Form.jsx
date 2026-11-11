import { useId, useState } from 'react';
import Icon from './Icon';

/** Label + control + inline error, wired together for screen readers. */
export function Field({ label, required, error, hint, full, children }) {
  return <div className={'field' + (full ? ' full' : '')}>{label && <label>{label}{required && <i> *</i>}</label>}{children}{hint && !error && <span className="hint">{hint}</span>}{error && <span className="err" role="alert">{error}</span>}</div>;
}

function useIds(error, hint) {
  const id = useId();
  return { id, describedBy: error ? id + '-err' : hint ? id + '-hint' : undefined };
}

function Wrap({ id, label, required, error, hint, full, children }) {
  return (
    <div className={'field' + (full ? ' full' : '')}>
      {label && <label htmlFor={id}>{label}{required && <i> *</i>}</label>}
      {children}
      {error ? <span id={id + '-err'} className="err" role="alert">{error}</span> : hint ? <span id={id + '-hint'} className="hint">{hint}</span> : null}
    </div>
  );
}

export function TextField({ name, label, value, onChange, onBlur, error, hint, required, type, full, ...rest }) {
  const { id, describedBy } = useIds(error, hint);
  return (
    <Wrap id={id} label={label} required={required} error={error} hint={hint} full={full}>
      <input id={id} name={name} type={type || 'text'} value={value ?? ''} aria-invalid={error ? 'true' : 'false'} aria-describedby={describedBy}
        onChange={(e) => onChange(name, e.target.value)} onBlur={onBlur} {...rest} />
    </Wrap>
  );
}

export function TextArea({ name, label, value, onChange, error, hint, required, full, ...rest }) {
  const { id, describedBy } = useIds(error, hint);
  return (
    <Wrap id={id} label={label} required={required} error={error} hint={hint} full={full}>
      <textarea id={id} name={name} value={value ?? ''} aria-invalid={error ? 'true' : 'false'} aria-describedby={describedBy}
        onChange={(e) => onChange(name, e.target.value)} {...rest} />
    </Wrap>
  );
}

/** options: ['A','B'] or [{ value, label }] */
export function SelectField({ name, label, value, onChange, options, error, hint, required, full, blank, ...rest }) {
  const { id, describedBy } = useIds(error, hint);
  return (
    <Wrap id={id} label={label} required={required} error={error} hint={hint} full={full}>
      <select id={id} name={name} value={value ?? ''} aria-invalid={error ? 'true' : 'false'} aria-describedby={describedBy}
        onChange={(e) => onChange(name, e.target.value)} {...rest}>
        {blank !== undefined && <option value="">{blank}</option>}
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </Wrap>
  );
}

/** Compact control used inside filter bars */
export function FilterField({ label, grow, children }) {
  return <div className={'f' + (grow ? ' grow' : '')}><label>{label}</label>{children}</div>;
}

/** Styled checkbox. Pass checked + onChange(checked). Use readOnly to show a ticked, fixed state. */
export function Checkbox({ name, checked, onChange, error, readOnly, children }) {
  const id = useId();
  return (
    <div className="field">
      <label className={'check' + (readOnly ? ' fixed' : '')} htmlFor={id}>
        <input id={id} name={name} type="checkbox" checked={!!checked} disabled={readOnly}
          aria-invalid={error ? 'true' : 'false'} aria-describedby={error ? id + '-err' : undefined}
          onChange={(e) => onChange && onChange(name, e.target.checked)} />
        <span className="box" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
        </span>
        <span className="check-text">{children}</span>
      </label>
      {error && <span id={id + '-err'} className="err" role="alert">{error}</span>}
    </div>
  );
}

/** Password input with a show/hide button. */
export function PasswordField({ name, label, value, onChange, error, hint, required, children, ...rest }) {
  const id = useId();
  const [show, setShow] = useState(false);
  const describedBy = error ? id + '-err' : hint ? id + '-hint' : undefined;
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}{required && <i> *</i>}</label>}
      <div className="pw">
        <input id={id} name={name} type={show ? 'text' : 'password'} value={value ?? ''} aria-invalid={error ? 'true' : 'false'} aria-describedby={describedBy}
          onChange={(e) => onChange(name, e.target.value)} {...rest} />
        <button type="button" className="pw-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
          <Icon name={show ? 'eyeoff' : 'eye'} />
        </button>
      </div>
      {children}
      {error ? <span id={id + '-err'} className="err" role="alert">{error}</span> : hint ? <span id={id + '-hint'} className="hint">{hint}</span> : null}
    </div>
  );
}
