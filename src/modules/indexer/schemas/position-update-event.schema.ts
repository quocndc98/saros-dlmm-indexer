import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema({ collection: 'position_update_events', timestamps: true })
export class PositionUpdateEvent extends Document {
  @Prop({ required: true })
  signature: string

  @Prop({ required: true })
  slot: number

  @Prop({ required: true })
  block_time: Date

  @Prop({ required: true })
  position_mint: string

  @Prop({ required: true })
  pair: string

  @Prop({ required: true })
  user: string

  @Prop({ required: true })
  event_type: string // 'create', 'increase', 'decrease', 'close'

  @Prop({ type: [Number], default: [] })
  bin_ids: number[]

  @Prop({ type: [String], default: [] })
  amounts_x: string[]

  @Prop({ type: [String], default: [] })
  amounts_y: string[]

  @Prop({ type: [String], default: [] })
  liquidity_shares: string[]

  @Prop({ default: Date.now })
  created_at: Date

  @Prop({ default: Date.now })
  updated_at: Date
}

export const PositionUpdateEventSchema = SchemaFactory.createForClass(PositionUpdateEvent)
