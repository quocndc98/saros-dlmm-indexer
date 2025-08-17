import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema({ timestamps: true })
export class PositionUpdateEvent extends Document {
  @Prop({ required: true })
  signature: string

  @Prop({ required: true })
  slot: number

  @Prop({ required: true })
  blockTime: Date

  @Prop({ required: true })
  positionMint: string

  @Prop({ required: true })
  pair: string

  @Prop({ required: true })
  user: string

  @Prop({ required: true })
  eventType: string // 'create', 'increase', 'decrease', 'close'

  @Prop({ type: [Number], default: [] })
  binIds: number[]

  @Prop({ type: [String], default: [] })
  amountsX: string[]

  @Prop({ type: [String], default: [] })
  amountsY: string[]

  @Prop({ type: [String], default: [] })
  liquidityShares: string[]
}

export const PositionUpdateEventSchema = SchemaFactory.createForClass(PositionUpdateEvent)
