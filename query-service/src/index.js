import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createElasticClient } from './elasticsearch.js';

let server;
let elastic;

async function bootstrap() {
  const config = loadConfig();
  elastic = createElasticClient(config);
  await elastic.connect();

  const app = createApp({
    config,
    services: {
      elastic
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

    await elastic?.disconnect();
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
  console.error(`[query-service] startup failed: ${error.message}`);
  await elastic?.disconnect();
  process.exit(1);
});
