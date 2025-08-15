export type AuthJwtPayload = {
  id: string
  role?: string
}

export type AuthOnchainPayload = {
  walletAddress: `0x${string}`
}
