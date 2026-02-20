import express from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { PatientEvent } from './models/patientEvent.js';
import { HttpError } from './errors.js';
import { validatePatientEventPayload, validatePatientIdParam } from './validators.js';

const postEventsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests to POST /events. Try again later.',
      requestId: req.requestId
    });
  }
});

const safeProjection = {
  _id: 0,
  patientId: 1,
  eventType: 1,
  severity: 1,
  department: 1,
  data: 1,
  timestamp: 1,
  createdAt: 1
};

export function createApp({ config, services }) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));

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

  app.post('/events', postEventsRateLimiter, async (req, res, next) => {
    try {
      const event = validatePatientEventPayload(req.body);

      await PatientEvent.create({
        patientId: event.patientId,
        eventType: event.eventType,
        severity: event.severity,
        department: event.department,
        data: event.data,
        timestamp: new Date(event.timestamp)
      });

      await services.kafka.publishPatientEvent(event);

      res.status(201).json({
        message: 'Event accepted',
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/events/:patientId', async (req, res, next) => {
    try {
      const patientId = validatePatientIdParam(req.params.patientId);
      const records = await PatientEvent.find(
        { patientId },
        safeProjection,
        { lean: true }
      ).sort({ timestamp: -1 });

      const events = records.map((record) => ({
        patientId: record.patientId,
        eventType: record.eventType,
        severity: record.severity,
        department: record.department,
        data: record.data,
        timestamp: new Date(record.timestamp).toISOString(),
        createdAt: new Date(record.createdAt).toISOString()
      }));

      res.status(200).json({ events, requestId: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.get('/health', async (req, res) => {
    const health = {
      service: config.serviceName,
      status: 'ok',
      dependencies: {
        mongodb: 'up',
        kafka: 'up'
      },
      requestId: req.requestId
    };

    let statusCode = 200;

    try {
      await services.checkMongoHealth();
    } catch (_error) {
      health.status = 'degraded';
      health.dependencies.mongodb = 'down';
      statusCode = 503;
    }

    try {
      await services.kafka.checkHealth();
    } catch (_error) {
      health.status = 'degraded';
      health.dependencies.kafka = 'down';
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
      const response = {
        error: err.message,
        requestId: req.requestId
      };

      if (err.details) {
        response.details = err.details;
      }

      res.status(err.statusCode).json(response);
      return;
    }

    console.error(`[${config.serviceName}] requestId=${req.requestId} message=${err.message}`);
    res.status(500).json({ error: 'Internal server error', requestId: req.requestId });
  });

  return app;
}
