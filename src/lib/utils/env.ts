export const env = (key: string, defaultValue?: string): string => {
  return process.env[key] ?? defaultValue
}

export const envAsBoolean = (key: string, defaultValue?: boolean) => {
  const value = env(key)
  if (value === 'true' || value === '1') {
    return true
  }
  if (value === 'false' || value === '0') {
    return false
  }
  if (defaultValue !== undefined) {
    return !!defaultValue
  }
  return false
}

export const envAsNumber = (key: string, defaultValue?: number) => {
  const value = env(key)
  if (!value) {
    return defaultValue
  }
  if (/^[0-9]+$/.test(value)) {
    return Number(value)
  }
  throw new Error(`Environment value for ${key} must be a number`)
}

export const envOrThrow = (key: string) => {
  const value = env(key, null)
  if (value === null) {
    throw new Error(`Missing value for environment variable: ${key}`)
  }
  return value
}
