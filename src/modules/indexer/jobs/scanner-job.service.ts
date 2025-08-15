import { Injectable, Inject } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { indexerConfig } from '../config/indexer.config'
import { ScannerService } from '../scanner/scanner.service'
import { Logger } from '@/lib'
import { envAsBoolean } from '@/lib'

@Injectable()
export class ScannerJobService {
  private readonly logger: Logger = new Logger(ScannerJobService.name)
  private isRunning = false

  constructor(
    @Inject(indexerConfig.KEY)
    private readonly config: ConfigType<typeof indexerConfig>,
    private readonly scannerService: ScannerService,
  ) {}

  // Manual trigger only - no cron job
  async runScanner() {
    // Check environment variable
    const enableScanner = envAsBoolean('ENABLE_SCANNER', true)
    if (!enableScanner) {
      this.logger.debug('Scanner disabled via ENABLE_SCANNER env variable')
      return false
    }

    if (this.isRunning) {
      this.logger.debug('Scanner already running, skipping...')
      return false
    }

    this.isRunning = true
    this.logger.debug('Starting scanner job')

    try {
      await this.scannerService.startScanning()
      return true
    } catch (error) {
      this.logger.error('Scanner job error:', error)
      return false
    } finally {
      this.isRunning = false
    }
  }

  async getStatus() {
    const enableScanner = envAsBoolean('ENABLE_SCANNER', true)
    return {
      isEnabled: enableScanner,
      isEnabledInConfig: this.config.enableScanner,
      isRunning: this.isRunning,
      scannerStatus: await this.scannerService.getStatus(),
    }
  }
}
