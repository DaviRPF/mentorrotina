import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';

// GET - Lista todas as sessões ou busca por data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    if (dateParam) {
      // Buscar sessão de um dia específico
      const date = new Date(dateParam);
      const session = await prisma.daySession.findFirst({
        where: {
          date: {
            gte: startOfDay(date),
            lte: endOfDay(date),
          },
        },
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
      return NextResponse.json(session);
    }

    // Listar todas as sessões
    const sessions = await prisma.daySession.findMany({
      orderBy: { date: 'desc' },
      include: {
        report: true,
      },
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Error fetching day sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch day sessions' }, { status: 500 });
  }
}

// POST - Criar ou retornar sessão existente para um dia
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const date = new Date(body.date);

    // Verificar se já existe uma sessão para esse dia
    const existing = await prisma.daySession.findFirst({
      where: {
        date: {
          gte: startOfDay(date),
          lte: endOfDay(date),
        },
      },
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

    if (existing) {
      return NextResponse.json(existing);
    }

    // Criar nova conversa para a sessão
    const conversation = await prisma.conversation.create({
      data: {
        title: `Acompanhamento - ${date.toLocaleDateString('pt-BR')}`,
      },
    });

    // Criar nova sessão
    const session = await prisma.daySession.create({
      data: {
        date: startOfDay(date),
        conversationId: conversation.id,
      },
      include: {
        conversation: {
          include: {
            messages: true,
          },
        },
        report: true,
      },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('Error creating day session:', error);
    return NextResponse.json({ error: 'Failed to create day session' }, { status: 500 });
  }
}
