import bs58 from 'bs58'
import { BN, BorshCoder } from '@coral-xyz/anchor'
import { LiquidityBookIdl } from './liquidity-book.idl'
import { PublicKey, Connection } from '@solana/web3.js'
import { IdlInstruction } from '@coral-xyz/anchor/dist/cjs/idl'
import { BinArray, IdlAccountName, Pair, Position } from './liquidity-book.type'

export const coder = new BorshCoder(LiquidityBookIdl)

export class LiquidityBookLibrary {
  static decodePairAccount(data: Buffer) {
    return coder.accounts.decode<Pair>('Pair', data)
  }

  static decodePositionAccount(data: Buffer) {
    return coder.accounts.decode<Position>('Position', data)
  }

  static decodeBinArrayAccount(data: Buffer) {
    return coder.accounts.decode<BinArray>('BinArray', data)
  }

  /**
   * @param data instruction data base58 encoded
   */
  static decodeInstruction(data: string) {
    const dataBuffer = Buffer.from(bs58.decode(data))
    const discriminator = dataBuffer.subarray(0, 8)
    const idlIx = LiquidityBookIdl.instructions.find((ix: any) =>
      Buffer.from(ix.discriminator).equals(discriminator),
    )
    if (!idlIx) return null

    return {
      idlIx,
      decodedIx: coder.instruction.decode(data, 'base58'),
    }
  }

  static decodeType<T>(name: string, data: Buffer) {
    const type = LiquidityBookIdl.types.find((type) => type.name === name)
    if (!type) return null

    return coder.types.decode<T>(type.name, data)
  }


  static getAccountsByName<T extends IdlInstruction, N extends IdlAccountName<T>>(
    idlIx: T,
    ixAccounts: Array<PublicKey>,
    accountNames: N[],
  ): { [K in N]: PublicKey | null } {
    return accountNames.reduce(
      (result, accountName) => {
        const idx = idlIx.accounts.findIndex((acc: any) => acc.name === accountName)
        result[accountName] = idx !== -1 ? ixAccounts[idx] : null
        return result
      },
      {} as { [K in N]: PublicKey | null },
    )
  }

  static getIdlInstructionByDiscriminator(discriminator: Buffer): IdlInstruction | null {
    return LiquidityBookIdl.instructions.find((ix) =>
      discriminator.equals(Buffer.from(ix.discriminator)),
    )
  }

  static getIdlInstructionByName(name: string): IdlInstruction | null {
    return LiquidityBookIdl.instructions.find((ix) => ix.name === name)
  }

  static getInstructionName(data: string): string | null {
    const dataBuffer = Buffer.from(bs58.decode(data))
    const discriminator = dataBuffer.subarray(0, 8)
    const idlIx = LiquidityBookIdl.instructions.find((ix) =>
      Buffer.from(ix.discriminator).equals(discriminator),
    )
    return idlIx ? idlIx.name : null
  }

  // @notice data should be full event data including event identifier
  static getEventName(data: string): string | null {
    const dataBuffer = Buffer.from(bs58.decode(data))
    // Skip event identifier (first 8 bytes), get discriminator from next 8 bytes
    const discriminator = dataBuffer.subarray(8, 16)
    const event = LiquidityBookIdl.events.find((ix) =>
      Buffer.from(ix.discriminator).equals(discriminator),
    )
    if (!event) return null
    return event.name
  }


}
