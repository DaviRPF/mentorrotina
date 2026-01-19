'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Send, Flag, Loader2, ChevronLeft, FileText, ImageIcon, RefreshCw, Sparkles, MessageSquare, Clock, ChevronRight, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDayTrackerStore, Message } from '@/store/day-tracker-store';
import { useCalendarStore } from '@/store/calendar-store';
import { useSettingsStore } from '@/store/settings-store';
import { DayReportView } from './DayReportView';
import { useImageUpload } from '@/hooks/useImageUpload';
import { EventEnhancement } from '@/components/event/EventEnhancement';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface DayEvent {
  id: string;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date;
  color: string;
}

export function DayTrackerModal() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tracking' | 'enhancement'>('tracking');
  const [selectedEventForEnhancement, setSelectedEventForEnhancement] = useState<DayEvent | null>(null);

  // Image upload hook
  const { images, isProcessing, addImage, addImagesFromClipboard, removeImage, clearImages } = useImageUpload(5);

  const {
    isOpen,
    selectedDate,
    currentSession,
    isLoading: isSessionLoading,
    isGeneratingReport,
    isDeletingReport,
    closeTracker,
    fetchOrCreateSession,
    generateReport,
    deleteReport,
    addMessageToSession,
  } = useDayTrackerStore();

  const { events } = useCalendarStore();
  const { memories, generalOrientations } = useSettingsStore();

  // Fetch or create session when opened
  useEffect(() => {
    if (isOpen && selectedDate && !currentSession) {
      setError(null);
      fetchOrCreateSession(selectedDate).then((session) => {
        if (!session) {
          setError('Não foi possível criar a sessão. Tente novamente.');
        } else if (!session.conversationId) {
          setError('Sessão sem conversa associada. Tente fechar e abrir novamente.');
        }
      });
    }
  }, [isOpen, selectedDate, currentSession, fetchOrCreateSession]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('tracking');
      setSelectedEventForEnhancement(null);
      setShowReport(false);
    }
  }, [isOpen]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.conversation?.messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isSessionLoading && activeTab === 'tracking') {
      inputRef.current?.focus();
    }
  }, [isOpen, isSessionLoading, activeTab]);

  // Get today's events
  const getTodayEvents = useCallback((): DayEvent[] => {
    if (!selectedDate) return [];
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);

    return events.filter(e => {
      const eventStart = new Date(e.startTime);
      return eventStart >= dayStart && eventStart <= dayEnd;
    }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .map(e => ({
        id: e.id,
        title: e.title,
        description: e.description || null,
        startTime: new Date(e.startTime),
        endTime: new Date(e.endTime),
        color: e.color,
      }));
  }, [selectedDate, events]);

  // Handle paste for images
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      const hasImage = Array.from(items).some(item => item.type.startsWith('image/'));
      if (hasImage) {
        e.preventDefault();
        await addImagesFromClipboard(items);
      }
    }
  }, [addImagesFromClipboard]);

  // Handle file selection
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      for (const file of Array.from(files)) {
        await addImage(file);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [addImage]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if ((!input.trim() && images.length === 0) || isLoading) return;

    if (!currentSession?.conversationId) {
      setError('Sessão não inicializada. Tente fechar e abrir novamente.');
      return;
    }

    const userMessage = input.trim() || (images.length > 0 ? '[Imagem enviada]' : '');
    const imagesToSend = images.map(img => ({ base64: img.base64, mimeType: img.mimeType }));

    setInput('');
    clearImages();
    setIsLoading(true);
    setError(null);

    // Add user message to UI
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString(),
    };
    addMessageToSession(userMsg);

    // Save user message to DB
    try {
      await fetch(`/api/conversations/${currentSession.conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: userMessage }),
      });
    } catch (err) {
      console.error('Error saving user message:', err);
    }

    try {
      // Build context for AI
      const todayEvents = getTodayEvents();
      const eventsContext = todayEvents.length > 0
        ? todayEvents.map(e => {
            return `- ${e.title} (${format(e.startTime, 'HH:mm')} - ${format(e.endTime, 'HH:mm')})`;
          }).join('\n')
        : 'Nenhum evento planejado';

      const memoriesContext = memories.length > 0
        ? memories.map(m => `- ${m.content}`).join('\n')
        : '';

      const history = currentSession.conversation?.messages
        .map(m => ({
          role: m.role,
          content: m.content,
          timestamp: format(new Date(m.createdAt), 'HH:mm')
        })) || [];

      // Call chat API with day tracker context
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history,
          isDayTracker: true,
          dayTrackerContext: {
            date: selectedDate?.toISOString(),
            events: eventsContext,
            memories: memoriesContext,
            orientations: generalOrientations,
          },
          images: imagesToSend,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Add assistant message to UI
        const assistantMsg: Message = {
          id: Date.now().toString() + '-ai',
          role: 'assistant',
          content: data.response,
          createdAt: new Date().toISOString(),
        };
        addMessageToSession(assistantMsg);

        // Save assistant message to DB
        await fetch(`/api/conversations/${currentSession.conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'assistant', content: data.response }),
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Chat API error:', response.status, errorData);
        setError('Erro na resposta da IA. Tente novamente.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Erro ao enviar mensagem. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFinishDay = async () => {
    if (!currentSession) return;
    const report = await generateReport(currentSession.id);
    if (report) {
      setShowReport(true);
    }
  };

  const handleRegenerateReport = async () => {
    if (!currentSession) return;
    await generateReport(currentSession.id);
  };

  const handleDeleteReport = async () => {
    if (!currentSession) return;
    const success = await deleteReport(currentSession.id);
    if (success) {
      setShowReport(false);
    }
  };

  if (!isOpen) return null;

  const todayEvents = getTodayEvents();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-900 sm:rounded-xl shadow-2xl w-full h-full sm:h-[80vh] sm:max-w-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {(showReport || selectedEventForEnhancement) && (
              <button
                onClick={() => {
                  if (selectedEventForEnhancement) {
                    setSelectedEventForEnhancement(null);
                  } else {
                    setShowReport(false);
                  }
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              activeTab === 'tracking'
                ? "bg-gradient-to-br from-green-500 to-emerald-600"
                : "bg-gradient-to-br from-purple-500 to-blue-600"
            )}>
              {activeTab === 'tracking' ? (
                <Flag className="w-5 h-5 text-white" />
              ) : (
                <Sparkles className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {showReport
                  ? 'Relatório do Dia'
                  : selectedEventForEnhancement
                    ? selectedEventForEnhancement.title
                    : activeTab === 'tracking'
                      ? 'Acompanhamento'
                      : 'Aperfeiçoamento'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedEventForEnhancement
                  ? `${format(selectedEventForEnhancement.startTime, 'HH:mm')} - ${format(selectedEventForEnhancement.endTime, 'HH:mm')}`
                  : selectedDate && format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentSession?.report && !showReport && activeTab === 'tracking' && (
              <button
                onClick={() => setShowReport(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500"
                title="Ver relatório"
              >
                <FileText className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={closeTracker}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Tabs - only show when not viewing report or specific event enhancement */}
        {!showReport && !selectedEventForEnhancement && (
          <div className="flex gap-1 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <button
              onClick={() => setActiveTab('tracking')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                activeTab === 'tracking'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              <MessageSquare className="w-4 h-4" />
              Acompanhamento
            </button>
            <button
              onClick={() => setActiveTab('enhancement')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                activeTab === 'enhancement'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400'
              )}
            >
              <Sparkles className="w-4 h-4" />
              Aperfeiçoamento
            </button>
          </div>
        )}

        {isSessionLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-green-500" />
          </div>
        ) : error && activeTab === 'tracking' ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  if (selectedDate) {
                    fetchOrCreateSession(selectedDate);
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        ) : showReport && currentSession?.report ? (
          <>
            <DayReportView report={currentSession.report} />
            {/* Report Actions */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-2">
                <button
                  onClick={handleRegenerateReport}
                  disabled={isGeneratingReport || isDeletingReport}
                  className="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-600"
                >
                  {isGeneratingReport ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Regenerando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Regenerar
                    </>
                  )}
                </button>
                <button
                  onClick={handleDeleteReport}
                  disabled={isGeneratingReport || isDeletingReport}
                  className="py-2 px-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg font-medium hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-red-200 dark:border-red-800"
                >
                  {isDeletingReport ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Apagando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Apagar
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                Regenerar recria o relatório. Apagar remove e volta para o chat.
              </p>
            </div>
          </>
        ) : selectedEventForEnhancement ? (
          /* Event Enhancement View */
          <div className="flex-1 overflow-hidden">
            <EventEnhancement
              eventId={selectedEventForEnhancement.id}
              eventTitle={selectedEventForEnhancement.title}
              eventDescription={selectedEventForEnhancement.description}
              eventStart={selectedEventForEnhancement.startTime}
              eventEnd={selectedEventForEnhancement.endTime}
            />
          </div>
        ) : activeTab === 'enhancement' ? (
          /* Events List for Enhancement */
          <div className="flex-1 overflow-y-auto p-4">
            {todayEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Sparkles className="w-12 h-12 text-purple-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Nenhum evento hoje
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm">
                  Não há eventos planejados para este dia. Adicione eventos ao calendário para poder aperfeiçoá-los.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Selecione um evento para receber um guia personalizado de como executá-lo da forma mais eficiente.
                </p>
                {todayEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEventForEnhancement(event)}
                    className="w-full flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md transition-all group"
                  >
                    <div
                      className="w-1 h-12 rounded-full flex-shrink-0"
                      style={{ backgroundColor: event.color }}
                    />
                    <div className="flex-1 text-left">
                      <h4 className="font-medium text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {event.title}
                      </h4>
                      <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                        <Clock className="w-3.5 h-3.5" />
                        {format(event.startTime, 'HH:mm')} - {format(event.endTime, 'HH:mm')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-sm font-medium">Aperfeiçoar</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Tracking Tab - Original Chat */
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Error banner */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
                  <button
                    onClick={() => setError(null)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Welcome message if no messages */}
              {(!currentSession?.conversation?.messages || currentSession.conversation.messages.length === 0) && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                  <h3 className="font-medium text-green-800 dark:text-green-200 mb-2">
                    Olá! Vamos acompanhar seu dia?
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                    Me conte o que você já fez hoje e eu vou te ajudar a manter o foco nas próximas atividades.
                  </p>
                  {todayEvents.length > 0 && (
                    <div className="text-sm text-green-600 dark:text-green-400">
                      <strong>Atividades planejadas:</strong>
                      <ul className="mt-1 space-y-1">
                        {todayEvents.slice(0, 5).map(e => (
                          <li key={e.id}>
                            {format(e.startTime, 'HH:mm')} - {e.title}
                          </li>
                        ))}
                        {todayEvents.length > 5 && (
                          <li className="text-green-500">+{todayEvents.length - 5} mais...</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Messages */}
              {currentSession?.conversation?.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                    }`}
                  >
                    <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                    <p className={`text-xs mt-1 ${
                      message.role === 'user'
                        ? 'text-green-200'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {format(new Date(message.createdAt), 'HH:mm')}
                    </p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
                    <Loader2 className="w-5 h-5 animate-spin text-green-500" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              {currentSession?.status !== 'completed' && (
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={handleFinishDay}
                    disabled={isGeneratingReport || !currentSession?.conversation?.messages?.length}
                    className="flex-1 py-2 px-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isGeneratingReport ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Gerando relatório...
                      </>
                    ) : (
                      <>
                        <Flag className="w-4 h-4" />
                        Finalizar Dia
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Image preview */}
              {images.length > 0 && (
                <div className="flex gap-2 mb-3 flex-wrap">
                  {images.map((img) => (
                    <div key={img.id} className="relative group">
                      <img
                        src={`data:${img.mimeType};base64,${img.base64}`}
                        alt={img.name}
                        className="w-12 h-12 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                      />
                      <button
                        onClick={() => removeImage(img.id)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                  {isProcessing && (
                    <div className="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    </div>
                  )}
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />

              <form onSubmit={handleSubmit} className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || images.length >= 5}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Adicionar imagem"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder="O que você fez agora? (cole imagens com Ctrl+V)"
                  className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={(!input.trim() && images.length === 0) || isLoading}
                  className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
