'use client';

import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Menu, Sun, Moon, Settings, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCalendarStore } from '@/store/calendar-store';
import { useSettingsStore } from '@/store/settings-store';
import { useChatStore } from '@/store/chat-store';
import { Button } from '@/components/ui/Button';
import { ViewType } from '@/types';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const {
    currentDate,
    view,
    setView,
    goToToday,
    goToPreviousDay,
    goToNextDay,
    goToPreviousWeek,
    goToNextWeek,
    searchQuery,
    setSearchQuery,
  } = useCalendarStore();

  const { setIsSettingsOpen, aiEnabled, theme, updateSettings } = useSettingsStore();
  const { toggleOpen: toggleChat, isOpen: isChatOpen } = useChatStore();

  // Apply theme based on settings
  useEffect(() => {
    const applyTheme = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = theme === 'dark' || (theme === 'system' && prefersDark);

      if (shouldBeDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();

    // Listen for system theme changes when using 'system' mode
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme();
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [theme]);

  const toggleDarkMode = () => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark);

    // Toggle between light and dark (not system)
    updateSettings({ theme: isDark ? 'light' : 'dark' });
  };

  const getTitle = () => {
    switch (view) {
      case 'day':
        return format(currentDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
      case 'week':
        return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
      case 'month':
        return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
      case 'agenda':
        return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
    }
  };

  const views: { label: string; value: ViewType }[] = [
    { label: 'Dia', value: 'day' },
    { label: 'Semana', value: 'week' },
    { label: 'Mês', value: 'month' },
    { label: 'Agenda', value: 'agenda' },
  ];

  // Compute if currently dark for the icon
  const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);

  return (
    <header className="h-14 sm:h-16 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-between px-2 sm:px-4 gap-1 sm:gap-4">
      <div className="flex items-center gap-1 sm:gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="text-xl font-semibold text-blue-600 dark:text-blue-400 hidden sm:block">
          MentorRotina
        </h1>

        <Button variant="secondary" size="sm" onClick={goToToday} className="text-xs sm:text-sm px-2 sm:px-3">
          Hoje
        </Button>

        <div className="flex items-center gap-0">
          <button
            onClick={goToPreviousWeek}
            className="p-1 sm:p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full hidden sm:block"
            title="-7 dias"
          >
            <ChevronsLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={goToPreviousDay}
            className="p-1 sm:p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
            title="-1 dia"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goToNextDay}
            className="p-1 sm:p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
            title="+1 dia"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={goToNextWeek}
            className="p-1 sm:p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full hidden sm:block"
            title="+7 dias"
          >
            <ChevronsRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        <h2 className="text-sm sm:text-lg font-medium text-gray-900 dark:text-white capitalize">
          <span className="hidden sm:inline">{getTitle()}</span>
          <span className="sm:hidden">{format(currentDate, "MMM yyyy", { locale: ptBR })}</span>
        </h2>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar eventos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 w-56 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="hidden sm:flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {views.map((v) => (
            <button
              key={v.value}
              onClick={() => setView(v.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === v.value
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              title={`Tecla: ${v.value[0].toUpperCase()}`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Mobile view selector */}
        <select
          value={view}
          onChange={(e) => setView(e.target.value as ViewType)}
          className="sm:hidden px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
        >
          {views.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>

        {/* AI Chat Button */}
        {aiEnabled && (
          <button
            onClick={toggleChat}
            className={`p-2 rounded-lg transition-colors ${
              isChatOpen
                ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
            title="Assistente IA"
          >
            <Sparkles className="w-5 h-5" />
          </button>
        )}

        {/* Settings Button */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          title="Configurações"
        >
          <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>

        {/* Dark Mode Button */}
        <button
          onClick={toggleDarkMode}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          title={isDark ? 'Modo claro' : 'Modo escuro'}
        >
          {isDark ? (
            <Sun className="w-5 h-5 text-yellow-500" />
          ) : (
            <Moon className="w-5 h-5 text-gray-600" />
          )}
        </button>
      </div>
    </header>
  );
}
