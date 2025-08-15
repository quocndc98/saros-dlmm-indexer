const ENV = process.env.NODE_ENV
const CONFIG = {
  prod: {
    baseUrl: 'http://superlink-noti-api-prd.coin98.prd',
    projectId: '68709783f5cb11f7859e1087',
  },
  preprod: {
    baseUrl: 'http://superlink-notification-stg.coin98.stg',
    projectId: '687097375a2c0cf0b691edf8',
  },
  staging: {
    baseUrl: 'http://superlink-notification-stg.coin98.stg',
    projectId: '687097375a2c0cf0b691edf8',
  },
}

const { baseUrl, projectId } = CONFIG[ENV as keyof typeof CONFIG] || CONFIG.staging

export const sendAlert = async (message: string): Promise<void> => {
  const endpoint = `${baseUrl}/v1/api/projects/${projectId}/logs`
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ msg: message }),
    })

    if (!response.ok) {
      console.error(`Alert - Server responded with status ${response.status}`)
    }
  } catch (error) {
    console.error('Alert - Failed to send alert:', error)
  }
}
