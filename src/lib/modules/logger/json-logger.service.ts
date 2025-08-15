import { LogLevel } from '@nestjs/common'
import pino, { Level } from 'pino'

export class JsonLogger {
  private logger: pino.Logger
  protected context?: string

  constructor(context?: string) {
    this.logger = pino({
      customLevels: {
        fatal: 60,
        error: 50,
        warn: 40,
        info: 30,
        debug: 20,
        verbose: 10,
      },
      formatters: {
        level(label, _number) {
          return { level: label }
        },
      },
      level: 'info',
    })

    if (context) {
      this.setContext(context)
    }
  }

  setContext(context: string) {
    this.context = context
  }

  public printStackTrace(stack: string) {
    if (!stack) {
      return
    }
    const err = new Error()
    err.stack = stack
    return this.logger.error({ err })
  }

  public printMessages(messages: unknown[], context = '', logLevel: LogLevel = 'log') {
    const level = this.getPinoLogLevel(logLevel)
    context = context?.length > 0 ? context : this.context
    messages.forEach((msg) => {
      this.logger[level]({ msg, context })
    })
  }

  private getPinoLogLevel(level: LogLevel) {
    const logLevelMapping: Record<LogLevel, Level> = {
      verbose: 'trace',
      debug: 'debug',
      log: 'info',
      warn: 'warn',
      error: 'error',
      fatal: 'fatal',
    }
    return logLevelMapping[level]
  }
}
