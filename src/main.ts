import { Server } from 'http'
import { Logger } from '@nestjs/common'
import { env } from '@/lib'
import { bootstrap } from './openapi'

async function run() {
  const { app } = await bootstrap()

  const port = env('PORT', '3000')
  const host = env('HOST', '0.0.0.0')
  app.listen(port, host).then((server: Server) => {
    server.headersTimeout = 60 * 1000
    server.keepAliveTimeout = 61 * 1000
    Logger.log(`Server listening at http://${host}:${port}`)
  })
}
run()
