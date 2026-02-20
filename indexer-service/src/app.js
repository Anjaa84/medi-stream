import express from 'express';
import { randomUUID } from 'node:crypto';

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

  app.get('/health', async (req, res) => {
    const response = {
      service: config.serviceName,
      status: 'ok',
      dependencies: {
        kafka: 'up',
        elasticsearch: 'up'
      },
      requestId: req.requestId
    };

    let statusCode = 200;

    try {
      await services.checkKafkaHealth();
    } catch (_error) {
      response.status = 'degraded';
      response.dependencies.kafka = 'down';
      statusCode = 503;
    }

    try {
      await services.checkElasticHealth();
    } catch (_error) {
      response.status = 'degraded';
      response.dependencies.elasticsearch = 'down';
      statusCode = 503;
    }

    res.status(statusCode).json(response);
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found', requestId: res.getHeader('X-Request-ID') });
  });

  app.use((err, req, res, _next) => {
    console.error(`[${config.serviceName}] requestId=${req.requestId} message=${err.message}`);
    res.status(500).json({ error: 'Internal server error', requestId: req.requestId });
  });

  return app;
}
