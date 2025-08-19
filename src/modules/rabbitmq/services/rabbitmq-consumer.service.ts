import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';
import { RabbitMQQueue } from '../types/enums';

@Injectable()
export class RabbitMQConsumerService implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQConsumerService.name);

  constructor(private readonly rabbitMQService: RabbitMQService) {}

    async onModuleInit() {
    await this.rabbitMQService.consume(RabbitMQQueue.TEST_QUEUE, (message) => {
      this.handleTestQueueMessage(message);
    });
    // TODO: Add more queue consumers if needed
    this.logger.log(`RabbitMQ consumer started for ${RabbitMQQueue.TEST_QUEUE}`);
  }

  private handleTestQueueMessage(message: any) {
    try {
      const parsedMessage = this.parseMessage(message);
      this.logger.log('Parsed message:', parsedMessage);
      // TODO: Process the parsed message
    } catch (error) {
      this.logger.error('Error processing RabbitMQ message:', error);
    }
  }

  private parseMessage(message: any): any {
    if (Buffer.isBuffer(message)) {
      return JSON.parse(message.toString('utf8'));
    } else if (message?.type === 'Buffer' && Array.isArray(message.data)) {
      return JSON.parse(Buffer.from(message.data).toString('utf8'));
    } else if (typeof message === 'string') {
      return JSON.parse(message);
    } else {
      return message;
    }
  }
}