import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createLlmClient } from './llm.js';
import { createQueryServiceClient } from './query-service-client.js';

let server;

async function bootstrap() {
  const config = loadConfig();

  const app = createApp({
    config,
    services: {
      llm: createLlmClient(config),
      queryService: createQueryServiceClient(config)
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

bootstrap().catch((error) => {
  console.error(`[ai-query-service] startup failed: ${error.message}`);
  process.exit(1);
});
