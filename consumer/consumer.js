const { Kafka } = require('kafkajs');
const log4js = require('log4js');

// Configure log4js for structured logging
log4js.configure({
  appenders: {
    console: {
      type: 'console',
      layout: {
        type: 'pattern',
        pattern: '%d{ISO8601} [%p] %c - %m'
      }
    },
    jsonConsole: {
      type: 'console',
      layout: {
        type: 'pattern',
        pattern: '%m'
      }
    }
  },
  categories: {
    default: { appenders: ['console'], level: 'info' },
    dbChanges: { appenders: ['jsonConsole'], level: 'info' }
  }
});

const logger = log4js.getLogger('default');
const dbChangesLogger = log4js.getLogger('dbChanges');

// Kafka configuration
const kafka = new Kafka({
  clientId: 'cdc-consumer',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
  retry: {
    initialRetryTime: 300,
    retries: 10
  }
});

const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || 'cdc-consumer-group',
  sessionTimeout: 30000,
  heartbeatInterval: 3000
});

async function processMessage(message) {
  try {
    const value = message.value.toString();
    const cdcEvent = JSON.parse(value);

    // Canal-JSON format contains database change events
    if (cdcEvent.data && Array.isArray(cdcEvent.data)) {
      for (const change of cdcEvent.data) {
        const logEntry = {
          timestamp: new Date().toISOString(),
          database: cdcEvent.database || 'unknown',
          table: cdcEvent.table || 'unknown',
          eventType: cdcEvent.type || 'unknown',
          data: change,
          old: cdcEvent.old && cdcEvent.old[0] ? cdcEvent.old[0] : null
        };

        // Log database change in structured JSON format
        dbChangesLogger.info(JSON.stringify(logEntry));

        // Also log in human-readable format for debugging
        logger.info(`Database Change - ${logEntry.eventType} on ${logEntry.database}.${logEntry.table}`);
      }
    } else {
      // Log raw event if format is different
      const logEntry = {
        timestamp: new Date().toISOString(),
        eventType: 'raw_cdc_event',
        data: cdcEvent
      };
      dbChangesLogger.info(JSON.stringify(logEntry));
    }
  } catch (error) {
    logger.error('Error processing message:', error);
    logger.error('Raw message:', message.value.toString());
  }
}

async function run() {
  try {
    logger.info('Starting CDC Consumer...');
    logger.info(`Kafka Broker: ${process.env.KAFKA_BROKER || 'kafka:9092'}`);
    logger.info(`Kafka Topic: ${process.env.KAFKA_TOPIC || 'tidb-changes'}`);

    await consumer.connect();
    logger.info('Connected to Kafka');

    await consumer.subscribe({
      topic: process.env.KAFKA_TOPIC || 'tidb-changes',
      fromBeginning: false
    });
    logger.info('Subscribed to topic');

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        await processMessage(message);
      },
    });

    logger.info('Consumer is running and waiting for messages...');
  } catch (error) {
    logger.error('Error in consumer:', error);
    setTimeout(() => {
      logger.info('Retrying connection...');
      run();
    }, 5000);
  }
}

// Handle graceful shutdown
const errorTypes = ['unhandledRejection', 'uncaughtException'];
const signalTraps = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

errorTypes.forEach(type => {
  process.on(type, async (error) => {
    try {
      logger.error(`Process ${type}:`, error);
      await consumer.disconnect();
      process.exit(1);
    } catch (_) {
      process.exit(1);
    }
  });
});

signalTraps.forEach(type => {
  process.once(type, async () => {
    try {
      logger.info(`Received ${type}, shutting down gracefully...`);
      await consumer.disconnect();
    } finally {
      process.exit(0);
    }
  });
});

// Start the consumer
run();
