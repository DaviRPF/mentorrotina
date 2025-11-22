export type ViewType = 'day' | 'week' | 'month' | 'agenda';

export interface RecurrenceRule {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  interval: number; // every X days/weeks/etc
  daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
  endDate?: string;
  count?: number; // number of occurrences
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  startTime: Date;
  endTime: Date;
  color: string;
  isAllDay: boolean;
  calendarId: string;
  recurrenceRule?: RecurrenceRule | null;
  recurrenceEndDate?: Date | null;
  parentEventId?: string | null;
  exceptionDates?: string[] | null;
  reminderMinutes?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Calendar {
  id: string;
  name: string;
  color: string;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventFormData {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  color: string;
  isAllDay: boolean;
  calendarId: string;
  recurrenceRule?: RecurrenceRule | null;
  reminderMinutes?: number | null;
}

export type DeleteOption = 'this' | 'future' | 'all';

export const COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Gray', value: '#6b7280' },
];

export const RECURRENCE_OPTIONS = [
  { label: 'Não repetir', value: null },
  { label: 'Todo dia', value: { type: 'daily', interval: 1 } },
  { label: 'Dia sim, dia não', value: { type: 'daily', interval: 2 } },
  { label: 'Toda semana', value: { type: 'weekly', interval: 1 } },
  { label: 'Todo mês', value: { type: 'monthly', interval: 1 } },
  { label: 'Todo ano', value: { type: 'yearly', interval: 1 } },
  { label: 'Dias da semana (Seg-Sex)', value: { type: 'weekly', interval: 1, daysOfWeek: [1, 2, 3, 4, 5] } },
  { label: 'Personalizado...', value: 'custom' },
] as const;

export const REMINDER_OPTIONS = [
  { label: 'Sem lembrete', value: null },
  { label: '5 minutos antes', value: 5 },
  { label: '10 minutos antes', value: 10 },
  { label: '15 minutos antes', value: 15 },
  { label: '30 minutos antes', value: 30 },
  { label: '1 hora antes', value: 60 },
  { label: '1 dia antes', value: 1440 },
];
