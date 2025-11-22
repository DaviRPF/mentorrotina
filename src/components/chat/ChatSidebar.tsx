'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Trash2, Check, XIcon, Loader2, Sparkles, ChevronDown, ChevronUp, Calendar, Clock, Repeat, Bell, Palette, Plus, MessageSquare, ChevronLeft, Edit2, Save, Brain } from 'lucide-react';
import { useChatStore, PendingAction, PendingMemoryAction, RecurrenceRule } from '@/store/chat-store';
import { useConversationStore } from '@/store/conversation-store';
import { useCalendarStore } from '@/store/calendar-store';
import { useSettingsStore } from '@/store/settings-store';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

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

// Color options for color picker
const COLOR_OPTIONS = [
  { value: '#3b82f6', name: 'Azul' },
  { value: '#ef4444', name: 'Vermelho' },
  { value: '#22c55e', name: 'Verde' },
  { value: '#eab308', name: 'Amarelo' },
  { value: '#a855f7', name: 'Roxo' },
  { value: '#ec4899', name: 'Rosa' },
  { value: '#f97316', name: 'Laranja' },
  { value: '#14b8a6', name: 'Teal' },
];

export function ChatSidebar() {
  const [input, setInput] = useState('');
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());
  const [showConversationList, setShowConversationList] = useState(false);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<PendingAction['data']>>({});
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(384); // 384px = w-96
  const [isResizing, setIsResizing] = useState(false);
  const [actionsHeight, setActionsHeight] = useState(256); // 256px default
  const [isResizingActions, setIsResizingActions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

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
    pendingActions,
    isOpen,
    isLoading,
    error,
    setIsOpen,
    addMessage: addLocalMessage,
    clearMessages,
    setIsLoading,
    setError,
    addPendingActions,
    acceptAction,
    rejectAction,
    acceptAllActions,
    rejectAllActions,
    getPendingActions,
    updateActionData,
    pendingMemoryActions,
    addPendingMemoryActions,
    acceptMemoryAction,
    rejectMemoryAction,
    clearPendingMemoryActions,
    getPendingMemoryActions,
  } = useChatStore();

  // Conversation store for database persistence
  const {
    conversations,
    currentConversationId,
    currentMessages,
    isLoading: isLoadingConversations,
    isLoadingMessages,
    fetchConversations,
    createConversation,
    selectConversation,
    deleteConversation,
    addMessage: addDbMessage,
    clearCurrentConversation,
  } = useConversationStore();

  const { addEvent, updateEvent, removeEvent, events, calendars, setEvents } = useCalendarStore();
  const { geminiModel, aiEnabled, memories, addMemory, updateMemory, removeMemory, generalOrientations, bookReferences, timeContexts } = useSettingsStore();

  // Load conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, pendingActions]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Handle Delete key for selected pending actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedActionId) {
          e.preventDefault();
          rejectAction(selectedActionId);
          setSelectedActionId(null);
        }
      }

      // Escape to deselect
      if (e.key === 'Escape') {
        setSelectedActionId(null);
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, selectedActionId, rejectAction]);

  // Handle sidebar resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      // Min 320px, max 800px
      setSidebarWidth(Math.min(800, Math.max(320, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing]);

  // Handle pending actions resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingActions || !sidebarRef.current) return;
      const sidebarRect = sidebarRef.current.getBoundingClientRect();
      const newHeight = sidebarRect.bottom - e.clientY;
      // Min 100px, max 600px
      setActionsHeight(Math.min(600, Math.max(100, newHeight)));
    };

    const handleMouseUp = () => {
      setIsResizingActions(false);
    };

    if (isResizingActions) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizingActions]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);
    setError(null);

    // Save user message to database
    await addDbMessage('user', userMessage);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          model: geminiModel,
          // Use all messages from DB for full context
          history: currentMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          // Personal context (immutable)
          memories: memories.map(m => m.content),
          // Mentor orientations
          orientations: generalOrientations,
          bookReferences: bookReferences.filter(b => b.enabled !== false).map(b => ({ title: b.title, topics: b.topics })),
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

      // Save assistant message to database with pending actions
      const pendingActionsData = data.actions && data.actions.length > 0 ? data.actions : undefined;
      await addDbMessage('assistant', data.response, pendingActionsData);

      // Add pending actions to local store for UI
      if (data.actions && data.actions.length > 0) {
        addPendingActions(data.actions);
      }

      // Analyze user message for personal info (memories)
      try {
        const memoryResponse = await fetch('/api/memories/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            memories: memories.map(m => ({ id: m.id, content: m.content })),
            model: geminiModel,
          }),
        });

        if (memoryResponse.ok) {
          const memoryData = await memoryResponse.json();
          if (memoryData.actions && memoryData.actions.length > 0) {
            addPendingMemoryActions(memoryData.actions);
          }
        }
      } catch (memErr) {
        console.error('Memory analysis error:', memErr);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      await addDbMessage(
        'assistant',
        'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Start new conversation
  const handleNewConversation = async () => {
    clearMessages(); // Clear local chat store
    clearCurrentConversation(); // Clear DB conversation
    setShowConversationList(false);
  };

  // Select existing conversation
  const handleSelectConversation = async (id: string) => {
    clearMessages(); // Clear local pending actions
    await selectConversation(id);
    setShowConversationList(false);
  };

  // Delete a conversation
  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Tem certeza que deseja excluir esta conversa?')) {
      await deleteConversation(id);
    }
  };

  // Start editing an action
  const startEditing = (action: PendingAction) => {
    setEditingActionId(action.id);
    setEditingData({ ...action.data });
    // Auto-expand the action being edited
    setExpandedActions(prev => {
      const next = new Set(prev);
      next.add(action.id);
      return next;
    });
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingActionId(null);
    setEditingData({});
  };

  // Save edited action
  const saveEditing = () => {
    if (editingActionId && editingData) {
      updateActionData(editingActionId, editingData);
      setEditingActionId(null);
      setEditingData({});
    }
  };

  // Format datetime for input
  const formatDateTimeForInput = (isoString: string | undefined): string => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return format(date, "yyyy-MM-dd'T'HH:mm");
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
    <div
      ref={sidebarRef}
      className="fixed right-0 top-0 bottom-0 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 flex flex-col"
      style={{ width: `${sidebarWidth}px` }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500 transition-colors z-10"
        onMouseDown={() => setIsResizing(true)}
      />
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {showConversationList ? (
            <button
              onClick={() => setShowConversationList(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          )}
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {showConversationList ? 'Conversas' : 'MentorRotina'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {showConversationList
                ? `${conversations.length} conversa${conversations.length !== 1 ? 's' : ''}`
                : 'Assistente IA'
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!showConversationList && (
            <>
              <button
                onClick={handleNewConversation}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Nova conversa"
              >
                <Plus className="w-4 h-4 text-gray-500" />
              </button>
              <button
                onClick={() => setShowConversationList(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Ver conversas"
              >
                <MessageSquare className="w-4 h-4 text-gray-500" />
              </button>
            </>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Conversation List */}
      {showConversationList ? (
        <div className="flex-1 overflow-y-auto">
          {isLoadingConversations ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 px-4">
              <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nenhuma conversa ainda
              </p>
              <button
                onClick={handleNewConversation}
                className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                Iniciar conversa
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={cn(
                    'w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-start gap-3',
                    currentConversationId === conv.id && 'bg-blue-50 dark:bg-blue-900/20'
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {conv.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {currentMessages.length === 0 && (
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

            {currentMessages.map((message) => (
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
                  <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                  <p
                    className={cn(
                      'text-xs mt-1',
                      message.role === 'user'
                        ? 'text-blue-200'
                        : 'text-gray-500 dark:text-gray-400'
                    )}
                  >
                    {format(new Date(message.createdAt), 'HH:mm')}
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

            {isLoadingMessages && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Carregando mensagens...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Pending Actions */}
          {pending.length > 0 && (
            <div
              className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 relative flex flex-col"
              style={{ height: `${actionsHeight}px`, minHeight: '100px' }}
            >
              {/* Resize handle */}
              <div
                className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-blue-500 transition-colors z-10"
                onMouseDown={() => setIsResizingActions(true)}
              />
              <div className="flex items-center justify-between p-4 pb-2">
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

              <div className="space-y-2 overflow-y-auto flex-1 px-4 pb-4">
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
                  onClick={() => setSelectedActionId(selectedActionId === action.id ? null : action.id)}
                  className={cn(
                    'bg-white dark:bg-gray-800 rounded-lg border overflow-hidden cursor-pointer transition-all',
                    selectedActionId === action.id
                      ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  )}
                >
                  {/* Header row - entire row is clickable for expand/collapse */}
                  <div
                    className="flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    onClick={(e) => { e.stopPropagation(); toggleActionExpanded(action.id); }}
                  >
                    <div className="p-1">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </div>

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

                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      {editingActionId === action.id ? (
                        <>
                          <button
                            onClick={saveEditing}
                            className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
                            title="Salvar"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                            title="Cancelar"
                          >
                            <XIcon className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEditing(action)}
                            className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
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
                        </>
                      )}
                    </div>
                  </div>

                  {/* Editing Form */}
                  {editingActionId === action.id && (
                    <div className="px-3 pb-3 pt-2 border-t border-gray-100 dark:border-gray-700 space-y-3 text-xs">
                      {/* Title */}
                      <div>
                        <label className="block text-gray-500 dark:text-gray-400 mb-1">Título</label>
                        <input
                          type="text"
                          value={editingData.title || ''}
                          onChange={(e) => setEditingData({ ...editingData, title: e.target.value })}
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-gray-500 dark:text-gray-400 mb-1">Descrição</label>
                        <input
                          type="text"
                          value={editingData.description || ''}
                          onChange={(e) => setEditingData({ ...editingData, description: e.target.value })}
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          placeholder="(opcional)"
                        />
                      </div>

                      {/* Start Time */}
                      <div>
                        <label className="block text-gray-500 dark:text-gray-400 mb-1">Início</label>
                        <input
                          type="datetime-local"
                          value={formatDateTimeForInput(editingData.startTime)}
                          onChange={(e) => setEditingData({ ...editingData, startTime: new Date(e.target.value).toISOString() })}
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                      </div>

                      {/* End Time */}
                      <div>
                        <label className="block text-gray-500 dark:text-gray-400 mb-1">Término</label>
                        <input
                          type="datetime-local"
                          value={formatDateTimeForInput(editingData.endTime)}
                          onChange={(e) => setEditingData({ ...editingData, endTime: new Date(e.target.value).toISOString() })}
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                      </div>

                      {/* Color */}
                      <div>
                        <label className="block text-gray-500 dark:text-gray-400 mb-1">Cor</label>
                        <div className="flex flex-wrap gap-1.5">
                          {COLOR_OPTIONS.map((color) => (
                            <button
                              key={color.value}
                              onClick={() => setEditingData({ ...editingData, color: color.value })}
                              className={cn(
                                'w-6 h-6 rounded-full border-2 transition-all',
                                editingData.color === color.value
                                  ? 'border-gray-900 dark:border-white scale-110'
                                  : 'border-transparent hover:scale-105'
                              )}
                              style={{ backgroundColor: color.value }}
                              title={color.name}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Calendar */}
                      <div>
                        <label className="block text-gray-500 dark:text-gray-400 mb-1">Calendário</label>
                        <select
                          value={editingData.calendarId || calendars[0]?.id || ''}
                          onChange={(e) => setEditingData({ ...editingData, calendarId: e.target.value })}
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        >
                          {calendars.map((cal) => (
                            <option key={cal.id} value={cal.id}>{cal.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Reminder */}
                      <div>
                        <label className="block text-gray-500 dark:text-gray-400 mb-1">Lembrete</label>
                        <select
                          value={editingData.reminderMinutes ?? 15}
                          onChange={(e) => setEditingData({ ...editingData, reminderMinutes: e.target.value ? Number(e.target.value) : null })}
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        >
                          <option value="">Sem lembrete</option>
                          <option value="5">5 minutos antes</option>
                          <option value="10">10 minutos antes</option>
                          <option value="15">15 minutos antes</option>
                          <option value="30">30 minutos antes</option>
                          <option value="60">1 hora antes</option>
                          <option value="1440">1 dia antes</option>
                        </select>
                      </div>

                      {/* All Day */}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`allday-${action.id}`}
                          checked={editingData.isAllDay || false}
                          onChange={(e) => setEditingData({ ...editingData, isAllDay: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        <label htmlFor={`allday-${action.id}`} className="text-gray-700 dark:text-gray-300">
                          Dia inteiro
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Expanded details (view mode) */}
                  {isExpanded && editingActionId !== action.id && (
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

          {/* Pending Memory Actions */}
          {getPendingMemoryActions().length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-purple-50 dark:bg-purple-900/20">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-purple-900 dark:text-purple-100 flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  Memórias Detectadas ({getPendingMemoryActions().length})
                </h3>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {getPendingMemoryActions().map((action) => (
                  <div
                    key={action.id}
                    className="bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-700 p-3"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded',
                        action.type === 'create' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                        action.type === 'update' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                        action.type === 'delete' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                      )}>
                        {action.type === 'create' && 'Nova'}
                        {action.type === 'update' && 'Atualizar'}
                        {action.type === 'delete' && 'Excluir'}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-1">{action.reason}</span>
                    </div>

                    {/* Show before/after for updates */}
                    {action.type === 'update' && action.currentContent && (
                      <div className="mb-2 text-xs">
                        <div className="text-gray-500 dark:text-gray-400 mb-1">Antes:</div>
                        <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded text-red-700 dark:text-red-300 line-through">
                          {action.currentContent}
                        </div>
                      </div>
                    )}

                    {/* Show new content */}
                    {(action.type === 'create' || action.type === 'update') && action.newContent && (
                      <div className="mb-2 text-xs">
                        {action.type === 'update' && <div className="text-gray-500 dark:text-gray-400 mb-1">Depois:</div>}
                        <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded text-green-700 dark:text-green-300">
                          {action.newContent}
                        </div>
                      </div>
                    )}

                    {/* Show content to delete */}
                    {action.type === 'delete' && action.currentContent && (
                      <div className="mb-2 text-xs">
                        <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded text-red-700 dark:text-red-300">
                          {action.currentContent}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => rejectMemoryAction(action.id)}
                        className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        Rejeitar
                      </button>
                      <button
                        onClick={() => {
                          // Apply the memory action
                          if (action.type === 'create' && action.newContent) {
                            addMemory(action.newContent);
                          } else if (action.type === 'update' && action.memoryId && action.newContent) {
                            updateMemory(action.memoryId, action.newContent);
                          } else if (action.type === 'delete' && action.memoryId) {
                            removeMemory(action.memoryId);
                          }
                          acceptMemoryAction(action.id);
                        }}
                        className="px-2 py-1 text-xs bg-purple-600 text-white hover:bg-purple-700 rounded"
                      >
                        Aceitar
                      </button>
                    </div>
                  </div>
                ))}
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
                disabled={!aiEnabled || isLoading || showConversationList}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || !aiEnabled || isLoading || showConversationList}
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
        </>
      )}
    </div>
  );
}
