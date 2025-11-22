'use client';

import { Modal } from '@/components/ui/Modal';
import { useSettingsStore, GEMINI_MODELS, GeminiModel } from '@/store/settings-store';
import { Settings, Bot, Calendar, Bell, Clock, Palette, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

type TabId = 'ai' | 'calendar' | 'appearance' | 'notifications';

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'ai', label: 'Inteligência Artificial', icon: <Bot className="w-4 h-4" /> },
  { id: 'calendar', label: 'Calendário', icon: <Calendar className="w-4 h-4" /> },
  { id: 'appearance', label: 'Aparência', icon: <Palette className="w-4 h-4" /> },
  { id: 'notifications', label: 'Notificações', icon: <Bell className="w-4 h-4" /> },
];

export function SettingsModal() {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    updateSettings,
    resetSettings,
    // AI
    geminiModel,
    aiEnabled,
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
