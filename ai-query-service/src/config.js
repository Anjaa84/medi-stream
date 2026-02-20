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

  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer');
  }

  const llmProvider = process.env.LLM_PROVIDER;
  if (!['openai', 'anthropic'].includes(llmProvider)) {
    throw new Error('LLM_PROVIDER must be either openai or anthropic');
  }

  if (llmProvider === 'openai' && !process.env.OPENAI_API_KEY) {
    throw new Error('Missing required environment variables: OPENAI_API_KEY');
  }

  if (llmProvider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('Missing required environment variables: ANTHROPIC_API_KEY');
  }

  return {
    serviceName: 'ai-query-service',
    nodeEnv: process.env.NODE_ENV,
    port,
    queryServiceUrl: process.env.QUERY_SERVICE_URL,
    llmProvider,
    openAiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openAiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
    llmModel:
      process.env.LLM_MODEL ||
      (llmProvider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-haiku-20241022')
  };
}
