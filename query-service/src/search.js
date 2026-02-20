import { HttpError } from './errors.js';

const EVENT_TYPES = new Set(['admission', 'lab_result', 'vitals', 'discharge']);
const SEVERITIES = new Set(['normal', 'warning', 'critical']);

const MAX_QUERY_LENGTH = 500;
const MAX_DEPARTMENT_LENGTH = 100;
const MAX_PAGE = 100000;
const MAX_LIMIT = 100;

function normalizeSingleQueryParam(value) {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    throw new HttpError(400, 'Duplicate query parameters are not allowed');
  }

  return value;
}

function parsePositiveInteger(value, fieldName, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new HttpError(400, `${fieldName} must be a positive integer`);
  }

  return parsed;
}

function validateIsoDateOrThrow(value, fieldName) {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, `${fieldName} must be a valid ISO date`);
  }

  return new Date(parsed).toISOString();
}

export function parseSearchParams(query) {
  const raw = {
    q: normalizeSingleQueryParam(query.q),
    eventType: normalizeSingleQueryParam(query.eventType),
    severity: normalizeSingleQueryParam(query.severity),
    department: normalizeSingleQueryParam(query.department),
    from: normalizeSingleQueryParam(query.from),
    to: normalizeSingleQueryParam(query.to),
    page: normalizeSingleQueryParam(query.page),
    limit: normalizeSingleQueryParam(query.limit)
  };

  if (raw.q !== undefined) {
    if (typeof raw.q !== 'string' || raw.q.trim().length === 0) {
      throw new HttpError(400, 'q must be a non-empty string');
    }

    if (raw.q.length > MAX_QUERY_LENGTH) {
      throw new HttpError(400, `q must be at most ${MAX_QUERY_LENGTH} characters`);
    }
  }

  if (raw.eventType !== undefined && !EVENT_TYPES.has(raw.eventType)) {
    throw new HttpError(400, 'eventType must be one of: admission, lab_result, vitals, discharge');
  }

  if (raw.severity !== undefined && !SEVERITIES.has(raw.severity)) {
    throw new HttpError(400, 'severity must be one of: normal, warning, critical');
  }

  if (raw.department !== undefined) {
    if (typeof raw.department !== 'string' || raw.department.trim().length === 0) {
      throw new HttpError(400, 'department must be a non-empty string');
    }

    if (raw.department.length > MAX_DEPARTMENT_LENGTH) {
      throw new HttpError(400, `department must be at most ${MAX_DEPARTMENT_LENGTH} characters`);
    }
  }

  const parsedFrom = validateIsoDateOrThrow(raw.from, 'from');
  const parsedTo = validateIsoDateOrThrow(raw.to, 'to');

  if (parsedFrom && parsedTo && Date.parse(parsedFrom) > Date.parse(parsedTo)) {
    throw new HttpError(400, 'from must be earlier than or equal to to');
  }

  const page = parsePositiveInteger(raw.page, 'page', 1);
  if (page > MAX_PAGE) {
    throw new HttpError(400, `page must be <= ${MAX_PAGE}`);
  }

  const limit = parsePositiveInteger(raw.limit, 'limit', 20);
  if (limit > MAX_LIMIT) {
    throw new HttpError(400, `limit must be <= ${MAX_LIMIT}`);
  }

  return {
    q: raw.q?.trim(),
    eventType: raw.eventType,
    severity: raw.severity,
    department: raw.department?.trim(),
    from: parsedFrom,
    to: parsedTo,
    page,
    limit
  };
}

export function buildSearchQuery(params) {
  const must = [];
  const filter = [];

  if (params.q) {
    must.push({
      simple_query_string: {
        query: params.q,
        fields: ['department^2', 'data.*'],
        default_operator: 'and'
      }
    });
  }

  if (params.eventType) {
    filter.push({ term: { eventType: params.eventType } });
  }

  if (params.severity) {
    filter.push({ term: { severity: params.severity } });
  }

  if (params.department) {
    filter.push({ match_phrase: { department: params.department } });
  }

  if (params.from || params.to) {
    const rangeFilter = {};
    if (params.from) {
      rangeFilter.gte = params.from;
    }
    if (params.to) {
      rangeFilter.lte = params.to;
    }

    filter.push({ range: { timestamp: rangeFilter } });
  }

  return {
    bool: {
      must,
      filter
    }
  };
}

export function formatSearchResponse(esResponse, pagination) {
  const body = esResponse.body || esResponse;
  const totalValue = body.hits?.total?.value || 0;

  const results = (body.hits?.hits || []).map((hit) => ({
    id: hit._id,
    ...hit._source
  }));

  return {
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total: totalValue,
      totalPages: Math.ceil(totalValue / pagination.limit)
    },
    results
  };
}

export function formatAggregationResponse(esResponse) {
  const body = esResponse.body || esResponse;

  const bySeverity = (body.aggregations?.bySeverity?.buckets || []).map((bucket) => ({
    key: bucket.key,
    count: bucket.doc_count
  }));

  const byEventType = (body.aggregations?.byEventType?.buckets || []).map((bucket) => ({
    key: bucket.key,
    count: bucket.doc_count
  }));

  return {
    bySeverity,
    byEventType
  };
}
