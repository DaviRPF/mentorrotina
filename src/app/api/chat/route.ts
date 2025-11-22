import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { format, parseISO, addDays, startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

interface CalendarContext {
  today: string;
  currentTime: string;
  events: {
    id: string;
    title: string;
    description: string | null;
    startTime: string;
    endTime: string;
    isAllDay: boolean;
    calendarName: string;
    isRecurring: boolean;
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
  const weekEnd = endOfWeek(addDays(now, 14), { weekStartsOn: 0 }); // Next 2 weeks

  const [events, calendars] = await Promise.all([
    prisma.event.findMany({
      where: {
        OR: [
          {
            startTime: { gte: weekStart, lte: weekEnd },
          },
          {
            recurrenceRule: { not: null },
          },
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
    currentTime: format(now, 'HH:mm'),
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startTime: format(e.startTime, "EEEE, d/MM 'às' HH:mm", { locale: ptBR }),
      endTime: format(e.endTime, 'HH:mm'),
      isAllDay: e.isAllDay,
      calendarName: e.calendar.name,
      isRecurring: !!e.recurrenceRule,
    })),
    calendars: calendars.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
    })),
  };
}

const SYSTEM_PROMPT = `Você é um assistente inteligente de calendário chamado MentorRotina. Você ajuda o usuário a organizar sua rotina de forma eficiente.

SUAS CAPACIDADES:
1. Criar, editar, mover e excluir eventos no calendário
2. Sugerir melhores horários baseado na agenda existente
3. Dar insights sobre a rotina (ex: "você tem muitas reuniões seguidas")
4. Responder perguntas sobre a agenda

FORMATO DE AÇÕES:
Quando precisar fazer alterações no calendário, SEMPRE retorne um JSON no seguinte formato ao final da sua resposta:

\`\`\`actions
[
  {
    "type": "create|update|delete|move",
    "description": "Descrição curta da ação",
    "data": {
      "title": "Título do evento",
      "description": "Descrição opcional",
      "startTime": "2025-01-15T09:00:00",
      "endTime": "2025-01-15T10:00:00",
      "calendarId": "id-do-calendario",
      "eventId": "id-do-evento-se-update-ou-delete",
      "recurrenceRule": null ou { "type": "daily|weekly|monthly", "interval": 1, "daysOfWeek": [1,3,5] }
    }
  }
]
\`\`\`

REGRAS:
- Seja conciso e amigável
- Use português brasileiro
- Quando o usuário pedir algo vago como "academia", pergunte detalhes (horário, duração)
- Sempre mostre as ações que serão feitas e peça confirmação implícita
- Para datas relativas (amanhã, próxima terça), calcule a data correta baseado no contexto
- Se não tiver certeza, pergunte ao usuário
- Dê insights úteis sobre a agenda quando apropriado

HOJE É: {{TODAY}}
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
    const { message, model = 'gemini-2.5-flash', history = [] } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Mensagem é obrigatória' },
        { status: 400 }
      );
    }

    // Get calendar context
    const context = await getCalendarContext();

    // Build system prompt with context
    const systemPrompt = SYSTEM_PROMPT
      .replace('{{TODAY}}', context.today)
      .replace('{{CURRENT_TIME}}', context.currentTime);

    // Build calendar context message
    const calendarContextMessage = `
CONTEXTO DO CALENDÁRIO:

Calendários disponíveis:
${context.calendars.map((c) => `- ${c.name} (ID: ${c.id})`).join('\n')}

Eventos das próximas 2 semanas:
${context.events.length > 0
  ? context.events.map((e) => `- "${e.title}" - ${e.startTime} até ${e.endTime}${e.isRecurring ? ' (recorrente)' : ''} [${e.calendarName}]`).join('\n')
  : 'Nenhum evento agendado.'}
`;

    // Build messages for Gemini
    const contents = [
      {
        role: 'user',
        parts: [{ text: systemPrompt + '\n\n' + calendarContextMessage }],
      },
      {
        role: 'model',
        parts: [{ text: 'Entendido! Sou o MentorRotina, seu assistente de calendário. Como posso ajudar você hoje?' }],
      },
      ...history.map((msg: { role: string; content: string }) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })),
      {
        role: 'user',
        parts: [{ text: message }],
      },
    ];

    // Call Gemini API
    const response = await fetch(
      `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_NONE',
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_NONE',
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_NONE',
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_NONE',
            },
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

    // Extract response text
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse actions from response
    let actions: object[] = [];
    const actionsMatch = responseText.match(/```actions\n([\s\S]*?)\n```/);
    if (actionsMatch) {
      try {
        actions = JSON.parse(actionsMatch[1]);
      } catch {
        console.error('Error parsing actions:', actionsMatch[1]);
      }
    }

    // Remove actions block from response for display
    const cleanResponse = responseText.replace(/```actions\n[\s\S]*?\n```/g, '').trim();

    return NextResponse.json({
      response: cleanResponse,
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
