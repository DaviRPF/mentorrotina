'use client';

import { useEffect, useState, useCallback } from 'react';
import { useCalendarStore } from '@/store/calendar-store';
import { useChatStore } from '@/store/chat-store';
import { useDayTrackerStore } from '@/store/day-tracker-store';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import { MonthView } from './MonthView';
import { AgendaView } from './AgendaView';
import { EventModal } from '@/components/modals/EventModal';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { DayTrackerModal } from '@/components/day-tracker/DayTrackerModal';
import { NotificationProvider } from './NotificationProvider';
import { QuickTodoInput } from '@/components/todos/QuickTodoInput';
import { TodoList } from '@/components/todos/TodoList';

export function Calendar() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
    view,
    setCalendars,
    setEvents,
    setIsLoading,
    goToPrevious,
    goToNext,
    goToToday,
    setView,
  } = useCalendarStore();

  const { toggleOpen: toggleChat } = useChatStore();
  const { fetchSessions, fetchReports } = useDayTrackerStore();

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Seed default calendar if needed
        await fetch('/api/seed', { method: 'POST' });

        // Fetch calendars
        const calendarsRes = await fetch('/api/calendars');
        if (calendarsRes.ok) {
          const calendars = await calendarsRes.json();
          setCalendars(calendars);
        }

        // Fetch events
        const eventsRes = await fetch('/api/events');
        if (eventsRes.ok) {
          const events = await eventsRes.json();
          setEvents(
            events.map((e: Record<string, unknown>) => ({
              ...e,
              startTime: new Date(e.startTime as string),
              endTime: new Date(e.endTime as string),
              recurrenceRule: e.recurrenceRule ? JSON.parse(e.recurrenceRule as string) : null,
            }))
          );
        }

        // Fetch day tracker sessions and reports
        await Promise.all([fetchSessions(), fetchReports()]);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [setCalendars, setEvents, setIsLoading, fetchSessions, fetchReports]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case 't':
        case 'T':
          goToToday();
          break;
        case 'd':
        case 'D':
          setView('day');
          break;
        case 'w':
        case 'W':
          setView('week');
          break;
        case 'm':
        case 'M':
          setView('month');
          break;
        case 'a':
        case 'A':
          setView('agenda');
          break;
        case 'i':
        case 'I':
          toggleChat();
          break;
      }
    },
    [goToPrevious, goToNext, goToToday, setView, toggleChat]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const renderView = () => {
    switch (view) {
      case 'day':
        return <DayView />;
      case 'week':
        return <WeekView />;
      case 'month':
        return <MonthView />;
      case 'agenda':
        return <AgendaView />;
      default:
        return <WeekView />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 flex flex-col overflow-hidden">
          {renderView()}
        </main>
      </div>
      <EventModal />
      <SettingsModal />
      <ChatSidebar />
      <DayTrackerModal />
      <NotificationProvider />
      <QuickTodoInput />
      <TodoList />
    </div>
  );
}
