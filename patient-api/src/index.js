import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { connectMongo, disconnectMongo, checkMongoHealth } from './db.js';
import { createKafkaClient } from './kafka.js';
import './models/patientEvent.js';

let kafka;
let server;

async function bootstrap() {
  const config = loadConfig();

  await connectMongo(config.mongodbUri);
  kafka = createKafkaClient(config);
  await kafka.connect();

  const app = createApp({
    config,
    services: {
      kafka,
      checkMongoHealth
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

    await Promise.allSettled([disconnectMongo(), kafka?.disconnect()]);
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
  console.error(`[patient-api] startup failed: ${error.message}`);
  await Promise.allSettled([disconnectMongo(), kafka?.disconnect()]);
  process.exit(1);
});
