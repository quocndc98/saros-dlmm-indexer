import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type TokenAccountDocument = TokenAccount & Document

@Schema({
    timestamps: true, // Automatically adds createdAt and updatedAt
})
export class TokenAccount {
  @Prop({ 
    type: String, 
    required: true, 
    unique: true,
  })
  id: string // Token account public key (primary key)

  @Prop({ 
    type: String, 
    required: true,
    index: true
  })
  tokenMintId: string // Token mint public key (renamed from mint to match Rust)

  @Prop({ 
    type: String, 
    required: true,
    index: true
  })
  ownerId: string // Current owner of the token account (renamed from owner to match Rust)

  @Prop({ 
    type: String, 
    required: true,
    default: '0' 
  })
  balance: string // Token balance as string (BigDecimal equivalent, renamed from amount)
}

export const TokenAccountSchema = SchemaFactory.createForClass(TokenAccount)