import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'ELASTICSEARCH_URL',
  'ELASTICSEARCH_INDEX'
];

export function loadConfig() {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer');
  }

  return {
    serviceName: 'query-service',
    nodeEnv: process.env.NODE_ENV,
    port,
    elasticsearchUrl: process.env.ELASTICSEARCH_URL,
    elasticsearchIndex: process.env.ELASTICSEARCH_INDEX
  };
}
