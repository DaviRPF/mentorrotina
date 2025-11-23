'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, X, ListTodo, Loader2 } from 'lucide-react';
import { useTodoStore } from '@/store/todo-store';
import { cn } from '@/lib/utils';

export function QuickTodoInput() {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    isQuickInputOpen,
    setQuickInputOpen,
    setTodoListOpen,
    createTodo,
    getPendingTodos,
    fetchTodos,
  } = useTodoStore();

  const pendingCount = getPendingTodos().length;

  // Fetch todos on mount
  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  // Focus input when opened
  useEffect(() => {
    if (isQuickInputOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isQuickInputOpen]);

  // Keyboard shortcut to open (Ctrl+T)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        setQuickInputOpen(!isQuickInputOpen);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQuickInputOpen, setQuickInputOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const todo = await createTodo(input.trim());
    setIsSubmitting(false);

    if (todo) {
      setInput('');
      // Keep input open for quick successive adds
    }
  };

  const handleClose = () => {
    setQuickInputOpen(false);
    setInput('');
  };

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-2">
        {/* Todo list button */}
        {pendingCount > 0 && !isQuickInputOpen && (
          <button
            onClick={() => setTodoListOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ListTodo className="w-4 h-4" />
            <span className="text-sm font-medium">{pendingCount}</span>
          </button>
        )}

        {/* Add todo button */}
        <button
          onClick={() => setQuickInputOpen(!isQuickInputOpen)}
          className={cn(
            'w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg flex items-center justify-center transition-all',
            isQuickInputOpen
              ? 'bg-gray-600 hover:bg-gray-700 rotate-45'
              : 'bg-gradient-to-br from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700'
          )}
        >
          {isQuickInputOpen ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Plus className="w-6 h-6 text-white" />
          )}
        </button>
      </div>

      {/* Quick input modal */}
      {isQuickInputOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={handleClose}
          />

          {/* Input card */}
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-4 mb-20 sm:mb-0">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nova tarefa
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ex: Entregar trabalho até sexta 18h"
                  className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Dica: escreva "até sexta", "amanhã", "urgente"
                </p>
                <button
                  type="submit"
                  disabled={!input.trim() || isSubmitting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Adicionar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
