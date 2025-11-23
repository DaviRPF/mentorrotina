'use client';

import {
  startOfMonth,
  endOfMonth,
  format,
  isSameDay,
  isToday,
  eachDayOfInterval,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCalendarStore } from '@/store/calendar-store';
import { cn } from '@/lib/utils';

export function AgendaView() {
  const {
    currentDate,
    getEventsForDateRange,
    setSelectedEvent,
    setIsEventModalOpen,
  } = useCalendarStore();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const visibleEvents = getEventsForDateRange(monthStart, monthEnd);

  // Group events by day
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const daysWithEvents = days
    .map((day) => ({
      date: day,
      events: visibleEvents
        .filter((event) => isSameDay(new Date(event.startTime), day))
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    }))
    .filter((day) => day.events.length > 0);

  const handleEventClick = (event: typeof visibleEvents[0]) => {
    setSelectedEvent(event);
    setIsEventModalOpen(true);
  };

  if (daysWithEvents.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <p className="text-lg font-medium">Nenhum evento este mês</p>
          <p className="text-sm mt-1">Clique em "Criar evento" para adicionar um novo evento</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="w-full md:max-w-3xl mx-auto py-2 sm:py-4 px-2 sm:px-0">
        {daysWithEvents.map(({ date, events }) => (
          <div key={date.toISOString()} className="mb-4 sm:mb-6">
            {/* Day header */}
            <div
              className={cn(
                'flex items-center gap-2 sm:gap-4 px-2 sm:px-4 py-2 sticky top-0 bg-white dark:bg-gray-900 z-10',
                isToday(date) && 'bg-blue-50 dark:bg-blue-900/20'
              )}
            >
              <div
                className={cn(
                  'text-center',
                  isToday(date) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                )}
              >
                <div className="text-xs uppercase font-medium">
                  {format(date, 'EEE', { locale: ptBR })}
                </div>
                <div
                  className={cn(
                    'text-xl sm:text-2xl font-bold',
                    isToday(date) && 'bg-blue-600 text-white w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center'
                  )}
                >
                  {format(date, 'd')}
                </div>
              </div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 capitalize">
                {format(date, "MMMM 'de' yyyy", { locale: ptBR })}
              </div>
            </div>

            {/* Events */}
            <div className="space-y-2 px-2 sm:px-4">
              {events.map((event) => {
                const start = new Date(event.startTime);
                const end = new Date(event.endTime);

                return (
                  <div
                    key={event.id}
                    onClick={() => handleEventClick(event)}
                    className="flex items-start gap-2 sm:gap-4 p-2 sm:p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors border border-gray-200 dark:border-gray-700"
                  >
                    {/* Color indicator */}
                    <div
                      className="w-1 h-full min-h-[40px] rounded-full flex-shrink-0"
                      style={{ backgroundColor: event.color }}
                    />

                    {/* Time */}
                    <div className="w-14 sm:w-20 flex-shrink-0 text-xs sm:text-sm">
                      {event.isAllDay ? (
                        <span className="text-gray-500 dark:text-gray-400">Dia todo</span>
                      ) : (
                        <>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {format(start, 'HH:mm')}
                          </div>
                          <div className="text-gray-500 dark:text-gray-400">
                            {format(end, 'HH:mm')}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">
                        {event.title}
                      </h3>
                      {event.description && (
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {event.description}
                        </p>
                      )}
                      {event.recurrenceRule && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <svg
                            className="w-3 h-3"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>Evento recorrente</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
