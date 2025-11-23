import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { format, addDays, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const ENHANCE_SYSTEM_PROMPT = `Você é o Coach de Performance do MentorRotina. Seu papel é ajudar o usuário a executar cada tarefa da forma mais EFICIENTE e OTIMIZADA possível.

=== SEU OBJETIVO ===
Dado um evento/tarefa específico, você deve:
1. Analisar o histórico do usuário com tarefas similares (relatórios passados, padrões)
2. Considerar as características pessoais do usuário (memórias, orientações)
3. Aplicar conhecimentos dos livros de referência
4. Gerar um GUIA DE EXECUÇÃO personalizado e prático

=== FORMATO DO GUIA ===
📋 **RESUMO DA TAREFA**
[Breve descrição do que será feito e por quê é importante]

⏱️ **PREPARAÇÃO** (5-10 min antes)
- [Passos para se preparar]

🎯 **EXECUÇÃO OTIMIZADA**
[Passo a passo detalhado de como fazer da melhor forma]
- Se for treino: séries, repetições, carga baseada no histórico
- Se for estudo: técnicas, tempo de foco, pausas
- Se for trabalho: prioridades, ferramentas, dicas de produtividade

📊 **BASEADO NO SEU HISTÓRICO**
[Insights personalizados baseados em relatórios/eventos anteriores]
- O que funcionou bem antes
- O que pode melhorar
- Progressão sugerida (se aplicável)

💡 **DICAS DOS LIVROS**
[Técnicas relevantes dos livros de referência do usuário]

⚡ **ENERGIA E FOCO**
[Dicas para manter energia e foco durante a tarefa]

=== REGRAS ===
1. Seja ESPECÍFICO e PRÁTICO - nada de conselhos genéricos
2. Use DADOS DO HISTÓRICO quando disponíveis (ex: "no último treino você fez 3x10 com 20kg, hoje tente 3x10 com 22kg")
3. Adapte às características pessoais do usuário (memórias)
4. Aplique técnicas dos livros de referência
5. Mantenha o tom MOTIVADOR mas REALISTA
6. Se não tiver histórico específico, dê orientações gerais mas personalizadas

=== CONTEXTO ===
DATA/HORA ATUAL: {{CURRENT_DATETIME}}

EVENTO A SER APERFEIÇOADO:
{{EVENT_INFO}}

MEMÓRIAS DO USUÁRIO:
{{MEMORIES}}

ORIENTAÇÕES GERAIS:
{{ORIENTATIONS}}

LIVROS DE REFERÊNCIA:
{{BOOKS}}

METAS E OBJETIVOS:
{{GOALS}}

HISTÓRICO DE EVENTOS SIMILARES:
{{SIMILAR_EVENTS}}

RELATÓRIOS RELEVANTES:
{{RELEVANT_REPORTS}}

TAREFAS PENDENTES RELACIONADAS:
{{RELATED_TODOS}}`;

async function getFullContext(eventId: string, eventTitle: string) {
  const now = new Date();
  const thirtyDaysAgo = startOfDay(subDays(now, 30));
  const thirtyDaysAhead = endOfDay(addDays(now, 30));

  // Get settings with all relations
  const settings = await prisma.userSettings.findUnique({
    where: { id: 'default' },
    include: {
      memories: true,
      bookReferences: { where: { enabled: true } },
      timeContexts: true,
    },
  });

  // Get the specific event
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { calendar: true },
  });

  // Get all events from last 30 days and next 30 days
  const allEvents = await prisma.event.findMany({
    where: {
      startTime: { gte: thirtyDaysAgo, lte: thirtyDaysAhead },
      parentEventId: null,
    },
    include: { calendar: true },
    orderBy: { startTime: 'asc' },
  });

  // Find similar events (same title or similar keywords)
  const titleWords = eventTitle.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const similarEvents = allEvents.filter(e => {
    if (e.id === eventId) return false;
    const eTitle = e.title.toLowerCase();
    return titleWords.some(word => eTitle.includes(word)) || eTitle === eventTitle.toLowerCase();
  });

  // Get reports from last 30 days
  const reports = await prisma.dayReport.findMany({
    where: {
      createdAt: { gte: thirtyDaysAgo },
    },
    include: {
      daySession: {
        include: {
          conversation: {
            include: {
              messages: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Filter relevant reports (that mention the event or similar activities)
  const relevantReports = reports.filter(r => {
    const summary = r.summary.toLowerCase();
    const completed = JSON.parse(r.completedTasks || '[]').join(' ').toLowerCase();
    const skipped = JSON.parse(r.skippedTasks || '[]').join(' ').toLowerCase();
    const highlights = JSON.parse(r.highlights || '[]').join(' ').toLowerCase();
    const allText = `${summary} ${completed} ${skipped} ${highlights}`;
    return titleWords.some(word => allText.includes(word));
  });

  // Get pending todos
  const todos = await prisma.todo.findMany({
    where: {
      status: { in: ['pending', 'scheduled'] },
    },
    orderBy: { deadline: 'asc' },
  });

  // Filter related todos
  const relatedTodos = todos.filter(t => {
    const content = t.content.toLowerCase();
    return titleWords.some(word => content.includes(word));
  });

  return {
    event,
    settings,
    similarEvents,
    relevantReports,
    relatedTodos,
    allEvents,
  };
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY não configurada' }, { status: 500 });
    }

    const body = await request.json();
    const {
      eventId,
      eventTitle,
      eventDescription,
      eventStart,
      eventEnd,
      model = 'gemini-2.5-flash',
      message = null, // For chat follow-ups
      history = [], // Chat history
    } = body;

    if (!eventId || !eventTitle) {
      return NextResponse.json({ error: 'Event info required' }, { status: 400 });
    }

    const context = await getFullContext(eventId, eventTitle);
    const now = new Date();

    // Build event info
    const eventInfo = `
Título: ${eventTitle}
Descrição: ${eventDescription || 'Nenhuma'}
Data/Hora: ${format(new Date(eventStart), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })} - ${format(new Date(eventEnd), 'HH:mm')}
Duração: ${Math.round((new Date(eventEnd).getTime() - new Date(eventStart).getTime()) / 60000)} minutos
Calendário: ${context.event?.calendar?.name || 'Principal'}`;

    // Build memories context
    const memoriesContext = context.settings?.memories.length
      ? context.settings.memories.map(m => `• ${m.content}`).join('\n')
      : 'Nenhuma memória registrada';

    // Build orientations
    const orientationsContext = context.settings?.generalOrientations || 'Nenhuma orientação definida';

    // Build books context
    const booksContext = context.settings?.bookReferences.length
      ? context.settings.bookReferences.map(b => {
          if (b.topics) return `• ${b.title}\n  Focar em: ${b.topics}`;
          return `• ${b.title} (conhecimento completo)`;
        }).join('\n')
      : 'Nenhum livro de referência';

    // Build goals context
    const timeContextLabels: Record<string, string> = {
      weekly: 'Semanal',
      monthly: 'Mensal',
      quarterly: 'Trimestral',
      sixMonth: 'Semestral',
      yearly: 'Anual',
    };
    const goalsContext = context.settings?.timeContexts.length
      ? context.settings.timeContexts
          .filter(tc => tc.content.trim())
          .map(tc => `🎯 ${timeContextLabels[tc.type] || tc.type}:\n${tc.content}`)
          .join('\n\n')
      : 'Nenhuma meta definida';

    // Build similar events context
    const similarEventsContext = context.similarEvents.length
      ? context.similarEvents.slice(0, 10).map(e =>
          `• ${format(e.startTime, 'dd/MM/yyyy HH:mm')}: ${e.title}${e.description ? ` - ${e.description}` : ''}`
        ).join('\n')
      : 'Nenhum evento similar encontrado no histórico';

    // Build relevant reports context
    const reportsContext = context.relevantReports.length
      ? context.relevantReports.slice(0, 5).map(r => {
          const completed = JSON.parse(r.completedTasks || '[]');
          const skipped = JSON.parse(r.skippedTasks || '[]');
          const highlights = JSON.parse(r.highlights || '[]');
          const insights = JSON.parse(r.insights || '[]');
          return `
📅 ${format(r.daySession.date, 'dd/MM/yyyy')} (${r.completionRate.toFixed(0)}% concluído)
Resumo: ${r.summary}
✓ Feito: ${completed.length > 0 ? completed.join(', ') : 'nada específico'}
✗ Não feito: ${skipped.length > 0 ? skipped.join(', ') : 'nada'}
⭐ Destaques: ${highlights.length > 0 ? highlights.join(', ') : 'nenhum'}
💡 Insights: ${insights.length > 0 ? insights.join('; ') : 'nenhum'}`;
        }).join('\n')
      : 'Nenhum relatório relevante encontrado';

    // Build related todos context
    const todosContext = context.relatedTodos.length
      ? context.relatedTodos.map(t => {
          const deadline = t.deadline ? format(t.deadline, 'dd/MM HH:mm') : 'sem prazo';
          return `• [${t.priority}] ${t.content} (${deadline})`;
        }).join('\n')
      : 'Nenhuma tarefa relacionada';

    // Build the system prompt
    const systemPrompt = ENHANCE_SYSTEM_PROMPT
      .replace('{{CURRENT_DATETIME}}', format(now, "EEEE, d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR }))
      .replace('{{EVENT_INFO}}', eventInfo)
      .replace('{{MEMORIES}}', memoriesContext)
      .replace('{{ORIENTATIONS}}', orientationsContext)
      .replace('{{BOOKS}}', booksContext)
      .replace('{{GOALS}}', goalsContext)
      .replace('{{SIMILAR_EVENTS}}', similarEventsContext)
      .replace('{{RELEVANT_REPORTS}}', reportsContext)
      .replace('{{RELATED_TODOS}}', todosContext);

    // Build contents for Gemini
    let contents;
    if (message) {
      // Chat follow-up
      contents = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Entendido! Vou analisar essa tarefa e criar um guia de execução otimizado baseado no seu histórico e preferências.' }] },
        ...history.slice(-20).map((msg: { role: string; content: string }) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })),
        { role: 'user', parts: [{ text: message }] },
      ];
    } else {
      // Initial enhancement generation
      contents = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Entendido! Vou analisar essa tarefa e criar um guia de execução otimizado.' }] },
        { role: 'user', parts: [{ text: `Por favor, gere o guia de aperfeiçoamento para a tarefa "${eventTitle}". Use todo o contexto disponível para personalizar as recomendações.` }] },
      ];
    }

    const response = await fetch(
      `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.4,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 4096,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API error:', errorData);
      return NextResponse.json(
        { error: 'Erro ao gerar aperfeiçoamento: ' + (errorData.error?.message || 'Erro desconhecido') },
        { status: response.status }
      );
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return NextResponse.json({
      enhancement: responseText,
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
