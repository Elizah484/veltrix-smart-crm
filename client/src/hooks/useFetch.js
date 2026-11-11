import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an API call when the component mounts and whenever `deps` change.
 * Returns { data, meta, error, loading, reload }. Out-of-date responses are ignored,
 * so quickly typing in a search box never shows older results.
 */
export function useFetch(fn, deps) {
  const [state, setState] = useState({ data: null, meta: null, error: null, loading: true });
  const counter = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(() => {
    const id = ++counter.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(() => fnRef.current())
      .then((res) => { if (id === counter.current) setState({ data: res ? res.data : null, meta: res ? res.meta : null, error: null, loading: false }); })
      .catch((err) => { if (id === counter.current) setState((s) => ({ ...s, error: err, loading: false })); });
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, deps || []);
  return { ...state, reload: run };
}
