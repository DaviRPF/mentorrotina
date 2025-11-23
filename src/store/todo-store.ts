import { create } from 'zustand';

export interface Todo {
  id: string;
  content: string;
  rawDeadline: string | null;
  deadline: Date | null;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  estimatedMinutes: number | null;
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
  scheduledEventId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TodoState {
  todos: Todo[];
  isLoading: boolean;
  isQuickInputOpen: boolean;
  isTodoListOpen: boolean;

  // Actions
  setTodos: (todos: Todo[]) => void;
  addTodo: (todo: Todo) => void;
  updateTodo: (id: string, updates: Partial<Todo>) => void;
  removeTodo: (id: string) => void;
  setIsLoading: (loading: boolean) => void;
  setQuickInputOpen: (open: boolean) => void;
  setTodoListOpen: (open: boolean) => void;

  // API calls
  fetchTodos: () => Promise<void>;
  createTodo: (content: string, estimatedMinutes?: number) => Promise<Todo | null>;
  completeTodo: (id: string) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;

  // Getters
  getPendingTodos: () => Todo[];
  getUrgentTodos: () => Todo[];
  getTodosForAI: () => { pending: Todo[]; byDeadline: Record<string, Todo[]> };
}

export const useTodoStore = create<TodoState>((set, get) => ({
  todos: [],
  isLoading: false,
  isQuickInputOpen: false,
  isTodoListOpen: false,

  setTodos: (todos) => set({ todos }),
  addTodo: (todo) => set((state) => ({ todos: [todo, ...state.todos] })),
  updateTodo: (id, updates) =>
    set((state) => ({
      todos: state.todos.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeTodo: (id) =>
    set((state) => ({
      todos: state.todos.filter((t) => t.id !== id),
    })),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setQuickInputOpen: (open) => set({ isQuickInputOpen: open }),
  setTodoListOpen: (open) => set({ isTodoListOpen: open }),

  fetchTodos: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch('/api/todos');
      if (response.ok) {
        const data = await response.json();
        const todos = data.map((t: Record<string, unknown>) => ({
          ...t,
          deadline: t.deadline ? new Date(t.deadline as string) : null,
          createdAt: new Date(t.createdAt as string),
          updatedAt: new Date(t.updatedAt as string),
        }));
        set({ todos });
      }
    } catch (error) {
      console.error('Error fetching todos:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  createTodo: async (content, estimatedMinutes) => {
    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, estimatedMinutes }),
      });

      if (response.ok) {
        const data = await response.json();
        const todo: Todo = {
          ...data,
          deadline: data.deadline ? new Date(data.deadline) : null,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
        };
        get().addTodo(todo);
        return todo;
      }
    } catch (error) {
      console.error('Error creating todo:', error);
    }
    return null;
  },

  completeTodo: async (id) => {
    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });

      if (response.ok) {
        get().updateTodo(id, { status: 'completed' });
      }
    } catch (error) {
      console.error('Error completing todo:', error);
    }
  },

  deleteTodo: async (id) => {
    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        get().removeTodo(id);
      }
    } catch (error) {
      console.error('Error deleting todo:', error);
    }
  },

  getPendingTodos: () => {
    return get().todos.filter((t) => t.status === 'pending' || t.status === 'scheduled');
  },

  getUrgentTodos: () => {
    return get().todos.filter(
      (t) => (t.status === 'pending' || t.status === 'scheduled') &&
             (t.priority === 'urgent' || t.priority === 'high')
    );
  },

  getTodosForAI: () => {
    const pending = get().getPendingTodos();
    const byDeadline: Record<string, Todo[]> = {
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
      noDeadline: [],
    };

    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const tomorrowEnd = new Date(todayEnd.getTime() + 24 * 60 * 60 * 1000);
    const weekEnd = new Date(todayEnd.getTime() + 7 * 24 * 60 * 60 * 1000);

    pending.forEach((todo) => {
      if (!todo.deadline) {
        byDeadline.noDeadline.push(todo);
      } else if (todo.deadline <= todayEnd) {
        byDeadline.today.push(todo);
      } else if (todo.deadline <= tomorrowEnd) {
        byDeadline.tomorrow.push(todo);
      } else if (todo.deadline <= weekEnd) {
        byDeadline.thisWeek.push(todo);
      } else {
        byDeadline.later.push(todo);
      }
    });

    return { pending, byDeadline };
  },
}));
