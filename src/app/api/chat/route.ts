import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { format, addDays, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

interface CalendarContext {
  today: string;
  todayISO: string;
  currentTime: string;
  dayOfWeek: string;
  isWeekend: boolean;
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
  // Extended history for AI context
  pastEvents: {
    date: string;
    dateKey: string;
    events: { title: string; date: string; startTime: string; endTime: string }[];
  }[];
  futureEvents: {
    date: string;
    dateKey: string;
    events: { title: string; date: string; startTime: string; endTime: string }[];
  }[];
  reports: {
    date: string;
    dateKey: string;
    summary: string;
    completedTasks: string[];
    skippedTasks: string[];
    highlights: string[];
    insights: string[];
    completionRate: number;
  }[];
  // Quick todos for AI to consider
  todos: {
    id: string;
    content: string;
    deadline: string | null;
    deadlineISO: string | null;
    priority: string;
    estimatedMinutes: number | null;
    status: string;
  }[];
}

async function getCalendarContext(): Promise<CalendarContext> {
  const now = new Date();
  const thirtyDaysAgo = startOfDay(subDays(now, 30));
  const thirtyDaysAhead = endOfDay(addDays(now, 30));

  // Get day of week info
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const dayName = format(now, 'EEEE', { locale: ptBR }); // "sábado", "domingo", etc.

  const [events, calendars, dayReports, todos] = await Promise.all([
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
    // Fetch reports from last 30 days
    prisma.dayReport.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
      include: {
        daySession: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    // Fetch pending todos
    prisma.todo.findMany({
      where: {
        status: { in: ['pending', 'scheduled'] },
      },
      orderBy: [
        { deadline: 'asc' },
        { createdAt: 'desc' },
      ],
    }),
  ]);

  // Separate past and future events
  const pastEvents: CalendarContext['pastEvents'] = [];
  const futureEvents: CalendarContext['futureEvents'] = [];

  // Group events by date
  const eventsByDate = new Map<string, typeof events>();
  for (const event of events) {
    const dateKey = format(event.startTime, 'yyyy-MM-dd');
    if (!eventsByDate.has(dateKey)) {
      eventsByDate.set(dateKey, []);
    }
    eventsByDate.get(dateKey)!.push(event);
  }

  const todayKey = format(now, 'yyyy-MM-dd');

  for (const [dateKey, dateEvents] of eventsByDate) {
    // IMPORTANT: Use the original event's startTime for date formatting
    // to avoid timezone issues when parsing dateKey string back to Date
    const referenceDate = dateEvents[0].startTime;

    const formatted = {
      date: format(referenceDate, "EEEE, d 'de' MMMM (dd/MM/yyyy)", { locale: ptBR }),
      dateKey: dateKey, // Include ISO date key for AI reference
      events: dateEvents.map(e => ({
        title: e.title,
        // Include full date in each event for clarity
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
  const reports = dayReports.map(r => ({
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
      .filter(e => format(e.startTime, 'yyyy-MM-dd') === todayKey || format(e.startTime, 'yyyy-MM-dd') > todayKey)
      .slice(0, 50) // Limit to next 50 events for main context
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
    pastEvents: pastEvents.slice(-15), // Last 15 days with events
    futureEvents: futureEvents.slice(0, 15), // Next 15 days with events
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
  };
}

const SYSTEM_PROMPT = `Você é MentorRotina, um assistente de calendário E um mentor pessoal. Você não é apenas um secretário que cria eventos - você é um MENTOR que ajuda o usuário a otimizar sua rotina, atingir seus objetivos e desenvolver hábitos saudáveis.

=== SISTEMA DE AÇÕES (PRIORIDADE MÁXIMA) ===
O sistema de ações JSON é a ÚNICA forma de modificar o calendário. Você DEVE:
- SEMPRE gerar o bloco \`\`\`actions quando o usuário pedir para criar/modificar/excluir eventos
- Gerar ações imediatamente quando tiver informações suficientes OU quando o usuário confirmar
- NUNCA apenas descrever o que faria - GERE O JSON
- REGRA CRÍTICA: Se você mencionar uma atividade com horário específico (ex: "Academia 08:00-09:30"), você DEVE criar uma ação para ela. Não fale sobre horários sem criar o evento correspondente!
- Quando o usuário pedir para montar a rotina do dia, crie TODAS as atividades como eventos, não apenas algumas
- MODIFICAÇÕES: Quando o usuário pedir para ajustar/modificar o plano proposto (ex: "espaça melhor", "muda o horário", "adiciona X"), você DEVE reenviar TODAS as ações atualizadas no bloco \`\`\`actions. As novas ações SUBSTITUEM as anteriores.

⚠️⚠️⚠️ ERRO GRAVE A EVITAR ⚠️⚠️⚠️
NUNCA descreva mudanças/ajustes na rotina SEM gerar o bloco \`\`\`actions!
Se você listou horários atualizados, você DEVE incluir as ações correspondentes NA MESMA MENSAGEM.

ERRADO (não faça):
"Aqui está a rotina atualizada:
- 06:00-06:30 - Acordar
- 06:30-07:00 - Café
..."
(sem bloco actions = usuário precisa pedir de novo!)

CORRETO (sempre faça):
"Aqui está a rotina atualizada:
- 06:00-06:30 - Acordar
- 06:30-07:00 - Café
...

\`\`\`actions
[ações aqui]
\`\`\`"

Se você descreveu horários, INCLUA as ações. Sem exceção!

=== REGRA CRÍTICA: SEMPRE DESCREVA A ROTINA NA MENSAGEM ===
⚠️ MUITO IMPORTANTE: Quando criar eventos/rotina, você DEVE SEMPRE incluir na sua mensagem de texto uma descrição organizada do que você está criando!

NUNCA gere apenas o bloco \`\`\`actions sem explicação. O usuário precisa ver na mensagem o que foi planejado.

Formato correto quando criar rotina:
1. Comece com uma breve introdução (ex: "Montei sua rotina para hoje!")
2. Liste TODAS as atividades em formato legível com horários
3. Adicione dicas/comentários se relevante
4. Por último, gere o bloco \`\`\`actions

EXEMPLO CORRETO:
"Montei sua rotina para hoje focando em [objetivo]! Aqui está o plano:

📋 **Rotina do Dia:**
- 08:00-09:30 - Academia (treino de força)
- 10:00-12:00 - Estudo de programação
- 12:00-13:00 - Almoço
- 14:00-16:00 - Trabalho no projeto X
...

💡 Dica: [algum conselho relevante]

\`\`\`actions
[JSON das ações]
\`\`\`"

EXEMPLO ERRADO (NÃO FAÇA ISSO):
"\`\`\`actions
[JSON das ações]
\`\`\`"

O usuário PRECISA ver a rotina descrita na mensagem, não apenas aceitar ações cegas!

=== MOVER/DELETAR EVENTOS EXISTENTES ===
Quando o usuário pedir para MOVER ou DELETAR um evento específico que JÁ EXISTE no calendário:
- Gere APENAS a ação necessária para aquele evento (não recrie a rotina inteira!)
- Para MOVER: use type "move" com eventId dentro do data
- Para DELETAR: use type "delete" com eventId dentro do data

Exemplo MOVER evento:
\`\`\`actions
[{"type":"move","description":"Mover Banho de Sáb 22/11 12:00 → Dom 23/11 12:00","data":{"eventId":"ID_DO_EVENTO_AQUI","startTime":"2025-11-23T12:00:00","endTime":"2025-11-23T12:30:00"}}]
\`\`\`

Exemplo DELETAR evento:
\`\`\`actions
[{"type":"delete","description":"Deletar Academia - Sáb 22/11 14:30-16:00","data":{"eventId":"ID_DO_EVENTO_AQUI"}}]
\`\`\`

⚠️ REGRA DE AÇÕES: Quando o usuário PEDIR para criar/montar rotina e você mencionar horários/atividades, inclua o bloco \`\`\`actions com TODAS as ações. Se descreveu 10 atividades, gere 10 ações. MAS se o usuário só fez uma PERGUNTA (ex: "o que devo fazer?"), NÃO crie eventos - apenas responda conversacionalmente.

=== REGRA CRÍTICA: RESPEITE EVENTOS EXISTENTES ===
⚠️ MUITO IMPORTANTE: Quando criar rotina, você DEVE considerar os eventos que JÁ EXISTEM no calendário!

1. NUNCA crie eventos que conflitem com eventos existentes (mesmos horários)
2. Monte a rotina AO REDOR dos eventos já marcados
3. Mencione na sua resposta que você está considerando os eventos existentes
4. Se o evento existente for algo como "Almoço" ou "Reunião", respeite e planeje antes/depois dele

EXEMPLO: Se já existe "Almoço 12:00-13:00" no calendário:
- ✅ CORRETO: Criar eventos 10:00-12:00 e 13:00-15:00 (ao redor do almoço)
- ❌ ERRADO: Criar evento 11:30-13:30 (conflita com o almoço existente)

Se o usuário PEDIR explicitamente para substituir um evento existente, aí sim você pode criar no mesmo horário.

=== REGRA CRÍTICA: PERGUNTAS vs PEDIDOS DE ROTINA ===
⚠️ MUITO IMPORTANTE: Diferencie PERGUNTAS SIMPLES de PEDIDOS DE ROTINA!

PERGUNTAS SIMPLES (responda de forma CURTA e DIRETA, sem criar eventos):
- "O que você recomenda?" → Dê uma resposta curta com conselho
- "Devo seguir meu dia normal?" → Responda sim/não com breve explicação
- "Tô com sono, o que faço?" → Dê dica rápida
- "Vale a pena fazer X?" → Responda objetivamente

PEDIDOS DE ROTINA (aí sim crie eventos):
- "Monta minha rotina de hoje"
- "Cria um plano pro dia"
- "Agenda pra mim..."
- "Organiza meu dia"
- "Faz minha rotina da semana"

Se o usuário fizer uma PERGUNTA, responda de forma CONVERSACIONAL e BREVE (2-4 parágrafos max).
NÃO crie rotinas elaboradas a menos que EXPLICITAMENTE pedido!

=== PAPEL DE MENTOR (COMPLEMENTAR AO SISTEMA DE AÇÕES) ===
Além de gerenciar eventos, você atua como mentor pessoal:
- Use as orientações do usuário para personalizar conselhos
- Sugira melhores horários baseado nas preferências dele
- Incentive e motive o usuário a manter compromissos
- Dê insights sobre otimização de rotina (ex: "Que tal academia de manhã para mais energia?")
- Avise quando a agenda está muito cheia ou mal distribuída
- Lembre sobre pausas, descanso e equilíbrio
- Ao dar conselhos de mentor, você pode SUGERIR eventos (gerando ações) que ajudem o usuário
- IMPORTANTE: Só crie eventos quando o usuário PEDIR explicitamente. Para perguntas, apenas responda.

=== CONHECIMENTOS DE LIVROS (MUITO IMPORTANTE) ===
O usuário registrou livros específicos para você usar. VOCÊ DEVE:
- Usar TODO o seu conhecimento sobre CADA livro que ele registrou
- APLICAR ATIVAMENTE os conceitos para: montar rotina eficiente, MOTIVAR e PERSUADIR
- Seja um COACH que usa os conhecimentos dos livros para PERSUADIR o usuário a cumprir compromissos
- Quando o usuário resistir ou procrastinar, use técnicas dos livros registrados
- Celebre progressos, reforce identidade positiva, crie senso de compromisso
- Mencione de qual livro vem cada técnica/conselho que você aplicar

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

=== CONTEXTO TEMPORAL (MUITO IMPORTANTE) ===
HOJE: {{TODAY}} ({{TODAY_ISO}})
DIA DA SEMANA: {{DAY_OF_WEEK}}
É FINAL DE SEMANA: {{IS_WEEKEND}}
HORA ATUAL: {{CURRENT_TIME}}

ATENÇÃO: Respeite o dia da semana! Se uma atividade é só para dias úteis (segunda a sexta), NÃO agende para sábado/domingo. Se hoje é final de semana, ajuste a rotina apropriadamente.

=== TAREFAS PENDENTES (TODOS) - PRIORIDADE NA ROTINA ===
O usuário tem tarefas (todos) com prazos que DEVEM ser consideradas ao montar a rotina.
Quando você criar uma rotina ou sugerir atividades:
1. PRIORIZE as tarefas com deadline mais próximo (urgent > high > medium > low)
2. ENCAIXE as tarefas nos horários livres do calendário
3. Considere o tempo estimado de cada tarefa
4. NÃO precisa agendar TODAS as tarefas de uma vez - distribua de forma realista
5. Ao criar evento para uma tarefa, mencione que está atendendo à tarefa pendente
6. Tarefas SEM deadline podem ser encaixadas quando houver tempo livre

PRIORIDADES:
- urgent: PRECISA ser feita HOJE
- high: Deadline em até 3 dias
- medium: Deadline em até 7 dias
- low: Deadline além de 7 dias ou sem deadline`;

const DAY_TRACKER_PROMPT = `Você é o Companheiro de Dia do MentorRotina. Seu papel é ACOMPANHAR o usuário ao longo do dia, ajudando-o a manter o foco e completar suas atividades.

=== SEU PAPEL ===
- O usuário vai reportar o que está fazendo ou já fez
- Você confirma, motiva e dá dicas práticas
- Você mostra qual é a PRÓXIMA atividade do dia
- Você ajuda a manter a energia e foco
- Você tem acesso ao HISTÓRICO de dias anteriores para contextualizar

=== FORMATO DAS RESPOSTAS ===
1. Reconheça o que o usuário fez (breve, positivo)
2. Dê uma dica rápida se apropriado (baseado nas memórias/orientações)
3. Indique o PRÓXIMO passo do dia

Exemplo:
Usuário: "Terminei a academia"
Você: "💪 Ótimo treino! Lembre-se de se hidratar bem agora.
📍 Próximo: Almoço às 12:30. Você tem 45 minutos para tomar banho e se preparar."

=== REGRAS ===
- Seja CONCISO - respostas curtas e diretas
- Use emojis para deixar mais visual
- Sempre mencione o PRÓXIMO compromisso quando relevante
- Motive mas não seja exagerado
- Se o usuário pulou algo, não julgue - ajude a replanejar
- Use as memórias e orientações para personalizar conselhos
- Quando o usuário perguntar sobre dias anteriores, USE o histórico fornecido
- LEMBRE o usuário sobre TAREFAS PENDENTES (todos) com deadline próximo
- Se uma tarefa está ATRASADA ou URGENTE, mencione para o usuário priorizar

=== CONTEXTO DO DIA ===
DATA: {{DATE}}
HORA ATUAL: {{CURRENT_TIME}}

EVENTOS PLANEJADOS PARA HOJE:
{{EVENTS}}

MEMÓRIAS DO USUÁRIO:
{{MEMORIES}}

ORIENTAÇÕES:
{{ORIENTATIONS}}

=== TAREFAS PENDENTES (TODOS) ===
{{TODOS}}

=== HISTÓRICO (últimos 30 dias) ===
{{HISTORY}}`;

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
      memories = [],
      orientations = '',
      bookReferences = [],
      timeContexts = [],
      isDayTracker = false,
      dayTrackerContext = null,
      images = [], // Array of { base64: string, mimeType: string }
    } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Mensagem é obrigatória' },
        { status: 400 }
      );
    }

    const context = await getCalendarContext();

    const systemPrompt = SYSTEM_PROMPT
      .replace(/\{\{TODAY\}\}/g, context.today)
      .replace(/\{\{TODAY_ISO\}\}/g, context.todayISO)
      .replace(/\{\{CURRENT_TIME\}\}/g, context.currentTime)
      .replace(/\{\{DAY_OF_WEEK\}\}/g, context.dayOfWeek)
      .replace(/\{\{IS_WEEKEND\}\}/g, context.isWeekend ? 'SIM (final de semana)' : 'NÃO (dia útil)');

    // Build mentor context
    let mentorContext = '';

    if (memories.length > 0) {
      mentorContext += `
🧠 MEMÓRIAS SOBRE O USUÁRIO (fatos permanentes, sempre considere):
${memories.map((m: string) => `• ${m}`).join('\n')}
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

    // Build historical context
    let historicalContext = '';

    if (context.pastEvents.length > 0) {
      historicalContext += `
📅 EVENTOS DOS ÚLTIMOS DIAS (o que estava planejado):
${context.pastEvents.map(day => `
=== ${day.date} [${day.dateKey}] ===
${day.events.map(e => `  - [${e.date}] ${e.title} (${e.startTime}-${e.endTime})`).join('\n')}`).join('\n')}
`;
    }

    if (context.reports.length > 0) {
      historicalContext += `
📊 RELATÓRIOS DE ACOMPANHAMENTO (o que realmente aconteceu):
${context.reports.map(r => `
=== ${r.date} [${r.dateKey}] === (${r.completionRate.toFixed(0)}% concluído)
  Resumo: ${r.summary}
  ✓ Feito: ${r.completedTasks.length > 0 ? r.completedTasks.join(', ') : 'nada registrado'}
  ✗ Não feito: ${r.skippedTasks.length > 0 ? r.skippedTasks.join(', ') : 'nada registrado'}
  💡 Insights: ${r.insights.length > 0 ? r.insights.join('; ') : 'nenhum'}`).join('\n')}
`;
    }

    if (context.futureEvents.length > 0) {
      historicalContext += `
📆 PRÓXIMOS DIAS (o que está planejado):
${context.futureEvents.map(day => `
=== ${day.date} [${day.dateKey}] ===
${day.events.map(e => `  - [${e.date}] ${e.title} (${e.startTime}-${e.endTime})`).join('\n')}`).join('\n')}
`;
    }

    // Build todos context with dynamic countdown
    let todosContext = '';
    if (context.todos.length > 0) {
      const now = new Date();

      const getCountdown = (deadlineISO: string | null) => {
        if (!deadlineISO) return 'Sem prazo definido';

        const deadline = new Date(deadlineISO);
        const diffMs = deadline.getTime() - now.getTime();

        if (diffMs < 0) {
          const hoursAgo = Math.abs(Math.floor(diffMs / (1000 * 60 * 60)));
          if (hoursAgo < 24) return `⚠️ ATRASADO há ${hoursAgo}h`;
          const daysAgo = Math.floor(hoursAgo / 24);
          return `⚠️ ATRASADO há ${daysAgo} dia${daysAgo > 1 ? 's' : ''}`;
        }

        const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
        if (hoursLeft < 24) return `🔴 Faltam ${hoursLeft}h - URGENTE`;

        const daysLeft = Math.floor(hoursLeft / 24);
        if (daysLeft === 1) return '🟠 Falta 1 dia';
        if (daysLeft <= 3) return `🟠 Faltam ${daysLeft} dias`;
        if (daysLeft <= 7) return `🟡 Faltam ${daysLeft} dias`;
        return `🟢 Faltam ${daysLeft} dias`;
      };

      todosContext = `
📋 TAREFAS PENDENTES (considere ao montar rotinas - ordenado por urgência):
${context.todos.map(t => {
  const countdown = getCountdown(t.deadlineISO);
  const duration = t.estimatedMinutes ? ` | ~${t.estimatedMinutes} min` : '';
  const deadlineDate = t.deadline ? ` (${t.deadline})` : '';
  return `- ${countdown}${deadlineDate}: ${t.content}${duration}`;
}).join('\n')}

⚠️ IMPORTANTE: As tarefas com countdown menor são MAIS URGENTES e devem ser priorizadas!
`;
    }

    const calendarContextMessage = `
CONTEXTO ATUAL:

Calendários (use o primeiro ID como padrão):
${context.calendars.map((c) => `- "${c.name}" | ID: ${c.id} | Cor: ${c.color}`).join('\n')}

Eventos de hoje e próximos:
${context.events.length > 0
  ? context.events.map((e) => `- "${e.title}" | ${e.startTime}-${e.endTime} | ID: ${e.id}${e.isRecurring ? ' | Recorrente' : ''}`).join('\n')
  : 'Nenhum evento.'}
${todosContext}${historicalContext}
${mentorContext}`;

    // Build contents based on whether it's day tracker or regular chat
    let contents;

    if (isDayTracker && dayTrackerContext) {
      // Build history context for day tracker
      let dayTrackerHistoryContext = '';

      if (context.pastEvents.length > 0) {
        dayTrackerHistoryContext += `
📅 EVENTOS DOS ÚLTIMOS DIAS (o que estava planejado):
${context.pastEvents.map(day => `
=== ${day.date} [${day.dateKey}] ===
${day.events.map(e => `  - [${e.date}] ${e.title} (${e.startTime}-${e.endTime})`).join('\n')}`).join('\n')}
`;
      }

      if (context.reports.length > 0) {
        dayTrackerHistoryContext += `
📊 RELATÓRIOS DE ACOMPANHAMENTO (o que realmente aconteceu):
${context.reports.map(r => `
=== ${r.date} [${r.dateKey}] === (${r.completionRate.toFixed(0)}% concluído)
  Resumo: ${r.summary}
  ✓ Feito: ${r.completedTasks.length > 0 ? r.completedTasks.join(', ') : 'nada registrado'}
  ✗ Não feito: ${r.skippedTasks.length > 0 ? r.skippedTasks.join(', ') : 'nada registrado'}
  💡 Insights: ${r.insights.length > 0 ? r.insights.join('; ') : 'nenhum'}`).join('\n')}
`;
      }

      if (context.futureEvents.length > 0) {
        dayTrackerHistoryContext += `
📆 PRÓXIMOS DIAS (o que está planejado):
${context.futureEvents.map(day => `
=== ${day.date} [${day.dateKey}] ===
${day.events.map(e => `  - [${e.date}] ${e.title} (${e.startTime}-${e.endTime})`).join('\n')}`).join('\n')}
`;
      }

      // Build todos context for day tracker (same format as main chat)
      let dayTrackerTodosContext = 'Nenhuma tarefa pendente';
      if (context.todos.length > 0) {
        const now = new Date();

        const getCountdown = (deadlineISO: string | null) => {
          if (!deadlineISO) return 'Sem prazo definido';

          const deadline = new Date(deadlineISO);
          const diffMs = deadline.getTime() - now.getTime();

          if (diffMs < 0) {
            const hoursAgo = Math.abs(Math.floor(diffMs / (1000 * 60 * 60)));
            if (hoursAgo < 24) return `⚠️ ATRASADO há ${hoursAgo}h`;
            const daysAgo = Math.floor(hoursAgo / 24);
            return `⚠️ ATRASADO há ${daysAgo} dia${daysAgo > 1 ? 's' : ''}`;
          }

          const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
          if (hoursLeft < 24) return `🔴 Faltam ${hoursLeft}h - URGENTE`;

          const daysLeft = Math.floor(hoursLeft / 24);
          if (daysLeft === 1) return '🟠 Falta 1 dia';
          if (daysLeft <= 3) return `🟠 Faltam ${daysLeft} dias`;
          if (daysLeft <= 7) return `🟡 Faltam ${daysLeft} dias`;
          return `🟢 Faltam ${daysLeft} dias`;
        };

        dayTrackerTodosContext = context.todos.map(t => {
          const countdown = getCountdown(t.deadlineISO);
          const duration = t.estimatedMinutes ? ` | ~${t.estimatedMinutes} min` : '';
          const deadlineDate = t.deadline ? ` (${t.deadline})` : '';
          return `- ${countdown}${deadlineDate}: ${t.content}${duration}`;
        }).join('\n');
      }

      // Day tracker uses a different prompt focused on day accompaniment
      const dayTrackerPrompt = DAY_TRACKER_PROMPT
        .replace('{{DATE}}', dayTrackerContext.date ? format(new Date(dayTrackerContext.date), "EEEE, d 'de' MMMM", { locale: ptBR }) : context.today)
        .replace('{{CURRENT_TIME}}', context.currentTime)
        .replace('{{EVENTS}}', dayTrackerContext.events || 'Nenhum evento planejado')
        .replace('{{MEMORIES}}', dayTrackerContext.memories || 'Nenhuma memória')
        .replace('{{ORIENTATIONS}}', dayTrackerContext.orientations || 'Nenhuma orientação')
        .replace('{{TODOS}}', dayTrackerTodosContext)
        .replace('{{HISTORY}}', dayTrackerHistoryContext || 'Nenhum histórico disponível ainda.');

      // Build user message parts with optional images
      const userMessageParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: message }
      ];

      // Add images if present
      if (images && images.length > 0) {
        for (const img of images as Array<{ base64: string; mimeType: string }>) {
          userMessageParts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.base64,
            }
          });
        }
      }

      contents = [
        {
          role: 'user',
          parts: [{ text: dayTrackerPrompt }],
        },
        {
          role: 'model',
          parts: [{ text: 'Olá! Estou aqui para acompanhar seu dia. Me conte o que você já fez ou está fazendo agora! 🎯' }],
        },
        // History from day tracker conversation
        ...history.slice(-20).map((msg: { role: string; content: string }) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })),
        {
          role: 'user',
          parts: userMessageParts,
        },
      ];
    } else {
      // Build user message parts with optional images
      const userMessageParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: message }
      ];

      // Add images if present
      if (images && images.length > 0) {
        for (const img of images as Array<{ base64: string; mimeType: string }>) {
          userMessageParts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.base64,
            }
          });
        }
      }

      // Regular calendar assistant
      contents = [
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
          parts: userMessageParts,
        },
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

    // Clean response - remove all code blocks (complete and incomplete)
    let cleanResponse = responseText
      .replace(/```actions\n[\s\S]*?```/g, '')
      .replace(/```json\n[\s\S]*?```/g, '')
      .replace(/```\n\[[\s\S]*?```/g, '')
      // Also remove incomplete code blocks at the end (no closing ```)
      .replace(/```actions\n[\s\S]*$/g, '')
      .replace(/```json\n[\s\S]*$/g, '')
      .replace(/```\n\[[\s\S]*$/g, '')
      // Remove any standalone JSON arrays that look like actions
      .replace(/\[\s*\{\s*"type"\s*:\s*"create"[\s\S]*$/g, '')
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
