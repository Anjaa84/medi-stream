import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'MONGODB_URI',
  'KAFKA_BROKERS',
  'KAFKA_CLIENT_ID',
  'KAFKA_TOPIC_PATIENT_EVENTS',
  'KAFKA_TOPIC_DLQ'
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

  const kafkaBrokers = process.env.KAFKA_BROKERS.split(',').map((v) => v.trim()).filter(Boolean);
  if (kafkaBrokers.length === 0) {
    throw new Error('KAFKA_BROKERS must include at least one broker');
  }

  return {
    serviceName: 'patient-api',
    nodeEnv: process.env.NODE_ENV,
    port,
    mongodbUri: process.env.MONGODB_URI,
    kafkaBrokers,
    kafkaClientId: process.env.KAFKA_CLIENT_ID,
    kafkaTopicPatientEvents: process.env.KAFKA_TOPIC_PATIENT_EVENTS,
    kafkaTopicDlq: process.env.KAFKA_TOPIC_DLQ
  };
}
