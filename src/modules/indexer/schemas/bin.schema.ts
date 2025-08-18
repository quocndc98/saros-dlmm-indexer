import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type BinDocument = Bin & Document

@Schema({ timestamps: true })
export class Bin {
  @Prop({ required: true, unique: true })
  id: string // Format `<pairId>-<lbBinId>`

  @Prop({ required: true })
  lbBinId: number

  @Prop({ required: true, index: true })
  binArrayId: string

  @Prop({ required: true })
  pairId: string

  @Prop({ required: true })
  binArrayIndex: number

  @Prop({ required: true, default: '0' })
  totalSupply: string

  @Prop({ required: true, default: '0' })
  reserveX: string

  @Prop({ required: true, default: '0' })
  reserveY: string
}

export const BinSchema = SchemaFactory.createForClass(Bin)

// Create compound index for efficient queries
BinSchema.index({ pairId: 1, lbBinId: 1 })
