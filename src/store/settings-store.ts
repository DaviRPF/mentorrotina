'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  topics: string; // Chapter/topic list (can be AI-generated or manual)
  enabled: boolean;
}

export interface TimeContext {
  content: string;
  updatedAt: number | null; // timestamp
}

export type TimeContextType = 'weekly' | 'monthly' | 'quarterly' | 'sixMonth' | 'yearly';

export const TIME_CONTEXT_DURATIONS: Record<TimeContextType, number> = {
  weekly: 7 * 24 * 60 * 60 * 1000,      // 7 days
  monthly: 30 * 24 * 60 * 60 * 1000,    // 30 days
  quarterly: 90 * 24 * 60 * 60 * 1000,  // 90 days
  sixMonth: 180 * 24 * 60 * 60 * 1000,  // 180 days
  yearly: 365 * 24 * 60 * 60 * 1000,    // 365 days
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

  // Personal Context (immutable, doesn't depend on time)
  personalContext: string;

  // AI Mentor Orientations
  generalOrientations: string;
  bookReferences: BookReference[];

  // Time Contexts (goals/plans for different periods)
  timeContexts: Record<TimeContextType, TimeContext>;

  // Calendar Settings
  weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
  defaultView: 'day' | 'week' | 'month' | 'agenda';
  defaultEventDuration: number; // in minutes
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

  // Working hours (for insights)
  workingHoursStart: number; // 0-23
  workingHoursEnd: number; // 0-23
  workingDays: number[]; // 0-6, 0 = Sunday
}

interface SettingsStore extends Settings {
  // Actions
  updateSettings: (settings: Partial<Settings>) => void;
  resetSettings: () => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;

  // Book references actions
  addBookReference: (title: string, topics: string) => void;
  updateBookReference: (id: string, title: string, topics: string) => void;
  removeBookReference: (id: string) => void;
  toggleBookReference: (id: string) => void;

  // Time context actions
  updateTimeContext: (type: TimeContextType, content: string) => void;
  clearTimeContext: (type: TimeContextType) => void;
}

const defaultTimeContexts: Record<TimeContextType, TimeContext> = {
  weekly: { content: '', updatedAt: null },
  monthly: { content: '', updatedAt: null },
  quarterly: { content: '', updatedAt: null },
  sixMonth: { content: '', updatedAt: null },
  yearly: { content: '', updatedAt: null },
};

const defaultSettings: Settings = {
  // AI
  geminiModel: 'gemini-2.5-flash',
  aiEnabled: true,

  // Personal Context
  personalContext: '',

  // AI Mentor Orientations
  generalOrientations: '',
  bookReferences: [],
  timeContexts: defaultTimeContexts,

  // Calendar
  weekStartsOn: 0,
  defaultView: 'week',
  defaultEventDuration: 60,
  defaultReminderMinutes: 15,

  // Appearance
  theme: 'system',
  compactMode: false,
  showWeekNumbers: false,

  // Notifications
  enableNotifications: true,
  soundEnabled: true,

  // Time
  use24HourFormat: true,

  // Working hours
  workingHoursStart: 9,
  workingHoursEnd: 18,
  workingDays: [1, 2, 3, 4, 5], // Mon-Fri
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,
      isSettingsOpen: false,

      updateSettings: (newSettings) => set((state) => ({ ...state, ...newSettings })),

      resetSettings: () => set({ ...defaultSettings }),

      setIsSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),

      addBookReference: (title, topics) => set((state) => ({
        bookReferences: [
          ...state.bookReferences,
          { id: crypto.randomUUID(), title, topics, enabled: true }
        ]
      })),

      updateBookReference: (id, title, topics) => set((state) => ({
        bookReferences: state.bookReferences.map((book) =>
          book.id === id ? { ...book, title, topics } : book
        )
      })),

      removeBookReference: (id) => set((state) => ({
        bookReferences: state.bookReferences.filter((book) => book.id !== id)
      })),

      toggleBookReference: (id) => set((state) => ({
        bookReferences: state.bookReferences.map((book) =>
          book.id === id ? { ...book, enabled: !book.enabled } : book
        )
      })),

      updateTimeContext: (type, content) => set((state) => ({
        timeContexts: {
          ...state.timeContexts,
          [type]: {
            content,
            updatedAt: content.trim() ? Date.now() : null,
          },
        },
      })),

      clearTimeContext: (type) => set((state) => ({
        timeContexts: {
          ...state.timeContexts,
          [type]: { content: '', updatedAt: null },
        },
      })),
    }),
    {
      name: 'mentor-rotina-settings',
      partialize: (state) => {
        // Don't persist isSettingsOpen
        const { isSettingsOpen, ...settings } = state;
        return settings;
      },
    }
  )
);
