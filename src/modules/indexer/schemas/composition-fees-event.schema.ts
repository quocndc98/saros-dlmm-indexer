import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type CompositionFeesEventDocument = CompositionFeesEvent & Document

@Schema({ timestamps: true })
export class CompositionFeesEvent {
  @Prop({ required: true, unique: true })
  id: string // Format `{blockNumber}-{signature}-{instructionIndex}-{pairId}-{lbBinId}`

  @Prop({ required: true })
  pairId: string

  @Prop({ required: true })
  binId: string // Format `{pairId}-{lbBinId}`

  @Prop({ required: true })
  lbBinId: number

  @Prop({ default: '0' })
  compositionFeesX: string

  @Prop({ default: '0' })
  compositionFeesXNative: string

  @Prop({ default: '0' })
  compositionFeesXUsd: string

  @Prop({ default: '0' })
  compositionFeesY: string

  @Prop({ default: '0' })
  compositionFeesYNative: string

  @Prop({ default: '0' })
  compositionFeesYUsd: string

  @Prop({ default: '0' })
  protocolFeesX: string

  @Prop({ default: '0' })
  protocolFeesXNative: string

  @Prop({ default: '0' })
  protocolFeesXUsd: string

  @Prop({ default: '0' })
  protocolFeesY: string

  @Prop({ default: '0' })
  protocolFeesYNative: string

  @Prop({ default: '0' })
  protocolFeesYUsd: string

  @Prop({ required: true })
  blockNumber: number

  @Prop({ required: true })
  signature: string

  @Prop({ required: true })
  index: number

  @Prop({ default: -1 })
  innerIndex?: number

  @Prop()
  blockTime?: Date | null
}

export const CompositionFeesEventSchema = SchemaFactory.createForClass(CompositionFeesEvent)

// TODO: Define indexes
