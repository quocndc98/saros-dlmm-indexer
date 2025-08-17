import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema({ timestamps: true })
export class SwapEvent extends Document {
  @Prop({ required: true })
  signature: string

  @Prop({ required: true })
  slot: number

  @Prop({ required: true })
  blockTime: Date

  @Prop({ required: true })
  pair: string

  @Prop({ required: true })
  user: string

  @Prop({ required: true })
  swapForY: boolean

  @Prop({ required: true })
  binId: number

  @Prop({ required: true })
  amountIn: string

  @Prop({ required: true })
  amountOut: string

  @Prop({ required: true })
  fee: string

  @Prop({ required: true })
  protocolFee: string

  @Prop({ required: true })
  volatilityAccumulator: number
}

export const SwapEventSchema = SchemaFactory.createForClass(SwapEvent)
