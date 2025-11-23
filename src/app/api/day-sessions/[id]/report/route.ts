import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { startOfDay, endOfDay } from 'date-fns';
import { callGeminiSimple } from '@/lib/ai/gemini-client';
import { buildReportPrompt, parseReport } from '@/lib/ai/prompts/report-generator';

const prisma = new PrismaClient();

// POST - Gerar relatório do dia
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const prompt = buildReportPrompt(
      session.date.toLocaleDateString('pt-BR'),
      eventsText,
      conversationText
    );

    const response = await callGeminiSimple(prompt, { temperature: 0.3, maxOutputTokens: 4096 });
    const reportData = parseReport(response);

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

// DELETE - Apagar relatório
export async function DELETE(
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

    await prisma.dayReport.delete({
      where: { id: report.id },
    });

    // Voltar status da sessão para 'active'
    await prisma.daySession.update({
      where: { id },
      data: { status: 'active' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting report:', error);
    return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 });
  }
}
