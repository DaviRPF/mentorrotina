'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Trash2, Check, XIcon, Loader2, Sparkles, ChevronDown, ChevronUp, Calendar, Clock, Repeat, Bell, Palette } from 'lucide-react';
import { useChatStore, PendingAction, RecurrenceRule } from '@/store/chat-store';
import { useCalendarStore } from '@/store/calendar-store';
import { useSettingsStore } from '@/store/settings-store';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Color names for display
const COLOR_NAMES: Record<string, string> = {
  '#3b82f6': 'Azul',
  '#ef4444': 'Vermelho',
  '#22c55e': 'Verde',
  '#eab308': 'Amarelo',
  '#a855f7': 'Roxo',
  '#ec4899': 'Rosa',
  '#f97316': 'Laranja',
  '#14b8a6': 'Teal',
};

// Helper to format recurrence rule
function formatRecurrence(rule: RecurrenceRule | null | undefined): string | null {
  if (!rule) return null;

  const daysMap: Record<number, string> = {
    0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb'
  };

  switch (rule.type) {
    case 'daily':
      if (rule.interval === 1) return 'Diariamente';
      if (rule.interval === 2) return 'Dia sim, dia não';
      return `A cada ${rule.interval} dias`;
    case 'weekly':
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        const days = rule.daysOfWeek.map(d => daysMap[d]).join(', ');
        return `Semanal (${days})`;
      }
      if (rule.interval === 1) return 'Semanalmente';
      return `A cada ${rule.interval} semanas`;
    case 'monthly':
      if (rule.interval === 1) return 'Mensalmente';
      return `A cada ${rule.interval} meses`;
    case 'yearly':
      return 'Anualmente';
    default:
      return 'Recorrente';
  }
}

// Helper to format reminder
function formatReminder(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined) return null;
  if (minutes < 60) return `${minutes} min antes`;
  if (minutes === 60) return '1 hora antes';
  if (minutes < 1440) return `${Math.floor(minutes / 60)} horas antes`;
  if (minutes === 1440) return '1 dia antes';
  return `${Math.floor(minutes / 1440)} dias antes`;
}

