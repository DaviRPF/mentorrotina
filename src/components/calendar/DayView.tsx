'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  format,
  isSameDay,
  setHours,
  setMinutes,
  addMinutes,
  startOfDay,
  endOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Flag } from 'lucide-react';
import { useCalendarStore } from '@/store/calendar-store';
import { useDayTrackerStore } from '@/store/day-tracker-store';
import { EventBlock } from './EventBlock';
import { cn } from '@/lib/utils';

const HOUR_HEIGHT = 60;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function DayView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ hour: number; minutes: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ hour: number; minutes: number } | null>(null);

  const {
    currentDate,
    getEventsForDateRange,
    setNewEventStart,
    setNewEventEnd,
    setIsEventModalOpen,
  } = useCalendarStore();

  const { openTracker, sessions } = useDayTrackerStore();

  const today = new Date();

  // Check if day has a completed session
  const daySession = sessions.find(s => {
    const sessionDate = new Date(s.date);
    return isSameDay(sessionDate, currentDate);
  });
  const hasReport = daySession?.status === 'completed';
  const dayStart = startOfDay(currentDate);
  const dayEnd = endOfDay(currentDate);
  const visibleEvents = getEventsForDateRange(dayStart, dayEnd);

  // Scroll to current hour on mount
  useEffect(() => {
    if (containerRef.current) {
      const currentHour = new Date().getHours();
      containerRef.current.scrollTop = (currentHour - 1) * HOUR_HEIGHT;
    }
  }, []);

  const getTimeFromY = useCallback((y: number, container: HTMLElement) => {
    const rect = container.getBoundingClientRect();
    const relativeY = y - rect.top + container.scrollTop;
    const hour = Math.floor(relativeY / HOUR_HEIGHT);
    const minutes = Math.round(((relativeY % HOUR_HEIGHT) / HOUR_HEIGHT) * 60 / 15) * 15;
    return { hour: Math.max(0, Math.min(23, hour)), minutes: Math.min(45, Math.max(0, minutes)) };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const container = containerRef.current;
    if (!container) return;

    const target = e.target as HTMLElement;
    if (target.closest('.event-block')) return;

    const { hour, minutes } = getTimeFromY(e.clientY, container);
    setIsDragging(true);
    setDragStart({ hour, minutes });
    setDragEnd({ hour, minutes: minutes + 15 });
  }, [getTimeFromY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;
    const container = containerRef.current;
    if (!container) return;

    const { hour, minutes } = getTimeFromY(e.clientY, container);
    setDragEnd({ hour, minutes: minutes + 15 });
  }, [isDragging, dragStart, getTimeFromY]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && dragStart && dragEnd) {
      let startTime = setMinutes(setHours(currentDate, dragStart.hour), dragStart.minutes);
      let endTime = setMinutes(setHours(currentDate, dragEnd.hour), dragEnd.minutes);

      if (startTime > endTime) {
        [startTime, endTime] = [endTime, startTime];
      }

      if (endTime <= startTime) {
        endTime = addMinutes(startTime, 30);
      }

      setNewEventStart(startTime);
      setNewEventEnd(endTime);
      setIsEventModalOpen(true);
    }

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd, currentDate, setNewEventStart, setNewEventEnd, setIsEventModalOpen]);

  const dayEvents = visibleEvents.filter((event) => {
    const eventDate = new Date(event.startTime);
    return isSameDay(eventDate, currentDate) && !event.isAllDay;
  });

  const allDayEvents = visibleEvents.filter((event) => {
    const eventDate = new Date(event.startTime);
    return isSameDay(eventDate, currentDate) && event.isAllDay;
  });

  const renderDragPreview = () => {
    if (!isDragging || !dragStart || !dragEnd) return null;

    const startHour = Math.min(dragStart.hour + dragStart.minutes / 60, dragEnd.hour + dragEnd.minutes / 60);
    const endHour = Math.max(dragStart.hour + dragStart.minutes / 60, dragEnd.hour + dragEnd.minutes / 60);

    const top = startHour * HOUR_HEIGHT;
    const height = Math.max((endHour - startHour) * HOUR_HEIGHT, 15);

    return (
      <div
        className="absolute left-1 right-1 bg-blue-200 dark:bg-blue-800 opacity-50 rounded border-2 border-blue-500 pointer-events-none z-10"
        style={{
          top: `${top}px`,
          height: `${height}px`,
        }}
      />
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 relative">
        <div className="w-[40px] sm:w-[60px] flex-shrink-0" />
        <div className="flex-1 text-center py-2 sm:py-4">
          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 uppercase">
            {format(currentDate, 'EEEE', { locale: ptBR })}
          </div>
          <div
            className={cn(
              'text-2xl sm:text-3xl font-medium mt-1 inline-flex items-center justify-center',
              isSameDay(currentDate, today)
                ? 'w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-600 text-white'
                : 'text-gray-900 dark:text-white'
            )}
          >
            {format(currentDate, 'd')}
          </div>
        </div>
        {/* Day Tracker Button */}
        <button
          onClick={() => openTracker(currentDate)}
          className={cn(
            'absolute top-2 right-2 sm:top-3 sm:right-3 p-1.5 sm:p-2 rounded-full transition-all',
            hasReport
              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
          )}
          title={hasReport ? 'Ver relatório do dia' : 'Acompanhar dia'}
        >
          <Flag className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      {/* All day events */}
      {allDayEvents.length > 0 && (
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="w-[40px] sm:w-[60px] flex-shrink-0 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 p-1 sm:p-2">
            <span className="hidden sm:inline">Dia todo</span>
            <span className="sm:hidden">Todo</span>
          </div>
          <div className="flex-1 p-1 sm:p-2 space-y-1">
            {allDayEvents.map((event) => (
              <div
                key={event.id}
                className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded cursor-pointer hover:opacity-80"
                style={{ backgroundColor: event.color, color: 'white' }}
              >
                {event.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="flex min-h-full">
          {/* Time column */}
          <div className="w-[40px] sm:w-[60px] flex-shrink-0 bg-white dark:bg-gray-900">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-[60px] border-b border-gray-100 dark:border-gray-800 text-right pr-1 sm:pr-2 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400"
              >
                <span className="-mt-2 block">
                  {hour.toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day column */}
          <div className="flex-1 border-l border-gray-200 dark:border-gray-700 relative">
            {/* Hour lines */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="border-b border-gray-100 dark:border-gray-800"
                style={{ height: HOUR_HEIGHT }}
              />
            ))}

            {/* Current time indicator */}
            {isSameDay(currentDate, today) && (
              <div
                className="absolute left-0 right-0 border-t-2 border-red-500 z-20 pointer-events-none"
                style={{
                  top: `${(today.getHours() + today.getMinutes() / 60) * HOUR_HEIGHT}px`,
                }}
              >
                <div className="absolute -left-1 -top-1.5 w-3 h-3 rounded-full bg-red-500" />
              </div>
            )}

            {/* Events */}
            {dayEvents.map((event) => (
              <EventBlock
                key={event.id}
                event={event}
                hourHeight={HOUR_HEIGHT}
              />
            ))}

            {/* Drag preview */}
            {renderDragPreview()}
          </div>
        </div>
      </div>
    </div>
  );
}
