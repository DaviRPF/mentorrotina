'use client';

import { useEffect, useRef } from 'react';
import { useCalendarStore } from '@/store/calendar-store';
import { isBefore, addMinutes, differenceInMinutes } from 'date-fns';

export function NotificationProvider() {
  const { events, calendars } = useCalendarStore();
  const notifiedEvents = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const checkNotifications = () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
      }

      const now = new Date();
      const visibleCalendarIds = calendars.filter((c) => c.isVisible).map((c) => c.id);

      events
        .filter((event) => visibleCalendarIds.includes(event.calendarId))
        .filter((event) => event.reminderMinutes != null)
        .forEach((event) => {
          const eventStart = new Date(event.startTime);
          const reminderTime = addMinutes(eventStart, -(event.reminderMinutes || 0));
          const notificationId = `${event.id}-${event.reminderMinutes}`;

          // Check if we should show notification
          if (
            !notifiedEvents.current.has(notificationId) &&
            isBefore(reminderTime, now) &&
            isBefore(now, eventStart)
          ) {
            const minutesUntil = differenceInMinutes(eventStart, now);

            new Notification('Lembrete: ' + event.title, {
              body: minutesUntil <= 1
                ? 'Começa agora!'
                : `Começa em ${minutesUntil} minutos`,
              icon: '/favicon.ico',
              tag: notificationId,
            });

            notifiedEvents.current.add(notificationId);
          }
        });
    };

    // Check immediately and then every minute
    checkNotifications();
    const interval = setInterval(checkNotifications, 60000);

    return () => clearInterval(interval);
  }, [events, calendars]);

  // Clean up old notification IDs periodically
  useEffect(() => {
    const cleanup = () => {
      const now = new Date();
      const activeEventIds = new Set(
        events
          .filter((e) => new Date(e.endTime) > now)
          .map((e) => e.id)
      );

      notifiedEvents.current.forEach((id) => {
        const eventId = id.split('-').slice(0, -1).join('-');
        if (!activeEventIds.has(eventId)) {
          notifiedEvents.current.delete(id);
        }
      });
    };

    const interval = setInterval(cleanup, 3600000); // Every hour
    return () => clearInterval(interval);
  }, [events]);

  return null;
}
