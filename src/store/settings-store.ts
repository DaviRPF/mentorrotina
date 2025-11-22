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

export interface BookSummary {
  id: string;
  title: string;
  summary: string;
}

export interface Settings {
  // AI Settings
  geminiModel: GeminiModel;
  aiEnabled: boolean;

  // AI Mentor Orientations
  generalOrientations: string;
  bookSummaries: BookSummary[];

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

  // Book summaries actions
  addBookSummary: (title: string, summary: string) => void;
  updateBookSummary: (id: string, title: string, summary: string) => void;
  removeBookSummary: (id: string) => void;
}

const defaultSettings: Settings = {
  // AI
  geminiModel: 'gemini-2.5-flash',
  aiEnabled: true,

  // AI Mentor Orientations
  generalOrientations: '',
  bookSummaries: [],

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

      addBookSummary: (title, summary) => set((state) => ({
        bookSummaries: [
          ...state.bookSummaries,
          { id: crypto.randomUUID(), title, summary }
        ]
      })),

      updateBookSummary: (id, title, summary) => set((state) => ({
        bookSummaries: state.bookSummaries.map((book) =>
          book.id === id ? { ...book, title, summary } : book
        )
      })),

      removeBookSummary: (id) => set((state) => ({
        bookSummaries: state.bookSummaries.filter((book) => book.id !== id)
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
