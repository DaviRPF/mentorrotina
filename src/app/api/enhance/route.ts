import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { format, addDays, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { callGeminiWithHistory, GeminiConfig } from '@/lib/ai/gemini-client';
import { buildEnhancePrompt } from '@/lib/ai/prompts/enhance-coach';

const ENHANCE_CONFIG: GeminiConfig = {
  temperature: 0.4,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 4096,
};

async function getFullContext(eventId: string, eventTitle: string) {
  const now = new Date();
  const thirtyDaysAgo = startOfDay(subDays(now, 30));
  const thirtyDaysAhead = endOfDay(addDays(now, 30));

  const settings = await prisma.userSettings.findUnique({
    where: { id: 'default' },
    include: {
      memories: true,
      bookReferences: { where: { enabled: true } },
      timeContexts: true,
    },
  });

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { calendar: true },
  });

  const allEvents = await prisma.event.findMany({
    where: {
      startTime: { gte: thirtyDaysAgo, lte: thirtyDaysAhead },
      parentEventId: null,
    },
    include: { calendar: true },
    orderBy: { startTime: 'asc' },
  });

  const titleWords = eventTitle.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const similarEvents = allEvents.filter(e => {
    if (e.id === eventId) return false;
    const eTitle = e.title.toLowerCase();
    return titleWords.some(word => eTitle.includes(word)) || eTitle === eventTitle.toLowerCase();
  });

  const reports = await prisma.dayReport.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    include: {
      daySession: {
        include: {
          conversation: { include: { messages: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const relevantReports = reports.filter(r => {
    const summary = r.summary.toLowerCase();
    const completed = JSON.parse(r.completedTasks || '[]').join(' ').toLowerCase();
    const skipped = JSON.parse(r.skippedTasks || '[]').join(' ').toLowerCase();
    const highlights = JSON.parse(r.highlights || '[]').join(' ').toLowerCase();
    const allText = `${summary} ${completed} ${skipped} ${highlights}`;
    return titleWords.some(word => allText.includes(word));
  });

  const todos = await prisma.todo.findMany({
    where: { status: { in: ['pending', 'scheduled'] } },
    orderBy: { deadline: 'asc' },
  });

  const relatedTodos = todos.filter(t => {
    const content = t.content.toLowerCase();
    return titleWords.some(word => content.includes(word));
  });

  return { event, settings, similarEvents, relevantReports, relatedTodos };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      eventId,
      eventTitle,
      eventDescription,
      eventStart,
      eventEnd,
      model = 'gemini-2.5-flash',
      message = null,
      history = [],
    } = body;

    if (!eventId || !eventTitle) {
      return NextResponse.json({ error: 'Event info required' }, { status: 400 });
    }

    const context = await getFullContext(eventId, eventTitle);
    const now = new Date();

    // Build contexts
    const eventInfo = `
Título: ${eventTitle}
Descrição: ${eventDescription || 'Nenhuma'}
Data/Hora: ${format(new Date(eventStart), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })} - ${format(new Date(eventEnd), 'HH:mm')}
Duração: ${Math.round((new Date(eventEnd).getTime() - new Date(eventStart).getTime()) / 60000)} minutos
Calendário: ${context.event?.calendar?.name || 'Principal'}`;

    const memoriesContext = context.settings?.memories.length
      ? context.settings.memories.map(m => `• ${m.content}`).join('\n')
      : 'Nenhuma memória';

    const orientationsContext = context.settings?.generalOrientations || 'Nenhuma orientação';

    const booksContext = context.settings?.bookReferences.length
      ? context.settings.bookReferences.map(b => {
          if (b.topics) return `• ${b.title}\n  Focar em: ${b.topics}`;
          return `• ${b.title}`;
        }).join('\n')
      : 'Nenhum livro';

    const timeContextLabels: Record<string, string> = {
      weekly: 'Semanal', monthly: 'Mensal', quarterly: 'Trimestral',
      sixMonth: 'Semestral', yearly: 'Anual',
    };
    const goalsContext = context.settings?.timeContexts.length
      ? context.settings.timeContexts
          .filter(tc => tc.content.trim())
          .map(tc => `🎯 ${timeContextLabels[tc.type] || tc.type}:\n${tc.content}`)
          .join('\n\n')
      : 'Nenhuma meta';

    const similarEventsContext = context.similarEvents.length
      ? context.similarEvents.slice(0, 10).map(e =>
          `• ${format(e.startTime, 'dd/MM/yyyy HH:mm')}: ${e.title}${e.description ? ` - ${e.description}` : ''}`
        ).join('\n')
      : 'Nenhum evento similar';

    const reportsContext = context.relevantReports.length
      ? context.relevantReports.slice(0, 5).map(r => {
          const completed = JSON.parse(r.completedTasks || '[]');
          const skipped = JSON.parse(r.skippedTasks || '[]');
          const highlights = JSON.parse(r.highlights || '[]');
          const insights = JSON.parse(r.insights || '[]');
          return `📅 ${format(r.daySession.date, 'dd/MM/yyyy')} (${r.completionRate.toFixed(0)}%)
Resumo: ${r.summary}
✓ Feito: ${completed.length > 0 ? completed.join(', ') : 'nada'}
✗ Não feito: ${skipped.length > 0 ? skipped.join(', ') : 'nada'}
⭐ Destaques: ${highlights.length > 0 ? highlights.join(', ') : 'nenhum'}
💡 Insights: ${insights.length > 0 ? insights.join('; ') : 'nenhum'}`;
        }).join('\n')
      : 'Nenhum relatório';

    const todosContext = context.relatedTodos.length
      ? context.relatedTodos.map(t => {
          const deadline = t.deadline ? format(t.deadline, 'dd/MM HH:mm') : 'sem prazo';
          return `• [${t.priority}] ${t.content} (${deadline})`;
        }).join('\n')
      : 'Nenhuma tarefa relacionada';

    const systemPrompt = buildEnhancePrompt(
      eventInfo,
      memoriesContext,
      orientationsContext,
      booksContext,
      goalsContext,
      similarEventsContext,
      reportsContext,
      todosContext,
      format(now, "EEEE, d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
    );

    const userMessage = message || `Por favor, gere o guia de aperfeiçoamento para a tarefa "${eventTitle}".`;
    const response = await callGeminiWithHistory(systemPrompt, history, userMessage, [], ENHANCE_CONFIG, model);

    return NextResponse.json({
      enhancement: response,
      context: {
        similarEventsCount: context.similarEvents.length,
        relevantReportsCount: context.relevantReports.length,
        hasMemories: (context.settings?.memories.length || 0) > 0,
        hasBooks: (context.settings?.bookReferences.length || 0) > 0,
      },
    });
  } catch (error) {
    console.error('Enhance API error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
