import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type LiquiditySharesDocument = LiquidityShares & Document

@Schema({
  timestamps: true,
})
export class LiquidityShares {
  @Prop({ required: true, unique: true })
  id: string // Format: {positionId}-{index}

  @Prop({ required: true })
  positionId: string

  @Prop({ required: true })
  index: number

  @Prop({ default: '0' })
  balance: string
}

export const LiquiditySharesSchema = SchemaFactory.createForClass(LiquidityShares)

// TODO: Define indexes
