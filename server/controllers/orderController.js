'use strict';

const { asyncHandler, ok, ctxOf } = require('../utils/http');
const { validateBody, parseId, optionalDate, optionalEnum } = require('../utils/validate');
const ApiError = require('../utils/ApiError');
const schemas = require('../validators/schemas');
const { ORDER_STATUSES, PAYMENT_STATUSES } = require('../utils/orderRules');
const orderService = require('../services/orderService');

const list = asyncHandler(async (req, res) => {
  const q = {
    ...req.query,
    from: optionalDate(req.query.from, 'The from date'),
    to: optionalDate(req.query.to, 'The to date'),
    status: optionalEnum(req.query.status, ORDER_STATUSES, 'The status'),
    payment: optionalEnum(req.query.payment, PAYMENT_STATUSES, 'The payment status'),
    customerId: req.query.customerId ? parseId(req.query.customerId, 'customerId') : null,
  };
  const { items, meta } = await orderService.list(req.user, q);
  ok(res, items, meta);
});

const get = asyncHandler(async (req, res) => ok(res, await orderService.get(req.user, parseId(req.params.id, 'The order id'))));

const history = asyncHandler(async (req, res) => ok(res, await orderService.getHistory(req.user, parseId(req.params.id, 'The order id'))));

const create = asyncHandler(async (req, res) => {
  const data = validateBody(req.body, schemas.order);
  const key = req.get('idempotency-key') || null;
  if (key && !/^[A-Za-z0-9_-]{8,80}$/.test(key)) throw ApiError.badRequest('The Idempotency-Key header must be 8 to 80 letters, numbers, dashes or underscores.');
  const result = await orderService.create(req.user, data, key, ctxOf(req));
  // A repeated submission returns the original order with 200 instead of creating a second one
  ok(res, result.order, { replayed: result.replayed }, result.replayed ? 200 : 201);
});

const setStatus = asyncHandler(async (req, res) => {
  const data = validateBody(req.body, schemas.orderStatus);
  ok(res, await orderService.setStatus(req.user, parseId(req.params.id, 'The order id'), data, ctxOf(req)));
});

const setPayment = asyncHandler(async (req, res) => {
  const data = validateBody(req.body, schemas.orderPayment);
  ok(res, await orderService.setPayment(req.user, parseId(req.params.id, 'The order id'), data, ctxOf(req)));
});

module.exports = { list, get, history, create, setStatus, setPayment };
