import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET - List all memories
export async function GET() {
  try {
    const memories = await prisma.memory.findMany({
      where: { userSettingsId: 'default' },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      memories.map(m => ({
        id: m.id,
        content: m.content,
        createdAt: m.createdAt.getTime(),
        updatedAt: m.updatedAt.getTime(),
      }))
    );
  } catch (error) {
    console.error('Error fetching memories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch memories' },
      { status: 500 }
    );
  }
}

// POST - Create a new memory
export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // Ensure default settings exists
    await prisma.userSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });

    const memory = await prisma.memory.create({
      data: {
        content,
        userSettingsId: 'default',
      },
    });

    return NextResponse.json({
      id: memory.id,
      content: memory.content,
      createdAt: memory.createdAt.getTime(),
      updatedAt: memory.updatedAt.getTime(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating memory:', error);
    return NextResponse.json(
      { error: 'Failed to create memory' },
      { status: 500 }
    );
  }
}
