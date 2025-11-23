/**
 * Construtor de contexto unificado para todas as chamadas de IA
 * Garante que a IA sempre tenha acesso a todas as informações relevantes
 */

import prisma from '@/lib/prisma';
import { format, addDays, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ============================================================================
// TIPOS
// ============================================================================

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  startTimeISO: string;
  endTime: string;
  endTimeISO: string;
  isAllDay: boolean;
  calendarName: string;
  calendarId: string;
  color: string;
  isRecurring: boolean;
  recurrenceRule: string | null;
  reminderMinutes: number | null;
}

export interface Calendar {
  id: string;
  name: string;
  color: string;
}

export interface DayEvents {
  date: string;
  dateKey: string;
  events: { title: string; date: string; startTime: string; endTime: string }[];
}

export interface DayReport {
  date: string;
  dateKey: string;
  summary: string;
  completedTasks: string[];
  skippedTasks: string[];
  highlights: string[];
  insights: string[];
  completionRate: number;
}

export interface Todo {
  id: string;
  content: string;
  deadline: string | null;
  deadlineISO: string | null;
  priority: string;
  estimatedMinutes: number | null;
  status: string;
}

export interface Memory {
  id: string;
  content: string;
}

export interface BookReference {
  title: string;
  topics: string | null;
}

export interface TimeContext {
  type: string;
  content: string;
}

export interface FullContext {
  // Temporal
  today: string;
  todayISO: string;
  currentTime: string;
  dayOfWeek: string;
  isWeekend: boolean;

  // Calendário
  events: CalendarEvent[];
  calendars: Calendar[];
  pastEvents: DayEvents[];
  futureEvents: DayEvents[];

  // Histórico
  reports: DayReport[];

  // Tarefas
  todos: Todo[];

  // Configurações do usuário
  memories: Memory[];
  orientations: string;
  bookReferences: BookReference[];
  timeContexts: TimeContext[];
}

// ============================================================================
// FUNÇÕES DE BUILD
// ============================================================================

/**
 * Busca e constrói o contexto completo do sistema
 */
export async function buildFullContext(): Promise<FullContext> {
  const now = new Date();
  const thirtyDaysAgo = startOfDay(subDays(now, 30));
  const thirtyDaysAhead = endOfDay(addDays(now, 30));

  // Day of week info
  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const dayName = format(now, 'EEEE', { locale: ptBR });

  // Fetch all data in parallel
  const [events, calendars, dayReports, todos, settings] = await Promise.all([
    prisma.event.findMany({
      where: {
        OR: [
          { startTime: { gte: thirtyDaysAgo, lte: thirtyDaysAhead } },
          { recurrenceRule: { not: null } },
        ],
        parentEventId: null,
      },
      include: { calendar: true },
      orderBy: { startTime: 'asc' },
    }),
    prisma.calendar.findMany({
      where: { isVisible: true },
    }),
    prisma.dayReport.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
      include: {
        daySession: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.todo.findMany({
      where: {
        status: { in: ['pending', 'scheduled'] },
      },
      orderBy: [
        { deadline: 'asc' },
        { createdAt: 'desc' },
      ],
    }),
    prisma.userSettings.findUnique({
      where: { id: 'default' },
      include: {
        memories: true,
        bookReferences: { where: { enabled: true } },
        timeContexts: true,
      },
    }),
  ]);

  // Process events into past and future
  const pastEvents: DayEvents[] = [];
  const futureEvents: DayEvents[] = [];
  const eventsByDate = new Map<string, typeof events>();
  const todayKey = format(now, 'yyyy-MM-dd');

  for (const event of events) {
    const dateKey = format(event.startTime, 'yyyy-MM-dd');
    if (!eventsByDate.has(dateKey)) {
      eventsByDate.set(dateKey, []);
    }
    eventsByDate.get(dateKey)!.push(event);
  }

  for (const [dateKey, dateEvents] of eventsByDate) {
    const referenceDate = dateEvents[0].startTime;
    const formatted = {
      date: format(referenceDate, "EEEE, d 'de' MMMM (dd/MM/yyyy)", { locale: ptBR }),
      dateKey,
      events: dateEvents.map(e => ({
        title: e.title,
        date: format(e.startTime, 'dd/MM/yyyy'),
        startTime: format(e.startTime, 'HH:mm'),
        endTime: format(e.endTime, 'HH:mm'),
      })),
    };

    if (dateKey < todayKey) {
      pastEvents.push(formatted);
    } else if (dateKey > todayKey) {
      futureEvents.push(formatted);
    }
  }

  // Parse reports
  const reports: DayReport[] = dayReports.map(r => ({
    date: format(r.daySession.date, "EEEE, d 'de' MMMM (dd/MM/yyyy)", { locale: ptBR }),
    dateKey: format(r.daySession.date, 'yyyy-MM-dd'),
    summary: r.summary,
    completedTasks: JSON.parse(r.completedTasks || '[]'),
    skippedTasks: JSON.parse(r.skippedTasks || '[]'),
    highlights: JSON.parse(r.highlights || '[]'),
    insights: JSON.parse(r.insights || '[]'),
    completionRate: r.completionRate,
  }));

  return {
    today: format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }),
    todayISO: format(now, 'yyyy-MM-dd'),
    currentTime: format(now, 'HH:mm'),
    dayOfWeek: dayName,
    isWeekend,
    events: events
      .filter(e => format(e.startTime, 'yyyy-MM-dd') >= todayKey)
      .slice(0, 50)
      .map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        startTime: format(e.startTime, "EEEE, d/MM 'às' HH:mm", { locale: ptBR }),
        startTimeISO: e.startTime.toISOString(),
        endTime: format(e.endTime, 'HH:mm'),
        endTimeISO: e.endTime.toISOString(),
        isAllDay: e.isAllDay,
        calendarName: e.calendar.name,
        calendarId: e.calendarId,
        color: e.color,
        isRecurring: !!e.recurrenceRule,
        recurrenceRule: e.recurrenceRule,
        reminderMinutes: e.reminderMinutes,
      })),
    calendars: calendars.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
    })),
    pastEvents: pastEvents.slice(-15),
    futureEvents: futureEvents.slice(0, 15),
    reports,
    todos: todos.map(t => ({
      id: t.id,
      content: t.content,
      deadline: t.deadline ? format(t.deadline, "EEEE, d/MM 'às' HH:mm", { locale: ptBR }) : null,
      deadlineISO: t.deadline ? t.deadline.toISOString() : null,
      priority: t.priority,
      estimatedMinutes: t.estimatedMinutes,
      status: t.status,
    })),
    memories: settings?.memories.map(m => ({ id: m.id, content: m.content })) || [],
    orientations: settings?.generalOrientations || '',
    bookReferences: settings?.bookReferences.map(b => ({ title: b.title, topics: b.topics })) || [],
    timeContexts: settings?.timeContexts.map(tc => ({ type: tc.type, content: tc.content })) || [],
  };
}

