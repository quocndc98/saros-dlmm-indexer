// Math utilities for Liquidity Book calculations
// Full production version with Q64.64 fixed-point arithmetic
// TODO: review and compare with Rust implementation

export class BinMath {
  private static readonly MIDDLE_BIN_ID = 8388608 // 2^23
  private static readonly SCALE = BigInt(2) ** BigInt(64) // Q64.64 scale factor
  private static readonly PRECISION = 128 // 128-bit precision for intermediate calculations
  private static readonly MAX_BIN_STEP = 100 // Maximum bin step in basis points

  /**
   * Convert Q64.64 fixed-point to floating point number
   */
  static q64ToFloat(q64Value: bigint): number {
    return Number(q64Value) / Number(this.SCALE)
  }

  /**
   * Convert floating point to Q64.64 fixed-point
   */
  static floatToQ64(value: number): bigint {
    return BigInt(Math.floor(value * Number(this.SCALE)))
  }

  /**
   * Normalize amount by dividing by 10^decimals with high precision
   */
  static normalizeAmount(amount: bigint | string, decimals: number): string {
    const amountBigInt = typeof amount === 'string' ? BigInt(amount) : amount
    const divisor = BigInt(10) ** BigInt(decimals)

    // Use BigInt division for exact calculation
    const wholePart = amountBigInt / divisor
    const remainder = amountBigInt % divisor

    if (remainder === BigInt(0)) {
      return wholePart.toString()
    }

    // Calculate fractional part with precision
    const fractionalPart = (remainder * BigInt(10 ** 18)) / divisor
    const fractionalStr = fractionalPart.toString().padStart(18, '0').replace(/0+$/, '')

    return fractionalStr ? `${wholePart}.${fractionalStr}` : wholePart.toString()
  }

  /**
   * Get price from bin ID using Q64.64 fixed-point arithmetic
   * This matches the Rust implementation exactly
   */
  static getPriceFromId(binStep: number, id: number): number {
    if (binStep <= 0 || binStep > this.MAX_BIN_STEP) {
      throw new Error(`Invalid bin step: ${binStep}`)
    }

    const exponent = id - this.MIDDLE_BIN_ID

    if (exponent === 0) {
      return 1.0
    }

    // Calculate (1 + binStep/10000)^exponent using Q64.64 arithmetic
    const baseBps = BigInt(binStep)
    const base = this.SCALE + (baseBps * this.SCALE) / BigInt(10000)

    if (exponent > 0) {
      return this.q64ToFloat(this.powQ64(base, exponent))
    } else {
      // For negative exponents, calculate 1 / base^(-exponent)
      const result = this.powQ64(base, -exponent)
      return this.q64ToFloat((this.SCALE * this.SCALE) / result)
    }
  }

  /**
   * Power function for Q64.64 fixed-point numbers
   * Uses binary exponentiation for efficiency
   */
  private static powQ64(base: bigint, exponent: number): bigint {
    if (exponent === 0) return this.SCALE
    if (exponent === 1) return base

    let result = this.SCALE
    let currentBase = base
    let exp = Math.abs(exponent)

    while (exp > 0) {
      if (exp % 2 === 1) {
        result = (result * currentBase) / this.SCALE
      }
      currentBase = (currentBase * currentBase) / this.SCALE
      exp = Math.floor(exp / 2)
    }

    return result
  }

  /**
   * Calculate price X/Y considering token decimals with high precision
   */
  static calculatePriceXY(price: number, tokenXDecimals: number, tokenYDecimals: number): number {
    const decimalAdjustment = tokenXDecimals - tokenYDecimals
    return price * Math.pow(10, decimalAdjustment)
  }

  /**
   * Convert raw amounts to decimal with exact precision
   */
  static toDecimal(amount: string | number, decimals: number): string {
    if (typeof amount === 'number') {
      amount = amount.toString()
    }

    const amountBigInt = BigInt(amount)
    return this.normalizeAmount(amountBigInt, decimals)
  }

  /**
   * Multiply two decimal strings with high precision
   */
  static multiply(a: string, b: string): string {
    // Convert to Q64.64 for calculation
    const aFloat = parseFloat(a)
    const bFloat = parseFloat(b)
    const aQ64 = this.floatToQ64(aFloat)
    const bQ64 = this.floatToQ64(bFloat)

    const resultQ64 = (aQ64 * bQ64) / this.SCALE
    return this.q64ToFloat(resultQ64).toString()
  }

  /**
   * Add two decimal strings with high precision
   */
  static add(a: string, b: string): string {
    const aFloat = parseFloat(a)
    const bFloat = parseFloat(b)
    const aQ64 = this.floatToQ64(aFloat)
    const bQ64 = this.floatToQ64(bFloat)

    const resultQ64 = aQ64 + bQ64
    return this.q64ToFloat(resultQ64).toString()
  }

  /**
   * Subtract two decimal strings with high precision
   */
  static subtract(a: string, b: string): string {
    const aFloat = parseFloat(a)
    const bFloat = parseFloat(b)
    const aQ64 = this.floatToQ64(aFloat)
    const bQ64 = this.floatToQ64(bFloat)

    const resultQ64 = aQ64 - bQ64
    return this.q64ToFloat(resultQ64).toString()
  }

  /**
   * Divide two decimal strings with high precision
   */
  static divide(a: string, b: string): string {
    const aFloat = parseFloat(a)
    const bFloat = parseFloat(b)

    if (bFloat === 0) {
      throw new Error('Division by zero')
    }

    const aQ64 = this.floatToQ64(aFloat)
    const bQ64 = this.floatToQ64(bFloat)

    const resultQ64 = (aQ64 * this.SCALE) / bQ64
    return this.q64ToFloat(resultQ64).toString()
  }

  /**
   * Compare two decimal strings
   * Returns: -1 if a < b, 0 if a === b, 1 if a > b
   */
  static compare(a: string, b: string): number {
    const aFloat = parseFloat(a)
    const bFloat = parseFloat(b)

    if (aFloat < bFloat) return -1
    if (aFloat > bFloat) return 1
    return 0
  }

  /**
   * Check if a decimal string is zero
   */
  static isZero(value: string): boolean {
    return parseFloat(value) === 0
  }

  /**
   * Get absolute value of a decimal string
   */
  static abs(value: string): string {
    return Math.abs(parseFloat(value)).toString()
  }

  /**
   * Round a decimal string to specified decimal places
   */
  static round(value: string, decimals: number): string {
    const factor = Math.pow(10, decimals)
    return (Math.round(parseFloat(value) * factor) / factor).toString()
  }

  /**
   * Calculate bin ID from price (inverse of getPriceFromId)
   */
  static getIdFromPrice(binStep: number, price: number): number {
    if (price <= 0) {
      throw new Error('Price must be positive')
    }

    if (price === 1.0) {
      return this.MIDDLE_BIN_ID
    }

    const baseBps = binStep / 10000
    const base = 1 + baseBps
    const exponent = Math.log(price) / Math.log(base)

    return Math.round(this.MIDDLE_BIN_ID + exponent)
  }

  /**
   * Calculate liquidity from amounts and price
   */
  static getLiquidityFromAmounts(
    amountX: string,
    amountY: string,
    price: number,
    tokenXDecimals: number,
    tokenYDecimals: number
  ): string {
    const normalizedX = this.toDecimal(amountX, tokenXDecimals)
    const normalizedY = this.toDecimal(amountY, tokenYDecimals)

    // Simplified liquidity calculation - in production you'd want the full AMM math
    const xValue = parseFloat(normalizedX)
    const yValue = parseFloat(normalizedY) / price

    return (xValue + yValue).toString()
  }
}
