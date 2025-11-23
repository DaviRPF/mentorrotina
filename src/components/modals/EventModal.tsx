'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Trash2, Clock, Calendar, Bell, Repeat, AlignLeft } from 'lucide-react';
import { useCalendarStore } from '@/store/calendar-store';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { COLORS, REMINDER_OPTIONS, RecurrenceRule } from '@/types';
import { cn } from '@/lib/utils';

export function EventModal() {
  const {
    isEventModalOpen,
    setIsEventModalOpen,
    selectedEvent,
    setSelectedEvent,
    newEventStart,
    newEventEnd,
    setNewEventStart,
    setNewEventEnd,
    calendars,
    addEvent,
    updateEvent,
    removeEvent,
    events,
    setEvents,
  } = useCalendarStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [color, setColor] = useState(COLORS[0].value);
  const [calendarId, setCalendarId] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null);
  const [recurrenceType, setRecurrenceType] = useState<string>('none');
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isEditing = !!selectedEvent;
  const isRecurringInstance = selectedEvent?.parentEventId != null ||
    (selectedEvent?.id.includes('-') && selectedEvent?.id.split('-').length > 5);

  useEffect(() => {
    if (selectedEvent) {
      setTitle(selectedEvent.title);
      setDescription(selectedEvent.description || '');
      setColor(selectedEvent.color);
      setCalendarId(selectedEvent.calendarId);
      setIsAllDay(selectedEvent.isAllDay);
      setReminderMinutes(selectedEvent.reminderMinutes || null);

      const start = new Date(selectedEvent.startTime);
      const end = new Date(selectedEvent.endTime);
      setStartDate(format(start, 'yyyy-MM-dd'));
      setStartTime(format(start, 'HH:mm'));
      setEndDate(format(end, 'yyyy-MM-dd'));
      setEndTime(format(end, 'HH:mm'));

      if (selectedEvent.recurrenceRule) {
        const rule = typeof selectedEvent.recurrenceRule === 'string'
          ? JSON.parse(selectedEvent.recurrenceRule)
          : selectedEvent.recurrenceRule;

        if (rule.type === 'daily' && rule.interval === 1) {
          setRecurrenceType('daily');
        } else if (rule.type === 'daily' && rule.interval === 2) {
          setRecurrenceType('alternate');
        } else if (rule.type === 'weekly' && rule.daysOfWeek?.length === 5) {
          setRecurrenceType('weekdays');
        } else if (rule.type === 'weekly' && rule.daysOfWeek) {
          setRecurrenceType('custom');
          setCustomDays(rule.daysOfWeek);
        } else if (rule.type === 'weekly') {
          setRecurrenceType('weekly');
        } else if (rule.type === 'monthly') {
          setRecurrenceType('monthly');
        } else if (rule.type === 'yearly') {
          setRecurrenceType('yearly');
        }

        if (selectedEvent.recurrenceEndDate) {
          setRecurrenceEndDate(format(new Date(selectedEvent.recurrenceEndDate), 'yyyy-MM-dd'));
        }
      } else {
        setRecurrenceType('none');
      }
    } else if (newEventStart && newEventEnd) {
      setTitle('');
      setDescription('');
      setColor(COLORS[0].value);
      setCalendarId(calendars[0]?.id || '');
      setIsAllDay(false);
      setReminderMinutes(null);
      setRecurrenceType('none');
      setCustomDays([]);
      setRecurrenceEndDate('');

      setStartDate(format(newEventStart, 'yyyy-MM-dd'));
      setStartTime(format(newEventStart, 'HH:mm'));
      setEndDate(format(newEventEnd, 'yyyy-MM-dd'));
      setEndTime(format(newEventEnd, 'HH:mm'));
    }
  }, [selectedEvent, newEventStart, newEventEnd, calendars]);

  // Handle Delete key to delete event
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if modal is open, editing an event, and not in an input
      if (!isEventModalOpen || !selectedEvent) return;

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        // For recurring events, show options. For single events, delete directly
        if (isRecurringInstance || selectedEvent.recurrenceRule) {
          setShowDeleteOptions(true);
        } else {
          handleDelete('all');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEventModalOpen, selectedEvent, isRecurringInstance]);

  const handleClose = () => {
    setIsEventModalOpen(false);
    setSelectedEvent(null);
    setNewEventStart(null);
    setNewEventEnd(null);
    setShowDeleteOptions(false);
  };

  const getRecurrenceRule = (): RecurrenceRule | null => {
    switch (recurrenceType) {
      case 'daily':
        return { type: 'daily', interval: 1 };
      case 'alternate':
        return { type: 'daily', interval: 2 };
      case 'weekly':
        return { type: 'weekly', interval: 1 };
      case 'weekdays':
        return { type: 'weekly', interval: 1, daysOfWeek: [1, 2, 3, 4, 5] };
      case 'monthly':
        return { type: 'monthly', interval: 1 };
      case 'yearly':
        return { type: 'yearly', interval: 1 };
      case 'custom':
        return customDays.length > 0
          ? { type: 'weekly', interval: 1, daysOfWeek: customDays }
          : null;
      default:
        return null;
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !calendarId) return;

    setIsLoading(true);

    const eventData = {
      title,
      description: description || null,
      startTime: new Date(`${startDate}T${startTime}`),
      endTime: new Date(`${endDate}T${endTime}`),
      color,
      calendarId,
      isAllDay,
      reminderMinutes,
      recurrenceRule: getRecurrenceRule(),
      recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
    };

    try {
      if (isEditing && selectedEvent) {
        const baseId = selectedEvent.id.includes('-') && selectedEvent.id.split('-').length > 5
          ? selectedEvent.id.split('-').slice(0, 5).join('-')
          : selectedEvent.id;

        const response = await fetch(`/api/events/${baseId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...eventData,
            updateType: isRecurringInstance ? 'all' : undefined,
          }),
        });

        if (response.ok) {
          const updated = await response.json();
          updateEvent(baseId, updated);

          // Refresh events from server
          const eventsResponse = await fetch('/api/events');
          if (eventsResponse.ok) {
            const allEvents = await eventsResponse.json();
            setEvents(allEvents.map((e: Record<string, unknown>) => ({
              ...e,
              startTime: new Date(e.startTime as string),
              endTime: new Date(e.endTime as string),
              recurrenceRule: e.recurrenceRule ? JSON.parse(e.recurrenceRule as string) : null,
            })));
          }
        }
      } else {
        const response = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        });

        if (response.ok) {
          const created = await response.json();
          addEvent({
            ...created,
            startTime: new Date(created.startTime),
            endTime: new Date(created.endTime),
            recurrenceRule: created.recurrenceRule ? JSON.parse(created.recurrenceRule) : null,
          });
        }
      }

      handleClose();
    } catch (error) {
      console.error('Error saving event:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (type: 'this' | 'future' | 'all') => {
    if (!selectedEvent) return;

    setIsLoading(true);

    try {
      const baseId = selectedEvent.id.includes('-') && selectedEvent.id.split('-').length > 5
        ? selectedEvent.id.split('-').slice(0, 5).join('-')
        : selectedEvent.id;

      const response = await fetch(`/api/events/${selectedEvent.id}?type=${type}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        if (type === 'all') {
          removeEvent(baseId);
        }

        // Refresh events from server
        const eventsResponse = await fetch('/api/events');
        if (eventsResponse.ok) {
          const allEvents = await eventsResponse.json();
          setEvents(allEvents.map((e: Record<string, unknown>) => ({
            ...e,
            startTime: new Date(e.startTime as string),
            endTime: new Date(e.endTime as string),
            recurrenceRule: e.recurrenceRule ? JSON.parse(e.recurrenceRule as string) : null,
          })));
        }
      }

      handleClose();
    } catch (error) {
      console.error('Error deleting event:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const weekDays = [
    { label: 'D', value: 0 },
    { label: 'S', value: 1 },
    { label: 'T', value: 2 },
    { label: 'Q', value: 3 },
    { label: 'Q', value: 4 },
    { label: 'S', value: 5 },
    { label: 'S', value: 6 },
  ];

  const toggleCustomDay = (day: number) => {
    setCustomDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  return (
    <Modal
      isOpen={isEventModalOpen}
      onClose={handleClose}
      title={isEditing ? 'Editar evento' : 'Novo evento'}
      className="w-full max-w-lg"
    >
      <div className="space-y-3 sm:space-y-4">
        {/* Title */}
        <Input
          placeholder="Adicionar título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-lg font-medium border-0 border-b rounded-none px-0 focus:ring-0"
        />

        {/* Date and Time */}
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-gray-400 mt-2" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="allDay"
                checked={isAllDay}
                onChange={(e) => setIsAllDay(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="allDay" className="text-sm text-gray-700 dark:text-gray-300">
                Dia inteiro
              </label>
            </div>

            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600"
              />
              {!isAllDay && (
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600"
                />
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600"
              />
              {!isAllDay && (
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600"
                />
              )}
            </div>
          </div>
        </div>

        {/* Recurrence */}
        <div className="flex items-start gap-3">
          <Repeat className="w-5 h-5 text-gray-400 mt-2" />
          <div className="flex-1 space-y-2">
            <select
              value={recurrenceType}
              onChange={(e) => setRecurrenceType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600"
            >
              <option value="none">Não repetir</option>
              <option value="daily">Todo dia</option>
              <option value="alternate">Dia sim, dia não</option>
              <option value="weekly">Toda semana</option>
              <option value="weekdays">Dias da semana (Seg-Sex)</option>
              <option value="monthly">Todo mês</option>
              <option value="yearly">Todo ano</option>
              <option value="custom">Personalizado...</option>
            </select>

            {recurrenceType === 'custom' && (
              <div className="flex flex-wrap gap-1">
                {weekDays.map((day) => (
                  <button
                    key={day.value}
                    onClick={() => toggleCustomDay(day.value)}
                    className={cn(
                      'w-10 h-10 sm:w-8 sm:h-8 rounded-full text-sm font-medium transition-colors',
                      customDays.includes(day.value)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            )}

            {recurrenceType !== 'none' && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Até:</span>
                <input
                  type="date"
                  value={recurrenceEndDate}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600"
                  placeholder="Sem data de término"
                />
              </div>
            )}
          </div>
        </div>

        {/* Calendar */}
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-gray-400" />
          <select
            value={calendarId}
            onChange={(e) => setCalendarId(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600"
          >
            {calendars.map((cal) => (
              <option key={cal.id} value={cal.id}>
                {cal.name}
              </option>
            ))}
          </select>
        </div>

        {/* Reminder */}
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-gray-400" />
          <select
            value={reminderMinutes ?? ''}
            onChange={(e) => setReminderMinutes(e.target.value ? Number(e.target.value) : null)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600"
          >
            {REMINDER_OPTIONS.map((opt) => (
              <option key={String(opt.value)} value={opt.value ?? ''}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div className="flex items-start gap-3">
          <AlignLeft className="w-5 h-5 text-gray-400 mt-2" />
          <textarea
            placeholder="Adicionar descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm dark:bg-gray-800 dark:border-gray-600 resize-none"
          />
        </div>

        {/* Color */}
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full" style={{ backgroundColor: color }} />
          <div className="flex-1 flex flex-wrap gap-1.5 sm:gap-2">
            {COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                className={cn(
                  'w-8 h-8 sm:w-6 sm:h-6 rounded-full transition-transform',
                  color === c.value && 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                )}
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t dark:border-gray-700">
          <div>
            {isEditing && (
              <div className="relative">
                <Button
                  variant="ghost"
                  onClick={() => setShowDeleteOptions(!showDeleteOptions)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </Button>

                {showDeleteOptions && isRecurringInstance && (
                  <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[200px] z-50">
                    <button
                      onClick={() => handleDelete('this')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Excluir este evento
                    </button>
                    <button
                      onClick={() => handleDelete('future')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Excluir este e futuros
                    </button>
                    <button
                      onClick={() => handleDelete('all')}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Excluir todos os eventos
                    </button>
                  </div>
                )}

                {showDeleteOptions && !isRecurringInstance && (
                  <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[200px] z-50">
                    <button
                      onClick={() => handleDelete('all')}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Confirmar exclusão
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isLoading || !title.trim()}>
              {isLoading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
