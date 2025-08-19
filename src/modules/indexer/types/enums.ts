export enum ConfigAvailability {
  Open = 'OPEN',
  Closed = 'CLOSED',
}

export enum BinStepConfigStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
}

export enum QuoteAssetStatus {
  Enabled = 'ENABLED',
  Disabled = 'DISABLED',
}

export enum QuoteAssetType {
  Native = 'NATIVE',
  Stable = 'STABLE',
  Other = 'OTHER',
}

export enum SwapType {
  ExactInput = 'EXACT_INPUT',
  ExactOutput = 'EXACT_OUTPUT',
}

export enum ProcessorName {
  CreatePositionProcessor = 'CreatePositionProcessor',
  ClosePositionProcessor = 'ClosePositionProcessor',
  SwapProcessor = 'SwapProcessor',
  QuoteAssetProcessor = 'QuoteAssetProcessor',
  CompositionFeesProcessor = 'CompositionFeesProcessor',
  DecreasePositionProcessor = 'DecreasePositionProcessor',
}
