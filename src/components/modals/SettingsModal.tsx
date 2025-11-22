'use client';

import { Modal } from '@/components/ui/Modal';
import { useSettingsStore, GEMINI_MODELS, GeminiModel, BookReference, Memory, TimeContextType, TIME_CONTEXT_LABELS, TIME_CONTEXT_DURATIONS } from '@/store/settings-store';
import { Bot, Calendar, Bell, Palette, RotateCcw, BookOpen, Plus, ChevronDown, ChevronUp, Trash2, GraduationCap, Target, Clock, Save, Sparkles, Loader2, Brain, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

type TabId = 'ai' | 'mentor' | 'goals' | 'calendar' | 'appearance' | 'notifications';

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'ai', label: 'Inteligência Artificial', icon: <Bot className="w-4 h-4" /> },
  { id: 'mentor', label: 'Orientações', icon: <GraduationCap className="w-4 h-4" /> },
  { id: 'goals', label: 'Metas', icon: <Target className="w-4 h-4" /> },
  { id: 'calendar', label: 'Calendário', icon: <Calendar className="w-4 h-4" /> },
  { id: 'appearance', label: 'Aparência', icon: <Palette className="w-4 h-4" /> },
  { id: 'notifications', label: 'Notificações', icon: <Bell className="w-4 h-4" /> },
];

// Helper to format time remaining
function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Expirado';

  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Time context order for display
const TIME_CONTEXT_ORDER: TimeContextType[] = ['weekly', 'monthly', 'quarterly', 'sixMonth', 'yearly'];

