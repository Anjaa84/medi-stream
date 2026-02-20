import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'QUERY_SERVICE_URL',
  'LLM_PROVIDER'
];

export function loadConfig() {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  const llmProvider = process.env.LLM_PROVIDER;
  if (llmProvider === 'openai' && !process.env.OPENAI_API_KEY) {
    throw new Error('Missing required environment variables: OPENAI_API_KEY');
  }

  if (llmProvider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('Missing required environment variables: ANTHROPIC_API_KEY');
  }

  return {
    serviceName: 'ai-query-service',
    nodeEnv: process.env.NODE_ENV,
    port: Number(process.env.PORT),
    queryServiceUrl: process.env.QUERY_SERVICE_URL,
    llmProvider,
    openAiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY
  };
}
