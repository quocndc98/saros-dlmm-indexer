import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type TokenMintDocument = TokenMint & Document

@Schema({ timestamps: true })
export class TokenMint {
  @Prop({ required: true, unique: true })
  id: string

  @Prop({ required: true })
  supply: string

  @Prop({ required: true })
  decimals: number

  @Prop({ required: true })
  name: string

  @Prop({ required: true })
  symbol: string
}

export const TokenMintSchema = SchemaFactory.createForClass(TokenMint)
