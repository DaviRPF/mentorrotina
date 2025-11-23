'use client';

import { create } from 'zustand';

export const GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Rápido e inteligente (Recomendado)' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Mais capaz, raciocínio avançado' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', description: 'Ultra rápido, baixo custo' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Versão anterior estável' },
] as const;

export type GeminiModel = typeof GEMINI_MODELS[number]['id'];

export interface BookReference {
  id: string;
  title: string;
  topics: string;
  enabled: boolean;
}

export interface Memory {
  id: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface TimeContext {
  content: string;
  updatedAt: number | null;
}

export type TimeContextType = 'weekly' | 'monthly' | 'quarterly' | 'sixMonth' | 'yearly';

export const TIME_CONTEXT_DURATIONS: Record<TimeContextType, number> = {
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
  quarterly: 90 * 24 * 60 * 60 * 1000,
  sixMonth: 180 * 24 * 60 * 60 * 1000,
  yearly: 365 * 24 * 60 * 60 * 1000,
};

export const TIME_CONTEXT_LABELS: Record<TimeContextType, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  sixMonth: 'Semestral',
  yearly: 'Anual',
};

export interface Settings {
  // AI Settings
  geminiModel: GeminiModel;
  aiEnabled: boolean;

  // Personal Memories
  memories: Memory[];

  // AI Mentor Orientations
  generalOrientations: string;
  bookReferences: BookReference[];

  // Time Contexts
  timeContexts: Record<TimeContextType, TimeContext>;

  // Calendar Settings
  weekStartsOn: 0 | 1;
  defaultView: 'day' | 'week' | 'month' | 'agenda';
  defaultEventDuration: number;
  defaultReminderMinutes: number | null;

  // Appearance
  theme: 'light' | 'dark' | 'system';
  compactMode: boolean;
  showWeekNumbers: boolean;

  // Notifications
  enableNotifications: boolean;
  soundEnabled: boolean;

  // Time format
  use24HourFormat: boolean;

  // Working hours
  workingHoursStart: number;
  workingHoursEnd: number;
  workingDays: number[];
}

interface SettingsStore extends Settings {
  // Loading state
  isLoading: boolean;
  isInitialized: boolean;

  // Modal state
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;

  // Actions
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
  resetSettings: () => void;

  // Memory actions
  addMemory: (content: string) => Promise<string>;
  updateMemory: (id: string, content: string) => Promise<void>;
  removeMemory: (id: string) => Promise<void>;

  // Book references actions
  addBookReference: (title: string, topics: string) => Promise<void>;
  updateBookReference: (id: string, title: string, topics: string) => Promise<void>;
  removeBookReference: (id: string) => Promise<void>;
  toggleBookReference: (id: string) => Promise<void>;

  // Time context actions
  updateTimeContext: (type: TimeContextType, content: string) => Promise<void>;
  clearTimeContext: (type: TimeContextType) => Promise<void>;
}

const defaultTimeContexts: Record<TimeContextType, TimeContext> = {
  weekly: { content: '', updatedAt: null },
  monthly: { content: '', updatedAt: null },
  quarterly: { content: '', updatedAt: null },
  sixMonth: { content: '', updatedAt: null },
  yearly: { content: '', updatedAt: null },
};

const defaultSettings: Settings = {
  geminiModel: 'gemini-2.5-flash',
  aiEnabled: true,
  memories: [],
  generalOrientations: '',
  bookReferences: [],
  timeContexts: defaultTimeContexts,
  weekStartsOn: 0,
  defaultView: 'week',
  defaultEventDuration: 60,
  defaultReminderMinutes: 15,
  theme: 'system',
  compactMode: false,
  showWeekNumbers: false,
  enableNotifications: true,
  soundEnabled: true,
  use24HourFormat: true,
  workingHoursStart: 9,
  workingHoursEnd: 18,
  workingDays: [1, 2, 3, 4, 5],
};

