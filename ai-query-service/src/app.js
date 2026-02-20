import express from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { HttpError } from './errors.js';
import { validateAiSearchPayload } from './validators.js';
import { parseAndValidateDsl } from './dsl-validator.js';

const aiSearchRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests to POST /ai-search. Try again later.',
      requestId: req.requestId
    });
  }
});

export function createApp({ config, services }) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '50kb' }));

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

  app.post('/ai-search', aiSearchRateLimiter, async (req, res, next) => {
    try {
      const payload = validateAiSearchPayload(req.body);
      const llmResponseText = await services.llm.generateDsl(payload.query);
      const parsedDsl = parseAndValidateDsl(llmResponseText);

      const response = await services.queryService.executeDslSearch({
        dsl: parsedDsl,
        requestId: req.requestId
      });

      res.status(200).json({
        generatedQuery: parsedDsl,
        results: {
          meta: response.meta,
          hits: response.results
        },
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/health', async (req, res) => {
    const health = {
      service: config.serviceName,
      status: 'ok',
      dependencies: {
        queryService: 'up',
        llm: 'up'
      },
      requestId: req.requestId
    };

    let statusCode = 200;

    try {
      await services.queryService.checkHealth(req.requestId);
    } catch (_error) {
      health.status = 'degraded';
      health.dependencies.queryService = 'down';
      statusCode = 503;
    }

    if (config.llmProvider === 'openai' && !config.openAiApiKey) {
      health.status = 'degraded';
      health.dependencies.llm = 'down';
      statusCode = 503;
    }

    if (config.llmProvider === 'anthropic' && !config.anthropicApiKey) {
      health.status = 'degraded';
      health.dependencies.llm = 'down';
      statusCode = 503;
    }

    res.status(statusCode).json(health);
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found', requestId: res.getHeader('X-Request-ID') });
  });

  app.use((err, req, res, _next) => {
    if (err instanceof SyntaxError && err.type === 'entity.parse.failed') {
      res.status(400).json({
        error: 'Malformed JSON body',
        requestId: req.requestId
      });
      return;
    }

    if (err instanceof HttpError) {
      const body = {
        error: err.message,
        requestId: req.requestId
      };

      if (err.details) {
        body.details = err.details;
      }

      res.status(err.statusCode).json(body);
      return;
    }

    console.error(`[${config.serviceName}] requestId=${req.requestId} message=${err.message}`);
    res.status(500).json({ error: 'Internal server error', requestId: req.requestId });
  });

  return app;
}
