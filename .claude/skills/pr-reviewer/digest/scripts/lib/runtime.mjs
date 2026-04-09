import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

export const anySchema = { kind: 'any' };
export const stringSchema = { kind: 'string' };
export const integerSchema = { kind: 'integer' };
export const booleanSchema = { kind: 'boolean' };

export function arraySchema(item) {
  return { kind: 'array', item };
}

export function objectSchema(properties) {
  return { kind: 'object', properties };
}

export function recordSchema(value) {
  return { kind: 'record', value };
}

export function readStrictJSON(path, schema, label) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(`read ${label}: ${error.message}`);
  }

  let value;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new Error(`decode ${label}: ${error.message}`);
  }

  try {
    validateJSON(value, schema, label);
  } catch (error) {
    throw new Error(`decode ${label}: ${error.message}`);
  }
  return value;
}

export function writeJSON(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeStdout(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }
  return '';
}

export function normalizeSide(value) {
  return String(value ?? '').trim().toUpperCase() === 'LEFT' ? 'LEFT' : 'RIGHT';
}

export function severityRank(value) {
  switch (String(value ?? '').trim().toUpperCase()) {
    case 'P1':
      return 0;
    case 'P2':
      return 1;
    default:
      return 2;
  }
}

export function sha1Prefix(value, length = 10) {
  return createHash('sha1').update(value).digest('hex').slice(0, length);
}

function validateJSON(value, schema, path) {
  switch (schema.kind) {
    case 'any':
      return;
    case 'string':
      if (typeof value !== 'string') {
        throw new Error(`expected string at ${path}`);
      }
      return;
    case 'integer':
      if (!Number.isInteger(value)) {
        throw new Error(`expected integer at ${path}`);
      }
      return;
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new Error(`expected boolean at ${path}`);
      }
      return;
    case 'array':
      if (!Array.isArray(value)) {
        throw new Error(`expected array at ${path}`);
      }
      for (let index = 0; index < value.length; index += 1) {
        validateJSON(value[index], schema.item, `${path}[${index}]`);
      }
      return;
    case 'object':
      if (!isPlainObject(value)) {
        throw new Error(`expected object at ${path}`);
      }
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(schema.properties, key)) {
          throw new Error(`unknown field "${key}"`);
        }
      }
      for (const [key, childSchema] of Object.entries(schema.properties)) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          validateJSON(value[key], childSchema, `${path}.${key}`);
        }
      }
      return;
    case 'record':
      if (!isPlainObject(value)) {
        throw new Error(`expected object at ${path}`);
      }
      for (const [key, child] of Object.entries(value)) {
        validateJSON(child, schema.value, `${path}.${key}`);
      }
      return;
    default:
      throw new Error(`unsupported schema kind "${schema.kind}"`);
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
