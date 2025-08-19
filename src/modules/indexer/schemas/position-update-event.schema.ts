import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type PositionUpdateEventDocument = PositionUpdateEvent & Document

@Schema({ timestamps: true })
export class PositionUpdateEvent {
  @Prop({ required: true, unique: true })
  id: string

  @Prop({ required: true })
  pairId: string

  @Prop({ required: true })
  positionId: string

  @Prop({ required: true })
  binId: string

  @Prop({ required: true })
  lbBinId: number

  @Prop({ required: true })
  deltaLiquidityBalance: string // BigDecimal as string

  @Prop({ required: true })
  deltaAmountX: string // BigDecimal as string

  @Prop({ required: true })
  deltaAmountY: string // BigDecimal as string

  @Prop({ required: true })
  blockNumber: number

  @Prop({ required: true })
  signature: string

  @Prop({ required: true })
  index: number // instruction_index

  @Prop({ default: -1 })
  innerIndex: number

  @Prop({ required: true })
  blockTime: Date
}

export const PositionUpdateEventSchema = SchemaFactory.createForClass(PositionUpdateEvent)
