import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema({ collection: 'transaction_events', timestamps: true })
export class TransactionEvent extends Document {
  @Prop({ required: true })
  signature: string

  @Prop({ required: true })
  slot: number

  @Prop({ required: true })
  block_time: Date

  @Prop({ required: true })
  is_successful: boolean

  @Prop({ type: Object })
  error_message?: any

  @Prop({ required: true })
  processed: boolean

  @Prop({ default: Date.now })
  created_at: Date

  @Prop({ default: Date.now })
  updated_at: Date
}

export const TransactionEventSchema = SchemaFactory.createForClass(TransactionEvent)
