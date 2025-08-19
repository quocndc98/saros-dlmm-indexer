import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import { QuoteAssetStatus, QuoteAssetType } from '../types/enums'

@Schema({ timestamps: true })
export class QuoteAsset {
  @Prop({ required: true, unique: true })
  id: string

  @Prop({ required: true })
  tokenMintId: string

  @Prop({ required: true })
  status: QuoteAssetStatus

  @Prop({ required: true })
  assetType: QuoteAssetType
}

export const QuoteAssetSchema = SchemaFactory.createForClass(QuoteAsset)
