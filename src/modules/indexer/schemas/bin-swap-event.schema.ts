import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type BinSwapEventDocument = BinSwapEvent & Document

@Schema({ timestamps: true })
export class BinSwapEvent {
  @Prop({ unique: true })
  id: string // Format `{blockNumber}-{signature}-{instructionIndex}-{innerIndex}-{pairId}-{binId}`

  @Prop({ required: true })
  pairId: string

  @Prop({ required: true })
  binId: string // Format `{pairId}-{lbBinId}`

  @Prop({ required: true })
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

export const BinSwapEventSchema = SchemaFactory.createForClass(BinSwapEvent)

// TODO: Define indexes
