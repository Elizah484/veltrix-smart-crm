import { useSearchParams } from 'react-router-dom';

/**
 * Keeps search, filters, sort and page in the address bar, so the back button
 * and a bookmarked link both restore the same view.
 */
export function useListParams(defaults) {
  const [sp, setSp] = useSearchParams();
  const params = {};
  Object.keys(defaults).forEach((k) => { params[k] = sp.get(k) ?? defaults[k]; });

  const update = (patch) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === '' || v === null || v === undefined || String(v) === String(defaults[k])) next.delete(k);
      else next.set(k, v);
    });
    if (!('page' in patch)) next.delete('page'); // any filter change goes back to page 1
    setSp(next, { replace: true });
  };

  const toggleSort = (key) => update({ sort: key, dir: params.sort === key && params.dir === 'asc' ? 'desc' : 'asc', page: '' });
  return [params, update, toggleSort];
}
