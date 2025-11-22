'use client';

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  setHours,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCalendarStore } from '@/store/calendar-store';
import { cn } from '@/lib/utils';

export function MonthView() {
  const {
    currentDate,
    setCurrentDate,
    setView,
    getEventsForDateRange,
    setNewEventStart,
    setNewEventEnd,
    setIsEventModalOpen,
    setSelectedEvent,
  } = useCalendarStore();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const today = new Date();

  const visibleEvents = getEventsForDateRange(calendarStart, calendarEnd);

  const getEventsForDay = (day: Date) => {
    return visibleEvents.filter((event) => {
      const eventDate = new Date(event.startTime);
      return isSameDay(eventDate, day);
    });
  };

  const handleDayClick = (day: Date) => {
    const startTime = setHours(day, 9);
    const endTime = setHours(day, 10);
    setNewEventStart(startTime);
    setNewEventEnd(endTime);
    setIsEventModalOpen(true);
  };

  const handleDayDoubleClick = (day: Date) => {
    setCurrentDate(day);
    setView('day');
  };

  const handleEventClick = (e: React.MouseEvent, event: typeof visibleEvents[0]) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setIsEventModalOpen(true);
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Group days into weeks
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        {weekDays.map((day) => (
          <div
            key={day}
            className="py-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400 border-l border-gray-200 dark:border-gray-700 first:border-l-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-rows-[repeat(auto-fill,minmax(120px,1fr))] h-full">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
              {week.map((day) => {
                const dayEvents = getEventsForDay(day);
                const maxVisibleEvents = 3;
                const moreCount = dayEvents.length - maxVisibleEvents;

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => handleDayClick(day)}
                    onDoubleClick={() => handleDayDoubleClick(day)}
                    className={cn(
                      'min-h-[120px] p-1 border-l border-gray-200 dark:border-gray-700 first:border-l-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
                      !isSameMonth(day, currentDate) && 'bg-gray-50 dark:bg-gray-800/30'
                    )}
                  >
                    <div
                      className={cn(
                        'text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center',
                        isSameDay(day, today)
                          ? 'bg-blue-600 text-white rounded-full'
                          : isSameMonth(day, currentDate)
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-400 dark:text-gray-600'
                      )}
                    >
                      {format(day, 'd')}
                    </div>

                    <div className="space-y-0.5">
                      {dayEvents.slice(0, maxVisibleEvents).map((event) => (
                        <div
                          key={event.id}
                          onClick={(e) => handleEventClick(e, event)}
                          className="text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                          style={{ backgroundColor: event.color, color: 'white' }}
                        >
                          {event.isAllDay ? (
                            event.title
                          ) : (
                            <>
                              <span className="font-medium">
                                {format(new Date(event.startTime), 'HH:mm')}
                              </span>{' '}
                              {event.title}
                            </>
                          )}
                        </div>
                      ))}
                      {moreCount > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 px-1.5">
                          +{moreCount} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
