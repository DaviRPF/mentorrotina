import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET - Buscar sessão específica
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    return NextResponse.json(session);
  } catch (error) {
    console.error('Error fetching day session:', error);
    return NextResponse.json({ error: 'Failed to fetch day session' }, { status: 500 });
  }
}

// PATCH - Atualizar sessão (ex: marcar como completa)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const session = await prisma.daySession.update({
      where: { id },
      data: {
        status: body.status,
      },
      include: {
        conversation: true,
        report: true,
      },
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error('Error updating day session:', error);
    return NextResponse.json({ error: 'Failed to update day session' }, { status: 500 });
  }
}

// DELETE - Deletar sessão
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.daySession.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting day session:', error);
    return NextResponse.json({ error: 'Failed to delete day session' }, { status: 500 });
  }
}
