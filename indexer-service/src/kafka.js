import { Kafka } from 'kafkajs';

const MAX_INDEX_RETRIES = 3;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseMessageValue(messageValue) {
  if (!messageValue) {
    throw new Error('Kafka message value is empty');
  }

  return JSON.parse(messageValue.toString('utf8'));
}

function buildDlqPayload(originalMessage, errorMessage) {
  return {
    originalMessage,
    error: {
      message: errorMessage,
      at: new Date().toISOString()
    }
  };
}

export function createKafkaClients(config, dependencies = {}) {
  const logger = dependencies.logger || console;
  const kafka = new Kafka({
    clientId: `${config.kafkaClientId}-indexer-service`,
    brokers: config.kafkaBrokers
  });

  const consumer = kafka.consumer({ groupId: config.kafkaGroupId });
  const producer = kafka.producer({ allowAutoTopicCreation: true });
  const admin = kafka.admin();

  let isRunning = false;
  let runPromise = null;

  return {
    async connect() {
      await Promise.all([consumer.connect(), producer.connect(), admin.connect()]);
    },

    async startConsumer({ indexEvent }) {
      await consumer.subscribe({
        topic: config.kafkaTopicPatientEvents,
        fromBeginning: false
      });

      isRunning = true;

      runPromise = consumer.run({
        autoCommit: false,
        eachBatchAutoResolve: false,
        eachBatch: async ({ batch, resolveOffset, heartbeat, commitOffsetsIfNecessary, isRunning: consumerIsRunning, isStale }) => {
          for (const message of batch.messages) {
            if (!consumerIsRunning() || isStale()) {
              break;
            }

            const raw = message.value?.toString('utf8') || '';

            try {
              const event = parseMessageValue(message.value);

              let indexed = false;
              let lastError = null;
              for (let attempt = 1; attempt <= MAX_INDEX_RETRIES; attempt += 1) {
                try {
                  await indexEvent(event);
                  indexed = true;
                  break;
                } catch (error) {
                  lastError = error;
                  logger.error(
                    `[indexer-service] index attempt=${attempt} failed topic=${batch.topic} partition=${batch.partition} offset=${message.offset} error=${error.message}`
                  );
                  if (attempt < MAX_INDEX_RETRIES) {
                    await delay(300 * attempt);
                  }
                }
              }

              if (!indexed) {
                const dlqPayload = buildDlqPayload(event, lastError?.message || 'Indexing failure');
                await producer.send({
                  topic: config.kafkaTopicDlq,
                  messages: [
                    {
                      key: event.patientId || message.key?.toString('utf8'),
                      value: JSON.stringify(dlqPayload),
                      headers: {
                        source: 'indexer-service',
                        version: '1'
                      }
                    }
                  ]
                });
              }
            } catch (error) {
              const dlqPayload = buildDlqPayload(raw, error.message);
              await producer.send({
                topic: config.kafkaTopicDlq,
                messages: [
                  {
                    key: message.key?.toString('utf8'),
                    value: JSON.stringify(dlqPayload),
                    headers: {
                      source: 'indexer-service',
                      version: '1'
                    }
                  }
                ]
              });
            }

            resolveOffset(message.offset);
            await commitOffsetsIfNecessary();
            await heartbeat();
          }
        }
      });

      runPromise.catch((error) => {
        logger.error(`[indexer-service] consumer run loop crashed: ${error.message}`);
      });
    },

    async checkHealth() {
      await admin.fetchTopicMetadata({
        topics: [config.kafkaTopicPatientEvents, config.kafkaTopicDlq]
      });
      return true;
    },

    async shutdown() {
      if (isRunning) {
        await consumer.stop();
        isRunning = false;
      }

      await runPromise?.catch(() => {});

      await Promise.allSettled([
        consumer.disconnect(),
        producer.disconnect(),
        admin.disconnect()
      ]);
    }
  };
}
