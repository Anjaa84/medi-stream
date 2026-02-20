import { Kafka } from 'kafkajs';

const MAX_RETRIES = 3;
const EVENT_TYPES = new Set(['admission', 'lab_result', 'vitals', 'discharge']);
const SEVERITIES = new Set(['normal', 'warning', 'critical']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertValidEventMessage(event) {
  if (!isObject(event)) {
    throw new Error('event must be an object');
  }

  const requiredFields = [
    'patientId',
    'eventType',
    'severity',
    'department',
    'data',
    'timestamp'
  ];

  for (const field of requiredFields) {
    if (!(field in event)) {
      throw new Error(`event is missing required field: ${field}`);
    }
  }

  if (typeof event.patientId !== 'string' || event.patientId.trim().length === 0) {
    throw new Error('event.patientId must be a non-empty string');
  }

  if (!EVENT_TYPES.has(event.eventType)) {
    throw new Error('event.eventType is invalid');
  }

  if (!SEVERITIES.has(event.severity)) {
    throw new Error('event.severity is invalid');
  }

  if (typeof event.department !== 'string' || event.department.trim().length === 0) {
    throw new Error('event.department must be a non-empty string');
  }

  if (!isObject(event.data)) {
    throw new Error('event.data must be an object');
  }

  const parsedTimestamp = Date.parse(event.timestamp);
  if (!Number.isFinite(parsedTimestamp)) {
    throw new Error('event.timestamp must be a valid ISO-8601 string');
  }
}

function buildMessage(event, source) {
  return {
    headers: {
      source,
      version: '1'
    },
    key: event.patientId,
    value: JSON.stringify(event)
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createPatientEventProducer(config, options = {}) {
  const logger = options.logger || console;
  const maxMessageBytes = Number(config.kafkaMaxMessageBytes || 1000000);
  if (!Number.isInteger(maxMessageBytes) || maxMessageBytes <= 0) {
    throw new Error('kafkaMaxMessageBytes must be a positive integer');
  }

  const kafka = new Kafka({
    clientId: `${config.kafkaClientId}-event-producer`,
    brokers: config.kafkaBrokers
  });

  const producer = kafka.producer({ allowAutoTopicCreation: true });
  const admin = kafka.admin();

  let isConnected = false;

  async function withRetries(operation, name) {
    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        logger.error(`[event-producer] ${name} attempt=${attempt} failed: ${error.message}`);
        if (attempt < MAX_RETRIES) {
          await delay(300 * attempt);
        }
      }
    }

    throw lastError;
  }

  return {
    async connect() {
      await withRetries(async () => {
        await producer.connect();
        await admin.connect();
      }, 'connect');
      isConnected = true;
    },

    async disconnect() {
      await Promise.allSettled([
        producer.disconnect(),
        admin.disconnect()
      ]);
      isConnected = false;
    },

    async publishPatientEvent(event, metadata = {}) {
      assertValidEventMessage(event);

      const message = buildMessage(event, metadata.source || 'patient-api');
      const messageSizeBytes = Buffer.byteLength(message.value, 'utf8');
      if (messageSizeBytes > maxMessageBytes) {
        throw new Error(
          `event message size ${messageSizeBytes} exceeds max ${maxMessageBytes}`
        );
      }

      try {
        await withRetries(async () => {
          await producer.send({
            topic: config.kafkaTopicPatientEvents,
            messages: [message]
          });
        }, 'publish');
      } catch (publishError) {
        const dlqPayload = {
          originalMessage: event,
          error: {
            message: publishError.message,
            at: new Date().toISOString()
          }
        };

        const dlqMessage = {
          headers: {
            source: metadata.source || 'patient-api',
            version: '1'
          },
          key: event.patientId,
          value: JSON.stringify(dlqPayload)
        };

        await producer.send({
          topic: config.kafkaTopicDlq,
          messages: [dlqMessage]
        });

        throw publishError;
      }
    },

    async checkHealth() {
      if (!isConnected) {
        return false;
      }

      await admin.fetchTopicMetadata({ topics: [config.kafkaTopicPatientEvents] });
      return true;
    }
  };
}
