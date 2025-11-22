import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get all messages in a conversation
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// POST - Add a message to conversation
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { role, content, pendingActions } = body;

    if (!role || !content) {
      return NextResponse.json(
        { error: 'Role and content are required' },
        { status: 400 }
      );
    }

    const message = await prisma.message.create({
      data: {
        role,
        content,
        conversationId: id,
        pendingActions: pendingActions ? JSON.stringify(pendingActions) : null,
      },
    });

    // Update conversation's updatedAt
    await prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    // Auto-generate title from first user message if it's "Nova conversa"
    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (conversation?.title === 'Nova conversa' && role === 'user') {
      const title = content.length > 50 ? content.substring(0, 50) + '...' : content;
      await prisma.conversation.update({
        where: { id },
        data: { title },
      });
    }

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json(
      { error: 'Failed to create message' },
      { status: 500 }
    );
  }
}
