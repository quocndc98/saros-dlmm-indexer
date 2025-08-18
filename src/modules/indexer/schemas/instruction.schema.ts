import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type InstructionDocument = Instruction & Document

@Schema({
  timestamps: true, // Automatically adds createdAt and updatedAt
})
export class Instruction {
  @Prop({ 
    type: String, 
    required: true, 
    unique: true,
  })
  id: string // Format: {blockNumber}-{signature}-{processorName}-{instructionIndex}-{innerIndex}

  @Prop({ 
    type: String, 
    required: true,
  })
  processorName: string // e.g., 'CreatePositionProcessor'

  @Prop({ 
    type: String, 
    required: true,
    index: true 
  })
  signature: string // Transaction signature

  @Prop({ 
    type: Number, 
    required: true,
  })
  index: number // Instruction index in transaction

  @Prop({ 
    type: Number, 
    required: false,
    default: null 
  })
  innerIndex: number | null // Inner instruction index (null if not inner)

  @Prop({ 
    type: Boolean, 
    required: true,
    default: false,
  })
  isInner: boolean // Whether this is an inner instruction

  @Prop({ 
    type: Number, 
    required: true,
  })
  blockNumber: number // Block number where instruction was executed

  @Prop({ 
    type: Date, 
    required: false,
    default: null,
  })
  blockTime: Date | null // Block timestamp
}

export const InstructionSchema = SchemaFactory.createForClass(Instruction)
