import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import { BinStepConfigStatus, ConfigAvailability } from '../types/enums'

export type BinStepConfigDocument = BinStepConfig & Document

@Schema({ timestamps: true })
export class BinStepConfig {
  @Prop({ required: true, unique: true })
  id: string

  @Prop({ required: true })
  liquidityBookConfig: string

  @Prop({ required: true, default: BinStepConfigStatus.Active })
  status: BinStepConfigStatus

  @Prop({ required: true })
  availability: ConfigAvailability

  @Prop({ required: true })
  binStep: number

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
}

export const BinStepConfigSchema = SchemaFactory.createForClass(BinStepConfig)
