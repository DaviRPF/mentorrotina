import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { startOfDay, endOfDay } from 'date-fns';

const prisma = new PrismaClient();

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// POST - Gerar relatório do dia
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY não configurada' }, { status: 500 });
    }

    const { id } = await params;

    // Buscar sessão com conversa
    const session = await prisma.daySession.findUnique({
      where: { id },
      include: {
        conversation: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        report: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Buscar eventos planejados para o dia
    const dayStart = startOfDay(session.date);
    const dayEnd = endOfDay(session.date);

    const plannedEvents = await prisma.event.findMany({
      where: {
        startTime: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    // Preparar contexto da conversa COM HORÁRIOS
    const conversationText = session.conversation?.messages
      .map(m => {
        const time = new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return `[${time}] ${m.role === 'user' ? 'Usuário' : 'IA'}: ${m.content}`;
      })
      .join('\n\n') || 'Nenhuma conversa registrada';

    const eventsText = plannedEvents.length > 0
      ? plannedEvents.map(e => {
          const start = new Date(e.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          const end = new Date(e.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          return `- ${e.title} (${start} - ${end})`;
        }).join('\n')
      : 'Nenhum evento planejado';

    const prompt = `Analise esta conversa de acompanhamento do dia e gere um relatório estruturado.

DATA: ${session.date.toLocaleDateString('pt-BR')}

EVENTOS PLANEJADOS PARA O DIA (com horários):
${eventsText}

CONVERSA DE ACOMPANHAMENTO (com horários das mensagens):
${conversationText}

INSTRUÇÕES IMPORTANTES:
1. Compare os HORÁRIOS das mensagens do usuário com os HORÁRIOS dos eventos planejados
2. Identifique se as atividades foram feitas no horário planejado, com atraso, ou adiantadas
3. Liste o que foi feito e em que horário foi reportado
4. Liste o que estava planejado mas não foi mencionado como feito

Gere um relatório JSON com a seguinte estrutura:
{
  "summary": "Resumo geral do dia em 2-3 frases, incluindo observações sobre pontualidade",
  "completedTasks": ["lista de tarefas completadas COM o horário que foram feitas, ex: 'Academia (feito às 08:30, planejado 08:00)'"],
  "skippedTasks": ["lista de tarefas planejadas que não foram mencionadas como feitas"],
  "highlights": ["momentos positivos ou conquistas mencionados"],
  "challenges": ["dificuldades ou problemas enfrentados, incluindo atrasos significativos"],
  "insights": ["aprendizados sobre gestão de tempo e sugestões para dias futuros"],
  "completedEvents": número de eventos completados,
  "energyLevel": nível de energia percebido (1-5, null se não mencionado),
  "moodRating": humor percebido (1-5, null se não mencionado)
}

Responda APENAS com o JSON, sem markdown ou explicações.`;

    // Chamar API do Gemini
    const response = await fetch(
      `${GEMINI_API_URL}/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API error:', errorData);
      return NextResponse.json({ error: 'Erro ao chamar API do Gemini' }, { status: 500 });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse do JSON
    let reportData;
    try {
      const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim();
      reportData = JSON.parse(cleanedText);
    } catch {
      console.error('Failed to parse report JSON:', text);
      reportData = {
        summary: 'Relatório gerado automaticamente',
        completedTasks: [],
        skippedTasks: [],
        highlights: [],
        challenges: [],
        insights: [],
        completedEvents: 0,
        energyLevel: null,
        moodRating: null,
      };
    }

    // Deletar relatório antigo se existir
    if (session.report) {
      await prisma.dayReport.delete({
        where: { id: session.report.id },
      });
    }

    // Criar novo relatório
    const report = await prisma.dayReport.create({
      data: {
        daySessionId: id,
        summary: reportData.summary || '',
        completedTasks: JSON.stringify(reportData.completedTasks || []),
        skippedTasks: JSON.stringify(reportData.skippedTasks || []),
        highlights: JSON.stringify(reportData.highlights || []),
        challenges: JSON.stringify(reportData.challenges || []),
        insights: JSON.stringify(reportData.insights || []),
        plannedEvents: plannedEvents.length,
        completedEvents: reportData.completedEvents || 0,
        completionRate: plannedEvents.length > 0
          ? Math.round((reportData.completedEvents || 0) / plannedEvents.length * 100)
          : 0,
        energyLevel: reportData.energyLevel,
        moodRating: reportData.moodRating,
      },
    });

    // Marcar sessão como completa
    await prisma.daySession.update({
      where: { id },
      data: { status: 'completed' },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

// GET - Buscar relatório existente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const report = await prisma.dayReport.findFirst({
      where: { daySessionId: id },
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 });
  }
}
