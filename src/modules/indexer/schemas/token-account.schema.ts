import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type TokenAccountDocument = TokenAccount & Document

@Schema({ timestamps: true })
export class TokenAccount {
  @Prop({ required: true, unique: true })
  id: string

  @Prop({ required: true, index: true })
  tokenMintId: string

  @Prop({ required: true, index: true })
  ownerId: string

  @Prop({ required: true, default: '0' })
  balance: string
}

export const TokenAccountSchema = SchemaFactory.createForClass(TokenAccount)
