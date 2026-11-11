'use strict';

const express = require('express');
const { authenticate, requirePermission, requireAny, csrfProtect } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');
const auth = require('../controllers/authController');
const customers = require('../controllers/customerController');
const interactions = require('../controllers/interactionController');
const orders = require('../controllers/orderController');
const admin = require('../controllers/adminController');

const router = express.Router();

// ---- Public ----------------------------------------------------------------
router.post('/auth/login', loginLimiter, auth.login);
router.post('/auth/register', loginLimiter, auth.register);

// ---- Everything below needs a valid session and, for changes, a CSRF token --
router.use(authenticate, csrfProtect);

// Authentication
router.get('/auth/me', auth.me);
router.post('/auth/logout', auth.logout);
router.post('/auth/change-password', auth.changePassword);

// Customers (fixed paths first so they are not read as :id)
router.get('/customers', requirePermission('customers.view'), customers.list);
router.post('/customers', requirePermission('customers.create'), customers.create);
router.post('/customers/check-duplicates', requirePermission('customers.view'), customers.checkDuplicates);
router.get('/customers/duplicates', requirePermission('customers.merge'), customers.duplicates);
router.post('/customers/duplicates/dismiss', requirePermission('customers.merge'), customers.dismissDuplicate);
router.post('/customers/merge', requirePermission('customers.merge'), customers.merge);
router.get('/customers/:id', requirePermission('customers.view'), customers.get);
router.put('/customers/:id', requirePermission('customers.edit'), customers.update);
router.patch('/customers/:id/status', requirePermission('customers.archive'), customers.setStatus);
router.get('/customers/:id/interactions', requirePermission('customers.view', 'interactions.view'), customers.interactions);
router.get('/customers/:id/orders', requirePermission('customers.view', 'orders.view'), customers.orders);
router.get('/customers/:id/history', requirePermission('customers.view'), customers.history);

// Interactions
router.get('/interactions', requirePermission('interactions.view'), interactions.list);
router.get('/interactions/follow-ups', requirePermission('interactions.view'), interactions.followUps);
router.post('/interactions', requirePermission('interactions.create'), interactions.create);
router.get('/interactions/:id', requirePermission('interactions.view'), interactions.get);
router.put('/interactions/:id', requirePermission('interactions.edit'), interactions.update);
router.patch('/interactions/:id/complete', requirePermission('interactions.view'), interactions.complete);
router.patch('/interactions/:id/assign', requirePermission('interactions.assign'), interactions.assign);

// Orders
router.get('/orders', requirePermission('orders.view'), orders.list);
router.post('/orders', requirePermission('orders.create'), orders.create);
router.get('/orders/:id', requirePermission('orders.view'), orders.get);
router.get('/orders/:id/history', requirePermission('orders.view'), orders.history);
router.patch('/orders/:id/status', requireAny('orders.status_basic', 'orders.status_any'), orders.setStatus);
router.patch('/orders/:id/payment', requirePermission('orders.view'), orders.setPayment);

// Dashboard
router.get('/dashboard/summary', admin.summary);
router.get('/dashboard/customer-trends', admin.customerTrends);
router.get('/dashboard/order-trends', admin.orderTrends);

// Reports (add ?format=csv to download)
router.get('/reports/:type', requirePermission('reports.view'), admin.report);

// Notifications (every signed-in user, their own only)
router.get('/notifications', admin.listNotifications);
router.patch('/notifications/read-all', admin.markAllRead);
router.patch('/notifications/:id/read', admin.markRead);

// Staff directory for dropdowns, and settings that every user needs to display money correctly
router.get('/users/directory', admin.directory);
router.get('/settings', admin.getSettings);

// Administration
router.get('/users', requirePermission('users.manage'), admin.listUsers);
router.post('/users', requirePermission('users.manage'), admin.createUser);
router.put('/users/:id', requirePermission('users.manage'), admin.updateUser);
router.put('/settings', requirePermission('settings.manage'), admin.updateSettings);
router.get('/system/health', requirePermission('settings.manage'), admin.health);
router.get('/audit-logs', requirePermission('audit.view'), admin.listAudit);

module.exports = router;
