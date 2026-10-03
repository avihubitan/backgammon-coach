import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Where the backup code lives: the device keychain on iOS/Android, local storage on web. */
export interface CredentialStore {
  getCode(): Promise<string | null>;
  setCode(code: string): Promise<void>;
  clear(): Promise<void>;
}

const KEY = 'bg-coach.backup-code';

export const deviceCredentials: CredentialStore =
  Platform.OS === 'web'
    ? {
        getCode: () => AsyncStorage.getItem(KEY),
        setCode: (code) => AsyncStorage.setItem(KEY, code),
        clear: () => AsyncStorage.removeItem(KEY),
      }
    : {
        getCode: () => SecureStore.getItemAsync(KEY),
        setCode: (code) => SecureStore.setItemAsync(KEY, code),
        clear: () => SecureStore.deleteItemAsync(KEY),
      };

/** For tests. */
export function memoryCredentials(initial: string | null = null): CredentialStore {
  let code = initial;
  return {
    getCode: async () => code,
    setCode: async (next) => {
      code = next;
    },
    clear: async () => {
      code = null;
    },
  };
}