export function ChatSidebar() {
  const [input, setInput] = useState('');
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const toggleActionExpanded = (actionId: string) => {
    setExpandedActions(prev => {
      const next = new Set(prev);
      if (next.has(actionId)) {
        next.delete(actionId);
      } else {
        next.add(actionId);
      }
      return next;
    });
  };

  const {
    messages,
    pendingActions,
    isOpen,
    isLoading,
    error,
    setIsOpen,
    addMessage,
    clearMessages,
    setIsLoading,
    setError,
    addPendingActions,
    acceptAction,
    rejectAction,
    acceptAllActions,
    rejectAllActions,
    getPendingActions,
  } = useChatStore();

  const { addEvent, updateEvent, removeEvent, events, calendars, setEvents } = useCalendarStore();
  const { geminiModel, aiEnabled, personalContext, generalOrientations, bookSummaries, timeContexts } = useSettingsStore();

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingActions]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    addMessage({ role: 'user', content: userMessage });
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          model: geminiModel,
          history: messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          // Personal context (immutable)
          personalContext: personalContext || '',
          // Mentor orientations
          orientations: generalOrientations,
          bookSummaries: bookSummaries.map(b => ({ title: b.title, summary: b.summary })),
          // Time contexts (goals)
          timeContexts: Object.entries(timeContexts || {})
            .filter(([_, ctx]) => ctx.content?.trim())
            .map(([type, ctx]) => ({ type, content: ctx.content })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar mensagem');
      }

      addMessage({ role: 'assistant', content: data.response });

      // Add pending actions if any
      if (data.actions && data.actions.length > 0) {
        addPendingActions(data.actions);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      addMessage({
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const executeAction = async (action: PendingAction) => {
    try {
      const defaultCalendar = calendars[0];

      switch (action.type) {
        case 'create': {
          const response = await fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: action.data.title,
              description: action.data.description,
              startTime: action.data.startTime,
              endTime: action.data.endTime,
              calendarId: action.data.calendarId || defaultCalendar?.id,
              color: action.data.color || defaultCalendar?.color || '#3b82f6',
              isAllDay: action.data.isAllDay || false,
              reminderMinutes: action.data.reminderMinutes ?? 15,
              recurrenceRule: action.data.recurrenceRule || null,
            }),
          });

          if (response.ok) {
            const created = await response.json();
            addEvent({
              ...created,
              startTime: new Date(created.startTime),
              endTime: new Date(created.endTime),
              recurrenceRule: created.recurrenceRule ? JSON.parse(created.recurrenceRule) : null,
            });
          } else {
            const errorData = await response.json();
            console.error('Error creating event:', errorData);
          }
          break;
        }

        case 'update':
        case 'move': {
          if (!action.data.eventId) break;

          const updateData: Record<string, unknown> = {};
          if (action.data.title) updateData.title = action.data.title;
          if (action.data.description !== undefined) updateData.description = action.data.description;
          if (action.data.startTime) updateData.startTime = action.data.startTime;
          if (action.data.endTime) updateData.endTime = action.data.endTime;
          if (action.data.color) updateData.color = action.data.color;
          if (action.data.isAllDay !== undefined) updateData.isAllDay = action.data.isAllDay;
          if (action.data.reminderMinutes !== undefined) updateData.reminderMinutes = action.data.reminderMinutes;
          if (action.data.recurrenceRule !== undefined) {
            updateData.recurrenceRule = action.data.recurrenceRule || null;
          }

          const response = await fetch(`/api/events/${action.data.eventId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData),
          });

          if (response.ok) {
            const updated = await response.json();
            updateEvent(action.data.eventId, {
              ...updated,
              startTime: new Date(updated.startTime),
              endTime: new Date(updated.endTime),
              recurrenceRule: updated.recurrenceRule ? JSON.parse(updated.recurrenceRule) : null,
            });
          }
          break;
        }

        case 'delete': {
          if (!action.data.eventId) break;

          const response = await fetch(`/api/events/${action.data.eventId}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            removeEvent(action.data.eventId);
          }
          break;
        }
      }

      acceptAction(action.id);
    } catch (error) {
      console.error('Error executing action:', error);
      rejectAction(action.id);
    }
  };

  const handleAcceptAction = (action: PendingAction) => {
    executeAction(action);
  };

  const handleRejectAction = (action: PendingAction) => {
    rejectAction(action.id);
  };

  const handleAcceptAll = () => {
    const pending = getPendingActions();
    pending.forEach(executeAction);
  };

  const pending = getPendingActions();

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">MentorRotina</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Assistente IA</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearMessages}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Limpar conversa"
          >
            <Trash2 className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">
              Olá! Sou o MentorRotina
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
              Posso ajudar você a organizar sua agenda. Experimente dizer:
            </p>
            <div className="mt-4 space-y-2">
              {[
                'Quero ir na academia amanhã às 7h',
                'Move a reunião de terça pra quinta',
                'O que tenho pra fazer essa semana?',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="block w-full text-left px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  "{suggestion}"
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex gap-3',
              message.role === 'user' ? 'flex-row-reverse' : ''
            )}
          >
            <div
              className={cn(
                'w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center',
                message.role === 'user'
                  ? 'bg-blue-600'
                  : 'bg-gradient-to-br from-blue-500 to-purple-600'
              )}
            >
              {message.role === 'user' ? (
                <span className="text-white text-sm font-medium">V</span>
              ) : (
                <Bot className="w-4 h-4 text-white" />
              )}
            </div>
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-2',
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p
                className={cn(
                  'text-xs mt-1',
                  message.role === 'user'
                    ? 'text-blue-200'
                    : 'text-gray-500 dark:text-gray-400'
                )}
              >
                {format(message.timestamp, 'HH:mm')}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                <span className="text-sm text-gray-500">Pensando...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Pending Actions */}
      {pending.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Ações Pendentes ({pending.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handleAcceptAll}
                className="text-xs text-green-600 hover:text-green-700 font-medium"
              >
                Aceitar todas
              </button>
              <button
                onClick={rejectAllActions}
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                Rejeitar todas
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {pending.map((action) => {
              const isExpanded = expandedActions.has(action.id);
              const colorName = action.data.color ? COLOR_NAMES[action.data.color.toLowerCase()] || action.data.color : null;
              const recurrence = formatRecurrence(action.data.recurrenceRule);
              const reminder = formatReminder(action.data.reminderMinutes);
              const calendarName = action.data.calendarId
                ? calendars.find(c => c.id === action.data.calendarId)?.name
                : calendars[0]?.name;

              return (
                <div
                  key={action.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* Header row */}
                  <div className="flex items-center gap-2 p-2">
                    <button
                      onClick={() => toggleActionExpanded(action.id)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </button>

                    {/* Color indicator */}
                    {action.data.color && (
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: action.data.color }}
                      />
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {action.type === 'create' && '➕ '}
                        {action.type === 'update' && '✏️ '}
                        {action.type === 'move' && '📍 '}
                        {action.type === 'delete' && '🗑️ '}
                        {action.data.title || action.description}
                      </p>
                      {action.data.startTime && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {format(new Date(action.data.startTime), "EEE, d/MM 'às' HH:mm", { locale: ptBR })}
                          {action.data.endTime && ` - ${format(new Date(action.data.endTime), 'HH:mm')}`}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => handleAcceptAction(action)}
                        className="p-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
                        title="Aceitar"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRejectAction(action)}
                        className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                        title="Rejeitar"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-gray-100 dark:border-gray-700 space-y-2 text-xs">
                      {/* Title & Description */}
                      {action.data.title && (
                        <div className="flex items-start gap-2">
                          <Calendar className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Título: </span>
                            <span className="text-gray-900 dark:text-white">{action.data.title}</span>
                          </div>
                        </div>
                      )}

                      {action.data.description && (
                        <div className="flex items-start gap-2">
                          <span className="text-gray-400 text-sm ml-0.5">📝</span>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Descrição: </span>
                            <span className="text-gray-900 dark:text-white">{action.data.description}</span>
                          </div>
                        </div>
                      )}

                      {/* Date/Time */}
                      {action.data.startTime && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Horário: </span>
                            <span className="text-gray-900 dark:text-white">
                              {format(new Date(action.data.startTime), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                              {action.data.endTime && ` até ${format(new Date(action.data.endTime), 'HH:mm')}`}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Color */}
                      {colorName && (
                        <div className="flex items-center gap-2">
                          <Palette className="w-3.5 h-3.5 text-gray-400" />
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-500 dark:text-gray-400">Cor: </span>
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: action.data.color }}
                            />
                            <span className="text-gray-900 dark:text-white">{colorName}</span>
                          </div>
                        </div>
                      )}

                      {/* Calendar */}
                      {calendarName && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Calendário: </span>
                            <span className="text-gray-900 dark:text-white">{calendarName}</span>
                          </div>
                        </div>
                      )}

                      {/* Recurrence */}
                      {recurrence && (
                        <div className="flex items-center gap-2">
                          <Repeat className="w-3.5 h-3.5 text-gray-400" />
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Repetição: </span>
                            <span className="text-gray-900 dark:text-white">{recurrence}</span>
                          </div>
                        </div>
                      )}

                      {/* Reminder */}
                      {reminder && (
                        <div className="flex items-center gap-2">
                          <Bell className="w-3.5 h-3.5 text-gray-400" />
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Lembrete: </span>
                            <span className="text-gray-900 dark:text-white">{reminder}</span>
                          </div>
                        </div>
                      )}

                      {/* All day */}
                      {action.data.isAllDay && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 text-sm ml-0.5">☀️</span>
                          <span className="text-gray-900 dark:text-white">Evento de dia inteiro</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            rows={1}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!aiEnabled || isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !aiEnabled || isLoading}
            className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        {!aiEnabled && (
          <p className="text-xs text-gray-500 mt-2">
            Assistente IA desativado. Ative nas configurações.
          </p>
        )}
      </div>
    </div>
  );
}