// ============================================================================
// FORMATADORES DE CONTEXTO PARA PROMPTS
// ============================================================================

/**
 * Formata contexto temporal
 */
export function formatTemporalContext(ctx: FullContext): string {
  return `HOJE: ${ctx.today} (${ctx.todayISO})
DIA DA SEMANA: ${ctx.dayOfWeek}
É FINAL DE SEMANA: ${ctx.isWeekend ? 'SIM' : 'NÃO'}
HORA ATUAL: ${ctx.currentTime}`;
}

/**
 * Formata calendários disponíveis
 */
export function formatCalendarsContext(ctx: FullContext): string {
  return `CALENDÁRIOS (use o primeiro ID como padrão):
${ctx.calendars.map((c) => `- "${c.name}" | ID: ${c.id} | Cor: ${c.color}`).join('\n')}`;
}

/**
 * Formata eventos de hoje e próximos
 */
export function formatEventsContext(ctx: FullContext): string {
  if (ctx.events.length === 0) return 'EVENTOS: Nenhum evento.';

  return `EVENTOS DE HOJE E PRÓXIMOS:
${ctx.events.map((e) => `- "${e.title}" | ${e.startTime}-${e.endTime} | ID: ${e.id}${e.isRecurring ? ' | Recorrente' : ''}`).join('\n')}`;
}

/**
 * Formata tarefas pendentes com countdown
 */
export function formatTodosContext(ctx: FullContext): string {
  if (ctx.todos.length === 0) return '';

  const now = new Date();

  const getCountdown = (deadlineISO: string | null) => {
    if (!deadlineISO) return 'Sem prazo definido';

    const deadline = new Date(deadlineISO);
    const diffMs = deadline.getTime() - now.getTime();

    if (diffMs < 0) {
      const hoursAgo = Math.abs(Math.floor(diffMs / (1000 * 60 * 60)));
      if (hoursAgo < 24) return `ATRASADO há ${hoursAgo}h`;
      const daysAgo = Math.floor(hoursAgo / 24);
      return `ATRASADO há ${daysAgo} dia${daysAgo > 1 ? 's' : ''}`;
    }

    const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
    if (hoursLeft < 24) return `Faltam ${hoursLeft}h - URGENTE`;

    const daysLeft = Math.floor(hoursLeft / 24);
    if (daysLeft === 1) return 'Falta 1 dia';
    if (daysLeft <= 3) return `Faltam ${daysLeft} dias`;
    if (daysLeft <= 7) return `Faltam ${daysLeft} dias`;
    return `Faltam ${daysLeft} dias`;
  };

  return `TAREFAS PENDENTES (ordenado por urgência):
${ctx.todos.map(t => {
  const countdown = getCountdown(t.deadlineISO);
  const duration = t.estimatedMinutes ? ` | ~${t.estimatedMinutes} min` : '';
  const deadlineDate = t.deadline ? ` (${t.deadline})` : '';
  return `- ${countdown}${deadlineDate}: ${t.content}${duration}`;
}).join('\n')}`;
}

