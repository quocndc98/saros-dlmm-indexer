import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'

@Schema({ timestamps: true })
export class Position {
  @Prop({ 
    type: String, 
    required: true, 
    unique: true,
  })
  id: string

  @Prop({ required: true })
  pairId: string

  @Prop({ required: true, unique: true })
  positionMintId: string

  @Prop({ required: true })
  ownerId: string

  @Prop({ required: true })
  lowerBinLbId: number

  @Prop({ required: true })
  upperBinLbId: number
}

export const PositionSchema = SchemaFactory.createForClass(Position)