export const useSettingsStore = create<SettingsStore>()((set, get) => ({
  ...defaultSettings,
  isLoading: false,
  isInitialized: false,
  isSettingsOpen: false,

  setIsSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),

  fetchSettings: async () => {
    if (get().isLoading) return;

    set({ isLoading: true });
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        set({
          ...data,
          isLoading: false,
          isInitialized: true,
        });
      } else {
        console.error('Failed to fetch settings');
        set({ isLoading: false, isInitialized: true });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      set({ isLoading: false, isInitialized: true });
    }
  },

  updateSettings: async (newSettings) => {
    // Optimistic update
    set((state) => ({ ...state, ...newSettings }));

    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });

      if (!response.ok) {
        console.error('Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  },

  resetSettings: () => set({ ...defaultSettings }),

  addMemory: async (content) => {
    try {
      const response = await fetch('/api/settings/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (response.ok) {
        const memory = await response.json();
        set((state) => ({
          memories: [memory, ...state.memories],
        }));
        return memory.id;
      }
      throw new Error('Failed to create memory');
    } catch (error) {
      console.error('Error adding memory:', error);
      throw error;
    }
  },

  updateMemory: async (id, content) => {
    // Optimistic update
    set((state) => ({
      memories: state.memories.map((m) =>
        m.id === id ? { ...m, content, updatedAt: Date.now() } : m
      ),
    }));

    try {
      const response = await fetch(`/api/settings/memories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        console.error('Failed to update memory');
        // Could revert here if needed
      }
    } catch (error) {
      console.error('Error updating memory:', error);
    }
  },

  removeMemory: async (id) => {
    // Optimistic update
    const previousMemories = get().memories;
    set((state) => ({
      memories: state.memories.filter((m) => m.id !== id),
    }));

    try {
      const response = await fetch(`/api/settings/memories/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        console.error('Failed to delete memory');
        // Revert
        set({ memories: previousMemories });
      }
    } catch (error) {
      console.error('Error deleting memory:', error);
      set({ memories: previousMemories });
    }
  },

  addBookReference: async (title, topics) => {
    try {
      const response = await fetch('/api/settings/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, topics }),
      });

      if (response.ok) {
        const book = await response.json();
        set((state) => ({
          bookReferences: [book, ...state.bookReferences],
        }));
      } else {
        throw new Error('Failed to create book reference');
      }
    } catch (error) {
      console.error('Error adding book reference:', error);
      throw error;
    }
  },

  updateBookReference: async (id, title, topics) => {
    // Optimistic update
    set((state) => ({
      bookReferences: state.bookReferences.map((b) =>
        b.id === id ? { ...b, title, topics } : b
      ),
    }));

    try {
      const response = await fetch(`/api/settings/books/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, topics }),
      });

      if (!response.ok) {
        console.error('Failed to update book reference');
      }
    } catch (error) {
      console.error('Error updating book reference:', error);
    }
  },

  removeBookReference: async (id) => {
    const previousBooks = get().bookReferences;
    set((state) => ({
      bookReferences: state.bookReferences.filter((b) => b.id !== id),
    }));

    try {
      const response = await fetch(`/api/settings/books/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        console.error('Failed to delete book reference');
        set({ bookReferences: previousBooks });
      }
    } catch (error) {
      console.error('Error deleting book reference:', error);
      set({ bookReferences: previousBooks });
    }
  },

  toggleBookReference: async (id) => {
    const book = get().bookReferences.find((b) => b.id === id);
    if (!book) return;

    const newEnabled = !book.enabled;

    // Optimistic update
    set((state) => ({
      bookReferences: state.bookReferences.map((b) =>
        b.id === id ? { ...b, enabled: newEnabled } : b
      ),
    }));

    try {
      const response = await fetch(`/api/settings/books/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled }),
      });

      if (!response.ok) {
        console.error('Failed to toggle book reference');
        // Revert
        set((state) => ({
          bookReferences: state.bookReferences.map((b) =>
            b.id === id ? { ...b, enabled: !newEnabled } : b
          ),
        }));
      }
    } catch (error) {
      console.error('Error toggling book reference:', error);
    }
  },

  updateTimeContext: async (type, content) => {
    // Optimistic update
    set((state) => ({
      timeContexts: {
        ...state.timeContexts,
        [type]: {
          content,
          updatedAt: content.trim() ? Date.now() : null,
        },
      },
    }));

    try {
      const response = await fetch(`/api/settings/time-contexts/${type}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        console.error('Failed to update time context');
      }
    } catch (error) {
      console.error('Error updating time context:', error);
    }
  },

  clearTimeContext: async (type) => {
    // Optimistic update
    set((state) => ({
      timeContexts: {
        ...state.timeContexts,
        [type]: { content: '', updatedAt: null },
      },
    }));

    try {
      const response = await fetch(`/api/settings/time-contexts/${type}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        console.error('Failed to clear time context');
      }
    } catch (error) {
      console.error('Error clearing time context:', error);
    }
  },
}));
