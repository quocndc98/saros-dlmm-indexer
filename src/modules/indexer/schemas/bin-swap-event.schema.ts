import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type BinSwapEventDocument = BinSwapEvent & Document

@Schema({ timestamps: true })
export class BinSwapEvent {
  @Prop({ required: true, index: true })
  pairId: string

  @Prop({ required: true, index: true })
  signature: string

  @Prop({ required: true })
  blockNumber: number

  @Prop({ required: true })
  instructionIndex: number

  @Prop()
  innerInstructionIndex?: number

  @Prop({ required: true })
  isInner: boolean

  @Prop()
  blockTime?: number

  @Prop({ required: true })
  swapForY: boolean

  @Prop({ required: true })
  protocolFee: string

  @Prop({ required: true, index: true })
  binId: number

  @Prop({ required: true })
  amountIn: string

  @Prop({ required: true })
  amountOut: string

  @Prop({ required: true })
  volatilityAccumulator: number

  @Prop({ required: true })
  fee: string

  @Prop()
  price?: string

  @Prop()
  priceXY?: string

  // Vault information (updated by swap instruction)
  @Prop()
  pairVaultIn?: string

  @Prop()
  pairVaultOut?: string

  @Prop()
  userVaultIn?: string

  @Prop()
  userVaultOut?: string

  @Prop()
  createdAt?: Date

  @Prop()
  updatedAt?: Date
}

export const BinSwapEventSchema = SchemaFactory.createForClass(BinSwapEvent)

// Create indexes for efficient queries
BinSwapEventSchema.index({ pairId: 1, blockNumber: -1 })
BinSwapEventSchema.index({ pairId: 1, binId: 1, blockNumber: -1 })
BinSwapEventSchema.index({ signature: 1, instructionIndex: 1 }, { unique: true })
