import { createApp } from './app.js';
import { loadConfig } from './config.js';

try {
  const config = loadConfig();
  const app = createApp(config);

  app.listen(config.port, () => {
    console.log(`[${config.serviceName}] listening on port ${config.port}`);
  });
} catch (error) {
  console.error(`[indexer-service] startup failed: ${error.message}`);
  process.exit(1);
}
