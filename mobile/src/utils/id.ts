import * as Crypto from 'expo-crypto';

/** A random unique id (UUID v4). */
export function newId(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
