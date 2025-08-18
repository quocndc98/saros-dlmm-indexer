import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type CompositionFeesEventDocument = CompositionFeesEvent & Document

@Schema({ timestamps: true })
export class CompositionFeesEvent {
  @Prop({ required: true, index: true })
  id: string

  @Prop({ required: true, index: true })
  signature: string

  @Prop({ required: true, index: true })
  pairId: string

  @Prop({ required: true })
  binId: string

  @Prop({ required: true })
  lbBinId: number

  // Composition fees in raw amounts
  @Prop({ required: true, default: '0' })
  compositionFeesX: string

  @Prop({ required: true, default: '0' })
  compositionFeesXNative: string

  @Prop({ required: true, default: '0' })
  compositionFeesXUsd: string

  @Prop({ required: true, default: '0' })
  compositionFeesY: string

  @Prop({ required: true, default: '0' })
  compositionFeesYNative: string

  @Prop({ required: true, default: '0' })
  compositionFeesYUsd: string

  // Protocol fees in raw amounts
  @Prop({ required: true, default: '0' })
  protocolFeesX: string

  @Prop({ required: true, default: '0' })
  protocolFeesXNative: string

  @Prop({ required: true, default: '0' })
  protocolFeesXUsd: string

  @Prop({ required: true, default: '0' })
  protocolFeesY: string

  @Prop({ required: true, default: '0' })
  protocolFeesYNative: string

  @Prop({ required: true, default: '0' })
  protocolFeesYUsd: string

  // Block and instruction info
  @Prop({ required: true, index: true })
  blockNumber: number

  @Prop()
  blockTime?: number

  @Prop({ required: true })
  instructionIndex: number

  @Prop()
  innerInstructionIndex?: number
}

export const CompositionFeesEventSchema = SchemaFactory.createForClass(CompositionFeesEvent)

// Create compound indexes for efficient queries
CompositionFeesEventSchema.index({ id: 1 }, { unique: true })
CompositionFeesEventSchema.index({ pairId: 1, blockNumber: -1 })
CompositionFeesEventSchema.index({ transactionSignature: 1 })
