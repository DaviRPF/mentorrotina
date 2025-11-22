'use client';

import { create } from 'zustand';
import { CalendarEvent, Calendar, ViewType, RecurrenceRule } from '@/types';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  addDays,
  addWeeks,
  addMonths,
  isSameDay,
  isAfter,
  isBefore,
  parseISO
} from 'date-fns';

interface CalendarStore {
  // State
  currentDate: Date;
  view: ViewType;
  events: CalendarEvent[];
  calendars: Calendar[];
  selectedEvent: CalendarEvent | null;
  isEventModalOpen: boolean;
  isLoading: boolean;
  searchQuery: string;

  // New event creation
  newEventStart: Date | null;
  newEventEnd: Date | null;

  // Actions
  setCurrentDate: (date: Date) => void;
  setView: (view: ViewType) => void;
  goToToday: () => void;
  goToPrevious: () => void;
  goToNext: () => void;

  // Event actions
  setEvents: (events: CalendarEvent[]) => void;
  addEvent: (event: CalendarEvent) => void;
  updateEvent: (id: string, event: Partial<CalendarEvent>) => void;
  removeEvent: (id: string) => void;
  setSelectedEvent: (event: CalendarEvent | null) => void;
  setIsEventModalOpen: (isOpen: boolean) => void;

  // New event creation
  setNewEventStart: (date: Date | null) => void;
  setNewEventEnd: (date: Date | null) => void;

  // Calendar actions
  setCalendars: (calendars: Calendar[]) => void;
  addCalendar: (calendar: Calendar) => void;
  updateCalendar: (id: string, calendar: Partial<Calendar>) => void;
  removeCalendar: (id: string) => void;
  toggleCalendarVisibility: (id: string) => void;

  // Loading
  setIsLoading: (isLoading: boolean) => void;

  // Search
  setSearchQuery: (query: string) => void;

  // Computed
  getVisibleEvents: () => CalendarEvent[];
  getEventsForDateRange: (start: Date, end: Date) => CalendarEvent[];
  getDateRange: () => { start: Date; end: Date };

