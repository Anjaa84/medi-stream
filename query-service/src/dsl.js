import { HttpError } from './errors.js';
import { formatSearchResponse } from './search.js';

const MAX_LIMIT = 100;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseDslPayload(payload) {
  if (!isObject(payload)) {
    throw new HttpError(400, 'Request body must be a JSON object');
  }

  const dsl = payload.dsl;
  if (!isObject(dsl)) {
    throw new HttpError(400, 'dsl must be a JSON object');
  }

  if (!isObject(dsl.query)) {
    throw new HttpError(400, 'dsl.query must be a JSON object');
  }

  const page = payload.page === undefined ? 1 : Number(payload.page);
  if (!Number.isInteger(page) || page < 1) {
    throw new HttpError(400, 'page must be a positive integer');
  }

  const limit = payload.limit === undefined ? 20 : Number(payload.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new HttpError(400, `limit must be a positive integer <= ${MAX_LIMIT}`);
  }

  return { dsl, page, limit };
}

export function formatDslSearchResponse(esResponse, page, limit) {
  return formatSearchResponse(esResponse, { page, limit });
}
