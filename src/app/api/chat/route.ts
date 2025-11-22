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

const SYSTEM_PROMPT = `Você é MentorRotina, um assistente de calendário. Seja direto e eficiente.

IMPORTANTE: Quando o usuário confirmar uma ação (dizendo "sim", "ok", "confirma", "pode criar", etc) ou quando ele der todos os detalhes necessários, você DEVE gerar o bloco de ações JSON imediatamente.

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
    const { message, model = 'gemini-2.5-flash', history = [] } = body;

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

    const calendarContextMessage = `
CONTEXTO ATUAL:

Calendários (use o primeiro ID como padrão):
${context.calendars.map((c) => `- "${c.name}" | ID: ${c.id} | Cor: ${c.color}`).join('\n')}

Eventos existentes:
${context.events.length > 0
  ? context.events.map((e) => `- "${e.title}" | ${e.startTime}-${e.endTime} | ID: ${e.id}${e.isRecurring ? ' | Recorrente' : ''}`).join('\n')
  : 'Nenhum evento.'}
`;

    const contents = [
      {
        role: 'user',
        parts: [{ text: systemPrompt + '\n\n' + calendarContextMessage }],
      },
      {
        role: 'model',
        parts: [{ text: 'Entendido! Pronto para ajudar com seu calendário. O que você precisa?' }],
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
            maxOutputTokens: 2048,
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
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

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
