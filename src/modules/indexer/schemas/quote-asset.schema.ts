import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema({ collection: 'quote_assets', timestamps: true })
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
  price_usd: number

  @Prop({ default: Date.now })
  created_at: Date

  @Prop({ default: Date.now })
  updated_at: Date
}

export const QuoteAssetSchema = SchemaFactory.createForClass(QuoteAsset)
