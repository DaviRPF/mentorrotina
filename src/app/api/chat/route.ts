import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

interface CalendarContext {
  today: string;
  todayISO: string;
  currentTime: string;
  events: {
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
  }[];
  calendars: {
    id: string;
    name: string;
    color: string;
  }[];
}

async function getCalendarContext(): Promise<CalendarContext> {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(addDays(now, 14), { weekStartsOn: 0 });

  const [events, calendars] = await Promise.all([
    prisma.event.findMany({
      where: {
        OR: [
          { startTime: { gte: weekStart, lte: weekEnd } },
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
  ]);

  return {
    today: format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }),
    todayISO: format(now, 'yyyy-MM-dd'),
    currentTime: format(now, 'HH:mm'),
    events: events.map((e) => ({
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
  };
}

const SYSTEM_PROMPT = `Você é MentorRotina, um assistente de calendário E um mentor pessoal. Você não é apenas um secretário que cria eventos - você é um MENTOR que ajuda o usuário a otimizar sua rotina, atingir seus objetivos e desenvolver hábitos saudáveis.

=== SISTEMA DE AÇÕES (PRIORIDADE MÁXIMA) ===
O sistema de ações JSON é a ÚNICA forma de modificar o calendário. Você DEVE:
- SEMPRE gerar o bloco \`\`\`actions quando o usuário pedir para criar/modificar/excluir eventos
- Gerar ações imediatamente quando tiver informações suficientes OU quando o usuário confirmar
- NUNCA apenas descrever o que faria - GERE O JSON

=== PAPEL DE MENTOR (COMPLEMENTAR AO SISTEMA DE AÇÕES) ===
Além de gerenciar eventos, você atua como mentor pessoal:
- Use as orientações do usuário para personalizar conselhos
- Sugira melhores horários baseado nas preferências dele
- Incentive e motive o usuário a manter compromissos
- Dê insights sobre otimização de rotina (ex: "Que tal academia de manhã para mais energia?")
- Avise quando a agenda está muito cheia ou mal distribuída
- Lembre sobre pausas, descanso e equilíbrio
- Ao dar conselhos de mentor, você pode SUGERIR eventos (gerando ações) que ajudem o usuário

=== CONHECIMENTOS DE LIVROS (MUITO IMPORTANTE) ===
O usuário selecionou livros específicos para você usar como base. VOCÊ DEVE:
- Usar TODO o seu conhecimento sobre CADA livro listado - não apenas os tópicos fornecidos
- APLICAR ATIVAMENTE os conceitos para: montar rotina eficiente, MOTIVAR e PERSUADIR o usuário
- Exemplos de aplicação:
  * "Atomic Habits": habit stacking, regra dos 2 minutos, tornar hábitos óbvios/atrativos
  * "Tiny Habits": começar ridiculamente pequeno, celebrar vitórias, âncoras
  * "The Sleep Solution": higiene do sono, ritmo circadiano, rotina noturna
  * "Intrinsic Motivation": autonomia, propósito, maestria, recompensas intrínsecas
  * "The Progress Principle": pequenas vitórias, progresso visível, catalisadores
  * "Influence": compromisso/consistência, prova social, escassez, reciprocidade
  * "Getting Things Done": capturar tudo, próxima ação, contextos, revisão semanal
- Seja um COACH que usa esses conhecimentos para PERSUADIR o usuário a cumprir seus compromissos
- Quando o usuário resistir ou procrastinar, use técnicas de persuasão dos livros
- Celebre progressos, reforce identidade positiva, crie senso de compromisso

IMPORTANTE: O papel de mentor COMPLEMENTA o sistema de ações. Você pode dar conselhos E criar eventos ao mesmo tempo. Por exemplo: "Baseado no Atomic Habits, sugiro criar um hábito de leitura logo após acordar - vou criar um evento para isso!" + [ações JSON]

CORES DISPONÍVEIS:
- Azul: #3b82f6 (padrão)
- Vermelho: #ef4444
- Verde: #22c55e
- Amarelo: #eab308
- Roxo: #a855f7
- Rosa: #ec4899
- Laranja: #f97316
- Teal: #14b8a6

TIPOS DE RECORRÊNCIA:
- Diário: { "type": "daily", "interval": 1 }
- Dia sim dia não: { "type": "daily", "interval": 2 }
- Semanal: { "type": "weekly", "interval": 1 }
- Dias específicos: { "type": "weekly", "interval": 1, "daysOfWeek": [1,2,3,4,5] } (0=Dom, 1=Seg, ..., 6=Sáb)
- Mensal: { "type": "monthly", "interval": 1 }

LEMBRETES (em minutos):
- 5, 10, 15, 30, 60 (1h), 1440 (1 dia)

FORMATO DE AÇÕES - Use EXATAMENTE este formato quando precisar criar/modificar eventos:

\`\`\`actions
[
  {
    "type": "create",
    "description": "Academia - Dom 23/11 08:00-09:30",
    "data": {
      "title": "Academia",
      "description": null,
      "startTime": "2025-11-23T08:00:00",
      "endTime": "2025-11-23T09:30:00",
      "color": "#22c55e",
      "calendarId": "ID_DO_CALENDARIO",
      "isAllDay": false,
      "reminderMinutes": 15,
      "recurrenceRule": null
    }
  }
]
\`\`\`

REGRAS:
1. SEMPRE gere o bloco \`\`\`actions quando o usuário confirmar ou der informações suficientes
2. Na descrição da ação, mostre: Título - Data Hora (ex: "Academia - Dom 23/11 08:00-09:30")
3. Se for recorrente, mostre na descrição (ex: "Academia - Toda terça 08:00-09:30")
4. Use o ID do calendário fornecido no contexto
5. Calcule as datas corretas baseado em HOJE: {{TODAY}} ({{TODAY_ISO}})
6. Para "amanhã", some 1 dia. Para "próxima terça", calcule a data correta
7. Se faltar informação essencial (horário), pergunte. Se tiver o básico, crie com valores padrão
8. Cor padrão: #3b82f6 (azul). Lembrete padrão: 15 min. Sem recorrência por padrão.

HORA ATUAL: {{CURRENT_TIME}}`;

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY não configurada. Adicione no arquivo .env' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      message,
      model = 'gemini-2.5-flash',
      history = [],
      personalContext = '',
      orientations = '',
      bookReferences = [],
      timeContexts = [],
    } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Mensagem é obrigatória' },
        { status: 400 }
      );
    }

    const context = await getCalendarContext();

    const systemPrompt = SYSTEM_PROMPT
      .replace('{{TODAY}}', context.today)
      .replace('{{TODAY_ISO}}', context.todayISO)
      .replace('{{CURRENT_TIME}}', context.currentTime);

    // Build mentor context
    let mentorContext = '';

    if (personalContext.trim()) {
      mentorContext += `
CONTEXTO PESSOAL DO USUÁRIO (informações permanentes, sempre considere):
${personalContext}
`;
    }

    if (orientations.trim()) {
      mentorContext += `
ORIENTAÇÕES DO USUÁRIO (use para personalizar conselhos e sugestões):
${orientations}
`;
    }

    if (bookReferences.length > 0) {
      mentorContext += `
📚 LIVROS SELECIONADOS PELO USUÁRIO (USE TODOS ATIVAMENTE):
${bookReferences.map((b: { title: string; topics: string }) => {
  if (b.topics && b.topics.trim()) {
    return `• ${b.title}
  Focar em: ${b.topics}`;
  } else {
    return `• ${b.title} (conhecimento COMPLETO)`;
  }
}).join('\n')}

INSTRUÇÕES SOBRE OS LIVROS:
→ Use CADA livro acima para montar rotina eficiente
→ Use técnicas de PERSUASÃO e MOTIVAÇÃO dos livros
→ Quando der conselho, mencione de qual livro veio o conceito
→ Se o usuário procrastinar, aplique princípios de "Influence" e "Tiny Habits"
→ Reforce identidade positiva ("você é uma pessoa que...")
`;
    }

    // Add time contexts (goals for different periods)
    const timeContextLabels: Record<string, string> = {
      weekly: 'Semanal (esta semana)',
      monthly: 'Mensal (este mês)',
      quarterly: 'Trimestral (próximos 3 meses)',
      sixMonth: 'Semestral (próximos 6 meses)',
      yearly: 'Anual (este ano)',
    };

    if (timeContexts.length > 0) {
      mentorContext += `
METAS E OBJETIVOS DO USUÁRIO (use para ajudar a otimizar a rotina e alcançar esses objetivos):
${timeContexts.map((ctx: { type: string; content: string }) => `
🎯 ${timeContextLabels[ctx.type] || ctx.type}:
${ctx.content}
`).join('\n')}
→ Considere essas metas ao sugerir eventos e dar conselhos. Ajude o usuário a organizar a rotina para alcançá-las!
`;
    }

    const calendarContextMessage = `
CONTEXTO ATUAL:

Calendários (use o primeiro ID como padrão):
${context.calendars.map((c) => `- "${c.name}" | ID: ${c.id} | Cor: ${c.color}`).join('\n')}

Eventos existentes:
${context.events.length > 0
  ? context.events.map((e) => `- "${e.title}" | ${e.startTime}-${e.endTime} | ID: ${e.id}${e.isRecurring ? ' | Recorrente' : ''}`).join('\n')
  : 'Nenhum evento.'}
${mentorContext}`;

    const contents = [
      {
        role: 'user',
        parts: [{ text: systemPrompt + '\n\n' + calendarContextMessage }],
      },
      {
        role: 'model',
        parts: [{ text: 'Entendido! Pronto para ajudar com seu calendário. O que você precisa?' }],
      },
      // Limit history to last 10 messages to prevent context overflow
      ...history.slice(-10).map((msg: { role: string; content: string }) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })),
      {
        role: 'user',
        parts: [{ text: message }],
      },
    ];

    const response = await fetch(
      `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
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
        { error: 'Erro ao chamar API do Gemini: ' + (errorData.error?.message || 'Erro desconhecido') },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Debug: Log raw response
    console.log('Gemini raw response:', JSON.stringify(data, null, 2));

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Debug: Log extracted text
    console.log('Extracted text length:', responseText.length);
    console.log('Extracted text preview:', responseText.substring(0, 200));

    // Parse actions - try multiple formats
    let actions: object[] = [];

    // Try ```actions format
    let actionsMatch = responseText.match(/```actions\n([\s\S]*?)\n```/);

    // Try ```json format
    if (!actionsMatch) {
      actionsMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
    }

    // Try ``` format
    if (!actionsMatch) {
      actionsMatch = responseText.match(/```\n(\[[\s\S]*?\])\n```/);
    }

    if (actionsMatch) {
      try {
        const parsed = JSON.parse(actionsMatch[1]);
        actions = Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        console.error('Error parsing actions:', actionsMatch[1], e);
      }
    }

    // Clean response - remove all code blocks
    const cleanResponse = responseText
      .replace(/```actions\n[\s\S]*?\n```/g, '')
      .replace(/```json\n[\s\S]*?\n```/g, '')
      .replace(/```\n\[[\s\S]*?\]\n```/g, '')
      .trim();

    // Provide default response if only actions were returned
    const finalResponse = cleanResponse || (actions.length > 0
      ? 'Preparei as ações para você! Revise e aceite quando estiver pronto.'
      : 'Desculpe, não consegui processar sua solicitação.');

    return NextResponse.json({
      response: finalResponse,
      actions,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
