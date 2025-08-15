import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Job } from 'bullmq'
import { BaseProcessor } from './base.processor'
import { DlqEvent } from '../schemas/dlq-event.schema'

@Injectable()
export class DlqProcessor extends BaseProcessor {
  constructor(
    @InjectModel(DlqEvent.name)
    private readonly dlqEventModel: Model<DlqEvent>,
  ) {
    super('DlqProcessor')
  }

  async process(job: Job): Promise<void> {
    this.logJobStart(job)

    try {
      const instruction = job.data
      const {
        signature,
        slot,
        blockTime,
        instructionIndex,
        instructionName,
        instructionData,
        errorMessage
      } = instruction

      // Save failed instruction to DLQ
      const dlqEvent = new this.dlqEventModel({
        signature,
        slot,
        block_time: new Date(blockTime * 1000),
        instruction_index: instructionIndex,
        instruction_name: instructionName,
        instruction_data: instructionData,
        error_message: errorMessage,
      })

      await dlqEvent.save()

      this.logger.warn(`Added instruction to DLQ: ${instructionName} from transaction ${signature}`)
      this.logJobComplete(job)
    } catch (error) {
      await this.handleError(error, `processing DLQ instruction`)
    }
  }
}
