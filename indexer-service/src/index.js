import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createKafkaClients } from './kafka.js';
import { createElasticClient } from './elasticsearch.js';

let kafka;
let elastic;
let server;

async function bootstrap() {
  const config = loadConfig();

  kafka = createKafkaClients(config);
  elastic = createElasticClient(config);

  await elastic.connect();
  await elastic.ensurePatientEventsIndex();
  await kafka.connect();

  await kafka.startConsumer({
    indexEvent: async (event) => {
      await elastic.indexEvent(event);
    }
  });

  const app = createApp({
    config,
    services: {
      checkKafkaHealth: () => kafka.checkHealth(),
      checkElasticHealth: () => elastic.checkHealth()
    }
  });

  server = app.listen(config.port, () => {
    console.log(`[${config.serviceName}] listening on port ${config.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`[${config.serviceName}] received ${signal}, shutting down`);

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    await Promise.allSettled([
      kafka?.shutdown(),
      elastic?.disconnect()
    ]);

    process.exit(0);
  };

  process.on('SIGINT', () => {
    shutdown('SIGINT').catch((error) => {
      console.error(`[${config.serviceName}] shutdown error: ${error.message}`);
      process.exit(1);
    });
  });

  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch((error) => {
      console.error(`[${config.serviceName}] shutdown error: ${error.message}`);
      process.exit(1);
    });
  });
}

bootstrap().catch(async (error) => {
  console.error(`[indexer-service] startup failed: ${error.message}`);
  await Promise.allSettled([
    kafka?.shutdown(),
    elastic?.disconnect()
  ]);
  process.exit(1);
});
