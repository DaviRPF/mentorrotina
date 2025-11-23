'use client';

import { format, formatDistanceToNow, differenceInDays, differenceInHours, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, Check, Trash2, Clock, AlertTriangle, AlertCircle, Circle, CalendarClock } from 'lucide-react';
import { useTodoStore, Todo } from '@/store/todo-store';
import { cn } from '@/lib/utils';

const priorityConfig = {
  urgent: {
    icon: AlertCircle,
    color: 'text-red-600 dark:text-red-400',
  },
  high: {
    icon: AlertTriangle,
    color: 'text-orange-600 dark:text-orange-400',
  },
  medium: {
    icon: Clock,
    color: 'text-blue-600 dark:text-blue-400',
  },
  low: {
    icon: Circle,
    color: 'text-gray-500 dark:text-gray-400',
  },
};

function getDeadlineInfo(deadline: Date | null): { text: string; urgency: 'overdue' | 'urgent' | 'soon' | 'normal' | 'none' } {
  if (!deadline) {
    return { text: 'Sem prazo definido', urgency: 'none' };
  }

  const now = new Date();

  if (isPast(deadline)) {
    const hoursAgo = Math.abs(differenceInHours(deadline, now));
    if (hoursAgo < 24) {
      return { text: `Atrasado há ${hoursAgo}h`, urgency: 'overdue' };
    }
    const daysAgo = Math.abs(differenceInDays(deadline, now));
    return { text: `Atrasado há ${daysAgo} dia${daysAgo > 1 ? 's' : ''}`, urgency: 'overdue' };
  }

  const hoursLeft = differenceInHours(deadline, now);
  const daysLeft = differenceInDays(deadline, now);

  if (hoursLeft < 1) {
    const minutesLeft = Math.max(0, Math.round((deadline.getTime() - now.getTime()) / 60000));
    return { text: `Faltam ${minutesLeft} min`, urgency: 'urgent' };
  }

  if (hoursLeft < 24) {
    return { text: `Faltam ${hoursLeft}h`, urgency: 'urgent' };
  }

  if (daysLeft === 1) {
    return { text: 'Falta 1 dia', urgency: 'soon' };
  }

  if (daysLeft <= 3) {
    return { text: `Faltam ${daysLeft} dias`, urgency: 'soon' };
  }

  if (daysLeft <= 7) {
    return { text: `Faltam ${daysLeft} dias`, urgency: 'normal' };
  }

  return { text: `Faltam ${daysLeft} dias`, urgency: 'normal' };
}

function TodoItem({ todo }: { todo: Todo }) {
  const { completeTodo, deleteTodo } = useTodoStore();
  const config = priorityConfig[todo.priority];
  const Icon = config.icon;
  const deadlineInfo = getDeadlineInfo(todo.deadline);

  const urgencyStyles = {
    overdue: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700',
    urgent: 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700',
    soon: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700',
    normal: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    none: 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700',
  };

  const urgencyTextStyles = {
    overdue: 'text-red-600 dark:text-red-400 font-semibold',
    urgent: 'text-orange-600 dark:text-orange-400 font-medium',
    soon: 'text-yellow-600 dark:text-yellow-500',
    normal: 'text-gray-600 dark:text-gray-400',
    none: 'text-gray-400 dark:text-gray-500 italic',
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-xl border transition-all',
        urgencyStyles[deadlineInfo.urgency]
      )}
    >
      {/* Priority indicator */}
      <div className={cn('mt-0.5', config.color)}>
        <Icon className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {todo.content}
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          {/* Deadline countdown */}
          <span className={cn('text-sm flex items-center gap-1', urgencyTextStyles[deadlineInfo.urgency])}>
            <CalendarClock className="w-3.5 h-3.5" />
            {deadlineInfo.text}
          </span>

          {/* Original deadline date */}
          {todo.deadline && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              ({format(todo.deadline, "EEE, d/MM HH:mm", { locale: ptBR })})
            </span>
          )}

          {todo.estimatedMinutes && (
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              ~{todo.estimatedMinutes} min
            </span>
          )}
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
  const { isTodoListOpen, setTodoListOpen, getPendingTodos } = useTodoStore();

  if (!isTodoListOpen) return null;

  const todos = getPendingTodos();

  // Sort by deadline (null deadlines at the end), then by priority
  const sortedTodos = [...todos].sort((a, b) => {
    // Overdue items first
    const aOverdue = a.deadline && isPast(a.deadline);
    const bOverdue = b.deadline && isPast(b.deadline);
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    // Then by deadline (nulls last)
    if (a.deadline && !b.deadline) return -1;
    if (!a.deadline && b.deadline) return 1;
    if (a.deadline && b.deadline) {
      return a.deadline.getTime() - b.deadline.getTime();
    }

    // Then by priority
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

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
              {sortedTodos.length} {sortedTodos.length === 1 ? 'tarefa' : 'tarefas'} • ordenado por urgência
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
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sortedTodos.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                Nenhuma tarefa pendente
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Use o botão + para adicionar
              </p>
            </div>
          ) : (
            sortedTodos.map((todo) => (
              <TodoItem key={todo.id} todo={todo} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
