import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/** Shared JSON storage for persisted stores (AsyncStorage on device, localStorage on web). */
export const persistStorage = createJSONStorage(() => AsyncStorage);
