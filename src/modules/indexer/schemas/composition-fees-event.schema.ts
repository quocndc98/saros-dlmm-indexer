import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema({ collection: 'composition_fees_events', timestamps: true })
export class CompositionFeesEvent extends Document {
  @Prop({ required: true })
  signature: string

  @Prop({ required: true })
  slot: number

  @Prop({ required: true })
  block_time: Date

  @Prop({ required: true })
  pair: string

  @Prop({ required: true })
  user: string

  @Prop({ required: true })
  total_fees_x: string

  @Prop({ required: true })
  total_fees_y: string

  @Prop({ type: [Number], required: true })
  bin_ids: number[]

  @Prop({ type: [String], required: true })
  fees_x: string[]

  @Prop({ type: [String], required: true })
  fees_y: string[]

  @Prop({ default: Date.now })
  created_at: Date

  @Prop({ default: Date.now })
  updated_at: Date
}

export const CompositionFeesEventSchema = SchemaFactory.createForClass(CompositionFeesEvent)
