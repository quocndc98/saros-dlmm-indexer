import { Module } from '@nestjs/common';
import { RabbitMQService } from './services/rabbitmq.service';
import { RabbitMQConsumerService } from './services/rabbitmq-consumer.service';

@Module({
  providers: [RabbitMQService, RabbitMQConsumerService],
  exports: [RabbitMQService, RabbitMQConsumerService],
})
export class RabbitMQModule {}