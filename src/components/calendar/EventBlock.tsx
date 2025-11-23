'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { useCalendarStore } from '@/store/calendar-store';
import { CalendarEvent } from '@/types';
import { cn } from '@/lib/utils';
import { useConflicts } from './ConflictIndicator';

interface EventBlockProps {
  event: CalendarEvent;
  hourHeight: number;
}

export function EventBlock({ event, hourHeight }: EventBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeType, setResizeType] = useState<'top' | 'bottom' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  const { setSelectedEvent, setIsEventModalOpen, updateEvent, events, setEvents } = useCalendarStore();
  const conflicts = useConflicts(event);

  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);

  const startHour = startTime.getHours() + startTime.getMinutes() / 60;
  const endHour = endTime.getHours() + endTime.getMinutes() / 60;
  const duration = endHour - startHour;

  const top = startHour * hourHeight;
  const height = Math.max(duration * hourHeight, 20);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Only open modal if user didn't drag/resize
    if (!hasMoved && !isResizing) {
      setSelectedEvent(event);
      setIsEventModalOpen(true);
    }
  };

  const handleResizeStart = (e: React.MouseEvent, type: 'top' | 'bottom') => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setResizeType(type);
  };

  const handleDragStart = (e: React.MouseEvent) => {
    // Don't prevent default or stop propagation here - let click work
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    setHasMoved(false);
    setIsMouseDown(true);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = async (e: MouseEvent) => {
      // Detect if user started dragging (moved mouse after mousedown)
      if (isMouseDown && mouseDownPos.current && !isDragging && !isResizing) {
        const dx = Math.abs(e.clientX - mouseDownPos.current.x);
        const dy = Math.abs(e.clientY - mouseDownPos.current.y);
        // Only start drag if moved more than 5px
        if (dx > 5 || dy > 5) {
          setIsDragging(true);
          setHasMoved(true);
        }
        return;
      }

      if (isResizing && resizeType) {
        const gridContainer = containerRef.current?.closest('.flex-1.overflow-auto');
        if (!gridContainer) return;

        const rect = gridContainer.getBoundingClientRect();
        const relativeY = e.clientY - rect.top + gridContainer.scrollTop;
        const hour = Math.floor(relativeY / hourHeight);
        const minutes = Math.round(((relativeY % hourHeight) / hourHeight) * 60 / 15) * 15;

        const newTime = new Date(startTime);
        newTime.setHours(hour, minutes, 0, 0);

        if (resizeType === 'top') {
          if (newTime < endTime) {
            // Update locally first for responsiveness
            const updatedEvents = events.map(e =>
              e.id === event.id ? { ...e, startTime: newTime } : e
            );
            setEvents(updatedEvents);
          }
        } else {
          if (newTime > startTime) {
            const updatedEvents = events.map(e =>
              e.id === event.id ? { ...e, endTime: newTime } : e
            );
            setEvents(updatedEvents);
          }
        }
      }

      if (isDragging) {
        const gridContainer = containerRef.current?.closest('.flex-1.overflow-auto');
        if (!gridContainer) return;

        const rect = gridContainer.getBoundingClientRect();
        const relativeY = e.clientY - rect.top + gridContainer.scrollTop - dragOffset.y;
        const hour = Math.floor(relativeY / hourHeight);
        const minutes = Math.round(((relativeY % hourHeight) / hourHeight) * 60 / 15) * 15;

        // Detect which day column we're over
        const dayColumns = gridContainer.querySelectorAll('.day-column');
        let targetDate: Date | null = null;

        for (const col of dayColumns) {
          const colRect = col.getBoundingClientRect();
          if (e.clientX >= colRect.left && e.clientX <= colRect.right) {
            const dateStr = col.getAttribute('data-date');
            if (dateStr) {
              targetDate = new Date(dateStr);
            }
            break;
          }
        }

        const eventDuration = endTime.getTime() - startTime.getTime();
        const newStartTime = targetDate ? new Date(targetDate) : new Date(startTime);
        newStartTime.setHours(hour, minutes, 0, 0);
        const newEndTime = new Date(newStartTime.getTime() + eventDuration);

        const updatedEvents = events.map(e =>
          e.id === event.id ? { ...e, startTime: newStartTime, endTime: newEndTime } : e
        );
        setEvents(updatedEvents);
      }
    };

    const handleMouseUp = async () => {
      if (isResizing || isDragging) {
        // Find the current event state
        const currentEvent = events.find(e => e.id === event.id);
        if (currentEvent) {
          // Save to server
          const baseId = event.id.includes('-') && event.id.split('-').length > 5
            ? event.id.split('-').slice(0, 5).join('-')
            : event.id;

          try {
            await fetch(`/api/events/${baseId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                startTime: currentEvent.startTime,
                endTime: currentEvent.endTime,
                updateType: event.parentEventId ? 'this' : undefined,
              }),
            });
          } catch (error) {
            console.error('Error updating event:', error);
          }
        }
      }

      mouseDownPos.current = null;
      setIsMouseDown(false);
      setIsResizing(false);
      setResizeType(null);
      setIsDragging(false);
    };

    // Listen for mouse events when mouse is down or dragging/resizing
    if (isMouseDown || isResizing || isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isMouseDown, isResizing, isDragging, resizeType, hourHeight, startTime, endTime, event, events, setEvents, dragOffset]);

  const isShort = height < 40;

  return (
    <div
      ref={containerRef}
      className={cn(
        'event-block absolute left-0.5 right-0.5 sm:left-1 sm:right-1 rounded px-1 sm:px-2 py-0.5 sm:py-1 cursor-pointer overflow-hidden',
        'hover:shadow-lg transition-shadow',
        (isResizing || isDragging) && 'opacity-75 shadow-lg z-30'
      )}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        backgroundColor: event.color,
        zIndex: isResizing || isDragging ? 30 : 10,
      }}
      onClick={handleClick}
      onMouseDown={handleDragStart}
    >
      {/* Top resize handle */}
      <div
        className="absolute top-0 left-0 right-0 h-2 cursor-n-resize hover:bg-black/10"
        onMouseDown={(e) => handleResizeStart(e, 'top')}
      />

      {/* Content - smaller on mobile */}
      <div className={cn('text-white text-[9px] sm:text-xs leading-tight', isShort && 'flex items-center gap-0.5 sm:gap-1')}>
        <div className="font-medium truncate">{event.title}</div>
        {!isShort && (
          <div className="text-white/80 text-[8px] sm:text-xs">
            {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
          </div>
        )}
        {isShort && (
          <span className="text-white/80 text-[8px] sm:text-xs">{format(startTime, 'HH:mm')}</span>
        )}
      </div>

      {/* Bottom resize handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize hover:bg-black/10"
        onMouseDown={(e) => handleResizeStart(e, 'bottom')}
      />

      {/* Indicators */}
      <div className="absolute bottom-1 right-1 flex items-center gap-1">
        {/* Conflict indicator */}
        {conflicts.length > 0 && (
          <div
            className="w-2 h-2 bg-orange-400 rounded-full"
            title={`Conflito com: ${conflicts.map((c) => c.title).join(', ')}`}
          />
        )}

        {/* Recurrence indicator */}
        {event.recurrenceRule && (
          <svg
            className="w-3 h-3 text-white/80"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
