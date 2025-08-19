import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type TokenMintDocument = TokenMint & Document

@Schema({ timestamps: true })
export class TokenMint {
  @Prop({ required: true, unique: true })
  id: string

  @Prop({})
  supply: string

  @Prop({})
  decimals: number

  @Prop({})
  name: string

  @Prop({})
  symbol: string
}

export const TokenMintSchema = SchemaFactory.createForClass(TokenMint)
