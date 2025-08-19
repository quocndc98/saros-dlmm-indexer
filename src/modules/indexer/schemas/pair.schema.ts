import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type PairDocument = Pair & Document

@Schema({ timestamps: true })
export class Pair {
  @Prop({ required: true, unique: true })
  id: string

  @Prop({ required: true })
  binStep: number

  @Prop({ required: true })
  activeId: number

  @Prop({ required: true })
  liquidityBookConfig: string

  @Prop({ required: true })
  binStepConfigId: string

  @Prop({ required: true })
  tokenMintXId: string

  @Prop({ required: true })
  tokenMintYId: string

  @Prop({ required: true })
  quoteAssetId: string

  @Prop({ required: true })
  name: string

  @Prop({ required: true })
  symbol: string

  @Prop({ required: true })
  baseFactor: number

  @Prop({ required: true })
  filterPeriod: number

  @Prop({ required: true })
  decayPeriod: number

  @Prop({ required: true })
  reductionFactor: number

  @Prop({ required: true })
  variableFeeControl: number

  @Prop({ required: true })
  maxVolatilityAccumulator: number

  @Prop({ required: true })
  protocolShare: number

  @Prop({ default: 0 })
  volatilityAccumulator: number

  @Prop({ default: 0 })
  volatilityReference: number

  @Prop({ default: 0 })
  idReference: number

  @Prop({ default: 0 })
  timeLastUpdated: number

  @Prop({ default: 0 })
  protocolFeesX: string

  @Prop({ default: 0 })
  protocolFeesY: string

  @Prop({ default: 0 })
  reserveX: string

  @Prop({ default: 0 })
  reserveY: string
}

export const PairSchema = SchemaFactory.createForClass(Pair)

// TODO: Define indexes
