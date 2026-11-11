'use strict';

// Vercel entrypoint: export the Express application instead of starting
// a persistent HTTP listener. Local development continues to use server.js.
const { assertSecure } = require('./config/env');
assertSecure();

const app = require('./app');

module.exports = app;