/**
 * Formata histórico (eventos passados e relatórios)
 */
export function formatHistoryContext(ctx: FullContext): string {
  let history = '';

  if (ctx.pastEvents.length > 0) {
    history += `EVENTOS DOS ÚLTIMOS DIAS:
${ctx.pastEvents.map(day => `=== ${day.date} [${day.dateKey}] ===
${day.events.map(e => `  - [${e.date}] ${e.title} (${e.startTime}-${e.endTime})`).join('\n')}`).join('\n')}

`;
  }

  if (ctx.reports.length > 0) {
    history += `RELATÓRIOS DE ACOMPANHAMENTO:
${ctx.reports.map(r => `=== ${r.date} [${r.dateKey}] === (${r.completionRate.toFixed(0)}% concluído)
  Resumo: ${r.summary}
  Feito: ${r.completedTasks.length > 0 ? r.completedTasks.join(', ') : 'nada registrado'}
  Não feito: ${r.skippedTasks.length > 0 ? r.skippedTasks.join(', ') : 'nada registrado'}
  Insights: ${r.insights.length > 0 ? r.insights.join('; ') : 'nenhum'}`).join('\n')}

`;
  }

  if (ctx.futureEvents.length > 0) {
    history += `PRÓXIMOS DIAS:
${ctx.futureEvents.map(day => `=== ${day.date} [${day.dateKey}] ===
${day.events.map(e => `  - [${e.date}] ${e.title} (${e.startTime}-${e.endTime})`).join('\n')}`).join('\n')}`;
  }

  return history;
}

/**
 * Formata memórias do usuário
 */
export function formatMemoriesContext(ctx: FullContext): string {
  if (ctx.memories.length === 0) return '';

  return `MEMÓRIAS SOBRE O USUÁRIO (fatos permanentes):
${ctx.memories.map((m) => `• ${m.content}`).join('\n')}`;
}

/**
 * Formata orientações do usuário
 */
export function formatOrientationsContext(ctx: FullContext): string {
  if (!ctx.orientations.trim()) return '';

  return `ORIENTAÇÕES DO USUÁRIO:
${ctx.orientations}`;
}

/**
 * Formata livros de referência
 */
export function formatBooksContext(ctx: FullContext): string {
  if (ctx.bookReferences.length === 0) return '';

  return `LIVROS DE REFERÊNCIA (use ativamente):
${ctx.bookReferences.map((b) => {
  if (b.topics && b.topics.trim()) {
    return `• ${b.title}\n  Focar em: ${b.topics}`;
  }
  return `• ${b.title} (conhecimento completo)`;
}).join('\n')}`;
}

/**
 * Formata metas e objetivos
 */
export function formatGoalsContext(ctx: FullContext): string {
  const timeContextLabels: Record<string, string> = {
    weekly: 'Semanal (esta semana)',
    monthly: 'Mensal (este mês)',
    quarterly: 'Trimestral (próximos 3 meses)',
    sixMonth: 'Semestral (próximos 6 meses)',
    yearly: 'Anual (este ano)',
  };

  const validContexts = ctx.timeContexts.filter(tc => tc.content.trim());
  if (validContexts.length === 0) return '';

  return `METAS E OBJETIVOS:
${validContexts.map((tc) => `🎯 ${timeContextLabels[tc.type] || tc.type}:
${tc.content}`).join('\n\n')}`;
}

/**
 * Constrói o contexto completo formatado para prompts
 */
export function buildFormattedContext(ctx: FullContext): string {
  const sections = [
    formatTemporalContext(ctx),
    formatCalendarsContext(ctx),
    formatEventsContext(ctx),
    formatTodosContext(ctx),
    formatHistoryContext(ctx),
    formatMemoriesContext(ctx),
    formatOrientationsContext(ctx),
    formatBooksContext(ctx),
    formatGoalsContext(ctx),
  ].filter(s => s.trim());

  return sections.join('\n\n');
}
