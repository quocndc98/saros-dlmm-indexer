import { ConsoleLogger, Injectable, LogLevel, Optional } from '@nestjs/common'
import { envAsBoolean } from '../../utils'
import { JsonLogger } from './json-logger.service'

@Injectable()
export class Logger extends ConsoleLogger {
  protected jsonLogger: JsonLogger
  constructor()
  constructor(context: string)
  constructor(context: string, options?: { timestamp?: boolean })
  constructor(
    @Optional() protected context?: string,
    @Optional() protected options: { timestamp?: boolean } = {},
  ) {
    super(context, options)
    const json = envAsBoolean('LOGGER_JSON', true)
    if (json) {
      this.jsonLogger = new JsonLogger(context)
    }
  }

  protected printMessages(
    messages: unknown[],
    context = '',
    logLevel: LogLevel = 'log',
    writeStreamType?: 'stdout' | 'stderr',
  ) {
    if (!this.jsonLogger) {
      return super.printMessages(messages, context, logLevel, writeStreamType)
    }
    return this.jsonLogger.printMessages(messages, context, logLevel)
  }

  protected printStackTrace(stack: string) {
    if (!this.jsonLogger) {
      return super.printStackTrace(stack)
    }
    return this.jsonLogger.printStackTrace(stack)
  }
}
