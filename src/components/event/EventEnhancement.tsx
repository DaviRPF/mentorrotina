'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, RefreshCw, Sparkles, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { useSettingsStore } from '@/store/settings-store';
import { useEnhancementStore } from '@/store/enhancement-store';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface EventEnhancementProps {
  eventId: string;
  eventTitle: string;
  eventDescription: string | null;
  eventStart: Date;
  eventEnd: Date;
}

export function EventEnhancement({
  eventId,
  eventTitle,
  eventDescription,
  eventStart,
  eventEnd,
}: EventEnhancementProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { geminiModel } = useSettingsStore();

  // Use enhancement store for persistence
  const {
    getEnhancement,
    setEnhancement,
    addChatMessage,
    clearEnhancement,
  } = useEnhancementStore();

  // Get stored data for this event
  const storedData = getEnhancement(eventId);
  const enhancement = storedData?.enhancement || null;
  const chatMessages = storedData?.chatMessages || [];
  const context = storedData?.context || null;

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Generate enhancement
  const generateEnhancement = async () => {
    setIsLoading(true);
    setError(null);

    // Clear existing enhancement for regeneration
    clearEnhancement(eventId);

    try {
      const response = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          eventTitle,
          eventDescription,
          eventStart: eventStart.toISOString(),
          eventEnd: eventEnd.toISOString(),
          model: geminiModel,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao gerar aperfeiçoamento');
      }

      // Store in enhancement store
      setEnhancement(eventId, {
        enhancement: data.enhancement,
        context: data.context,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  // Send chat message
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message to store
    addChatMessage(eventId, { role: 'user', content: userMessage });
    setIsLoading(true);

    try {
      const response = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          eventTitle,
          eventDescription,
          eventStart: eventStart.toISOString(),
          eventEnd: eventEnd.toISOString(),
          model: geminiModel,
          message: userMessage,
          history: chatMessages,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar mensagem');
      }

      // Add assistant response to store
      addChatMessage(eventId, { role: 'assistant', content: data.enhancement });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Initial state - show button to generate (only if no stored enhancement)
  if (!enhancement && !isLoading && !error) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8 px-4">
        <Sparkles className="w-12 h-12 text-purple-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Aperfeiçoar Tarefa
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6 max-w-sm">
          Gere um guia personalizado de como executar esta tarefa da forma mais eficiente,
          baseado no seu histórico e preferências.
        </p>
        <button
          onClick={generateEnhancement}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl"
        >
          <Sparkles className="w-5 h-5" />
          Gerar Aperfeiçoamento
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Context info */}
      {context && (
        <div className="flex flex-wrap gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700 text-xs">
          {context.similarEventsCount > 0 && (
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
              {context.similarEventsCount} eventos similares
            </span>
          )}
          {context.relevantReportsCount > 0 && (
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
              {context.relevantReportsCount} relatórios relevantes
            </span>
          )}
          {context.hasMemories && (
            <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded">
              Memórias ativas
            </span>
          )}
          {context.hasBooks && (
            <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded">
              Livros de referência
            </span>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          <button
            onClick={generateEnhancement}
            className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && chatMessages.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 py-8">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-4" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Analisando seu histórico e gerando insights...
          </p>
        </div>
      )}

      {/* Chat messages */}
      {chatMessages.length > 0 && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[90%] rounded-lg px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {isLoading && chatMessages.length > 0 && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3">
                <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      )}

      {/* Chat input and actions */}
      {enhancement && (
        <div className="border-t dark:border-gray-700 p-4 space-y-3">
          {/* Toggle chat */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            <MessageSquare className="w-4 h-4" />
            Tirar dúvidas ou ajustar
            {isChatOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {isChatOpen && (
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Pergunte algo ou peça ajustes..."
                rows={2}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm resize-none bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          )}

          {/* Regenerate button */}
          <button
            onClick={generateEnhancement}
            disabled={isLoading}
            className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Regenerar aperfeiçoamento
          </button>
        </div>
      )}
    </div>
  );
}
