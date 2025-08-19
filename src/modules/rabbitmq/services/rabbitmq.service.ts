import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { connect, AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';
import { RabbitMQQueue } from '../types/enums';


@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: AmqpConnectionManager;
  private channel: ChannelWrapper;

  async onModuleInit() {
    const url = process.env.RMQ_URL || 'amqp://localhost:5672';
    this.connection = connect(url);
    this.channel = this.connection.createChannel({
      json: true,
      setup: async (channel: ConfirmChannel) => {
        await channel.assertQueue(RabbitMQQueue.TEST_QUEUE, { durable: true });
        // TODO: Add more queue setups if needed
      },
    });
    this.logger.log('RabbitMQ connection initialized');
  }

  async sendToQueue(queue: string, message: any) {
    await this.channel.sendToQueue(queue, message);
    this.logger.log(`Sent message to queue "${queue}"`);
  }

  async consume(queue: string, onMessage: (msg: any) => void) {
    await this.channel.addSetup(async (channel) => {
      await channel.consume(queue, (msg) => {
        if (msg !== null) {
          this.logger.log(`Received message from queue "${queue}"`);
          onMessage(msg.content);
          channel.ack(msg);
        }
      });
    });
    this.logger.log(`Started consuming queue "${queue}"`);
  }

  async onModuleDestroy() {
    await this.connection.close();
    this.logger.log('RabbitMQ connection closed');
  }
}