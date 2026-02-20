import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPatientEventProducer } from './producer.js';

let producer;
let server;

async function bootstrap() {
  const config = loadConfig();
  producer = createPatientEventProducer(config);
  await producer.connect();

  const app = createApp({ config, producer });

  server = app.listen(config.port, () => {
    console.log(`[${config.serviceName}] listening on port ${config.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`[${config.serviceName}] received ${signal}, shutting down`);

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    await producer.disconnect();
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
  console.error(`[event-producer] startup failed: ${error.message}`);
  await producer?.disconnect();
  process.exit(1);
});
