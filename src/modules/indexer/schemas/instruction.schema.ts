import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type InstructionDocument = Instruction & Document

@Schema({ timestamps: true })
export class Instruction {
  @Prop({ required: true, unique: true })
  id: string // Format: {blockNumber}-{signature}-{processorName}-{instructionIndex}-{innerIndex}

  @Prop({ required: true })
  processorName: string

  @Prop({ required: true })
  blockNumber: number

  @Prop({ required: true })
  signature: string

  @Prop({ required: true })
  index: number

  @Prop({ default: -1 })
  innerIndex?: number

  @Prop({ required: true })
  isInner: boolean

  @Prop()
  blockTime?: Date | null
}

export const InstructionSchema = SchemaFactory.createForClass(Instruction)
