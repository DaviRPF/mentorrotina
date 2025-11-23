'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Send, Flag, Loader2, ChevronLeft, FileText, ImageIcon, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDayTrackerStore, Message } from '@/store/day-tracker-store';
import { useCalendarStore } from '@/store/calendar-store';
import { useSettingsStore } from '@/store/settings-store';
import { DayReportView } from './DayReportView';
import { useImageUpload } from '@/hooks/useImageUpload';

export function DayTrackerModal() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image upload hook
  const { images, isProcessing, addImage, addImagesFromClipboard, removeImage, clearImages } = useImageUpload(5);

  const {
    isOpen,
    selectedDate,
    currentSession,
    isLoading: isSessionLoading,
    isGeneratingReport,
    closeTracker,
    fetchOrCreateSession,
    generateReport,
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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.conversation?.messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isSessionLoading) {
      inputRef.current?.focus();
    }
  }, [isOpen, isSessionLoading]);

  // Get today's events
  const getTodayEvents = useCallback(() => {
    if (!selectedDate) return [];
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);

    return events.filter(e => {
      const eventStart = new Date(e.startTime);
      return eventStart >= dayStart && eventStart <= dayEnd;
    }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
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
            const start = new Date(e.startTime);
            const end = new Date(e.endTime);
            return `- ${e.title} (${format(start, 'HH:mm')} - ${format(end, 'HH:mm')})`;
          }).join('\n')
        : 'Nenhum evento planejado';

      const memoriesContext = memories.length > 0
        ? memories.map(m => `- ${m.content}`).join('\n')
        : '';

      const history = currentSession.conversation?.messages
        .map(m => ({ role: m.role, content: m.content })) || [];

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
    const report = await generateReport(currentSession.id);
    if (report) {
      // Report is already being shown, just need to refresh the view
      // The store update will trigger a re-render with the new report
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-900 sm:rounded-xl shadow-2xl w-full h-full sm:h-[80vh] sm:max-w-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {showReport && (
              <button
                onClick={() => setShowReport(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Flag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {showReport ? 'Relatório do Dia' : 'Acompanhamento'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedDate && format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentSession?.report && !showReport && (
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

        {isSessionLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-green-500" />
          </div>
        ) : error ? (
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
            {/* Regenerate Report Button */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleRegenerateReport}
                disabled={isGeneratingReport}
                className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-600"
              >
                {isGeneratingReport ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Regenerando relatório...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Regenerar Relatório
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                Recria o relatório com base na conversa atual
              </p>
            </div>
          </>
        ) : (
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
                  {getTodayEvents().length > 0 && (
                    <div className="text-sm text-green-600 dark:text-green-400">
                      <strong>Atividades planejadas:</strong>
                      <ul className="mt-1 space-y-1">
                        {getTodayEvents().slice(0, 5).map(e => (
                          <li key={e.id}>
                            {format(new Date(e.startTime), 'HH:mm')} - {e.title}
                          </li>
                        ))}
                        {getTodayEvents().length > 5 && (
                          <li className="text-green-500">+{getTodayEvents().length - 5} mais...</li>
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
                    <p className="whitespace-pre-wrap">{message.content}</p>
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
