'use client';

import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, Check, Trash2, Clock, AlertTriangle, AlertCircle, Circle, CalendarClock } from 'lucide-react';
import { useTodoStore, Todo } from '@/store/todo-store';
import { cn } from '@/lib/utils';

const priorityConfig = {
  urgent: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    border: 'border-red-300 dark:border-red-700',
    text: 'text-red-700 dark:text-red-400',
    icon: AlertCircle,
    label: 'Urgente',
  },
  high: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    border: 'border-orange-300 dark:border-orange-700',
    text: 'text-orange-700 dark:text-orange-400',
    icon: AlertTriangle,
    label: 'Alta',
  },
  medium: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    border: 'border-blue-300 dark:border-blue-700',
    text: 'text-blue-700 dark:text-blue-400',
    icon: Clock,
    label: 'Média',
  },
  low: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    border: 'border-gray-300 dark:border-gray-700',
    text: 'text-gray-600 dark:text-gray-400',
    icon: Circle,
    label: 'Baixa',
  },
};

function TodoItem({ todo }: { todo: Todo }) {
  const { completeTodo, deleteTodo } = useTodoStore();
  const config = priorityConfig[todo.priority];
  const Icon = config.icon;

  const formatDeadline = (deadline: Date | null) => {
    if (!deadline) return null;

    if (isToday(deadline)) {
      return `Hoje às ${format(deadline, 'HH:mm')}`;
    }
    if (isTomorrow(deadline)) {
      return `Amanhã às ${format(deadline, 'HH:mm')}`;
    }
    if (isPast(deadline)) {
      return `Atrasado (${formatDistanceToNow(deadline, { locale: ptBR, addSuffix: true })})`;
    }
    return format(deadline, "EEE, d 'de' MMM 'às' HH:mm", { locale: ptBR });
  };

  const isOverdue = todo.deadline && isPast(todo.deadline);

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-xl border transition-all',
        config.bg,
        config.border,
        isOverdue && 'border-red-500 dark:border-red-600'
      )}
    >
      {/* Priority indicator */}
      <div className={cn('mt-0.5', config.text)}>
        <Icon className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {todo.content}
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-1">
          {todo.deadline && (
            <span className={cn(
              'text-xs flex items-center gap-1',
              isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'
            )}>
              <CalendarClock className="w-3 h-3" />
              {formatDeadline(todo.deadline)}
            </span>
          )}

          {todo.estimatedMinutes && (
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {todo.estimatedMinutes} min
            </span>
          )}

          <span className={cn('text-xs px-1.5 py-0.5 rounded-full', config.bg, config.text)}>
            {config.label}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => completeTodo(todo.id)}
          className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors text-green-600"
          title="Marcar como concluído"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={() => deleteTodo(todo.id)}
          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors text-red-600"
          title="Excluir"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function TodoList() {
  const { isTodoListOpen, setTodoListOpen, getTodosForAI } = useTodoStore();

  if (!isTodoListOpen) return null;

  const { byDeadline } = getTodosForAI();

  const sections = [
    { key: 'today', label: 'Hoje', todos: byDeadline.today },
    { key: 'tomorrow', label: 'Amanhã', todos: byDeadline.tomorrow },
    { key: 'thisWeek', label: 'Esta semana', todos: byDeadline.thisWeek },
    { key: 'later', label: 'Depois', todos: byDeadline.later },
    { key: 'noDeadline', label: 'Sem prazo', todos: byDeadline.noDeadline },
  ].filter((s) => s.todos.length > 0);

  const totalTodos = sections.reduce((acc, s) => acc + s.todos.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => setTodoListOpen(false)}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[80vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Tarefas Pendentes
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {totalTodos} {totalTodos === 1 ? 'tarefa' : 'tarefas'}
            </p>
          </div>
          <button
            onClick={() => setTodoListOpen(false)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {sections.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                Nenhuma tarefa pendente
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Use o botão + para adicionar
              </p>
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.key}>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  {section.label}
                </h3>
                <div className="space-y-2">
                  {section.todos.map((todo) => (
                    <TodoItem key={todo.id} todo={todo} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
