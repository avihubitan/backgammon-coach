import { create } from 'zustand';

import type { IconName } from '@/components/ui/Icon';

/** Celebratory banners that can appear over any screen (daily challenge done, …). */
export interface Toast {
  id: number;
  icon: IconName;
  title: string;
  message?: string;
  xp?: number;
  testID?: string;
}

interface ToastState {
  queue: Toast[];
  show: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>()((set) => ({
  queue: [],
  show: (toast) => set((state) => ({ queue: [...state.queue, { ...toast, id: nextId++ }] })),
  dismiss: (id) => set((state) => ({ queue: state.queue.filter((toast) => toast.id !== id) })),
}));
