import { HttpError } from './errors.js';

const ALLOWED_FIELDS = ['query'];

export function validateAiSearchPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new HttpError(400, 'Request body must be a JSON object');
  }

  const unexpectedFields = Object.keys(payload).filter((key) => !ALLOWED_FIELDS.includes(key));
  if (unexpectedFields.length > 0) {
    throw new HttpError(400, 'Unexpected fields in payload', { unexpectedFields });
  }

  if (typeof payload.query !== 'string' || payload.query.trim().length === 0) {
    throw new HttpError(400, 'query must be a non-empty string');
  }

  const trimmed = payload.query.trim();
  if (trimmed.length > 500) {
    throw new HttpError(400, 'query must be at most 500 characters');
  }

  return {
    query: trimmed
  };
}
