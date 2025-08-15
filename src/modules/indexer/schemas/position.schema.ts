import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema({ collection: 'positions', timestamps: true })
export class Position extends Document {
  @Prop({ required: true, unique: true })
  position_mint: string

  @Prop({ required: true })
  pair: string

  @Prop({ required: true })
  owner: string

  @Prop({ required: true })
  lower_bin_id: number

  @Prop({ required: true })
  upper_bin_id: number

  @Prop({ type: [String], required: true })
  liquidity_shares: string[]

  @Prop({ default: Date.now })
  created_at: Date

  @Prop({ default: Date.now })
  updated_at: Date
}

export const PositionSchema = SchemaFactory.createForClass(Position)
