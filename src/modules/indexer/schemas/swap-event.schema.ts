import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import { SwapType } from '../types/enums'

export type SwapEventDocument = SwapEvent & Document

@Schema({ timestamps: true })
export class SwapEvent {
  @Prop({ required: true, unique: true })
  id: string // Format `<blockNumber>-<signature>-<instructionIndex>-<innerInstructionIndex>-<binId>`

  @Prop({ required: true, index: true })
  pairId: string

  @Prop({ required: true, index: true })
  signature: string

  @Prop({ required: true })
  swapType: SwapType // ExactInput or ExactOutput

  @Prop({ required: true })
  tokenMintXId: string

  @Prop({ required: true })
  tokenMintYId: string

  @Prop({ required: true })
  binArrayLower: string

  @Prop({ required: true })
  binArrayUpper: string

  @Prop({ required: true })
  tokenVaultX: string

  @Prop({ required: true })
  tokenVaultY: string

  @Prop({ required: true })
  userVaultX: string

  @Prop({ required: true })
  userVaultY: string

  @Prop({ required: true })
  instructionIndex: number

  @Prop()
  innerInstructionIndex?: number

  @Prop({ required: true })
  isInner: boolean

  @Prop({ required: true })
  blockNumber: number

  @Prop()
  blockTime?: number
}

export const SwapEventSchema = SchemaFactory.createForClass(SwapEvent)

// Create indexes for efficient queries
SwapEventSchema.index({ id: 1 }, { unique: true })
SwapEventSchema.index({ pairId: 1, blockNumber: -1 })
SwapEventSchema.index({ signature: 1 })
