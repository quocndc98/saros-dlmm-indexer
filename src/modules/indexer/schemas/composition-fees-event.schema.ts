import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema({ timestamps: true })
export class CompositionFeesEvent extends Document {
  @Prop({ required: true })
  signature: string

  @Prop({ required: true })
  slot: number

  @Prop({ required: true })
  blockTime: Date

  @Prop({ required: true })
  pair: string

  @Prop({ required: true })
  user: string

  @Prop({ required: true })
  totalFeesX: string

  @Prop({ required: true })
  totalFeesY: string

  @Prop({ type: [Number], required: true })
  binIds: number[]

  @Prop({ type: [String], required: true })
  feesX: string[]

  @Prop({ type: [String], required: true })
  feesY: string[]
}

export const CompositionFeesEventSchema = SchemaFactory.createForClass(CompositionFeesEvent)
