import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema({ timestamps: true })
export class DlqEvent extends Document {
  @Prop({ required: true })
  blockNumber: number

  @Prop({ required: true })
  signature: string

  @Prop()
  blockTime?: Date | null

  @Prop({ required: true })
  instructionIndex: number

  @Prop({ required: true })
  instructionName: string

  @Prop({ type: Object })
  instructionData: any

  @Prop({ type: Object })
  errorMessage: any
}

export const DlqEventSchema = SchemaFactory.createForClass(DlqEvent)
