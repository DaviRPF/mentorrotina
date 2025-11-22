'use client';

import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: PendingAction[];
}

export interface RecurrenceRule {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  daysOfWeek?: number[];
  endDate?: string;
  count?: number;
}

export interface PendingAction {
  id: string;
  type: 'create' | 'update' | 'delete' | 'move';
  description: string;
  data: {
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    color?: string;
    calendarId?: string;
    eventId?: string;
    isAllDay?: boolean;
    reminderMinutes?: number | null;
    recurrenceRule?: RecurrenceRule | null;
  };
  status: 'pending' | 'accepted' | 'rejected';
}

export interface PendingMemoryAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  memoryId?: string; // for update/delete
  currentContent?: string; // for update/delete - what it was
  newContent?: string; // for create/update - what it will be
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
}

interface ChatStore {
  // State
  messages: ChatMessage[];
  pendingActions: PendingAction[];
  pendingMemoryActions: PendingMemoryAction[];
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  setIsOpen: (isOpen: boolean) => void;
  toggleOpen: () => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  // Pending calendar actions
  addPendingActions: (actions: Omit<PendingAction, 'id' | 'status'>[]) => void;
  updateActionStatus: (id: string, status: PendingAction['status']) => void;
  updateActionData: (id: string, data: Partial<PendingAction['data']>) => void;
  clearPendingActions: () => void;
  acceptAction: (id: string) => void;
  rejectAction: (id: string) => void;
  acceptAllActions: () => void;
  rejectAllActions: () => void;
  getPendingActions: () => PendingAction[];

  // Pending memory actions
  addPendingMemoryActions: (actions: Omit<PendingMemoryAction, 'id' | 'status'>[]) => void;
  acceptMemoryAction: (id: string) => void;
  rejectMemoryAction: (id: string) => void;
  clearPendingMemoryActions: () => void;
  getPendingMemoryActions: () => PendingMemoryAction[];
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  pendingActions: [],
  pendingMemoryActions: [],
  isOpen: false,
  isLoading: false,
  error: null,

  addMessage: (message) => {
    const newMessage: ChatMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    set((state) => ({
      messages: [...state.messages, newMessage],
    }));
  },

  clearMessages: () => set({ messages: [], pendingActions: [] }),

  setIsOpen: (isOpen) => set({ isOpen }),

  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),

  setIsLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  addPendingActions: (actions) => {
    const newActions: PendingAction[] = actions.map((action) => ({
      ...action,
      id: crypto.randomUUID(),
      status: 'pending',
    }));
    set((state) => ({
      pendingActions: [...state.pendingActions, ...newActions],
    }));
  },

  updateActionStatus: (id, status) => {
    set((state) => ({
      pendingActions: state.pendingActions.map((action) =>
        action.id === id ? { ...action, status } : action
      ),
    }));
  },

  updateActionData: (id, data) => {
    set((state) => ({
      pendingActions: state.pendingActions.map((action) =>
        action.id === id ? { ...action, data: { ...action.data, ...data } } : action
      ),
    }));
  },

  clearPendingActions: () => set({ pendingActions: [] }),

  acceptAction: (id) => {
    get().updateActionStatus(id, 'accepted');
  },

  rejectAction: (id) => {
    get().updateActionStatus(id, 'rejected');
  },

  acceptAllActions: () => {
    set((state) => ({
      pendingActions: state.pendingActions.map((action) =>
        action.status === 'pending' ? { ...action, status: 'accepted' } : action
      ),
    }));
  },

  rejectAllActions: () => {
    set((state) => ({
      pendingActions: state.pendingActions.map((action) =>
        action.status === 'pending' ? { ...action, status: 'rejected' } : action
      ),
    }));
  },

  getPendingActions: () => {
    return get().pendingActions.filter((action) => action.status === 'pending');
  },

  // Memory actions
  addPendingMemoryActions: (actions) => {
    const newActions: PendingMemoryAction[] = actions.map((action) => ({
      ...action,
      id: crypto.randomUUID(),
      status: 'pending',
    }));
    set((state) => ({
      pendingMemoryActions: [...state.pendingMemoryActions, ...newActions],
    }));
  },

  acceptMemoryAction: (id) => {
    set((state) => ({
      pendingMemoryActions: state.pendingMemoryActions.map((action) =>
        action.id === id ? { ...action, status: 'accepted' } : action
      ),
    }));
  },

  rejectMemoryAction: (id) => {
    set((state) => ({
      pendingMemoryActions: state.pendingMemoryActions.map((action) =>
        action.id === id ? { ...action, status: 'rejected' } : action
      ),
    }));
  },

  clearPendingMemoryActions: () => set({ pendingMemoryActions: [] }),

  getPendingMemoryActions: () => {
    return get().pendingMemoryActions.filter((action) => action.status === 'pending');
  },
}));
