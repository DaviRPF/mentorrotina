import { create } from 'zustand';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface EnhancementContext {
  similarEventsCount: number;
  relevantReportsCount: number;
  hasMemories: boolean;
  hasBooks: boolean;
}

interface EventEnhancementData {
  enhancement: string;
  chatMessages: ChatMessage[];
  context: EnhancementContext | null;
  generatedAt: string;
}

interface EnhancementStore {
  // Map of eventId -> enhancement data
  enhancements: Record<string, EventEnhancementData>;

  // Get enhancement for a specific event
  getEnhancement: (eventId: string) => EventEnhancementData | null;

  // Set enhancement for an event
  setEnhancement: (eventId: string, data: {
    enhancement: string;
    context: EnhancementContext | null;
  }) => void;

  // Add a chat message to an event's enhancement
  addChatMessage: (eventId: string, message: ChatMessage) => void;

  // Get chat messages for an event
  getChatMessages: (eventId: string) => ChatMessage[];

  // Clear enhancement for an event (for regenerating)
  clearEnhancement: (eventId: string) => void;

  // Clear all enhancements
  clearAll: () => void;
}

export const useEnhancementStore = create<EnhancementStore>((set, get) => ({
  enhancements: {},

  getEnhancement: (eventId) => {
    return get().enhancements[eventId] || null;
  },

  setEnhancement: (eventId, data) => {
    set((state) => ({
      enhancements: {
        ...state.enhancements,
        [eventId]: {
          enhancement: data.enhancement,
          chatMessages: [{ role: 'assistant', content: data.enhancement }],
          context: data.context,
          generatedAt: new Date().toISOString(),
        },
      },
    }));
  },

  addChatMessage: (eventId, message) => {
    set((state) => {
      const existing = state.enhancements[eventId];
      if (!existing) return state;

      return {
        enhancements: {
          ...state.enhancements,
          [eventId]: {
            ...existing,
            chatMessages: [...existing.chatMessages, message],
          },
        },
      };
    });
  },

  getChatMessages: (eventId) => {
    const data = get().enhancements[eventId];
    return data?.chatMessages || [];
  },

  clearEnhancement: (eventId) => {
    set((state) => {
      const { [eventId]: _, ...rest } = state.enhancements;
      return { enhancements: rest };
    });
  },

  clearAll: () => {
    set({ enhancements: {} });
  },
}));
