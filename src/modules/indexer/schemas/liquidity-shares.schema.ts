import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type LiquiditySharesDocument = LiquidityShares & Document

@Schema({
  timestamps: true, // Automatically adds createdAt and updatedAt
})
export class LiquidityShares {
  @Prop({ 
    type: String, 
    required: true, 
    unique: true,
  })
  id: string // Primary key (format: {position_id}-{index})

  @Prop({ 
    type: String, 
    required: true,
    index: true
  })
  positionId: string // Position ID (renamed from position_id to match TypeScript conventions)

  @Prop({ 
    type: Number, 
    required: true,
  })
  index: number // Liquidity share index (i32 in Rust)

  @Prop({ 
    type: String, 
    required: true,
    default: '0' 
  })
  balance: string // Balance as string (BigDecimal equivalent in Rust)
}

export const LiquiditySharesSchema = SchemaFactory.createForClass(LiquidityShares)
