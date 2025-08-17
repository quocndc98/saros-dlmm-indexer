import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema({ timestamps: true })
export class QuoteAsset extends Document {
  @Prop({ required: true, unique: true })
  mint: string

  @Prop({ required: true })
  symbol: string

  @Prop({ required: true })
  name: string

  @Prop({ required: true })
  decimals: number

  @Prop({ required: true, default: 0 })
  priceUsd: number
}

export const QuoteAssetSchema = SchemaFactory.createForClass(QuoteAsset)
