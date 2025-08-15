import { Controller, Get, Post, Body } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger'
import { ScannerJobService } from '../jobs/scanner-job.service'
import { ConsumerJobService } from '../jobs/consumer-job.service'
import { ScannerService } from '../scanner/scanner.service'

@ApiTags('indexer')
@Controller('indexer')
export class IndexerController {
  constructor(
    private readonly scannerJobService: ScannerJobService,
    private readonly consumerJobService: ConsumerJobService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Get indexer status' })
  @ApiResponse({ status: 200, description: 'Indexer status retrieved successfully' })
  async getStatus() {
    const [scannerStatus, consumerStatus] = await Promise.all([
      this.scannerJobService.getStatus(),
      this.consumerJobService.getStatus(),
    ])

    return {
      scanner: scannerStatus,
      consumer: consumerStatus,
      timestamp: new Date().toISOString(),
    }
  }

  @Get('scanner/status')
  @ApiOperation({ summary: 'Get scanner status' })
  @ApiResponse({ status: 200, description: 'Scanner status retrieved successfully' })
  async getScannerStatus() {
    return await this.scannerJobService.getStatus()
  }

  @Get('consumer/status')
  @ApiOperation({ summary: 'Get consumer status' })
  @ApiResponse({ status: 200, description: 'Consumer status retrieved successfully' })
  async getConsumerStatus() {
    return await this.consumerJobService.getStatus()
  }
}
