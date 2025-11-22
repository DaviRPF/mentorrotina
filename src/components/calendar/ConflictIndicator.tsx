'use client';

import { useMemo } from 'react';
import { useCalendarStore } from '@/store/calendar-store';
import { CalendarEvent } from '@/types';
import { isSameDay, areIntervalsOverlapping } from 'date-fns';

interface ConflictIndicatorProps {
  event: CalendarEvent;
}

export function useConflicts(event: CalendarEvent): CalendarEvent[] {
  const { events, calendars } = useCalendarStore();

  return useMemo(() => {
    if (event.isAllDay) return [];

    const visibleCalendarIds = calendars.filter((c) => c.isVisible).map((c) => c.id);

    return events.filter((otherEvent) => {
      if (otherEvent.id === event.id) return false;
      if (otherEvent.isAllDay) return false;
      if (!visibleCalendarIds.includes(otherEvent.calendarId)) return false;

      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      const otherStart = new Date(otherEvent.startTime);
      const otherEnd = new Date(otherEvent.endTime);

      // Check if same day
      if (!isSameDay(eventStart, otherStart)) return false;

      // Check if overlapping
      return areIntervalsOverlapping(
        { start: eventStart, end: eventEnd },
        { start: otherStart, end: otherEnd }
      );
    });
  }, [event, events, calendars]);
}

export function ConflictIndicator({ event }: ConflictIndicatorProps) {
  const conflicts = useConflicts(event);

  if (conflicts.length === 0) return null;

  return (
    <div className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full" title={`Conflito com: ${conflicts.map(c => c.title).join(', ')}`} />
  );
}
