'use strict';

const { asyncHandler, ok, ctxOf } = require('../utils/http');
const { validateBody, parseId, optionalDate } = require('../utils/validate');
const ApiError = require('../utils/ApiError');
const schemas = require('../validators/schemas');
const { toCsv } = require('../utils/csv');
const { writeAudit } = require('../utils/audit');
const userService = require('../services/userService');
const settingsService = require('../services/settingsService');
const auditService = require('../services/auditService');
const notificationService = require('../services/notificationService');
const dashboardService = require('../services/dashboardService');
const reportService = require('../services/reportService');

// ---- users ----
const listUsers = asyncHandler(async (req, res) => ok(res, await userService.list()));
const directory = asyncHandler(async (req, res) => ok(res, await userService.directory()));
const createUser = asyncHandler(async (req, res) => {
  const data = validateBody(req.body, schemas.userCreate);
  ok(res, await userService.create(data, ctxOf(req)), null, 201);
});
const updateUser = asyncHandler(async (req, res) => {
  const data = validateBody(req.body, schemas.userUpdate);
  ok(res, await userService.update(parseId(req.params.id, 'The user id'), data, req.user, ctxOf(req)));
});

// ---- settings and health ----
const getSettings = asyncHandler(async (req, res) => ok(res, await settingsService.get()));
const updateSettings = asyncHandler(async (req, res) => {
  const data = validateBody(req.body, schemas.settings);
  ok(res, await settingsService.update(data, ctxOf(req)));
});
const health = asyncHandler(async (req, res) => ok(res, await settingsService.health()));

// ---- audit ----
const listAudit = asyncHandler(async (req, res) => {
  const q = {
    ...req.query,
    from: optionalDate(req.query.from, 'The from date'),
    to: optionalDate(req.query.to, 'The to date'),
    userId: req.query.userId ? parseId(req.query.userId, 'userId') : null,
    entityId: req.query.entityId ? parseId(req.query.entityId, 'entityId') : null,
  };
  const { items, meta } = await auditService.list(q);
  ok(res, items, meta);
});

// ---- notifications ----
const listNotifications = asyncHandler(async (req, res) =>
  ok(res, await notificationService.list(req.user, { unreadOnly: req.query.unread === 'true', limit: req.query.limit })));
const markRead = asyncHandler(async (req, res) => {
  await notificationService.markRead(req.user, parseId(req.params.id, 'The notification id'));
  ok(res, { read: true });
});
const markAllRead = asyncHandler(async (req, res) => {
  await notificationService.markAllRead(req.user);
  ok(res, { read: true });
});

// ---- dashboard ----
const summary = asyncHandler(async (req, res) => ok(res, await dashboardService.summary(req.user, req.query)));
const customerTrends = asyncHandler(async (req, res) => ok(res, await dashboardService.customerTrends(req.user, req.query)));
const orderTrends = asyncHandler(async (req, res) => ok(res, await dashboardService.orderTrends(req.user, req.query)));

// ---- reports ----
const report = asyncHandler(async (req, res) => {
  const type = String(req.params.type);
  const range = { from: optionalDate(req.query.from, 'The from date'), to: optionalDate(req.query.to, 'The to date') };
  const data = await reportService.run(req.user, type, range);

  if (req.query.format === 'csv') {
    if (!req.user.can('reports.export')) throw ApiError.forbidden('You do not have permission to export reports.');
    await writeAudit(ctxOf(req), { action: 'export.csv', entityType: 'report', summary: 'Exported ' + data.title + ' (' + data.rows.length + ' rows)' });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="veltrix-' + type + '.csv"');
    return res.send(toCsv(data.columns, data.rows));
  }
  ok(res, { ...data, rows: data.rows.slice(0, 500), totalRows: data.rows.length });
});

module.exports = {
  listUsers, directory, createUser, updateUser, getSettings, updateSettings, health, listAudit,
  listNotifications, markRead, markAllRead, summary, customerTrends, orderTrends, report,
};
