'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  addDays,
  eachDayOfInterval,
  format,
  isSameDay,
  setHours,
  setMinutes,
  addMinutes,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Flag } from 'lucide-react';
import { useCalendarStore } from '@/store/calendar-store';
import { useDayTrackerStore } from '@/store/day-tracker-store';
import { EventBlock } from './EventBlock';
import { CalendarEvent } from '@/types';
import { cn } from '@/lib/utils';

const HOUR_HEIGHT = 60; // pixels per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function WeekView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ day: Date; hour: number; minutes: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ day: Date; hour: number; minutes: number } | null>(null);

  const {
    currentDate,
    getEventsForDateRange,
    setNewEventStart,
    setNewEventEnd,
    setIsEventModalOpen,
    events,
    calendars,
  } = useCalendarStore();

  const { openTracker, sessions } = useDayTrackerStore();

  // Janela deslizante de 7 dias a partir da data atual
  const weekStart = currentDate;
  const weekEnd = addDays(currentDate, 6);
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const today = new Date();

  const visibleEvents = getEventsForDateRange(weekStart, weekEnd);

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

  const getDayFromX = useCallback((x: number, container: HTMLElement): Date | null => {
    const rect = container.getBoundingClientRect();
    const timeColumnWidth = 60;
    const relativeX = x - rect.left - timeColumnWidth;
    const dayWidth = (rect.width - timeColumnWidth) / 7;
    const dayIndex = Math.floor(relativeX / dayWidth);

    if (dayIndex >= 0 && dayIndex < 7) {
      return days[dayIndex];
    }
    return null;
  }, [days]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    const container = containerRef.current;
    if (!container) return;

    const target = e.target as HTMLElement;
    if (target.closest('.event-block')) return; // Don't start drag on events

    const day = getDayFromX(e.clientX, container);
    if (!day) return;

    const { hour, minutes } = getTimeFromY(e.clientY, container);
    setIsDragging(true);
    setDragStart({ day, hour, minutes });
    setDragEnd({ day, hour, minutes: minutes + 15 });
  }, [getDayFromX, getTimeFromY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;
    const container = containerRef.current;
    if (!container) return;

    const { hour, minutes } = getTimeFromY(e.clientY, container);
    setDragEnd({ day: dragStart.day, hour, minutes: minutes + 15 });
  }, [isDragging, dragStart, getTimeFromY]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && dragStart && dragEnd) {
      let startTime = setMinutes(setHours(dragStart.day, dragStart.hour), dragStart.minutes);
      let endTime = setMinutes(setHours(dragEnd.day, dragEnd.hour), dragEnd.minutes);

      // Ensure start is before end
      if (startTime > endTime) {
        [startTime, endTime] = [endTime, startTime];
      }

      // Minimum 15 minutes
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
  }, [isDragging, dragStart, dragEnd, setNewEventStart, setNewEventEnd, setIsEventModalOpen]);

  const getEventsForDay = (day: Date): CalendarEvent[] => {
    return visibleEvents.filter((event) => {
      const eventDate = new Date(event.startTime);
      return isSameDay(eventDate, day) && !event.isAllDay;
    });
  };

  const getAllDayEventsForDay = (day: Date): CalendarEvent[] => {
    return visibleEvents.filter((event) => {
      const eventDate = new Date(event.startTime);
      return isSameDay(eventDate, day) && event.isAllDay;
    });
  };

  const renderDragPreview = () => {
    if (!isDragging || !dragStart || !dragEnd) return null;

    const startHour = Math.min(dragStart.hour + dragStart.minutes / 60, dragEnd.hour + dragEnd.minutes / 60);
    const endHour = Math.max(dragStart.hour + dragStart.minutes / 60, dragEnd.hour + dragEnd.minutes / 60);
    const dayIndex = days.findIndex((d) => isSameDay(d, dragStart.day));

    if (dayIndex === -1) return null;

    const top = startHour * HOUR_HEIGHT;
    const height = Math.max((endHour - startHour) * HOUR_HEIGHT, 15);

    return (
      <div
        className="absolute bg-blue-200 dark:bg-blue-800 opacity-50 rounded border-2 border-blue-500 pointer-events-none z-10"
        style={{
          top: `${top}px`,
          height: `${height}px`,
          left: `calc(${(dayIndex / 7) * 100}% + 2px)`,
          width: `calc(${100 / 7}% - 4px)`,
        }}
      />
    );
  };

  // Check for all-day events
  const hasAllDayEvents = days.some((day) => getAllDayEventsForDay(day).length > 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with day names */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="w-[60px] flex-shrink-0" />
        {days.map((day) => {
          // Check if day has an active/completed session
          const daySession = sessions.find(s => {
            const sessionDate = new Date(s.date);
            return isSameDay(sessionDate, day);
          });
          const hasReport = daySession?.status === 'completed';

          return (
            <div
              key={day.toISOString()}
              className="flex-1 text-center py-2 border-l border-gray-200 dark:border-gray-700 relative group"
            >
              {/* Day Tracker Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openTracker(day);
                }}
                className={cn(
                  'absolute top-1 right-1 p-1 rounded-full transition-all',
                  hasReport
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                    : 'opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-green-600'
                )}
                title={hasReport ? 'Ver relatório do dia' : 'Acompanhar dia'}
              >
                <Flag className="w-3.5 h-3.5" />
              </button>

              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                {format(day, 'EEE', { locale: ptBR })}
              </div>
              <div
                className={cn(
                  'text-2xl font-medium mt-1',
                  isSameDay(day, today)
                    ? 'w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center mx-auto'
                    : 'text-gray-900 dark:text-white'
                )}
              >
                {format(day, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      {/* All day events row */}
      {hasAllDayEvents && (
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="w-[60px] flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 p-1">
            Dia todo
          </div>
          {days.map((day) => {
            const allDayEvents = getAllDayEventsForDay(day);
            return (
              <div
                key={day.toISOString()}
                className="flex-1 border-l border-gray-200 dark:border-gray-700 p-1 min-h-[40px]"
              >
                {allDayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="text-xs px-2 py-1 rounded mb-1 truncate cursor-pointer hover:opacity-80"
                    style={{ backgroundColor: event.color, color: 'white' }}
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Time grid */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto relative"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="flex min-h-full">
          {/* Time column */}
          <div className="w-[60px] flex-shrink-0 bg-white dark:bg-gray-900">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-[60px] border-b border-gray-100 dark:border-gray-800 text-right pr-2 text-xs text-gray-500 dark:text-gray-400"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="-mt-2 block">
                  {hour.toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Days columns */}
          <div className="flex-1 flex relative">
            {days.map((day, dayIndex) => {
              const dayEvents = getEventsForDay(day);

              return (
                <div
                  key={day.toISOString()}
                  data-date={day.toISOString()}
                  className="flex-1 border-l border-gray-200 dark:border-gray-700 relative day-column"
                >
                  {/* Hour lines */}
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="border-b border-gray-100 dark:border-gray-800"
                      style={{ height: HOUR_HEIGHT }}
                    />
                  ))}

                  {/* Current time indicator */}
                  {isSameDay(day, today) && (
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
                </div>
              );
            })}

            {/* Drag preview */}
            {renderDragPreview()}
          </div>
        </div>
      </div>
    </div>
  );
}
