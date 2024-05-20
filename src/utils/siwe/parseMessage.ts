import type { Address } from 'abitype'

import type { ExactPartial } from '../../types/utils.js'
import type { Message } from './types.js'

/**
 * @description Parses EIP-4361 formated message into message fields object.
 */
export function parseMessage(message: string): ExactPartial<Message> {
  const { scheme, statement, ...prefix } = (message.match(prefixRegex)
    ?.groups ?? {}) as {
    address: Address
    domain: string
    scheme?: string
    statement?: string
  }
  const { chainId, expirationTime, issuedAt, notBefore, requestId, ...suffix } =
    (message.match(suffixRegex)?.groups ?? {}) as {
      chainId: string
      expirationTime?: string
      issuedAt?: string
      nonce: string
      notBefore?: string
      requestId?: string
      uri: string
      version: '1'
    }
  // TODO: Speed up
  const resources = message.split('Resources:')[1]?.split('\n- ').slice(1)
  return {
    ...prefix,
    ...suffix,
    ...(chainId ? { chainId: Number(chainId) } : {}),
    ...(expirationTime ? { expirationTime: new Date(expirationTime) } : {}),
    ...(issuedAt ? { issuedAt: new Date(issuedAt) } : {}),
    ...(notBefore ? { notBefore: new Date(notBefore) } : {}),
    ...(requestId ? { requestId } : {}),
    ...(resources ? { resources } : {}),
    ...(scheme ? { scheme } : {}),
    ...(statement ? { statement } : {}),
  }
}

// https://regexr.com/80gdj
const prefixRegex =
  /^(?:(?<scheme>[a-zA-Z][a-zA-Z0-9+-.]*):\/\/)?(?<domain>[a-zA-Z0-9+-.]*) (?:wants you to sign in with your Ethereum account:\n)(?<address>0x[a-fA-F0-9]{40})\n\n(?:(?<statement>.*)\n\n)?/

// https://regexr.com/80gf9
const suffixRegex =
  /(?:URI: (?<uri>.+))\n(?:Version: (?<version>.+))\n(?:Chain ID: (?<chainId>\d+))\n(?:Nonce: (?<nonce>[a-zA-Z0-9]+))\n(?:Issued At: (?<issuedAt>.+))(?:\nExpiration Time: (?<expirationTime>.+))?(?:\nNot Before: (?<notBefore>.+))?(?:\nRequest ID: (?<requestId>.+))?/
