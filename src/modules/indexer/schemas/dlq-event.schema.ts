import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema({ collection: 'dlq_events', timestamps: true })
export class DlqEvent extends Document {
  @Prop({ required: true })
  signature: string

  @Prop({ required: true })
  slot: number

  @Prop({ required: true })
  block_time: Date

  @Prop({ required: true })
  instruction_index: number

  @Prop({ required: true })
  instruction_name: string

  @Prop({ type: Object })
  instruction_data: any

  @Prop({ type: Object })
  error_message: any

  @Prop({ default: Date.now })
  created_at: Date

  @Prop({ default: Date.now })
  updated_at: Date
}

export const DlqEventSchema = SchemaFactory.createForClass(DlqEvent)
