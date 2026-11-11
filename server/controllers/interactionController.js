'use strict';

const { asyncHandler, ok, ctxOf } = require('../utils/http');
const { validateBody, parseId, optionalDate, optionalEnum } = require('../utils/validate');
const schemas = require('../validators/schemas');
const interactionService = require('../services/interactionService');

const list = asyncHandler(async (req, res) => {
  const q = {
    ...req.query,
    from: optionalDate(req.query.from, 'The from date'),
    to: optionalDate(req.query.to, 'The to date'),
    type: optionalEnum(req.query.type, schemas.INTERACTION_TYPES, 'The type'),
    status: optionalEnum(req.query.status, schemas.INTERACTION_STATUSES, 'The status'),
    customerId: req.query.customerId ? parseId(req.query.customerId, 'customerId') : null,
  };
  const { items, meta } = await interactionService.list(req.user, q);
  ok(res, items, meta);
});

const followUps = asyncHandler(async (req, res) => {
  const state = optionalEnum(req.query.state, ['overdue', 'upcoming', 'done'], 'The state') || 'overdue';
  ok(res, await interactionService.followUps(req.user, state));
});

const get = asyncHandler(async (req, res) => ok(res, await interactionService.get(req.user, parseId(req.params.id, 'The interaction id'))));

const create = asyncHandler(async (req, res) => {
  const data = validateBody(req.body, schemas.interaction);
  ok(res, await interactionService.create(req.user, data, ctxOf(req)), null, 201);
});

const update = asyncHandler(async (req, res) => {
  const data = validateBody(req.body, schemas.interaction);
  ok(res, await interactionService.update(req.user, parseId(req.params.id, 'The interaction id'), data, ctxOf(req)));
});

const complete = asyncHandler(async (req, res) => ok(res, await interactionService.complete(req.user, parseId(req.params.id, 'The interaction id'), ctxOf(req))));

const assign = asyncHandler(async (req, res) => {
  const data = validateBody(req.body, schemas.assign);
  ok(res, await interactionService.assign(req.user, parseId(req.params.id, 'The interaction id'), data.assigneeId, ctxOf(req)));
});

module.exports = { list, followUps, get, create, update, complete, assign };