  // Recurrence helpers
  expandRecurringEvents: (events: CalendarEvent[], start: Date, end: Date) => CalendarEvent[];
}

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  // Initial state
  currentDate: new Date(),
  view: 'week',
  events: [],
  calendars: [],
  selectedEvent: null,
  isEventModalOpen: false,
  isLoading: false,
  searchQuery: '',
  newEventStart: null,
  newEventEnd: null,

  // Navigation
  setCurrentDate: (date) => set({ currentDate: date }),
  setView: (view) => set({ view }),

  goToToday: () => set({ currentDate: new Date() }),

  goToPrevious: () => {
    const { currentDate, view } = get();
    switch (view) {
      case 'day':
        set({ currentDate: addDays(currentDate, -1) });
        break;
      case 'week':
        set({ currentDate: addWeeks(currentDate, -1) });
        break;
      case 'month':
      case 'agenda':
        set({ currentDate: addMonths(currentDate, -1) });
        break;
    }
  },

  goToNext: () => {
    const { currentDate, view } = get();
    switch (view) {
      case 'day':
        set({ currentDate: addDays(currentDate, 1) });
        break;
      case 'week':
        set({ currentDate: addWeeks(currentDate, 1) });
        break;
      case 'month':
      case 'agenda':
        set({ currentDate: addMonths(currentDate, 1) });
        break;
    }
  },

  // Events
  setEvents: (events) => set({ events }),
  addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
  updateEvent: (id, updates) => set((state) => ({
    events: state.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
  })),
  removeEvent: (id) => set((state) => ({
    events: state.events.filter((e) => e.id !== id),
  })),
  setSelectedEvent: (event) => set({ selectedEvent: event }),
  setIsEventModalOpen: (isOpen) => set({ isEventModalOpen: isOpen }),

  // New event
  setNewEventStart: (date) => set({ newEventStart: date }),
  setNewEventEnd: (date) => set({ newEventEnd: date }),

  // Calendars
  setCalendars: (calendars) => set({ calendars }),
  addCalendar: (calendar) => set((state) => ({ calendars: [...state.calendars, calendar] })),
  updateCalendar: (id, updates) => set((state) => ({
    calendars: state.calendars.map((c) => (c.id === id ? { ...c, ...updates } : c)),
  })),
  removeCalendar: (id) => set((state) => ({
    calendars: state.calendars.filter((c) => c.id !== id),
  })),
  toggleCalendarVisibility: (id) => set((state) => ({
    calendars: state.calendars.map((c) =>
      c.id === id ? { ...c, isVisible: !c.isVisible } : c
    ),
  })),

  // Loading
  setIsLoading: (isLoading) => set({ isLoading }),

  // Search
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Computed
  getVisibleEvents: () => {
    const { events, calendars, searchQuery } = get();
    const visibleCalendarIds = calendars.filter((c) => c.isVisible).map((c) => c.id);

    let filteredEvents = events.filter((e) => visibleCalendarIds.includes(e.calendarId));

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredEvents = filteredEvents.filter(
        (e) =>
          e.title.toLowerCase().includes(query) ||
          e.description?.toLowerCase().includes(query)
      );
    }

    return filteredEvents;
  },

  getEventsForDateRange: (start, end) => {
    const { getVisibleEvents, expandRecurringEvents } = get();
    const events = getVisibleEvents();
    const expandedEvents = expandRecurringEvents(events, start, end);

    return expandedEvents.filter((event) => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      return (
        (eventStart >= start && eventStart <= end) ||
        (eventEnd >= start && eventEnd <= end) ||
        (eventStart <= start && eventEnd >= end)
      );
    });
  },

  getDateRange: () => {
    const { currentDate, view } = get();
    switch (view) {
      case 'day':
        return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
      case 'week':
        return {
          start: startOfWeek(currentDate, { weekStartsOn: 0 }),
          end: endOfWeek(currentDate, { weekStartsOn: 0 })
        };
      case 'month':
      case 'agenda':
        return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
    }
  },

  // Recurrence expansion
  expandRecurringEvents: (events, rangeStart, rangeEnd) => {
    const result: CalendarEvent[] = [];

    events.forEach((event) => {
      if (!event.recurrenceRule) {
        result.push(event);
        return;
      }

      const rule = typeof event.recurrenceRule === 'string'
        ? JSON.parse(event.recurrenceRule) as RecurrenceRule
        : event.recurrenceRule;

      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      const duration = eventEnd.getTime() - eventStart.getTime();

      const exceptionDates = event.exceptionDates
        ? (typeof event.exceptionDates === 'string'
            ? JSON.parse(event.exceptionDates)
            : event.exceptionDates)
        : [];

      let currentDate = new Date(eventStart);
      let occurrenceCount = 0;
      const maxOccurrences = rule.count || 365; // Limit to prevent infinite loops

      while (currentDate <= rangeEnd && occurrenceCount < maxOccurrences) {
        // Check if this occurrence should be skipped
        const isException = exceptionDates.some((d: string) =>
          isSameDay(parseISO(d), currentDate)
        );

        // Check recurrence end date
        const recurrenceEnd = event.recurrenceEndDate ? new Date(event.recurrenceEndDate) : null;
        if (recurrenceEnd && isAfter(currentDate, recurrenceEnd)) {
          break;
        }

        if (!isException && currentDate >= rangeStart) {
          // For weekly recurrence with specific days
          if (rule.type === 'weekly' && rule.daysOfWeek && rule.daysOfWeek.length > 0) {
            const dayOfWeek = currentDate.getDay();
            if (rule.daysOfWeek.includes(dayOfWeek)) {
              result.push({
                ...event,
                id: `${event.id}-${currentDate.toISOString()}`,
                startTime: new Date(currentDate),
                endTime: new Date(currentDate.getTime() + duration),
                parentEventId: event.id,
              });
            }
          } else {
            result.push({
              ...event,
              id: `${event.id}-${currentDate.toISOString()}`,
              startTime: new Date(currentDate),
              endTime: new Date(currentDate.getTime() + duration),
              parentEventId: event.id,
            });
          }
        }

        // Move to next occurrence based on rule type
        switch (rule.type) {
          case 'daily':
            currentDate = addDays(currentDate, rule.interval);
            break;
          case 'weekly':
            if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
              // Move to next day, but only count week intervals when wrapping
              currentDate = addDays(currentDate, 1);
              if (currentDate.getDay() === 0 && rule.interval > 1) {
                currentDate = addWeeks(currentDate, rule.interval - 1);
              }
            } else {
              currentDate = addWeeks(currentDate, rule.interval);
            }
            break;
          case 'monthly':
            currentDate = addMonths(currentDate, rule.interval);
            break;
          case 'yearly':
            currentDate = addMonths(currentDate, 12 * rule.interval);
            break;
          default:
            currentDate = addDays(currentDate, rule.interval);
        }

        occurrenceCount++;
      }
    });

    return result;
  },
}));
