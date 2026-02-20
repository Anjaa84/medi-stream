import { HttpError } from './errors.js';
import { ALLOWED_FIELDS } from './mapping.js';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function collectFieldRefs(node, bucket) {
  if (Array.isArray(node)) {
    node.forEach((item) => collectFieldRefs(item, bucket));
    return;
  }

  if (!isObject(node)) {
    return;
  }

  if (typeof node.field === 'string') {
    bucket.add(node.field);
  }

  for (const [key, value] of Object.entries(node)) {
    if (isObject(value) && (key === 'term' || key === 'match' || key === 'match_phrase' || key === 'range')) {
      for (const fieldName of Object.keys(value)) {
        bucket.add(fieldName);
      }
    }

    if (key === 'sort' && Array.isArray(value)) {
      value.forEach((sortItem) => {
        if (isObject(sortItem)) {
          Object.keys(sortItem).forEach((fieldName) => bucket.add(fieldName));
        }
      });
    }

    collectFieldRefs(value, bucket);
  }
}

export function parseAndValidateDsl(rawText) {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (_error) {
    throw new HttpError(422, 'LLM output is not valid JSON');
  }

  if (!isObject(parsed)) {
    throw new HttpError(422, 'LLM output must be a JSON object');
  }

  const rootKeys = Object.keys(parsed);
  const disallowedRootKeys = rootKeys.filter((key) => !['query', 'sort', 'aggs', 'size', 'from'].includes(key));
  if (disallowedRootKeys.length > 0) {
    throw new HttpError(422, 'LLM output contains unsupported root keys', {
      disallowedRootKeys
    });
  }

  if (!isObject(parsed.query)) {
    throw new HttpError(422, 'LLM output must include a query object');
  }

  const fields = new Set();
  collectFieldRefs(parsed, fields);

  const disallowedFields = Array.from(fields).filter((field) => {
    if (field.startsWith('data.')) {
      return false;
    }
    return !ALLOWED_FIELDS.has(field);
  });

  if (disallowedFields.length > 0) {
    throw new HttpError(422, 'LLM output references disallowed fields', {
      disallowedFields
    });
  }

  return parsed;
}
