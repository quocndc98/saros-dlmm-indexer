import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import { SwapType } from '../types/enums'

export type SwapEventDocument = SwapEvent & Document

@Schema({ timestamps: true })
export class SwapEvent {
  @Prop({ required: true, unique: true })
  id: string // Format `<blockNumber>-<signature>-<instructionIndex>-<innerInstructionIndex>-<binId>`

  @Prop({ required: true })
  pairId: string

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
  blockNumber: number

  @Prop({ required: true })
  signature: string

  @Prop({ required: true })
  index: number

  @Prop({ required: true })
  isInner: boolean

  @Prop({ default: -1 })
  innerIndex?: number

  @Prop()
  blockTime?: Date | null
}

export const SwapEventSchema = SchemaFactory.createForClass(SwapEvent)

// TODO: Add indexes
