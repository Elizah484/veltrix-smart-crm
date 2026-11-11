'use strict';

const ApiError = require('./ApiError');
const { isEmail, isPhone } = require('./normalize');
const { isYmd } = require('./dates');

/**
 * Small schema validator. Only fields named in the schema are copied to the
 * result, so extra fields in the request (for example "role" or "version")
 * can never be written by accident (mass-assignment protection).
 *
 * schema = { fieldName: { type, label, required, max, min, values, items, nullable } }
 * types: string, email, phone, int, number, enum, date, datetime, bool, array
 */
function validateBody(input, schema, options) {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const errors = {};
  const out = {};
  const prefix = (options && options.prefix) || '';

  Object.keys(schema).forEach((key) => {
    const rule = schema[key];
    const label = rule.label || key;
    const raw = body[key];
    const errKey = prefix + key;
    const missing = raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');

    if (missing) {
      if (rule.required) errors[errKey] = 'Enter ' + label + '.';
      else out[key] = rule.default !== undefined ? rule.default : null;
      return;
    }

    switch (rule.type) {
      case 'string':
      case 'email':
      case 'phone': {
        if (typeof raw !== 'string') { errors[errKey] = label + ' must be text.'; return; }
        const s = raw.trim();
        const max = rule.max || 255;
        if (s.length > max) { errors[errKey] = 'Use ' + max + ' characters or fewer.'; return; }
        if (rule.min && s.length < rule.min) { errors[errKey] = 'Use at least ' + rule.min + ' characters.'; return; }
        if (rule.type === 'email' && !isEmail(s)) { errors[errKey] = 'Enter a valid email address, such as name@example.com.'; return; }
        if (rule.type === 'phone' && !isPhone(s)) { errors[errKey] = 'Enter a phone number with 9 to 15 digits.'; return; }
        out[key] = s;
        return;
      }
      case 'int':
      case 'number': {
        const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
        if (!Number.isFinite(n)) { errors[errKey] = label + ' must be a number.'; return; }
        if (rule.type === 'int' && !Number.isInteger(n)) { errors[errKey] = label + ' must be a whole number.'; return; }
        if (rule.min !== undefined && n < rule.min) { errors[errKey] = label + ' must be at least ' + rule.min + '.'; return; }
        if (rule.max !== undefined && n > rule.max) { errors[errKey] = label + ' must be at most ' + rule.max + '.'; return; }
        if (rule.type === 'number' && rule.decimals !== undefined && Math.round(n * Math.pow(10, rule.decimals)) / Math.pow(10, rule.decimals) !== n) {
          errors[errKey] = label + ' can have at most ' + rule.decimals + ' decimal places.';
          return;
        }
        out[key] = n;
        return;
      }
      case 'enum': {
        if (!rule.values.includes(raw)) { errors[errKey] = 'Choose a valid ' + label + '.'; return; }
        out[key] = raw;
        return;
      }
      case 'date': {
        if (!isYmd(raw)) { errors[errKey] = label + ' must be a valid date (YYYY-MM-DD).'; return; }
        out[key] = raw;
        return;
      }
      case 'datetime': {
        const d = new Date(raw);
        if (typeof raw !== 'string' || Number.isNaN(d.getTime())) { errors[errKey] = label + ' must be a valid date and time.'; return; }
        out[key] = d;
        return;
      }
      case 'bool': {
        if (typeof raw !== 'boolean') { errors[errKey] = label + ' must be true or false.'; return; }
        out[key] = raw;
        return;
      }
      case 'array': {
        if (!Array.isArray(raw)) { errors[errKey] = label + ' must be a list.'; return; }
        if (rule.min !== undefined && raw.length < rule.min) { errors[errKey] = 'Add at least ' + rule.min + ' ' + label + '.'; return; }
        if (rule.max !== undefined && raw.length > rule.max) { errors[errKey] = 'Use at most ' + rule.max + ' ' + label + '.'; return; }
        const list = [];
        raw.forEach((item, idx) => {
          const sub = validateBody(item, rule.items, { collect: true, prefix: errKey + '.' + idx + '.' });
          Object.assign(errors, sub.errors);
          list.push(sub.value);
        });
        out[key] = list;
        return;
      }
      default:
        errors[errKey] = 'Unsupported field.';
    }
  });

  if (options && options.collect) return { value: out, errors };
  if (Object.keys(errors).length) throw ApiError.validation(errors);
  return out;
}

/** A positive integer id from a URL parameter */
function parseId(value, label) {
  const s = String(value);
  if (!/^\d{1,10}$/.test(s) || Number(s) < 1) throw ApiError.badRequest((label || 'The id') + ' is not valid.');
  return Number(s);
}

/** Optional YYYY-MM-DD query parameter */
function optionalDate(value, label) {
  if (value === undefined || value === null || value === '') return null;
  if (!isYmd(value)) throw ApiError.badRequest((label || 'The date') + ' must be written as YYYY-MM-DD.');
  return String(value);
}

/** Optional value that must be one of a list */
function optionalEnum(value, values, label) {
  if (value === undefined || value === null || value === '') return null;
  if (!values.includes(value)) throw ApiError.badRequest((label || 'The value') + ' is not valid.');
  return value;
}

module.exports = { validateBody, parseId, optionalDate, optionalEnum };
