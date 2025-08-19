import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema({ timestamps: true })
export class TransactionEvent extends Document {
  @Prop({ required: true })
  blockNumber: number

  @Prop({ required: true })
  signature: string

  @Prop()
  blockTime?: Date | null

  @Prop({ required: true })
  processed: boolean

  @Prop({ default: false })
  queued: boolean
}

export const TransactionEventSchema = SchemaFactory.createForClass(TransactionEvent)
