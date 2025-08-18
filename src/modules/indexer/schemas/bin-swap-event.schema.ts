import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type BinSwapEventDocument = BinSwapEvent & Document

@Schema({ timestamps: true })
export class BinSwapEvent {
  @Prop({ required: true })
  id: string

  @Prop({ required: true, index: true })
  signature: string

  @Prop({ required: true, index: true })
  pairId: string

  @Prop({ required: true, index: true })
  binId: string

  @Prop({ required: true, index: true })
  lbBinId: number

  @Prop({ required: true })
  userVaultIn: string

  @Prop({ required: true })
  userVaultOut: string

  @Prop({ required: true })
  pairVaultIn: string

  @Prop({ required: true })
  pairVaultOut: string

  @Prop({ required: true })
  swapForY: boolean

  // All amounts stored as normalized strings (matching Rust BigDecimal)
  @Prop({ required: true })
  amountIn: string

  @Prop({ required: true })
  amountInNative: string

  @Prop({ required: true })
  amountInUsd: string

  @Prop({ required: true })
  amountOut: string

  @Prop({ required: true })
  amountOutNative: string

  @Prop({ required: true })
  amountOutUsd: string

  @Prop({ required: true })
  fees: string

  @Prop({ required: true })
  feesNative: string

  @Prop({ required: true })
  feesUsd: string

  @Prop({ required: true })
  protocolFees: string

  @Prop({ required: true })
  protocolFeesNative: string

  @Prop({ required: true })
  protocolFeesUsd: string

  @Prop({ required: true })
  volatilityAccumulator: number

  @Prop({ required: true })
  index: number

  @Prop({ required: true })
  innerIndex: number

  @Prop({ required: true })
  blockNumber: number

  @Prop({ required: true })
  blockTime: Date
}

export const BinSwapEventSchema = SchemaFactory.createForClass(BinSwapEvent)

// Create indexes for efficient queries (matching Rust constraints)
BinSwapEventSchema.index({ id: 1, chain: 1 }, { unique: true })
BinSwapEventSchema.index({ pairId: 1, blockNumber: -1 })
BinSwapEventSchema.index({ pairId: 1, lbBinId: 1, blockNumber: -1 })
BinSwapEventSchema.index({ signature: 1, index: 1 })
