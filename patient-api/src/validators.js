import { HttpError } from './errors.js';

const ALLOWED_FIELDS = [
  'patientId',
  'eventType',
  'severity',
  'department',
  'data',
  'timestamp'
];

const EVENT_TYPES = new Set(['admission', 'lab_result', 'vitals', 'discharge']);
const SEVERITIES = new Set(['normal', 'warning', 'critical']);

const MAX_PATIENT_ID_LENGTH = 50;
const MAX_DEPARTMENT_LENGTH = 100;
const MAX_TIMESTAMP_LENGTH = 40;
const MAX_STRING_IN_DATA_LENGTH = 500;
const MAX_DATA_BYTES = 50 * 1024;
const ISO_8601_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateStringLength(value, label, maxLength) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(400, `${label} must be a non-empty string`);
  }

  if (value.length > maxLength) {
    throw new HttpError(400, `${label} must be at most ${maxLength} characters`);
  }
}

function validateNoLongStringsInObject(value, path = 'data') {
  if (typeof value === 'string') {
    if (value.length > MAX_STRING_IN_DATA_LENGTH) {
      throw new HttpError(
        400,
        `String at ${path} exceeds max length of ${MAX_STRING_IN_DATA_LENGTH}`
      );
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => validateNoLongStringsInObject(item, `${path}[${index}]`));
    return;
  }

  if (isObject(value)) {
    Object.entries(value).forEach(([key, nested]) => {
      if (key.length > 100) {
        throw new HttpError(400, `Object key at ${path}.${key} exceeds max length of 100`);
      }
      validateNoLongStringsInObject(nested, `${path}.${key}`);
    });
  }
}

export function validatePatientEventPayload(payload) {
  if (!isObject(payload)) {
    throw new HttpError(400, 'Request body must be a JSON object');
  }

  const unexpectedFields = Object.keys(payload).filter((key) => !ALLOWED_FIELDS.includes(key));
  if (unexpectedFields.length > 0) {
    throw new HttpError(400, 'Unexpected fields in payload', {
      unexpectedFields
    });
  }

  const { patientId, eventType, severity, department, data, timestamp } = payload;

  validateStringLength(patientId, 'patientId', MAX_PATIENT_ID_LENGTH);
  validateStringLength(department, 'department', MAX_DEPARTMENT_LENGTH);
  validateStringLength(timestamp, 'timestamp', MAX_TIMESTAMP_LENGTH);

  if (!EVENT_TYPES.has(eventType)) {
    throw new HttpError(400, 'eventType must be one of: admission, lab_result, vitals, discharge');
  }

  if (!SEVERITIES.has(severity)) {
    throw new HttpError(400, 'severity must be one of: normal, warning, critical');
  }

  if (!isObject(data)) {
    throw new HttpError(400, 'data must be an object');
  }

  const dataBytes = Buffer.byteLength(JSON.stringify(data), 'utf8');
  if (dataBytes > MAX_DATA_BYTES) {
    throw new HttpError(400, `data must not exceed ${MAX_DATA_BYTES} bytes`);
  }

  validateNoLongStringsInObject(data);

  if (!ISO_8601_PATTERN.test(timestamp)) {
    throw new HttpError(400, 'timestamp must be a valid ISO 8601 string');
  }

  const parsedTimestamp = Date.parse(timestamp);
  if (!Number.isFinite(parsedTimestamp)) {
    throw new HttpError(400, 'timestamp must be a valid ISO 8601 string');
  }

  const now = Date.now();
  if (parsedTimestamp > now + 60_000) {
    throw new HttpError(400, 'timestamp cannot be more than 1 minute in the future');
  }

  return {
    patientId: patientId.trim(),
    eventType,
    severity,
    department: department.trim(),
    data,
    timestamp: new Date(parsedTimestamp).toISOString()
  };
}

export function validatePatientIdParam(patientId) {
  validateStringLength(patientId, 'patientId', MAX_PATIENT_ID_LENGTH);
  return patientId.trim();
}
