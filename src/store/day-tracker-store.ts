import { create } from 'zustand';

export interface DayReport {
  id: string;
  daySessionId: string;
  summary: string;
  completedTasks: string[];
  skippedTasks: string[];
  highlights: string[];
  challenges: string[];
  insights: string[];
  plannedEvents: number;
  completedEvents: number;
  completionRate: number;
  energyLevel: number | null;
  moodRating: number | null;
  createdAt: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface DaySession {
  id: string;
  date: string;
  status: 'active' | 'completed';
  conversationId: string | null;
  conversation?: {
    id: string;
    messages: Message[];
  };
  report?: DayReport;
  createdAt: string;
}

interface DayTrackerStore {
  // State
  isOpen: boolean;
  selectedDate: Date | null;
  currentSession: DaySession | null;
  sessions: DaySession[];
  reports: DayReport[];
  isLoading: boolean;
  isGeneratingReport: boolean;

  // Actions
  openTracker: (date: Date) => void;
  closeTracker: () => void;
  setCurrentSession: (session: DaySession | null) => void;
  setSessions: (sessions: DaySession[]) => void;
  setReports: (reports: DayReport[]) => void;
  setLoading: (loading: boolean) => void;
  setGeneratingReport: (generating: boolean) => void;

  // API calls
  fetchOrCreateSession: (date: Date) => Promise<DaySession | null>;
  fetchSessions: () => Promise<void>;
  fetchReports: () => Promise<void>;
  generateReport: (sessionId: string) => Promise<DayReport | null>;
  addMessageToSession: (message: Message) => void;
}

export const useDayTrackerStore = create<DayTrackerStore>((set, get) => ({
  // Initial state
  isOpen: false,
  selectedDate: null,
  currentSession: null,
  sessions: [],
  reports: [],
  isLoading: false,
  isGeneratingReport: false,

  // Actions
  openTracker: (date) => set({ isOpen: true, selectedDate: date }),
  closeTracker: () => set({ isOpen: false, selectedDate: null, currentSession: null }),
  setCurrentSession: (session) => set({ currentSession: session }),
  setSessions: (sessions) => set({ sessions }),
  setReports: (reports) => set({ reports }),
  setLoading: (loading) => set({ isLoading: loading }),
  setGeneratingReport: (generating) => set({ isGeneratingReport: generating }),

  // API calls
  fetchOrCreateSession: async (date) => {
    set({ isLoading: true });
    try {
      const response = await fetch('/api/day-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: date.toISOString() }),
      });

      if (response.ok) {
        const session = await response.json();
        set({ currentSession: session, isLoading: false });
        return session;
      }
      set({ isLoading: false });
      return null;
    } catch (error) {
      console.error('Error fetching/creating session:', error);
      set({ isLoading: false });
      return null;
    }
  },

  fetchSessions: async () => {
    try {
      const response = await fetch('/api/day-sessions');
      if (response.ok) {
        const sessions = await response.json();
        set({ sessions });
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  },

  fetchReports: async () => {
    try {
      const response = await fetch('/api/day-reports');
      if (response.ok) {
        const reports = await response.json();
        // Parse JSON strings
        const parsedReports = reports.map((r: DayReport & {
          completedTasks: string;
          skippedTasks: string;
          highlights: string;
          challenges: string;
          insights: string;
        }) => ({
          ...r,
          completedTasks: JSON.parse(r.completedTasks || '[]'),
          skippedTasks: JSON.parse(r.skippedTasks || '[]'),
          highlights: JSON.parse(r.highlights || '[]'),
          challenges: JSON.parse(r.challenges || '[]'),
          insights: JSON.parse(r.insights || '[]'),
        }));
        set({ reports: parsedReports });
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  },

  generateReport: async (sessionId) => {
    set({ isGeneratingReport: true });
    try {
      const response = await fetch(`/api/day-sessions/${sessionId}/report`, {
        method: 'POST',
      });

      if (response.ok) {
        const report = await response.json();
        const parsedReport = {
          ...report,
          completedTasks: JSON.parse(report.completedTasks || '[]'),
          skippedTasks: JSON.parse(report.skippedTasks || '[]'),
          highlights: JSON.parse(report.highlights || '[]'),
          challenges: JSON.parse(report.challenges || '[]'),
          insights: JSON.parse(report.insights || '[]'),
        };

        // Update current session
        const { currentSession } = get();
        if (currentSession) {
          set({
            currentSession: { ...currentSession, status: 'completed', report: parsedReport },
            isGeneratingReport: false,
          });
        }

        // Refresh reports list
        get().fetchReports();

        return parsedReport;
      }
      set({ isGeneratingReport: false });
      return null;
    } catch (error) {
      console.error('Error generating report:', error);
      set({ isGeneratingReport: false });
      return null;
    }
  },

  addMessageToSession: (message) => {
    const { currentSession } = get();
    if (currentSession && currentSession.conversation) {
      set({
        currentSession: {
          ...currentSession,
          conversation: {
            ...currentSession.conversation,
            messages: [...currentSession.conversation.messages, message],
          },
        },
      });
    }
  },
}));
