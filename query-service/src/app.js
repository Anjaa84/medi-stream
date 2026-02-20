import express from 'express';
import { randomUUID } from 'node:crypto';
import { HttpError } from './errors.js';
import {
  parseSearchParams,
  buildSearchQuery,
  formatSearchResponse,
  formatAggregationResponse
} from './search.js';
import { parseDslPayload, formatDslSearchResponse } from './dsl.js';

export function createApp({ config, services }) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    const startedAt = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      console.log(
        `[${config.serviceName}] requestId=${requestId} method=${req.method} path=${req.originalUrl} status=${res.statusCode} durationMs=${durationMs}`
      );
    });

    next();
  });

  app.get('/search', async (req, res, next) => {
    try {
      const params = parseSearchParams(req.query);
      const query = buildSearchQuery(params);
      const from = (params.page - 1) * params.limit;

      const response = await services.elastic.search({
        query,
        from,
        size: params.limit
      });

      const formatted = formatSearchResponse(response, {
        page: params.page,
        limit: params.limit
      });

      res.status(200).json({
        ...formatted,
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/search/aggregations', async (req, res, next) => {
    try {
      const params = parseSearchParams(req.query);
      const query = buildSearchQuery(params);
      const response = await services.elastic.aggregations({ query });
      const aggregations = formatAggregationResponse(response);

      res.status(200).json({
        aggregations,
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/search/dsl', async (req, res, next) => {
    try {
      const { dsl, page, limit } = parseDslPayload(req.body);
      const from = (page - 1) * limit;
      const response = await services.elastic.search({
        query: dsl.query,
        from,
        size: limit,
        sort: dsl.sort
      });

      const formatted = formatDslSearchResponse(response, page, limit);
      res.status(200).json({
        ...formatted,
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/health', async (req, res) => {
    try {
      await services.elastic.checkHealth();
      res.status(200).json({
        service: config.serviceName,
        status: 'ok',
        dependencies: {
          elasticsearch: 'up'
        },
        requestId: req.requestId
      });
    } catch (_error) {
      res.status(503).json({
        service: config.serviceName,
        status: 'degraded',
        dependencies: {
          elasticsearch: 'down'
        },
        requestId: req.requestId
      });
    }
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found', requestId: res.getHeader('X-Request-ID') });
  });

  app.use((err, req, res, _next) => {
    if (err instanceof HttpError) {
      res.status(err.statusCode).json({
        error: err.message,
        requestId: req.requestId
      });
      return;
    }

    console.error(`[${config.serviceName}] requestId=${req.requestId} message=${err.message}`);
    res.status(500).json({ error: 'Internal server error', requestId: req.requestId });
  });

  return app;
}
