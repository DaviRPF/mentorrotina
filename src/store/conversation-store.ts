'use client';

import { create } from 'zustand';

export interface DbMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  conversationId: string;
  pendingActions: string | null;
  createdAt: string;
}

export interface DbConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: DbMessage[];
}

interface ConversationStore {
  // State
  conversations: DbConversation[];
  currentConversationId: string | null;
  currentMessages: DbMessage[];
  isLoading: boolean;
  isLoadingMessages: boolean;

  // Actions
  fetchConversations: () => Promise<void>;
  createConversation: () => Promise<string | null>;
  selectConversation: (id: string | null) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  addMessage: (role: 'user' | 'assistant', content: string, pendingActions?: object[]) => Promise<DbMessage | null>;
  updateConversationTitle: (id: string, title: string) => Promise<void>;
  clearCurrentConversation: () => void;
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  currentMessages: [],
  isLoading: false,
  isLoadingMessages: false,

  fetchConversations: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        set({ conversations: data });
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  createConversation: async () => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Nova conversa' }),
      });

      if (res.ok) {
        const conversation = await res.json();
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          currentConversationId: conversation.id,
          currentMessages: [],
        }));
        return conversation.id;
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
    return null;
  },

  selectConversation: async (id: string | null) => {
    if (!id) {
      set({ currentConversationId: null, currentMessages: [] });
      return;
    }

    set({ isLoadingMessages: true, currentConversationId: id });

    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (res.ok) {
        const conversation = await res.json();
        set({ currentMessages: conversation.messages || [] });
      }
    } catch (error) {
      console.error('Error fetching conversation:', error);
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  deleteConversation: async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        const state = get();
        set({
          conversations: state.conversations.filter((c) => c.id !== id),
          ...(state.currentConversationId === id && {
            currentConversationId: null,
            currentMessages: [],
          }),
        });
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  },

  addMessage: async (role, content, pendingActions) => {
    const state = get();
    let conversationId = state.currentConversationId;

    // Create conversation if none exists
    if (!conversationId) {
      conversationId = await get().createConversation();
      if (!conversationId) return null;
    }

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          content,
          pendingActions: pendingActions || null,
        }),
      });

      if (res.ok) {
        const message = await res.json();
        set((state) => ({
          currentMessages: [...state.currentMessages, message],
        }));

        // Refresh conversations to update title/updatedAt
        get().fetchConversations();

        return message;
      }
    } catch (error) {
      console.error('Error adding message:', error);
    }
    return null;
  },

  updateConversationTitle: async (id, title) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });

      if (res.ok) {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, title } : c
          ),
        }));
      }
    } catch (error) {
      console.error('Error updating conversation title:', error);
    }
  },

  clearCurrentConversation: () => {
    set({ currentConversationId: null, currentMessages: [] });
  },
}));
