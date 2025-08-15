import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema({ collection: 'bin_swap_events', timestamps: true })
export class BinSwapEvent extends Document {
  @Prop({ required: true })
  signature: string

  @Prop({ required: true })
  slot: number

  @Prop({ required: true })
  block_time: Date

  @Prop({ required: true })
  pair: string

  @Prop({ required: true })
  swap_for_y: boolean

  @Prop({ required: true })
  bin_id: number

  @Prop({ required: true })
  amount_in: string

  @Prop({ required: true })
  amount_out: string

  @Prop({ required: true })
  fee: string

  @Prop({ required: true })
  protocol_fee: string

  @Prop({ required: true })
  volatility_accumulator: number

  @Prop({ default: Date.now })
  created_at: Date

  @Prop({ default: Date.now })
  updated_at: Date
}

export const BinSwapEventSchema = SchemaFactory.createForClass(BinSwapEvent)
