import { Kafka } from 'kafkajs';

export function createKafkaClient(config) {
  const kafka = new Kafka({
    clientId: `${config.kafkaClientId}-patient-api`,
    brokers: config.kafkaBrokers
  });

  const producer = kafka.producer({ allowAutoTopicCreation: true });
  const admin = kafka.admin();

  return {
    async connect() {
      await producer.connect();
      await admin.connect();
    },

    async disconnect() {
      await Promise.allSettled([producer.disconnect(), admin.disconnect()]);
    },

    async publishPatientEvent(event) {
      await producer.send({
        topic: config.kafkaTopicPatientEvents,
        messages: [
          {
            key: event.patientId,
            value: JSON.stringify(event),
            headers: {
              source: 'patient-api',
              version: '1'
            }
          }
        ]
      });
    },

    async checkHealth() {
      await admin.fetchTopicMetadata({ topics: [config.kafkaTopicPatientEvents] });
      return true;
    }
  };
}
