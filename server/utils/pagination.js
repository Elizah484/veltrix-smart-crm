'use strict';

const ApiError = require('./ApiError');

/**
 * Safe paging and sorting from query-string values.
 * sortMap maps the public sort name to a trusted SQL fragment, so a client can
 * never inject its own column names. Page numbers are validated integers, which
 * is why they are written into the SQL text (LIMIT cannot be a bound value in
 * every MySQL version).
 */
function parsePaging(query, sortMap, defaultSort, defaultDir, opts) {
  const maxPageSize = (opts && opts.maxPageSize) || 100;
  const defSize = (opts && opts.defaultPageSize) || 10;

  let page = 1;
  if (query.page !== undefined && query.page !== '') {
    if (!/^\d{1,6}$/.test(String(query.page)) || Number(query.page) < 1) throw ApiError.badRequest('page must be a positive whole number.');
    page = Number(query.page);
  }
  let pageSize = defSize;
  if (query.pageSize !== undefined && query.pageSize !== '') {
    if (!/^\d{1,4}$/.test(String(query.pageSize)) || Number(query.pageSize) < 1) throw ApiError.badRequest('pageSize must be a positive whole number.');
    pageSize = Math.min(Number(query.pageSize), maxPageSize);
  }

  const sortKey = query.sort === undefined || query.sort === '' ? defaultSort : String(query.sort);
  if (!Object.prototype.hasOwnProperty.call(sortMap, sortKey)) throw ApiError.badRequest('Cannot sort by "' + sortKey + '".');
  const dirRaw = query.dir === undefined || query.dir === '' ? defaultDir : String(query.dir).toLowerCase();
  if (dirRaw !== 'asc' && dirRaw !== 'desc') throw ApiError.badRequest('dir must be asc or desc.');
  const dir = dirRaw.toUpperCase();

  const orderBy = sortMap[sortKey].split(',').map((c) => c.trim() + ' ' + dir).join(', ');
  return { page, pageSize, offset: (page - 1) * pageSize, orderBy, sortKey, dir: dirRaw };
}

const pageMeta = (p, total) => ({
  page: p.page,
  pageSize: p.pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / p.pageSize)),
  sort: p.sortKey,
  dir: p.dir,
});

module.exports = { parsePaging, pageMeta };
