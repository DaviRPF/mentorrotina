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
  addMonths,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useCalendarStore } from '@/store/calendar-store';
import { cn } from '@/lib/utils';

export function MiniCalendar() {
  const { currentDate, setCurrentDate } = useCalendarStore();
  const [viewDate, setViewDate] = useState(currentDate);

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const today = new Date();

  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white capitalize">
          {format(viewDate, 'MMMM yyyy', { locale: ptBR })}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewDate(subMonths(viewDate, 1))}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewDate(addMonths(viewDate, 1))}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day, i) => (
          <div
            key={i}
            className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1"
          >
            {day}
          </div>
        ))}

        {days.map((day) => (
          <button
            key={day.toISOString()}
            onClick={() => setCurrentDate(day)}
            className={cn(
              'text-center text-sm py-1 rounded-full transition-colors',
              !isSameMonth(day, viewDate) && 'text-gray-400 dark:text-gray-600',
              isSameMonth(day, viewDate) && 'text-gray-900 dark:text-white',
              isSameDay(day, today) && 'bg-blue-600 text-white',
              isSameDay(day, currentDate) &&
                !isSameDay(day, today) &&
                'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400',
              !isSameDay(day, today) &&
                !isSameDay(day, currentDate) &&
                'hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
          >
            {format(day, 'd')}
          </button>
        ))}
      </div>
    </div>
  );
}