export function SettingsModal() {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    updateSettings,
    resetSettings,
    // AI
    geminiModel,
    aiEnabled,
    // Mentor/Orientations
    memories,
    addMemory,
    updateMemory,
    removeMemory,
    generalOrientations,
    bookReferences,
    addBookReference,
    updateBookReference,
    removeBookReference,
    toggleBookReference,
    // Time Contexts
    timeContexts,
    updateTimeContext,
    clearTimeContext,
    // Calendar
    weekStartsOn,
    defaultView,
    defaultEventDuration,
    defaultReminderMinutes,
    // Appearance
    theme,
    compactMode,
    showWeekNumbers,
    // Notifications
    enableNotifications,
    soundEnabled,
    // Time
    use24HourFormat,
    // Working hours
    workingHoursStart,
    workingHoursEnd,
    workingDays,
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<TabId>('ai');

  // State for adding/editing book references
  const [isAddingBook, setIsAddingBook] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkTitles, setBulkTitles] = useState('');
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookTopics, setNewBookTopics] = useState('');
  const [expandedBooks, setExpandedBooks] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);

  // State for memories
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [isBulkMemoryMode, setIsBulkMemoryMode] = useState(false);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [bulkMemoryText, setBulkMemoryText] = useState('');
  const [isProcessingMemories, setIsProcessingMemories] = useState(false);
  const [deleteMemoryConfirmId, setDeleteMemoryConfirmId] = useState<string | null>(null);

  // State for time contexts
  const [editingContexts, setEditingContexts] = useState<Record<TimeContextType, string>>({
    weekly: '',
    monthly: '',
    quarterly: '',
    sixMonth: '',
    yearly: '',
  });
  const [contextHasChanges, setContextHasChanges] = useState<Record<TimeContextType, boolean>>({
    weekly: false,
    monthly: false,
    quarterly: false,
    sixMonth: false,
    yearly: false,
  });
  const [, forceUpdate] = useState(0); // For timer updates

  // Initialize editing contexts from store
  useEffect(() => {
    if (timeContexts) {
      setEditingContexts({
        weekly: timeContexts.weekly?.content || '',
        monthly: timeContexts.monthly?.content || '',
        quarterly: timeContexts.quarterly?.content || '',
        sixMonth: timeContexts.sixMonth?.content || '',
        yearly: timeContexts.yearly?.content || '',
      });
      setContextHasChanges({
        weekly: false,
        monthly: false,
        quarterly: false,
        sixMonth: false,
        yearly: false,
      });
    }
  }, [isSettingsOpen]);

  // Update timer every minute
  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate(n => n + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleContextChange = (type: TimeContextType, value: string) => {
    setEditingContexts(prev => ({ ...prev, [type]: value }));
    const originalContent = timeContexts?.[type]?.content || '';
    setContextHasChanges(prev => ({ ...prev, [type]: value !== originalContent }));
  };

  const handleSaveContext = (type: TimeContextType) => {
    updateTimeContext(type, editingContexts[type]);
    setContextHasChanges(prev => ({ ...prev, [type]: false }));
  };

  const getTimeRemaining = (type: TimeContextType): number | null => {
    const context = timeContexts?.[type];
    if (!context?.updatedAt || !context.content.trim()) return null;
    const elapsed = Date.now() - context.updatedAt;
    return TIME_CONTEXT_DURATIONS[type] - elapsed;
  };

  const toggleBookExpanded = (bookId: string) => {
    setExpandedBooks(prev => {
      const next = new Set(prev);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else {
        next.add(bookId);
      }
      return next;
    });
  };

  const handleAddBook = () => {
    if (newBookTitle.trim()) {
      addBookReference(newBookTitle.trim(), newBookTopics.trim());
      setNewBookTitle('');
      setNewBookTopics('');
      setIsAddingBook(false);
    }
  };

  const handleEditBook = (book: BookReference) => {
    setEditingBookId(book.id);
    setNewBookTitle(book.title);
    setNewBookTopics(book.topics);
  };

  const handleSaveEdit = () => {
    if (editingBookId && newBookTitle.trim()) {
      updateBookReference(editingBookId, newBookTitle.trim(), newBookTopics.trim());
      setEditingBookId(null);
      setNewBookTitle('');
      setNewBookTopics('');
    }
  };

  const handleCancelEdit = () => {
    setEditingBookId(null);
    setNewBookTitle('');
    setNewBookTopics('');
    setIsAddingBook(false);
    setIsBulkMode(false);
    setBulkTitles('');
  };

  const handleBulkAdd = () => {
    const titles = bulkTitles
      .split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    titles.forEach(title => {
      addBookReference(title, '');
    });

    setBulkTitles('');
    setIsBulkMode(false);
    setIsAddingBook(false);
  };

  const handleDeleteBook = (bookId: string) => {
    removeBookReference(bookId);
    setDeleteConfirmId(null);
  };

  const handleGenerateTopics = async () => {
    if (!newBookTitle.trim()) return;

    setIsGeneratingTopics(true);
    try {
      const response = await fetch('/api/book-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newBookTitle.trim(), model: geminiModel }),
      });

      if (response.ok) {
        const data = await response.json();
        setNewBookTopics(data.topics);
      } else {
        const error = await response.json();
        console.error('Error generating topics:', error);
      }
    } catch (error) {
      console.error('Error generating topics:', error);
    } finally {
      setIsGeneratingTopics(false);
    }
  };

  // Memory handlers
  const handleAddMemory = () => {
    if (newMemoryContent.trim()) {
      addMemory(newMemoryContent.trim());
      setNewMemoryContent('');
      setIsAddingMemory(false);
    }
  };

  const handleEditMemory = (memory: Memory) => {
    setEditingMemoryId(memory.id);
    setNewMemoryContent(memory.content);
  };

  const handleSaveMemoryEdit = () => {
    if (editingMemoryId && newMemoryContent.trim()) {
      updateMemory(editingMemoryId, newMemoryContent.trim());
      setEditingMemoryId(null);
      setNewMemoryContent('');
    }
  };

  const handleCancelMemoryEdit = () => {
    setEditingMemoryId(null);
    setNewMemoryContent('');
    setIsAddingMemory(false);
    setIsBulkMemoryMode(false);
    setBulkMemoryText('');
  };

  const handleDeleteMemory = (id: string) => {
    removeMemory(id);
    setDeleteMemoryConfirmId(null);
  };

  const handleBulkImportMemories = async () => {
    if (!bulkMemoryText.trim()) return;

    setIsProcessingMemories(true);
    try {
      const response = await fetch('/api/memories/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: bulkMemoryText.trim(), model: geminiModel }),
      });

      if (response.ok) {
        const data = await response.json();
        data.memories.forEach((content: string) => {
          addMemory(content);
        });
        setBulkMemoryText('');
        setIsBulkMemoryMode(false);
        setIsAddingMemory(false);
      }
    } catch (error) {
      console.error('Error importing memories:', error);
    } finally {
      setIsProcessingMemories(false);
    }
  };

  const handleClose = () => {
    setIsSettingsOpen(false);
  };

  const toggleWorkingDay = (day: number) => {
    if (workingDays.includes(day)) {
      updateSettings({ workingDays: workingDays.filter((d) => d !== day) });
    } else {
      updateSettings({ workingDays: [...workingDays, day].sort() });
    }
  };

  const weekDayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <Modal
      isOpen={isSettingsOpen}
      onClose={handleClose}
      title="Configurações"
      className="max-w-2xl"
    >
      <div className="flex gap-4 -mx-6 -mt-2">
        {/* Tabs */}
        <div className="w-48 border-r border-gray-200 dark:border-gray-700 px-2 py-2 flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-left',
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}

          <hr className="my-3 border-gray-200 dark:border-gray-700" />

          <button
            onClick={resetSettings}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Restaurar padrões
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 py-2 pr-2 min-h-[400px]">
          {/* AI Tab */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                  Assistente IA
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Configure o assistente inteligente do calendário
                </p>

                <label className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Ativar assistente IA
                  </span>
                  <input
                    type="checkbox"
                    checked={aiEnabled}
                    onChange={(e) => updateSettings({ aiEnabled: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                  Modelo do Gemini
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Escolha o modelo de IA para o assistente
                </p>

                <div className="space-y-2">
                  {GEMINI_MODELS.map((model) => (
                    <label
                      key={model.id}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                        geminiModel === model.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      )}
                    >
                      <input
                        type="radio"
                        name="geminiModel"
                        value={model.id}
                        checked={geminiModel === model.id}
                        onChange={(e) => updateSettings({ geminiModel: e.target.value as GeminiModel })}
                        className="mt-1"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {model.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {model.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                  A API key deve ser configurada na variável de ambiente GEMINI_API_KEY
                </p>
              </div>
            </div>
          )}

          {/* Mentor/Orientations Tab */}
          {activeTab === 'mentor' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    Memórias
                  </h3>
                  {!isAddingMemory && !editingMemoryId && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setIsAddingMemory(true); setIsBulkMemoryMode(true); }}
                        className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400"
                        title="Importar texto e separar em memórias"
                      >
                        <FileText className="w-4 h-4" />
                        Importar
                      </button>
                      <button
                        onClick={() => { setIsAddingMemory(true); setIsBulkMemoryMode(false); }}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Fatos permanentes sobre você. A IA pode sugerir criar/editar memórias durante conversas.
                </p>

                {/* Bulk Import Form */}
                {isAddingMemory && isBulkMemoryMode && !editingMemoryId && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 mb-3">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">
                          Cole um texto sobre você (a IA vai separar em memórias)
                        </label>
                        <textarea
                          value={bulkMemoryText}
                          onChange={(e) => setBulkMemoryText(e.target.value)}
                          placeholder="Sou estudante de medicina, trabalho meio período. Tenho TDAH e preciso de pausas frequentes. Sou introvertido e prefiro atividades solo. Moro em São Paulo..."
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={handleCancelMemoryEdit}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleBulkImportMemories}
                          disabled={!bulkMemoryText.trim() || isProcessingMemories}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                        >
                          {isProcessingMemories ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          Processar com IA
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Single Add/Edit Form */}
                {(isAddingMemory && !isBulkMemoryMode || editingMemoryId) && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 mb-3">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">
                          {editingMemoryId ? 'Editar memória' : 'Nova memória'}
                        </label>
                        <textarea
                          value={newMemoryContent}
                          onChange={(e) => setNewMemoryContent(e.target.value)}
                          placeholder="Ex: Tem TDAH e precisa de pausas frequentes"
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={handleCancelMemoryEdit}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={editingMemoryId ? handleSaveMemoryEdit : handleAddMemory}
                          disabled={!newMemoryContent.trim()}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          {editingMemoryId ? 'Salvar' : 'Adicionar'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Memory List */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {memories.length === 0 && !isAddingMemory && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      Nenhuma memória registrada ainda.
                    </p>
                  )}

                  {memories.map((memory) => (
                    <div
                      key={memory.id}
                      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2"
                    >
                      {deleteMemoryConfirmId === memory.id ? (
                        <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded">
                          <p className="text-xs text-red-700 dark:text-red-400 mb-2">
                            Excluir esta memória?
                          </p>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setDeleteMemoryConfirmId(null)}
                              className="px-2 py-1 text-xs text-gray-600"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleDeleteMemory(memory.id)}
                              className="px-2 py-1 text-xs bg-red-600 text-white rounded"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <Brain className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                          <p className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                            {memory.content}
                          </p>
                          <button
                            onClick={() => handleEditMemory(memory)}
                            className="p-1 text-gray-400 hover:text-blue-600"
                            title="Editar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteMemoryConfirmId(memory.id)}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                  Orientações Gerais
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Instruções e diretrizes que o mentor IA deve seguir ao ajudar você.
                  Por exemplo: horários preferidos, objetivos de vida, hábitos que quer desenvolver.
                </p>
                <textarea
                  value={generalOrientations}
                  onChange={(e) => updateSettings({ generalOrientations: e.target.value })}
                  placeholder="Ex: Quero acordar às 6h e fazer exercícios. Meu objetivo é estudar 2h por dia. Prefiro reuniões pela manhã..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Livros de Referência
                  </h3>
                  {!isAddingBook && !editingBookId && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setIsAddingBook(true); setIsBulkMode(true); }}
                        className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 font-medium"
                        title="Adicionar vários livros de uma vez"
                      >
                        <Plus className="w-4 h-4" />
                        Vários
                      </button>
                      <button
                        onClick={() => { setIsAddingBook(true); setIsBulkMode(false); }}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  A IA usará TODO o conhecimento que ela tem sobre esses livros.
                </p>

                {/* Bulk Add Form */}
                {isAddingBook && isBulkMode && !editingBookId && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 mb-3">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">
                          Títulos dos livros (um por linha)
                        </label>
                        <textarea
                          value={bulkTitles}
                          onChange={(e) => setBulkTitles(e.target.value)}
                          placeholder="Atomic Habits&#10;Deep Work&#10;O Poder do Hábito&#10;Essencialismo"
                          rows={5}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          {bulkTitles.split('\n').filter(t => t.trim()).length} livro(s)
                        </p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleBulkAdd}
                          disabled={!bulkTitles.trim()}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Adicionar todos
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Single Add/Edit Book Form */}
                {(isAddingBook && !isBulkMode || editingBookId) && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 mb-3">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">
                          Título do livro
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newBookTitle}
                            onChange={(e) => setNewBookTitle(e.target.value)}
                            placeholder="Ex: Atomic Habits"
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            onClick={handleGenerateTopics}
                            disabled={!newBookTitle.trim() || isGeneratingTopics}
                            className="flex items-center gap-1 px-3 py-2 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            title="Gerar tópicos com IA"
                          >
                            {isGeneratingTopics ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                            Gerar
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">
                          Tópicos / Capítulos (opcional)
                        </label>
                        <textarea
                          value={newBookTopics}
                          onChange={(e) => setNewBookTopics(e.target.value)}
                          placeholder="Deixe vazio para usar todo o conhecimento da IA, ou liste os capítulos/tópicos específicos que você quer que a IA considere..."
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          {newBookTopics.length > 0 ? `${newBookTopics.length.toLocaleString()} caracteres` : 'Sem tópicos = usa conhecimento completo'}
                        </p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={editingBookId ? handleSaveEdit : handleAddBook}
                          disabled={!newBookTitle.trim()}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {editingBookId ? 'Salvar' : 'Adicionar'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Book List */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {bookReferences.length === 0 && !isAddingBook && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      Nenhum livro adicionado ainda.
                    </p>
                  )}

                  {bookReferences.map((book) => (
                    <div
                      key={book.id}
                      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                    >
                      {/* Delete Confirmation */}
                      {deleteConfirmId === book.id ? (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20">
                          <p className="text-sm text-red-700 dark:text-red-400 mb-2">
                            Tem certeza que deseja excluir "{book.title}"?
                          </p>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleDeleteBook(book.id)}
                              className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 p-2">
                            {/* Toggle enabled/disabled */}
                            <button
                              onClick={() => toggleBookReference(book.id)}
                              className={cn(
                                'relative w-9 h-5 rounded-full transition-colors flex-shrink-0',
                                book.enabled !== false
                                  ? 'bg-blue-600'
                                  : 'bg-gray-300 dark:bg-gray-600'
                              )}
                              title={book.enabled !== false ? 'Desativar' : 'Ativar'}
                            >
                              <span
                                className={cn(
                                  'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                                  book.enabled !== false ? 'translate-x-4' : 'translate-x-0.5'
                                )}
                              />
                            </button>
                            <button
                              onClick={() => toggleBookExpanded(book.id)}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                            >
                              {expandedBooks.has(book.id) ? (
                                <ChevronUp className="w-4 h-4 text-gray-500" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              )}
                            </button>
                            <BookOpen className={cn(
                              'w-4 h-4 flex-shrink-0',
                              book.enabled !== false ? 'text-blue-500' : 'text-gray-400'
                            )} />
                            <span className={cn(
                              'flex-1 text-sm font-medium truncate',
                              book.enabled !== false
                                ? 'text-gray-900 dark:text-white'
                                : 'text-gray-400 dark:text-gray-500'
                            )}>
                              {book.title}
                            </span>
                            {/* Topics indicator */}
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {book.topics ? `${book.topics.length.toLocaleString()} chars` : 'completo'}
                            </span>
                            <button
                              onClick={() => handleEditBook(book)}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Editar"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(book.id)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          {expandedBooks.has(book.id) && book.topics && (
                            <div className="px-3 pb-3 pt-1 border-t border-gray-100 dark:border-gray-700">
                              <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                                {book.topics}
                              </p>
                            </div>
                          )}
                          {expandedBooks.has(book.id) && !book.topics && (
                            <div className="px-3 pb-3 pt-1 border-t border-gray-100 dark:border-gray-700">
                              <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                                Usando conhecimento completo da IA sobre este livro
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  <strong>Como funciona:</strong> O mentor IA usará estas orientações e conhecimentos dos livros para te dar conselhos
                  personalizados, sugerir melhores horários para suas atividades, te incentivar a manter hábitos
                  e ajudar você a atingir seus objetivos de forma mais eficiente.
                </p>
              </div>
            </div>
          )}

          {/* Goals/Time Contexts Tab */}
          {activeTab === 'goals' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                  Metas e Contextos Temporais
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Defina seus objetivos para diferentes períodos. O mentor IA usará essas informações para
                  te ajudar a manter o foco e alcançar suas metas. O cronômetro indica quanto tempo resta do período.
                </p>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {TIME_CONTEXT_ORDER.map((type) => {
                  const timeRemaining = getTimeRemaining(type);
                  const isExpired = timeRemaining !== null && timeRemaining <= 0;
                  const hasContent = editingContexts[type].trim().length > 0;

                  return (
                    <div
                      key={type}
                      className={cn(
                        'p-3 rounded-lg border transition-colors',
                        isExpired
                          ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Target className={cn(
                            'w-4 h-4',
                            isExpired ? 'text-red-500' : 'text-blue-500'
                          )} />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {TIME_CONTEXT_LABELS[type]}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Timer */}
                          {timeRemaining !== null && (
                            <div className={cn(
                              'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                              isExpired
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                            )}>
                              <Clock className="w-3 h-3" />
                              {isExpired ? 'Expirado!' : formatTimeRemaining(timeRemaining)}
                            </div>
                          )}

                          {/* Save button */}
                          {contextHasChanges[type] && (
                            <button
                              onClick={() => handleSaveContext(type)}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              <Save className="w-3 h-3" />
                              Salvar
                            </button>
                          )}
                        </div>
                      </div>

                      <textarea
                        value={editingContexts[type]}
                        onChange={(e) => handleContextChange(type, e.target.value)}
                        placeholder={`O que você quer realizar neste período ${TIME_CONTEXT_LABELS[type].toLowerCase()}?`}
                        rows={3}
                        className={cn(
                          'w-full px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500',
                          isExpired
                            ? 'border-red-200 dark:border-red-800 bg-white dark:bg-gray-800'
                            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
                        )}
                      />

                      {isExpired && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          Este período expirou! Atualize suas metas e salve para reiniciar o cronômetro.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  <strong>Dica:</strong> Você não precisa preencher todos os períodos. Preencha apenas os que fazem
                  sentido para você. O mentor IA vai considerar todas as metas que você definir ao te dar conselhos
                  e sugestões de organização de rotina.
                </p>
              </div>
            </div>
          )}

          {/* Calendar Tab */}
          {activeTab === 'calendar' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Geral
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                      Semana começa em
                    </label>
                    <select
                      value={weekStartsOn}
                      onChange={(e) => updateSettings({ weekStartsOn: Number(e.target.value) as 0 | 1 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                    >
                      <option value={0}>Domingo</option>
                      <option value={1}>Segunda-feira</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                      Visualização padrão
                    </label>
                    <select
                      value={defaultView}
                      onChange={(e) => updateSettings({ defaultView: e.target.value as typeof defaultView })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                    >
                      <option value="day">Dia</option>
                      <option value="week">Semana</option>
                      <option value="month">Mês</option>
                      <option value="agenda">Agenda</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                      Duração padrão de eventos (minutos)
                    </label>
                    <select
                      value={defaultEventDuration}
                      onChange={(e) => updateSettings({ defaultEventDuration: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                    >
                      <option value={15}>15 minutos</option>
                      <option value={30}>30 minutos</option>
                      <option value={45}>45 minutos</option>
                      <option value={60}>1 hora</option>
                      <option value={90}>1h30</option>
                      <option value={120}>2 horas</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Horário de trabalho
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Usado pela IA para sugerir melhores horários
                </p>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                      Início
                    </label>
                    <select
                      value={workingHoursStart}
                      onChange={(e) => updateSettings({ workingHoursStart: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {i.toString().padStart(2, '0')}:00
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                      Fim
                    </label>
                    <select
                      value={workingHoursEnd}
                      onChange={(e) => updateSettings({ workingHoursEnd: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {i.toString().padStart(2, '0')}:00
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                    Dias de trabalho
                  </label>
                  <div className="flex gap-1">
                    {weekDayLabels.map((label, index) => (
                      <button
                        key={index}
                        onClick={() => toggleWorkingDay(index)}
                        className={cn(
                          'w-10 h-10 rounded-full text-xs font-medium transition-colors',
                          workingDays.includes(index)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Tema
                </h3>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'light', label: 'Claro' },
                    { value: 'dark', label: 'Escuro' },
                    { value: 'system', label: 'Sistema' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => updateSettings({ theme: option.value as typeof theme })}
                      className={cn(
                        'px-4 py-2 text-sm rounded-lg border transition-colors',
                        theme === option.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Modo compacto
                    </span>
                    <p className="text-xs text-gray-500">Reduz o espaçamento</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={compactMode}
                    onChange={(e) => updateSettings({ compactMode: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Mostrar número das semanas
                    </span>
                    <p className="text-xs text-gray-500">Exibe o número da semana no calendário</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={showWeekNumbers}
                    onChange={(e) => updateSettings({ showWeekNumbers: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Formato 24 horas
                    </span>
                    <p className="text-xs text-gray-500">14:00 em vez de 2:00 PM</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={use24HourFormat}
                    onChange={(e) => updateSettings({ use24HourFormat: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Ativar notificações
                    </span>
                    <p className="text-xs text-gray-500">Receba lembretes de eventos</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableNotifications}
                    onChange={(e) => updateSettings({ enableNotifications: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Som de notificação
                    </span>
                    <p className="text-xs text-gray-500">Tocar som ao receber notificação</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={(e) => updateSettings({ soundEnabled: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  Lembrete padrão
                </label>
                <select
                  value={defaultReminderMinutes ?? ''}
                  onChange={(e) => updateSettings({
                    defaultReminderMinutes: e.target.value ? Number(e.target.value) : null
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                >
                  <option value="">Sem lembrete</option>
                  <option value={5}>5 minutos antes</option>
                  <option value={10}>10 minutos antes</option>
                  <option value={15}>15 minutos antes</option>
                  <option value={30}>30 minutos antes</option>
                  <option value={60}>1 hora antes</option>
                  <option value={1440}>1 dia antes</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
