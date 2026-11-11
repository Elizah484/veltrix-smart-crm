'use strict';

const { asyncHandler, ok, ctxOf } = require('../utils/http');
const { validateBody, parseId, optionalDate, optionalEnum } = require('../utils/validate');
const schemas = require('../validators/schemas');
const customerService = require('../services/customerService');
const interactionService = require('../services/interactionService');
const orderService = require('../services/orderService');

const list = asyncHandler(async (req, res) => {
  const q = {
    ...req.query,
    from: optionalDate(req.query.from, 'The from date'),
    to: optionalDate(req.query.to, 'The to date'),
    category: optionalEnum(req.query.category, schemas.CATEGORIES, 'The category'),
    status: optionalEnum(req.query.status, ['Active', 'Inactive', 'Archived'], 'The status'),
  };
  const { items, meta } = await customerService.list(req.user, q);
  ok(res, items, meta);
});

const get = asyncHandler(async (req, res) => ok(res, await customerService.get(req.user, parseId(req.params.id, 'The customer id'))));

const create = asyncHandler(async (req, res) => {
  const data = validateBody(req.body, schemas.customer);
  ok(res, await customerService.create(req.user, data, ctxOf(req)), null, 201);
});

const update = asyncHandler(async (req, res) => {
  const data = validateBody(req.body, schemas.customer);
  ok(res, await customerService.update(req.user, parseId(req.params.id, 'The customer id'), data, ctxOf(req)));
});

const setStatus = asyncHandler(async (req, res) => {
  const data = validateBody(req.body, schemas.customerStatus);
  ok(res, await customerService.setStatus(req.user, parseId(req.params.id, 'The customer id'), data.status, ctxOf(req)));
});

const interactions = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'The customer id');
  await customerService.findVisible(req.user, id);
  ok(res, await interactionService.forCustomer(req.user, id));
});

const orders = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'The customer id');
  await customerService.findVisible(req.user, id);
  ok(res, await orderService.forCustomer(req.user, id));
});

const history = asyncHandler(async (req, res) => ok(res, await customerService.history(req.user, parseId(req.params.id, 'The customer id'))));

const checkDuplicates = asyncHandler(async (req, res) => {
  const data = validateBody(req.body, { ...schemas.customer, registeredOn: { type: 'date', label: 'date' } });
  const excludeId = req.body && req.body.excludeId ? parseId(req.body.excludeId, 'excludeId') : 0;
  ok(res, await customerService.checkDuplicates(req.user, data, excludeId));
});

const duplicates = asyncHandler(async (req, res) => ok(res, await customerService.duplicatePairs()));

const dismissDuplicate = asyncHandler(async (req, res) => {
  const data = validateBody(req.body, schemas.duplicateDecision);
  await customerService.dismissDuplicate(req.user, data.customerAId, data.customerBId, ctxOf(req));
  ok(res, { dismissed: true });
});

const merge = asyncHandler(async (req, res) => {
  const data = validateBody(req.body, schemas.merge);
  ok(res, await customerService.merge(req.user, data.keepId, data.mergeId, ctxOf(req)));
});

module.exports = { list, get, create, update, setStatus, interactions, orders, history, checkDuplicates, duplicates, dismissDuplicate, merge };
