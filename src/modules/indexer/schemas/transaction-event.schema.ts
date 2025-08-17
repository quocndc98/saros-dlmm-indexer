import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema({ timestamps: true })
export class TransactionEvent extends Document {
  @Prop({ required: true })
  signature: string

  @Prop({ required: true })
  slot: number

  @Prop({ required: true })
  blockTime: Date

  @Prop({ required: true })
  isSuccessful: boolean

  @Prop({ type: Object })
  errorMessage?: any

  @Prop({ required: true })
  processed: boolean

  @Prop({ default: false })
  queued: boolean

  @Prop({ default: Date.now })
  createdAt: Date

  @Prop({ default: Date.now })
  updatedAt: Date
}

export const TransactionEventSchema = SchemaFactory.createForClass(TransactionEvent)
